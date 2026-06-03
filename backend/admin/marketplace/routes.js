import { Router } from "express";
import { getMeFromAccessToken } from "../auth/service.js";
import { getMarketplaceProviderById, listMarketplaceProviders } from "./service.js";

export const marketplaceRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function canBrowseMarketplace(role) {
  const r = String(role || "").trim().toLowerCase();
  return r === "patient" || r === "admin" || r === "super_admin" || r === "owner";
}

marketplaceRouter.get("/providers", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    if (!canBrowseMarketplace(me.role)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const providerId = String(req.query.provider_id || "").trim();
    if (providerId) {
      const detail = await getMarketplaceProviderById(providerId);
      if (!detail) return res.status(404).json({ error: "Provider not found or not eligible for marketplace." });
      return res.json(detail);
    }

    const catalog = await listMarketplaceProviders();
    return res.json(catalog);
  } catch (error) {
    return next(error);
  }
});
