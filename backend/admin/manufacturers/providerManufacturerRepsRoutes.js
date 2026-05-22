import { Router } from "express";
import { getMeFromAccessToken } from "../auth/service.js";
import {
  getProviderManufacturerRep,
  listProviderManufacturerReps,
  upsertProviderManufacturerRep,
} from "./providerManufacturerRepsRepository.js";

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

export const providerManufacturerRepsRouter = Router();

providerManufacturerRepsRouter.get("/", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const providerId = isAdminRole(me?.role)
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
    const { me } = await requireAuth(req);
    const manufacturerId = String(req.query?.manufacturer_id || "").trim();
    if (!manufacturerId) {
      return res.status(400).json({ error: "manufacturer_id is required." });
    }

    const providerId = isAdminRole(me?.role)
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
    const { me } = await requireAuth(req);
    const body = req.body || {};
    const manufacturerId = String(body.manufacturer_id || "").trim();
    if (!manufacturerId) {
      return res.status(400).json({ error: "manufacturer_id is required." });
    }

    const row = await upsertProviderManufacturerRep({
      provider_id: me?.id,
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
