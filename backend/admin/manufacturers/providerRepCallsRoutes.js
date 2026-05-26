import { Router } from "express";
import { hasAdminOrStaffModuleAccess, requireAuth } from "../auth/helpers.js";
import { listProviderRepCalls } from "./providerRepCallsRepository.js";

function canManageManufacturers(me) {
  return hasAdminOrStaffModuleAccess(me, "AdminManufacturers");
}

export const providerRepCallsRouter = Router();
providerRepCallsRouter.use(requireAuth);

providerRepCallsRouter.get("/", async (req, res, next) => {
  try {
    const me = req.me || {};
    const providerId = canManageManufacturers(me)
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
