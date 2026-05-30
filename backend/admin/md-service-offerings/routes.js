import { Router } from "express";
import { pool, query } from "../db.js";
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

/** MD rows may use auth user id or legacy app users.id — resolve both for reads/writes. */
async function resolveMdIdentityIds(authUserId) {
  const authId = String(authUserId || "").trim();
  if (!authId) return [];
  const { rows } = await query(
    `select auth_user_id::text as auth_user_id, id::text as app_user_id
       from public.users
      where auth_user_id::text = $1 or id::text = $1
      limit 1`,
    [authId]
  );
  const aliases = new Set([authId]);
  const row = rows[0];
  if (row?.auth_user_id) aliases.add(String(row.auth_user_id));
  if (row?.app_user_id) aliases.add(String(row.app_user_id));
  return [...aliases];
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
    const mdIds = await resolveMdIdentityIds(mid);
    const { rows } = await query(
      `select distinct service_type_id
       from public.medical_director_service_offering
       where medical_director_id = any($1::text[])
       order by service_type_id`,
      [mdIds]
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
    const mdIds = await resolveMdIdentityIds(mid);
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
      await query(
        `delete from public.medical_director_service_offering where medical_director_id = any($1::text[])`,
        [mdIds]
      );
      return res.json({ ok: true, service_type_ids: [] });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `delete from public.medical_director_service_offering where medical_director_id = any($1::text[])`,
        [mdIds]
      );
      await client.query(
        `insert into public.medical_director_service_offering (medical_director_id, service_type_id)
         select $1, x
           from unnest($2::text[]) as x
         on conflict (medical_director_id, service_type_id) do nothing`,
        [mid, ids]
      );
      await client.query("COMMIT");
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore
      }
      throw err;
    } finally {
      client.release();
    }
    return res.json({ ok: true, service_type_ids: ids });
  } catch (error) {
    return next(error);
  }
});
