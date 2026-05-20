import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";

export const patientJourneyRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function hasAdminAccess(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "super_admin" || normalized === "owner";
}

function rowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    patient_id: row.patient_id,
    patient_email: row.patient_email ?? "",
    tier: row.tier ?? "free",
    subscription_status: row.subscription_status ?? null,
    onboarding_completed: row.onboarding_completed === true,
    skin_concerns: Array.isArray(row.skin_concerns) ? row.skin_concerns : [],
    treatment_goals: Array.isArray(row.treatment_goals) ? row.treatment_goals : [],
    budget_comfort: row.budget_comfort ?? null,
    scans: Array.isArray(row.scans) ? row.scans : [],
    daily_checkins: Array.isArray(row.daily_checkins) ? row.daily_checkins : [],
    roadmap: row.roadmap ?? null,
    ai_score: row.ai_score != null ? Number(row.ai_score) : null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function requireUser(req) {
  const token = getBearerToken(req);
  if (!token) {
    const err = new Error("Missing bearer token.");
    err.statusCode = 401;
    throw err;
  }
  const me = await getMeFromAccessToken(token);
  return me;
}

patientJourneyRouter.get("/", async (req, res, next) => {
  try {
    const me = await requireUser(req);
    const patientId = String(req.query.patient_id || "").trim();
    if (!patientId) {
      if (!hasAdminAccess(me.role)) {
        const err = new Error("patient_id query parameter is required.");
        err.statusCode = 400;
        throw err;
      }
      const lim = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
      const { rows } = await query(
        `select * from public.patient_journeys order by updated_at desc nulls last limit $1`,
        [lim]
      );
      return res.json((rows || []).map(rowToApi));
    }
    if (!hasAdminAccess(me.role) && String(me.id) !== patientId) {
      const err = new Error("Forbidden.");
      err.statusCode = 403;
      throw err;
    }
    const { rows } = await query(
      `select * from public.patient_journeys where patient_id = $1 limit 5`,
      [patientId]
    );
    return res.json((rows || []).map(rowToApi));
  } catch (error) {
    return next(error);
  }
});

patientJourneyRouter.post("/", async (req, res, next) => {
  try {
    const me = await requireUser(req);
    const body = req.body || {};
    const patientId = String(body.patient_id || me.id).trim();
    if (!hasAdminAccess(me.role) && patientId !== String(me.id)) {
      const err = new Error("Forbidden.");
      err.statusCode = 403;
      throw err;
    }
    const { rows } = await query(
      `insert into public.patient_journeys (
        patient_id, patient_email, tier, subscription_status, onboarding_completed,
        skin_concerns, treatment_goals, budget_comfort, scans, daily_checkins, roadmap, ai_score
      ) values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12)
      on conflict (patient_id) do update set
        patient_email = excluded.patient_email,
        tier = excluded.tier,
        subscription_status = excluded.subscription_status,
        onboarding_completed = excluded.onboarding_completed,
        skin_concerns = excluded.skin_concerns,
        treatment_goals = excluded.treatment_goals,
        budget_comfort = excluded.budget_comfort,
        scans = excluded.scans,
        daily_checkins = excluded.daily_checkins,
        roadmap = excluded.roadmap,
        ai_score = excluded.ai_score,
        updated_at = now()
      returning *`,
      [
        patientId,
        body.patient_email || me.email || null,
        String(body.tier || "free"),
        body.subscription_status ?? null,
        Boolean(body.onboarding_completed),
        JSON.stringify(Array.isArray(body.skin_concerns) ? body.skin_concerns : []),
        JSON.stringify(Array.isArray(body.treatment_goals) ? body.treatment_goals : []),
        body.budget_comfort ?? null,
        JSON.stringify(Array.isArray(body.scans) ? body.scans : []),
        JSON.stringify(Array.isArray(body.daily_checkins) ? body.daily_checkins : []),
        body.roadmap != null ? JSON.stringify(body.roadmap) : null,
        body.ai_score != null && body.ai_score !== "" ? Number(body.ai_score) : null
      ]
    );
    return res.status(201).json(rowToApi(rows[0]));
  } catch (error) {
    return next(error);
  }
});

patientJourneyRouter.put("/:id", async (req, res, next) => {
  try {
    const me = await requireUser(req);
    const id = String(req.params.id || "").trim();
    if (!id) {
      const err = new Error("id is required.");
      err.statusCode = 400;
      throw err;
    }
    const existing = await query(`select * from public.patient_journeys where id = $1::uuid limit 1`, [id]);
    const row = existing.rows?.[0];
    if (!row) {
      const err = new Error("Patient journey not found.");
      err.statusCode = 404;
      throw err;
    }
    if (!hasAdminAccess(me.role) && String(row.patient_id) !== String(me.id)) {
      const err = new Error("Forbidden.");
      err.statusCode = 403;
      throw err;
    }
    const body = req.body || {};
    const nextTier = body.tier != null ? String(body.tier) : row.tier;
    const nextSub = Object.hasOwn(body, "subscription_status") ? body.subscription_status : row.subscription_status;
    const nextOnboarding =
      Object.hasOwn(body, "onboarding_completed") ? Boolean(body.onboarding_completed) : row.onboarding_completed;
    const nextConcerns = Array.isArray(body.skin_concerns) ? body.skin_concerns : row.skin_concerns;
    const nextGoals = Array.isArray(body.treatment_goals) ? body.treatment_goals : row.treatment_goals;
    const nextBudget = Object.hasOwn(body, "budget_comfort") ? body.budget_comfort : row.budget_comfort;
    const nextScans = Array.isArray(body.scans) ? body.scans : row.scans;
    const nextCheckins = Array.isArray(body.daily_checkins) ? body.daily_checkins : row.daily_checkins;
    const nextRoadmap = Object.hasOwn(body, "roadmap") ? body.roadmap : row.roadmap;
    const nextAiScore = Object.hasOwn(body, "ai_score") ? body.ai_score : row.ai_score;

    const { rows } = await query(
      `update public.patient_journeys set
        patient_email = coalesce($2, patient_email),
        tier = $3,
        subscription_status = $4,
        onboarding_completed = $5,
        skin_concerns = $6::jsonb,
        treatment_goals = $7::jsonb,
        budget_comfort = $8,
        scans = $9::jsonb,
        daily_checkins = $10::jsonb,
        roadmap = $11::jsonb,
        ai_score = $12,
        updated_at = now()
      where id = $1::uuid
      returning *`,
      [
        id,
        Object.hasOwn(body, "patient_email") ? body.patient_email : row.patient_email,
        nextTier,
        nextSub,
        nextOnboarding,
        JSON.stringify(nextConcerns || []),
        JSON.stringify(nextGoals || []),
        nextBudget,
        JSON.stringify(nextScans || []),
        JSON.stringify(nextCheckins || []),
        nextRoadmap != null ? JSON.stringify(nextRoadmap) : null,
        nextAiScore != null && nextAiScore !== "" ? Number(nextAiScore) : null
      ]
    );
    return res.json(rowToApi(rows[0]));
  } catch (error) {
    return next(error);
  }
});
