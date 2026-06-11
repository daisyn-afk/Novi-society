import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";
import { validateBookingScope } from "../bookingValidation.js";
import {
  createAppointmentDepositCheckout,
  requestAppointmentDeposit,
  resolveProviderBookingDeposit,
  syncAppointmentDepositPayment,
  enrichAppointmentDepositFields,
} from "./paymentService.js";
import {
  createAppointmentTreatmentCheckout,
  previewTreatmentInvoice,
  requestAppointmentTreatmentPayment,
  syncAppointmentTreatmentPayment,
} from "./treatmentPaymentService.js";
import {
  assertGfePrerequisiteForAppointment,
  enrichAppointmentGfeFields,
  enrichAppointmentsGfeFields,
} from "../gfe/patientGfeService.js";
import {
  sendAppointmentConfirmedPatientEmail,
  sendAppointmentCancelledPatientEmail,
  sendAppointmentNoShowPatientEmail,
  notifyPatientAppointmentNoShow,
  notifyPatientAppointmentCancelled,
  notifyProviderAppointmentCancelled,
} from "../patientAppointmentEmails.js";
import { migratePreBookingMessagesToAppointment } from "../appointment-messages/migratePreBookingThread.js";
import { isAppointmentInPast } from "../lib/appointmentScheduling.js";
import {
  APPOINTMENT_QUALIPHY_EXAM_IDS_SQL,
  APPOINTMENT_REQUIRES_GFE_SQL,
  APPOINTMENT_SERVICE_TYPE_JOINS,
  resolveTreatmentServiceType,
} from "../lib/treatmentServiceType.js";

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
       coalesce(
         case when coalesce(st.is_membership, false) = false then st.name else null end,
         st_svc.name
       ) as service_type_name,
       ${APPOINTMENT_REQUIRES_GFE_SQL} as requires_gfe,
       coalesce(
         case when coalesce(st.is_membership, false) = false then st.category else null end,
         st_svc.category
       ) as service_type_category,
       ${APPOINTMENT_QUALIPHY_EXAM_IDS_SQL} as qualiphy_exam_ids,
       pu.email as patient_user_email,
       pu.full_name as patient_user_name`;

const APPOINTMENTS_FROM = `from public.appointments a
       ${APPOINTMENT_SERVICE_TYPE_JOINS}
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
  providerId,
  providerEmail,
  serviceLabel,
  appointmentDate,
  appointmentTime,
  cancelReason,
  wasRequest,
  cancelledBy,
}) {
  const outcomes = {
    confirmed_email: null,
    cancelled_email: null,
    cancelled_patient_notification: null,
    cancelled_provider_notification: null,
    no_show_email: null,
    no_show_notification: null,
  };

  const notifyUserId = await resolvePatientNotifyUserId(patientId);

  if (prevStatus !== "confirmed" && nextStatus === "confirmed") {
    if (!patientEmail) {
      // eslint-disable-next-line no-console
      console.warn("[appointments] skipped confirmed email — no patient email", { patientId });
    } else {
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
  }

  if (prevStatus !== "cancelled" && nextStatus === "cancelled") {
    const cancelledByPatient = cancelledBy === "patient";
    const cancelledByProvider = cancelledBy === "provider" || cancelledBy === "admin";

    if (cancelledByProvider && patientEmail) {
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

    if (cancelledByProvider) {
      try {
        const notif = await notifyPatientAppointmentCancelled({
          patientId: notifyUserId,
          patientEmail,
          providerName,
          serviceLabel,
          appointmentDate,
          wasRequest,
        });
        outcomes.cancelled_patient_notification = notif.sent ? "sent" : "skipped";
      } catch (err) {
        outcomes.cancelled_patient_notification = "failed";
        // eslint-disable-next-line no-console
        console.warn("[appointments] cancelled patient notification failed:", err?.message || err);
      }
    }

    if (cancelledByPatient) {
      try {
        const notif = await notifyProviderAppointmentCancelled({
          providerId,
          providerEmail,
          patientName,
          serviceLabel,
          appointmentDate,
        });
        outcomes.cancelled_provider_notification = notif.sent ? "sent" : "skipped";
      } catch (err) {
        outcomes.cancelled_provider_notification = "failed";
        // eslint-disable-next-line no-console
        console.warn("[appointments] cancelled provider notification failed:", err?.message || err);
      }
    }
  }

  if (prevStatus !== "no_show" && nextStatus === "no_show") {
    if (!patientEmail) {
      // eslint-disable-next-line no-console
      console.warn("[appointments] skipped no-show email — no patient email", { patientId });
    } else {
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
  const {
    patient_user_email: _pe,
    patient_user_name: _pn,
    service_type_category: _stc,
    ...rest
  } = row;

  return {
    ...rest,
    id: row.id,
    patient_email: patientEmail,
    patient_name: patientName,
    service,
    service_type_name: serviceTypeName || row.service_type_name || null,
    service_type_category: row.service_type_category || null,
    requires_gfe: row.requires_gfe === true,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

async function enrichAppointmentForClient(appointment) {
  const withGfe = await enrichAppointmentGfeFields(mapAppointmentRow(appointment));
  return enrichAppointmentDepositFields(withGfe);
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
  "deposit_amount",
  "total_amount",
  "amount_paid",
  "payment_status",
  "consent_signed",
  "duration_minutes",
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
    const mapped = (rows || []).map((row) => mapAppointmentRow(row));
    const withGfe = await enrichAppointmentsGfeFields(mapped);
    const enriched = await Promise.all(withGfe.map((row) => enrichAppointmentDepositFields(row)));
    return res.json(enriched);
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
    const appointmentTime = String(body.appointment_time || "09:00").trim() || "09:00";
    if (!providerId || !service || !appointmentDate) {
      return res.status(400).json({ error: "provider_id, service, and appointment_date are required." });
    }
    if (isAppointmentInPast(appointmentDate, appointmentTime)) {
      return res.status(400).json({ error: "Appointment date and time cannot be in the past." });
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
    const treatmentSvc = await resolveTreatmentServiceType(query, {
      serviceName: service,
      serviceTypeId: validation.service_type_id,
    });
    if (treatmentSvc?.requires_gfe === true) initialGfeStatus = "not_sent";

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
        appointmentTime,
        body.patient_notes || null,
        validation.referral_code || null,
        String(body.status || "requested").trim() || "requested",
        initialGfeStatus,
      ]
    );
    const createdId = rows[0]?.id;
    if (createdId) {
      try {
        await migratePreBookingMessagesToAppointment(query, {
          providerId,
          patientId,
          appointmentId: createdId,
        });
      } catch (migrateErr) {
        console.warn(
          "[appointments] pre-booking message migration failed:",
          migrateErr?.message || migrateErr
        );
      }

      const { rows: enriched } = await query(
        `${APPOINTMENTS_SELECT}
           ${APPOINTMENTS_FROM}
          where a.id = $1`,
        [createdId]
      );
      return res.status(201).json(await enrichAppointmentForClient(enriched[0] || rows[0]));
    }
    return res.status(201).json(await enrichAppointmentForClient(rows[0]));
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

    const nextStatusRaw = Object.prototype.hasOwnProperty.call(updates, "status")
      ? String(updates.status || "").trim().toLowerCase()
      : null;
    const prevStatusRaw = String(existing.status || "").trim().toLowerCase();
    if (
      nextStatusRaw === "completed" &&
      Number(existing.deposit_amount) > 0 &&
      String(existing.payment_status || "").toLowerCase() !== "paid"
    ) {
      return res.status(400).json({
        error:
          "The patient must pay the booking deposit before you can mark this appointment complete or log treatment.",
      });
    }
    if (nextStatusRaw === "completed" && !hasAdminAccess(me.role)) {
      try {
        await assertGfePrerequisiteForAppointment(id);
      } catch (gfeError) {
        return res.status(gfeError?.statusCode || 409).json({ error: gfeError?.message || "GFE prerequisite not met." });
      }
    }
    const isProviderOwner =
      existing.provider_id === me.id && !hasAdminAccess(me.role);
    if (
      isProviderOwner &&
      prevStatusRaw === "requested" &&
      nextStatusRaw === "confirmed"
    ) {
      return res.status(400).json({
        error:
          "Use Confirm Appointment so the booking deposit is recorded on this visit.",
      });
    }
    if (
      nextStatusRaw === "awaiting_payment" &&
      prevStatusRaw !== "awaiting_payment" &&
      !Object.prototype.hasOwnProperty.call(updates, "deposit_amount") &&
      !(Number(existing.deposit_amount) > 0)
    ) {
      updates.deposit_amount = await resolveProviderBookingDeposit(existing.provider_id);
    }

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
      return res.json(await enrichAppointmentForClient(enriched[0] || existing));
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
    const updatedForClient = await enrichAppointmentForClient(enriched[0] || rows[0]);

    const prevStatus = String(existing.status || "").trim().toLowerCase();
    const nextStatus = String(updatedForClient.status || "").trim().toLowerCase();
    const cancelReason =
      updates.cancellation_reason != null ? String(updates.cancellation_reason) : String(existing.cancellation_reason || "");

    let cancelledBy = null;
    if (prevStatus !== "cancelled" && nextStatus === "cancelled") {
      if (existing.patient_id === me.id && !hasAdminAccess(me.role)) {
        cancelledBy = "patient";
      } else if (existing.provider_id === me.id && !hasAdminAccess(me.role)) {
        cancelledBy = "provider";
      } else if (hasAdminAccess(me.role)) {
        cancelledBy = "admin";
      }
    }

    const { patientEmail, patientName } = await resolvePatientContact(
      updatedForClient.patient_id || existing.patient_id,
      updatedForClient.patient_email || existing.patient_email,
      updatedForClient.patient_name || existing.patient_name
    );

    const patientNotifications = await runAppointmentPatientNotifications({
      prevStatus,
      nextStatus,
      patientEmail,
      patientName,
      patientId: updatedForClient.patient_id || existing.patient_id,
      providerName: updatedForClient.provider_name || existing.provider_name,
      providerId: updatedForClient.provider_id || existing.provider_id,
      providerEmail: updatedForClient.provider_email || existing.provider_email,
      serviceLabel: updatedForClient.service || existing.service,
      appointmentDate: updatedForClient.appointment_date || existing.appointment_date,
      appointmentTime: updatedForClient.appointment_time || existing.appointment_time,
      cancelReason,
      wasRequest: prevStatus === "requested",
      cancelledBy,
    });

    return res.json({ ...updatedForClient, patient_notifications: patientNotifications });
  } catch (error) {
    return next(error);
  }
});

/** Patient pays appointment deposit via Stripe Checkout. */
appointmentsRouter.post("/:id/deposit-checkout", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    const appointmentId = String(req.params.id || "").trim();
    const body = req.body || {};
    const clientTimestamp =
      req.get("x-novi-client-timestamp") || body.client_timestamp || null;
    const trackingSourceOrigin = req.get("origin") || req.get("referer") || null;
    const trackingRequestIp = (() => {
      const forwarded = req.get("x-forwarded-for");
      if (forwarded) return String(forwarded).split(",")[0].trim();
      return req.ip || req.socket?.remoteAddress || null;
    })();

    const result = await createAppointmentDepositCheckout({
      token,
      appointmentId,
      body,
      tracking: {
        clientTimestamp,
        sourceOrigin: trackingSourceOrigin,
        requestIp: trackingRequestIp,
        userAgent: req.get("user-agent") || null,
      },
    });
    return res.json(result);
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, sessionUrl: null });
    }
    return next(error);
  }
});

