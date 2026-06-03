import { Router } from "express";
import { hasAdminOrStaffModuleAccess, requireAuth } from "../auth/helpers.js";
import {
  listManufacturerOrderInventoryLines,
  listManufacturerOrderRequests,
} from "./orderRequestsRepository.js";

function canManageManufacturers(me) {
  return hasAdminOrStaffModuleAccess(me, "AdminManufacturers");
}

export const manufacturerOrderRequestsRouter = Router();
manufacturerOrderRequestsRouter.use(requireAuth);

manufacturerOrderRequestsRouter.get("/inventory-lines", async (req, res, next) => {
  try {
    const me = req.me || {};
    const providerId = canManageManufacturers(me)
      ? req.query?.provider_id
        ? String(req.query.provider_id)
        : undefined
      : String(me?.id || "");

    const lines = await listManufacturerOrderInventoryLines({
      providerId,
      manufacturerId: req.query?.manufacturer_id
        ? String(req.query.manufacturer_id)
        : undefined,
      contactType: "order",
    });
    res.json(lines);
  } catch (error) {
    next(error);
  }
});

manufacturerOrderRequestsRouter.get("/", async (req, res, next) => {
  try {
    const me = req.me || {};
    const sortRaw = String(req.query?.sort || "-created_at");
    const sort = sortRaw.startsWith("-") ? sortRaw : `-${sortRaw}`;
    const providerId = canManageManufacturers(me)
      ? req.query?.provider_id
        ? String(req.query.provider_id)
        : undefined
      : String(me?.id || "");

    const rows = await listManufacturerOrderRequests({
      providerId,
      manufacturerId: req.query?.manufacturer_id
        ? String(req.query.manufacturer_id)
        : undefined,
      contactType: req.query?.contact_type
        ? String(req.query.contact_type)
        : undefined,
      sort,
    });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});
