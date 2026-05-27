import { Router } from "express";
import { hasAdminOrStaffModuleAccess, requireAuth } from "../auth/helpers.js";
import {
  getProviderManufacturerRep,
  listProviderManufacturerReps,
  upsertProviderManufacturerRep,
} from "./providerManufacturerRepsRepository.js";

function canManageManufacturers(me) {
  return hasAdminOrStaffModuleAccess(me, "AdminManufacturers");
}

export const providerManufacturerRepsRouter = Router();
providerManufacturerRepsRouter.use(requireAuth);

providerManufacturerRepsRouter.get("/", async (req, res, next) => {
  try {
    const me = req.me || {};
    const providerId = canManageManufacturers(me)
      ? req.query?.provider_id
        ? String(req.query.provider_id)
        : undefined
      : String(me?.id || "");

    const rows = await listProviderManufacturerReps({
      providerId,
      manufacturerId: req.query?.manufacturer_id
        ? String(req.query.manufacturer_id)
        : undefined,
    });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

providerManufacturerRepsRouter.get("/lookup", async (req, res, next) => {
  try {
    const me = req.me || {};
    const manufacturerId = String(req.query?.manufacturer_id || "").trim();
    if (!manufacturerId) {
      return res.status(400).json({ error: "manufacturer_id is required." });
    }

    const providerId = canManageManufacturers(me)
      ? String(req.query?.provider_id || me?.id || "")
      : String(me?.id || "");

    const row = await getProviderManufacturerRep({ providerId, manufacturerId });
    res.json(row);
  } catch (error) {
    next(error);
  }
});

providerManufacturerRepsRouter.put("/", async (req, res, next) => {
  try {
    const me = req.me || {};
    const body = req.body || {};
    const manufacturerId = String(body.manufacturer_id || "").trim();
    if (!manufacturerId) {
      return res.status(400).json({ error: "manufacturer_id is required." });
    }

    const providerId = canManageManufacturers(me)
      ? String(body.provider_id || body.providerId || me?.id || "").trim()
      : String(me?.id || "").trim();
    if (!providerId) {
      return res.status(400).json({ error: "provider_id is required." });
    }
    const row = await upsertProviderManufacturerRep({
      provider_id: providerId,
      manufacturer_id: manufacturerId,
      manufacturer_application_id: body.manufacturer_application_id || null,
      rep_name: body.rep_name || "",
      rep_email: body.rep_email || "",
      rep_phone: body.rep_phone || "",
    });
    res.json(row);
  } catch (error) {
    next(error);
  }
});
