import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";
import { validateBookingScope } from "../bookingValidation.js";
import {
  sendAppointmentConfirmedPatientEmail,
  sendAppointmentCancelledPatientEmail,
  sendAppointmentNoShowPatientEmail,
  notifyPatientAppointmentNoShow,
} from "../patientAppointmentEmails.js";

export const appointmentsRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function hasAdminAccess(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "super_admin" || normalized === "owner";
}

const APPOINTMENTS_SELECT = `select a.*,
       coalesce(st.name, st_by_name.name) as service_type_name,
       coalesce(st.requires_gfe, st_by_name.requires_gfe, false) as requires_gfe,
       pu.email as patient_user_email,
       pu.full_name as patient_user_name`;

const APPOINTMENTS_FROM = `from public.appointments a
       left join public.service_type st on st.id::text = a.service_type_id::text
       left join public.service_type st_by_name on a.service_type_id is null
         and lower(trim(coalesce(st_by_name.name, ''))) = lower(trim(coalesce(a.service, '')))
         and coalesce(st_by_name.requires_gfe, false) = true
       left join public.users pu on pu.auth_user_id::text = a.patient_id or pu.id::text = a.patient_id`;

async function resolvePatientContact(patientId, email, name) {
  let patientEmail = String(email || "").trim() || null;
  let patientName = String(name || "").trim() || null;
  const pid = String(patientId || "").trim();
  if (pid) {
    const { rows } = await query(
      `select auth_user_id, email, full_name from public.users
        where auth_user_id::text = $1 or id::text = $1
        limit 1`,
      [pid]
    );
    const user = rows[0];
    if (user) {
      // Account email is source of truth for transactional mail (appointment row may be stale).
      patientEmail = String(user.email || "").trim() || patientEmail;
      patientName = String(user.full_name || "").trim() || patientName;
    }
  }
  return { patientEmail, patientName };
}

async function resolvePatientNotifyUserId(patientId) {
  const pid = String(patientId || "").trim();
  if (!pid) return null;
  const { rows } = await query(
    `select auth_user_id::text as auth_user_id from public.users
      where auth_user_id::text = $1 or id::text = $1
      limit 1`,
    [pid]
  );
  return rows[0]?.auth_user_id || pid;
}

async function runAppointmentPatientNotifications({
  prevStatus,
  nextStatus,
  patientEmail,
  patientName,
  patientId,
  providerName,
  serviceLabel,
  appointmentDate,
  appointmentTime,
  providerId,
  cancelReason,
  wasRequest,
}) {
  const outcomes = {
    confirmed_email: null,
    cancelled_email: null,
    no_show_email: null,
    no_show_notification: null,
  };

  if (!patientEmail) {
    // eslint-disable-next-line no-console
    console.warn("[appointments] skipped patient emails — no patient email", { patientId, nextStatus });
    return outcomes;
  }

  const notifyUserId = await resolvePatientNotifyUserId(patientId);

  if (prevStatus !== "confirmed" && nextStatus === "confirmed") {
    try {
      await sendAppointmentConfirmedPatientEmail({
        to: patientEmail,
        patientName,
        providerName,
        serviceLabel,
        appointmentDate,
        appointmentTime,
      });
      outcomes.confirmed_email = "sent";
    } catch (err) {
      outcomes.confirmed_email = "failed";
      // eslint-disable-next-line no-console
      console.warn("[appointments] confirmed email failed:", err?.message || err);
    }
  }

  if (prevStatus !== "cancelled" && nextStatus === "cancelled") {
    try {
      await sendAppointmentCancelledPatientEmail({
        to: patientEmail,
        patientName,
        providerName,
        serviceLabel,
        appointmentDate,
        reason: cancelReason,
        wasRequest,
      });
      outcomes.cancelled_email = "sent";
    } catch (err) {
      outcomes.cancelled_email = "failed";
      // eslint-disable-next-line no-console
      console.warn("[appointments] cancelled email failed:", err?.message || err);
    }
  }

  if (prevStatus !== "no_show" && nextStatus === "no_show") {
    try {
      await sendAppointmentNoShowPatientEmail({
        to: patientEmail,
        patientName,
        providerName,
        serviceLabel,
        appointmentDate,
        appointmentTime,
        providerId,
      });
      outcomes.no_show_email = "sent";
      // eslint-disable-next-line no-console
      console.log("[appointments] no-show email sent to", patientEmail);
    } catch (err) {
      outcomes.no_show_email = "failed";
      // eslint-disable-next-line no-console
      console.warn("[appointments] no-show email failed:", err?.message || err);
    }

    try {
      const notif = await notifyPatientAppointmentNoShow({
        patientId: notifyUserId,
        patientEmail,
        providerName,
        serviceLabel,
        appointmentDate,
      });
      outcomes.no_show_notification = notif.sent ? "sent" : "skipped";
    } catch (err) {
      outcomes.no_show_notification = "failed";
      // eslint-disable-next-line no-console
      console.warn("[appointments] no-show notification failed:", err?.message || err);
    }
  }

  return outcomes;
}

