import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";
import { listEligibleMedicalDirectorsForService } from "../mdEligibleDirectors.js";

export const mdServiceOfferingsRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function isMdRole(role) {
  return String(role || "").trim().toLowerCase() === "medical_director";
}

/** Any authenticated user — same list the server uses for round-robin (reuse + client fallback). */
mdServiceOfferingsRouter.get("/eligible-for-service", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const serviceTypeId = String(req.query.service_type_id || "").trim();
    if (!serviceTypeId) {
      return res.status(400).json({ error: "service_type_id is required." });
    }
    const providerState = String(req.query.provider_state || me.state || "").trim() || null;
    const eligible = await listEligibleMedicalDirectorsForService(serviceTypeId, { providerState });
    return res.json({ ok: true, eligible });
  } catch (error) {
    return next(error);
  }
});

mdServiceOfferingsRouter.get("/me", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    if (!isMdRole(me.role)) {
      return res.status(403).json({ error: "Medical director access only." });
    }
    const mid = String(me.id || "").trim();
    const { rows } = await query(
      `select service_type_id
       from public.medical_director_service_offering
       where medical_director_id = $1
       order by service_type_id`,
      [mid]
    );
    return res.json({ service_type_ids: (rows || []).map((r) => String(r.service_type_id || "")) });
  } catch (error) {
    return next(error);
  }
});

mdServiceOfferingsRouter.put("/me", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    if (!isMdRole(me.role)) {
      return res.status(403).json({ error: "Medical director access only." });
    }
    const mid = String(me.id || "").trim();
    const rawIds = req.body?.service_type_ids;
    if (!Array.isArray(rawIds)) {
      return res.status(400).json({ error: "service_type_ids must be an array." });
    }
    let ids = [...new Set(rawIds.map((x) => String(x ?? "").trim()).filter(Boolean))];
    if (ids.includes("*")) {
      ids = ["*"];
    } else if (ids.length > 0) {
      const { rows: okRows } = await query(`select id from public.service_type where id = any($1::text[])`, [ids]);
      const valid = new Set((okRows || []).map((r) => String(r.id)));
      ids = ids.filter((id) => valid.has(id));
    }

    if (ids.length === 0) {
      await query(`delete from public.medical_director_service_offering where medical_director_id = $1`, [mid]);
      return res.json({ ok: true, service_type_ids: [] });
    }

    await query(
      `with deleted as (
         delete from public.medical_director_service_offering
         where medical_director_id = $1
       )
       insert into public.medical_director_service_offering (medical_director_id, service_type_id)
       select $1, x from unnest($2::text[]) as x`,
      [mid, ids]
    );
    return res.json({ ok: true, service_type_ids: ids });
  } catch (error) {
    return next(error);
  }
});
