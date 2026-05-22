import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";

export const reviewsRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function hasAdminAccess(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "super_admin" || normalized === "owner";
}

function mapReviewRow(row) {
  return {
    ...row,
    rating: row.rating != null ? Number(row.rating) : null,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

reviewsRouter.get("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    const where = [];
    const params = [];
    const providerId = String(req.query.provider_id || "").trim();
    const patientId = String(req.query.patient_id || "").trim();
    const isVerified = req.query.is_verified;
    const role = String(me.role || "").trim().toLowerCase();

    if (hasAdminAccess(me.role)) {
      if (providerId) {
        params.push(providerId);
        where.push(`provider_id = $${params.length}`);
      }
      if (patientId) {
        params.push(patientId);
        where.push(`patient_id = $${params.length}`);
      }
      if (isVerified === true || isVerified === "true") {
        where.push(`is_verified = true`);
      }
    } else if (role === "patient") {
      if (patientId && patientId !== me.id) {
        return res.status(403).json({ error: "Forbidden." });
      }
      if (patientId) {
        params.push(patientId);
        where.push(`patient_id = $${params.length}`);
      } else if (isVerified === true || isVerified === "true") {
        where.push(`is_verified = true`);
      } else {
        params.push(me.id);
        where.push(`patient_id = $${params.length}`);
      }
    } else {
      params.push(me.id);
      where.push(`provider_id = $${params.length}`);
      if (isVerified === true || isVerified === "true") {
        where.push(`is_verified = true`);
      }
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    params.push(limit);
    const limitIdx = params.length;

    const sql = `select *
                   from public.reviews
                   ${where.length ? `where ${where.join(" and ")}` : ""}
                   order by created_at desc
                   limit $${limitIdx}`;
    const { rows } = await query(sql, params).catch(() => ({ rows: [] }));
    return res.json((rows || []).map(mapReviewRow));
  } catch (error) {
    return next(error);
  }
});

reviewsRouter.post("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const role = String(me.role || "").trim().toLowerCase();
    if (role !== "patient" && !hasAdminAccess(me.role)) {
      return res.status(403).json({ error: "Only patients can submit reviews." });
    }

    const body = req.body || {};
    const appointmentId = String(body.appointment_id || "").trim();
    const rating = Number(body.rating);
    const comment = String(body.comment || "").trim();

    if (!appointmentId) {
      return res.status(400).json({ error: "appointment_id is required." });
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating must be between 1 and 5." });
    }

    const patientId = hasAdminAccess(me.role) && body.patient_id ? String(body.patient_id) : me.id;

    const { rows: apptRows } = await query(
      `select * from public.appointments where id = $1 limit 1`,
      [appointmentId]
    );
    const appt = apptRows[0];
    if (!appt) return res.status(404).json({ error: "Appointment not found." });
    if (String(appt.patient_id || "") !== String(patientId)) {
      return res.status(403).json({ error: "You can only review your own appointments." });
    }
    if (String(appt.status || "").toLowerCase() !== "completed") {
      return res.status(400).json({ error: "You can only review completed appointments." });
    }

    const { rows: dupRows } = await query(
      `select id from public.reviews where appointment_id = $1 limit 1`,
      [appointmentId]
    );
    if (dupRows.length) {
      return res.status(409).json({ error: "You have already reviewed this appointment." });
    }

    const { rows } = await query(
      `insert into public.reviews (
        provider_id, patient_id, patient_name, appointment_id,
        rating, comment, is_verified
      ) values ($1, $2, $3, $4, $5, $6, true)
      returning *`,
      [
        appt.provider_id,
        patientId,
        body.patient_name || me.full_name || appt.patient_name || null,
        appointmentId,
        rating,
        comment || null,
      ]
    );

    const review = rows[0];
    await query(
      `insert into public.notifications (user_id, user_email, type, message, link_page)
       values ($1, $2, 'general', $3, 'ProviderPractice')`,
      [
        appt.provider_id,
        appt.provider_email,
        `New ${rating}-star review from ${body.patient_name || me.full_name || "a patient"} for ${appt.service}.`,
      ]
    ).catch(() => {});

    return res.status(201).json(mapReviewRow(review));
  } catch (error) {
    return next(error);
  }
});

reviewsRouter.patch("/:id", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const id = String(req.params.id || "").trim();
    const { rows: existingRows } = await query(`select * from public.reviews where id = $1 limit 1`, [id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Review not found." });
    if (existing.provider_id !== me.id && !hasAdminAccess(me.role)) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const body = req.body || {};
    const { rows } = await query(
      `update public.reviews
          set response = coalesce($2, response),
              responded_at = coalesce($3, responded_at),
              updated_at = now()
        where id = $1
        returning *`,
      [id, body.response ?? null, body.responded_at ?? new Date().toISOString()]
    );
    return res.json(mapReviewRow(rows[0]));
  } catch (error) {
    return next(error);
  }
});
