import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";
import { hasAdminAccess, hasAdminOrStaffModuleAccess } from "../auth/helpers.js";

export const reviewsRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function canModerateReviews(me) {
  return hasAdminAccess(me?.role) || hasAdminOrStaffModuleAccess(me, "AdminCompliance");
}

function mapReviewRow(row) {
  return {
    ...row,
    rating: row.rating != null ? Number(row.rating) : null,
    is_verified: row.is_verified === true,
    is_flagged: row.is_flagged === true,
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

    if (canModerateReviews(me)) {
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
        rating, comment
      ) values ($1, $2, $3, $4, $5, $6)
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
       values ($1, $2, 'general', $3, $4)`,
      [
        appt.provider_id,
        appt.provider_email,
        `New ${rating}-star review from ${body.patient_name || me.full_name || "a patient"} for ${appt.service} is awaiting admin approval.`,
        "ProviderPractice?tab=performance",
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

    const body = req.body || {};
    const isModerator = canModerateReviews(me);
    const isProvider = String(existing.provider_id || "") === String(me.id);

    const isModerationUpdate =
      isModerator &&
      (body.is_verified !== undefined ||
        body.is_flagged !== undefined ||
        body.flag_reason !== undefined);

    if (isModerationUpdate) {
      const isVerified =
        body.is_verified !== undefined ? body.is_verified === true : existing.is_verified === true;
      let isFlagged =
        body.is_flagged !== undefined ? body.is_flagged === true : existing.is_flagged === true;
      let flagReason =
        body.flag_reason !== undefined
          ? String(body.flag_reason || "").trim() || null
          : existing.flag_reason;

      if (isVerified && body.is_flagged === false) {
        isFlagged = false;
        flagReason = null;
      }
      if (body.is_verified === true && body.is_flagged === undefined) {
        isFlagged = false;
        flagReason = null;
      }

      const { rows } = await query(
        `update public.reviews
            set is_verified = $2,
                is_flagged = $3,
                flag_reason = $4,
                updated_at = now()
          where id = $1
          returning *`,
        [id, isVerified, isFlagged, flagReason]
      );
      return res.json(mapReviewRow(rows[0]));
    }

    if (isProvider && body.response !== undefined) {
      const { rows } = await query(
        `update public.reviews
            set response = $2,
                responded_at = coalesce($3, now()),
                updated_at = now()
          where id = $1
          returning *`,
        [id, body.response ? String(body.response) : null, body.responded_at || null]
      );
      return res.json(mapReviewRow(rows[0]));
    }

    if (!isModerator && !isProvider) {
      return res.status(403).json({ error: "Forbidden." });
    }
    return res.status(400).json({ error: "No valid fields to update." });
  } catch (error) {
    return next(error);
  }
});

reviewsRouter.delete("/:id", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    if (!canModerateReviews(me)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const id = String(req.params.id || "").trim();
    const { rowCount } = await query(`delete from public.reviews where id = $1`, [id]);
    if (!rowCount) return res.status(404).json({ error: "Review not found." });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});
