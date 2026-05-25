import { Router } from "express";
import { getMeFromAccessToken } from "../auth/service.js";
import { listProviderRepCalls } from "./providerRepCallsRepository.js";

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

async function requireAuth(req) {
  const token = getBearerToken(req);
  if (!token) {
    const err = new Error("Missing bearer token.");
    err.statusCode = 401;
    throw err;
  }
  const me = await getMeFromAccessToken(token);
  return { me };
}

function isAdminRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return value === "admin" || value === "super_admin" || value === "owner";
}

export const providerRepCallsRouter = Router();

providerRepCallsRouter.get("/", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const providerId = isAdminRole(me?.role)
      ? req.query?.provider_id
        ? String(req.query.provider_id)
        : undefined
      : String(me?.id || "");

    const upcomingOnly = String(req.query?.upcoming || "").toLowerCase() === "true";

    const rows = await listProviderRepCalls({
      providerId,
      manufacturerId: req.query?.manufacturer_id
        ? String(req.query.manufacturer_id)
        : undefined,
      upcomingOnly,
    });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});