function mapAppointmentRow(row) {
  const serviceTypeName = row.service_type_name != null ? String(row.service_type_name).trim() : "";
  const service = String(row.service || "").trim() || serviceTypeName;
  const patientEmail =
    String(row.patient_email || row.patient_user_email || "").trim() || null;
  const patientName =
    String(row.patient_name || row.patient_user_name || "").trim() || null;
  const { patient_user_email: _pe, patient_user_name: _pn, ...rest } = row;
  return {
    ...rest,
    id: row.id,
    patient_email: patientEmail,
    patient_name: patientName,
    service,
    service_type_name: serviceTypeName || row.service_type_name || null,
    requires_gfe: row.requires_gfe === true,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

const PATCH_ALLOWED = [
  "status",
  "appointment_date",
  "appointment_time",
  "patient_notes",
  "notes",
  "confirmed_at",
  "completed_at",
  "cancellation_reason",
  "gfe_status",
  "gfe_exam_url",
  "gfe_initiated_at",
  "treatment_record_id",
];

appointmentsRouter.get("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    const where = [];
    const params = [];
    const providerId = String(req.query.provider_id || "").trim();
    const patientId = String(req.query.patient_id || "").trim();
    const status = String(req.query.status || "").trim();

    if (hasAdminAccess(me.role)) {
      if (providerId) {
        params.push(providerId);
        where.push(`a.provider_id = $${params.length}`);
      }
      if (patientId) {
        params.push(patientId);
        where.push(`a.patient_id = $${params.length}`);
      }
    } else if (String(me.role || "").toLowerCase() === "patient") {
      params.push(me.id);
      where.push(`a.patient_id = $${params.length}`);
    } else {
      params.push(me.id);
      where.push(`a.provider_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      where.push(`a.status = $${params.length}`);
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    params.push(limit);
    const limitIdx = params.length;

    const sql = `${APPOINTMENTS_SELECT}
                   ${APPOINTMENTS_FROM}
                   ${where.length ? `where ${where.join(" and ")}` : ""}
                   order by a.appointment_date desc, a.created_at desc
                   limit $${limitIdx}`;
    const { rows } = await query(sql, params);
    return res.json((rows || []).map(mapAppointmentRow));
  } catch (error) {
    return next(error);
  }
});

appointmentsRouter.post("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const role = String(me.role || "").toLowerCase();
    if (role !== "patient" && !hasAdminAccess(me.role)) {
      return res.status(403).json({ error: "Only patients can request appointments." });
    }

    const body = req.body || {};
    const providerId = String(body.provider_id || "").trim();
    const service = String(body.service || "").trim();
    const appointmentDate = String(body.appointment_date || "").trim();
    if (!providerId || !service || !appointmentDate) {
      return res.status(400).json({ error: "provider_id, service, and appointment_date are required." });
    }

    const validation = await validateBookingScope({
      providerId,
      service,
      referral_code: body.referral_code,
    });
    if (!validation.eligible) {
      return res.status(400).json({
        eligible: false,
        reason: validation.reason || "Provider is not eligible for this service.",
      });
    }

    let initialGfeStatus = "not_required";
    if (validation.service_type_id) {
      const { rows: stRows } = await query(
        `select requires_gfe from public.service_type where id = $1 limit 1`,
        [validation.service_type_id]
      );
      if (stRows[0]?.requires_gfe === true) initialGfeStatus = "not_sent";
    }

    const patientId = hasAdminAccess(me.role) && body.patient_id ? String(body.patient_id) : me.id;
    const { patientEmail, patientName } = await resolvePatientContact(
      patientId,
      body.patient_email || me.email,
      body.patient_name || me.full_name
    );
    const { rows } = await query(
      `insert into public.appointments (
        patient_id, patient_email, patient_name,
        provider_id, provider_email, provider_name,
        service, service_type_id, appointment_date, appointment_time,
        patient_notes, referral_code, status, gfe_status
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      returning *`,
      [
        patientId,
        patientEmail,
        patientName,
        providerId,
        body.provider_email || null,
        body.provider_name || null,
        service,
        validation.service_type_id || body.service_type_id || null,
        appointmentDate,
        String(body.appointment_time || "09:00").trim() || "09:00",
        body.patient_notes || null,
        validation.referral_code || null,
        String(body.status || "requested").trim() || "requested",
        initialGfeStatus,
      ]
    );
    const createdId = rows[0]?.id;
    if (createdId) {
      const { rows: enriched } = await query(
        `${APPOINTMENTS_SELECT}
           ${APPOINTMENTS_FROM}
          where a.id = $1`,
        [createdId]
      );
      return res.status(201).json(mapAppointmentRow(enriched[0] || rows[0]));
    }
    return res.status(201).json(mapAppointmentRow(rows[0]));
  } catch (error) {
    return next(error);
  }
});

appointmentsRouter.patch("/:id", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const id = String(req.params.id || "").trim();
    const { rows: existingRows } = await query(`select * from public.appointments where id = $1 limit 1`, [id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Appointment not found." });

    const isOwner =
      existing.provider_id === me.id ||
      existing.patient_id === me.id ||
      hasAdminAccess(me.role);
    if (!isOwner) return res.status(403).json({ error: "Forbidden." });

    const updates = req.body || {};
    const setParts = [];
    const params = [id];
    for (const key of PATCH_ALLOWED) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        params.push(updates[key]);
        setParts.push(`${key} = $${params.length}`);
      }
    }
    if (!setParts.length) {
      const { rows: enriched } = await query(
        `${APPOINTMENTS_SELECT}
           ${APPOINTMENTS_FROM}
          where a.id = $1`,
        [id]
      );
      return res.json(mapAppointmentRow(enriched[0] || existing));
    }

    const { rows } = await query(
      `update public.appointments set ${setParts.join(", ")}, updated_at = now() where id = $1 returning *`,
      params
    );
    const { rows: enriched } = await query(
      `${APPOINTMENTS_SELECT}
         ${APPOINTMENTS_FROM}
        where a.id = $1`,
      [id]
    );
    const updated = mapAppointmentRow(enriched[0] || rows[0]);

    const prevStatus = String(existing.status || "").trim().toLowerCase();
    const nextStatus = String(updated.status || "").trim().toLowerCase();
    const cancelReason =
      updates.cancellation_reason != null ? String(updates.cancellation_reason) : String(existing.cancellation_reason || "");

    const { patientEmail, patientName } = await resolvePatientContact(
      updated.patient_id || existing.patient_id,
      updated.patient_email || existing.patient_email,
      updated.patient_name || existing.patient_name
    );

    const patientNotifications = await runAppointmentPatientNotifications({
      prevStatus,
      nextStatus,
      patientEmail,
      patientName,
      patientId: updated.patient_id || existing.patient_id,
      providerName: updated.provider_name || existing.provider_name,
      serviceLabel: updated.service || existing.service,
      appointmentDate: updated.appointment_date || existing.appointment_date,
      appointmentTime: updated.appointment_time || existing.appointment_time,
      providerId: updated.provider_id || existing.provider_id,
      cancelReason,
      wasRequest: prevStatus === "requested",
    });

    return res.json({ ...updated, patient_notifications: patientNotifications });
  } catch (error) {
    return next(error);
  }
});
