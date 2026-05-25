import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";
import { validateBookingScope } from "../bookingValidation.js";

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

function mapAppointmentRow(row) {
  return {
    ...row,
    id: row.id,
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

    const sql = `select a.*, coalesce(st.requires_gfe, false) as requires_gfe
                   from public.appointments a
                   left join public.service_type st on st.id::text = a.service_type_id::text
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

    const validation = await validateBookingScope({ providerId, service });
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
        body.patient_email || me.email || null,
        body.patient_name || me.full_name || null,
        providerId,
        body.provider_email || null,
        body.provider_name || null,
        service,
        validation.service_type_id || body.service_type_id || null,
        appointmentDate,
        String(body.appointment_time || "09:00").trim() || "09:00",
        body.patient_notes || null,
        body.referral_code || null,
        String(body.status || "requested").trim() || "requested",
        initialGfeStatus,
      ]
    );
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
        `select a.*, coalesce(st.requires_gfe, false) as requires_gfe
           from public.appointments a
           left join public.service_type st on st.id::text = a.service_type_id::text
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
      `select a.*, coalesce(st.requires_gfe, false) as requires_gfe
         from public.appointments a
         left join public.service_type st on st.id::text = a.service_type_id::text
        where a.id = $1`,
      [id]
    );
    return res.json(mapAppointmentRow(enriched[0] || rows[0]));
  } catch (error) {
    return next(error);
  }
});
