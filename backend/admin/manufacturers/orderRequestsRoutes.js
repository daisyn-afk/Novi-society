import { Router } from "express";
import { getMeFromAccessToken } from "../auth/service.js";
import {
  listManufacturerOrderInventoryLines,
  listManufacturerOrderRequests,
} from "./orderRequestsRepository.js";

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

export const manufacturerOrderRequestsRouter = Router();

manufacturerOrderRequestsRouter.get("/inventory-lines", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const providerId = isAdminRole(me?.role)
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
    const { me } = await requireAuth(req);
    const sortRaw = String(req.query?.sort || "-created_at");
    const sort = sortRaw.startsWith("-") ? sortRaw : `-${sortRaw}`;
    const providerId = isAdminRole(me?.role)
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
