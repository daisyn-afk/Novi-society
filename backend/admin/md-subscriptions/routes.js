import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";

export const mdSubscriptionsRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function hasAdminAccess(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "super_admin" || normalized === "owner";
}

mdSubscriptionsRouter.get("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const providerIdFilter = String(req.query.provider_id || "").trim();

    if (hasAdminAccess(me.role)) {
      if (providerIdFilter) {
        const { rows } = await query(
          `select * from public.md_subscription
           where provider_id = $1
           order by created_at desc nulls last
           limit 200`,
          [providerIdFilter]
        );
        return res.json(rows || []);
      }
      const { rows } = await query(
        `select * from public.md_subscription
         order by created_at desc nulls last
         limit 500`
      );
      return res.json(rows || []);
    }

    const { rows } = await query(
      `select * from public.md_subscription
       where provider_id = $1
       order by created_at desc nulls last
       limit 200`,
      [me.id]
    );
    return res.json(rows || []);
  } catch (error) {
    return next(error);
  }
});

mdSubscriptionsRouter.post("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const body = req.body || {};
    const providerId = String(body.provider_id || "").trim() || me.id;
    if (!hasAdminAccess(me.role) && providerId !== me.id) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const serviceTypeId = String(body.service_type_id || "").trim();
    if (!serviceTypeId) {
      return res.status(400).json({ error: "service_type_id is required." });
    }
    const status = String(body.status || "active").trim() || "active";
    const { rows } = await query(
      `insert into public.md_subscription (
        provider_id, provider_email, provider_name, service_type_id, service_type_name,
        service_type_monthly_fee, status, signed_at, signed_by_name, activated_at, enrollment_id, signature_data
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning *`,
      [
        providerId,
        body.provider_email || me.email || null,
        body.provider_name || me.full_name || null,
        serviceTypeId,
        body.service_type_name || null,
        body.service_type_monthly_fee != null && String(body.service_type_monthly_fee).trim() !== ""
          ? Number(body.service_type_monthly_fee)
          : null,
        status,
        body.signed_at || null,
        body.signed_by_name || me.full_name || null,
        body.activated_at || null,
        body.enrollment_id != null && String(body.enrollment_id).trim() !== "" ? String(body.enrollment_id) : null,
        body.signature_data != null ? String(body.signature_data) : null
      ]
    );
    return res.status(201).json(rows[0]);
  } catch (error) {
    return next(error);
  }
});
