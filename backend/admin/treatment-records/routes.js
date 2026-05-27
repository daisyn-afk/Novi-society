import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";

export const treatmentRecordsRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function hasAdminAccess(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "super_admin" || normalized === "owner";
}

function isMedicalDirectorRole(role) {
  return String(role || "").trim().toLowerCase() === "medical_director";
}

const MD_REVIEW_STATUSES = new Set(["approved", "flagged", "changes_requested"]);

async function notifyProviderOfTreatmentRecordReview(record) {
  const status = String(record?.status || "").trim();
  if (!MD_REVIEW_STATUSES.has(status)) return;
  const service = String(record?.service || "treatment").trim();
  const patient = String(record?.patient_name || record?.patient_email || "patient").trim();
  const notes = String(record?.md_review_notes || "").trim();
  const messages = {
    approved: `Your MD approved your treatment record for ${service} (${patient}).`,
    flagged: `Your MD flagged your treatment record for ${service} (${patient}).${notes ? ` Notes: ${notes}` : ""}`,
    changes_requested: `Your MD requested changes on your treatment record for ${service} (${patient}).${notes ? ` Notes: ${notes}` : ""}`,
  };
  const types = {
    approved: "treatment_record_approved",
    flagged: "treatment_record_flagged",
    changes_requested: "treatment_record_changes_requested",
  };
  const message = messages[status];
  const type = types[status];
  if (!message || !record?.provider_id) return;
  await query(
    `insert into public.notifications (user_id, user_email, type, message, link_page)
     values ($1, $2, $3, $4, $5)`,
    [
      record.provider_id,
      record.provider_email || null,
      type,
      message,
      "ProviderPractice",
    ]
  ).catch(() => {});
}