/** Patient: sync deposit after Stripe redirect (when webhook is delayed). */
appointmentsRouter.post("/:id/sync-deposit-payment", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    const appointmentId = String(req.params.id || "").trim();
    const stripeSessionId = String(req.body?.stripe_session_id || "").trim() || null;
    const updated = await syncAppointmentDepositPayment({
      token,
      appointmentId,
      stripeSessionId,
    });
    const { rows: enriched } = await query(
      `${APPOINTMENTS_SELECT}
         ${APPOINTMENTS_FROM}
        where a.id = $1`,
      [appointmentId]
    );
    return res.json(await enrichAppointmentForClient(enriched[0] || updated));
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return next(error);
  }
});

/** Provider preview treatment invoice from menu pricing + logged units/areas. */
appointmentsRouter.post("/:id/treatment-invoice-preview", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    const appointmentId = String(req.params.id || "").trim();
    const preview = await previewTreatmentInvoice({
      token,
      appointmentId,
      body: req.body || {},
    });
    return res.json(preview);
  } catch (error) {
    if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message });
    return next(error);
  }
});

/** Provider sends treatment balance invoice to patient. */
appointmentsRouter.post("/:id/request-treatment-payment", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    const appointmentId = String(req.params.id || "").trim();
    const updated = await requestAppointmentTreatmentPayment({
      token,
      appointmentId,
      body: req.body || {},
    });
    const { rows: enriched } = await query(
      `${APPOINTMENTS_SELECT}
         ${APPOINTMENTS_FROM}
        where a.id = $1`,
      [appointmentId]
    );
    return res.json(await enrichAppointmentForClient(enriched[0] || updated));
  } catch (error) {
    if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message });
    return next(error);
  }
});