function mapRow(row) {
  return {
    ...row,
    areas_treated: Array.isArray(row.areas_treated) ? row.areas_treated : [],
    products_used: Array.isArray(row.products_used) ? row.products_used : [],
    before_photo_urls: Array.isArray(row.before_photo_urls) ? row.before_photo_urls : [],
    after_photo_urls: Array.isArray(row.after_photo_urls) ? row.after_photo_urls : [],
    gfe_questions_answers: Array.isArray(row.gfe_questions_answers) ? row.gfe_questions_answers : [],
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

function buildPayload(body) {
  return {
    appointment_id: body.appointment_id || null,
    provider_id: body.provider_id,
    provider_email: body.provider_email || null,
    provider_name: body.provider_name || null,
    patient_id: body.patient_id || null,
    patient_email: body.patient_email || null,
    patient_name: body.patient_name || null,
    service: body.service || null,
    treatment_date: body.treatment_date || null,
    areas_treated: JSON.stringify(Array.isArray(body.areas_treated) ? body.areas_treated : []),
    products_used: JSON.stringify(Array.isArray(body.products_used) ? body.products_used : []),
    units_used: body.units_used != null ? String(body.units_used) : null,
    units_label: body.units_label || "units",
    clinical_notes: body.clinical_notes || null,
    adverse_reaction: Boolean(body.adverse_reaction),
    adverse_reaction_notes: body.adverse_reaction_notes || null,
    before_photo_urls: JSON.stringify(Array.isArray(body.before_photo_urls) ? body.before_photo_urls : []),
    after_photo_urls: JSON.stringify(Array.isArray(body.after_photo_urls) ? body.after_photo_urls : []),
    status: String(body.status || "draft").trim() || "draft",
    md_review_notes: body.md_review_notes || null,
    md_reviewed_by: body.md_reviewed_by || null,
    md_reviewed_at: body.md_reviewed_at || null,
    gfe_status: body.gfe_status || null,
    gfe_exam_url: body.gfe_exam_url || null,
    gfe_provider_name: body.gfe_provider_name || null,
    gfe_questions_answers: JSON.stringify(
      Array.isArray(body.gfe_questions_answers) ? body.gfe_questions_answers : []
    ),
  };
}

async function supervisedProviderIdsForMd(mdAuthUserId) {
  const { rows } = await query(
    `select provider_id::text as provider_id
       from public.medical_director_relationship
      where medical_director_id = $1
        and lower(status) = 'active'`,
    [mdAuthUserId]
  );
  return rows.map((r) => r.provider_id).filter(Boolean);
}

treatmentRecordsRouter.get("/", async (req, res, next) => {
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
        where.push(`provider_id = $${params.length}`);
      }
      if (patientId) {
        params.push(patientId);
        where.push(`patient_id = $${params.length}`);
      }
    } else if (isMedicalDirectorRole(me.role)) {
      const supervised = await supervisedProviderIdsForMd(me.id);
      if (providerId) {
        if (!supervised.includes(providerId)) {
          return res.status(403).json({ error: "Forbidden." });
        }
        params.push(providerId);
        where.push(`provider_id = $${params.length}`);
      } else if (supervised.length) {
        params.push(supervised);
        where.push(`provider_id = any($${params.length}::text[])`);
      } else {
        return res.json([]);
      }
    } else if (String(me.role || "").toLowerCase() === "patient") {
      params.push(me.id);
      where.push(`patient_id = $${params.length}`);
    } else {
      params.push(me.id);
      where.push(`provider_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    params.push(limit);
    const limitIdx = params.length;

    const { rows } = await query(
      `select * from public.treatment_records
       ${where.length ? `where ${where.join(" and ")}` : ""}
       order by treatment_date desc nulls last, created_at desc
       limit $${limitIdx}`,
      params
    );
    return res.json((rows || []).map(mapRow));
  } catch (error) {
    return next(error);
  }
});

treatmentRecordsRouter.post("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const body = req.body || {};
    const providerId = String(body.provider_id || "").trim() || me.id;
    if (!hasAdminAccess(me.role) && providerId !== me.id) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const p = buildPayload({ ...body, provider_id: providerId });
    const { rows } = await query(
      `insert into public.treatment_records (
        appointment_id, provider_id, provider_email, provider_name,
        patient_id, patient_email, patient_name, service, treatment_date,
        areas_treated, products_used, units_used, units_label,
        clinical_notes, adverse_reaction, adverse_reaction_notes,
        before_photo_urls, after_photo_urls, status,
        md_review_notes, md_reviewed_by, md_reviewed_at,
        gfe_status, gfe_exam_url, gfe_provider_name, gfe_questions_answers
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19,
        $20,$21,$22,$23,$24,$25,$26::jsonb
      ) returning *`,
      [
        p.appointment_id,
        p.provider_id,
        p.provider_email,
        p.provider_name,
        p.patient_id,
        p.patient_email,
        p.patient_name,
        p.service,
        p.treatment_date,
        p.areas_treated,
        p.products_used,
        p.units_used,
        p.units_label,
        p.clinical_notes,
        p.adverse_reaction,
        p.adverse_reaction_notes,
        p.before_photo_urls,
        p.after_photo_urls,
        p.status,
        p.md_review_notes,
        p.md_reviewed_by,
        p.md_reviewed_at,
        p.gfe_status,
        p.gfe_exam_url,
        p.gfe_provider_name,
        p.gfe_questions_answers,
      ]
    );
    const record = rows[0];
    if (record?.appointment_id) {
      await query(
        `update public.appointments
            set treatment_record_id = $2, updated_at = now()
          where id = $1`,
        [record.appointment_id, record.id]
      );
    }
    return res.status(201).json(mapRow(record));
  } catch (error) {
    return next(error);
  }
});

treatmentRecordsRouter.patch("/:id", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const id = String(req.params.id || "").trim();
    const { rows: existingRows } = await query(
      `select * from public.treatment_records where id = $1 limit 1`,
      [id]
    );
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Treatment record not found." });

    const role = String(me.role || "").toLowerCase();
    let canEdit =
      existing.provider_id === me.id ||
      hasAdminAccess(me.role);
    if (!canEdit && isMedicalDirectorRole(me.role)) {
      const supervised = await supervisedProviderIdsForMd(me.id);
      canEdit = supervised.includes(String(existing.provider_id || ""));
    }
    if (!canEdit) return res.status(403).json({ error: "Forbidden." });

    const body = req.body || {};
    const allowed = [
      "areas_treated", "products_used", "units_used", "units_label", "clinical_notes",
      "adverse_reaction", "adverse_reaction_notes", "before_photo_urls", "after_photo_urls",
      "status", "md_review_notes", "md_reviewed_by", "md_reviewed_at",
      "gfe_status", "gfe_exam_url", "gfe_provider_name", "gfe_questions_answers",
      "treatment_date", "service",
    ];
    const setParts = [];
    const params = [id];
    for (const key of allowed) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
      params.push(
        ["areas_treated", "products_used", "before_photo_urls", "after_photo_urls", "gfe_questions_answers"].includes(key)
          ? JSON.stringify(Array.isArray(body[key]) ? body[key] : [])
          : body[key]
      );
      const cast = ["areas_treated", "products_used", "before_photo_urls", "after_photo_urls", "gfe_questions_answers"].includes(key)
        ? "::jsonb"
        : "";
      setParts.push(`${key} = $${params.length}${cast}`);
    }
    if (!setParts.length) return res.json(mapRow(existing));

    const { rows } = await query(
      `update public.treatment_records set ${setParts.join(", ")}, updated_at = now() where id = $1 returning *`,
      params
    );
    const updated = mapRow(rows[0]);
    const prevStatus = String(existing.status || "").trim();
    const nextStatus = String(updated.status || "").trim();
    const mdActed =
      (isMedicalDirectorRole(me.role) || hasAdminAccess(me.role)) &&
      Object.prototype.hasOwnProperty.call(body, "status");
    if (mdActed && prevStatus !== nextStatus && MD_REVIEW_STATUSES.has(nextStatus)) {
      await notifyProviderOfTreatmentRecordReview(updated);
    }
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});