/** Patient pays treatment balance via Stripe Checkout. */
appointmentsRouter.post("/:id/treatment-checkout", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    const appointmentId = String(req.params.id || "").trim();
    const body = req.body || {};
    const result = await createAppointmentTreatmentCheckout({
      token,
      appointmentId,
      body,
      tracking: {
        clientTimestamp: req.get("x-novi-client-timestamp") || body.client_timestamp || null,
        sourceOrigin: req.get("origin") || req.get("referer") || null,
        requestIp: (() => {
          const forwarded = req.get("x-forwarded-for");
          if (forwarded) return String(forwarded).split(",")[0].trim();
          return req.ip || req.socket?.remoteAddress || null;
        })(),
        userAgent: req.get("user-agent") || null,
      },
    });
    return res.json(result);
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, sessionUrl: null });
    }
    return next(error);
  }
});

/** Patient: sync treatment payment after Stripe redirect. */
appointmentsRouter.post("/:id/sync-treatment-payment", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    const appointmentId = String(req.params.id || "").trim();
    const stripeSessionId = String(req.body?.stripe_session_id || "").trim() || null;
    const updated = await syncAppointmentTreatmentPayment({
      token,
      appointmentId,
      stripeSessionId,
    });
    const { rows: enriched } = await query(
      `${APPOINTMENTS_SELECT}
         ${APPOINTMENTS_FROM}
        where a.id = $1`,
      [appointmentId]
    );
    return res.json(await enrichAppointmentForClient(enriched[0] || updated));
  } catch (error) {
    if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message });
    return next(error);
  }
});

/** Provider confirms request and asks patient to pay deposit. */
appointmentsRouter.post("/:id/request-deposit", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    const appointmentId = String(req.params.id || "").trim();
    const updated = await requestAppointmentDeposit({
      token,
      appointmentId,
      body: req.body || {},
    });
    const { rows: enriched } = await query(
      `${APPOINTMENTS_SELECT}
         ${APPOINTMENTS_FROM}
        where a.id = $1`,
      [appointmentId]
    );
    return res.json(await enrichAppointmentForClient(enriched[0] || updated));
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return next(error);
  }
});
