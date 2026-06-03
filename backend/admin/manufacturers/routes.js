import { Router } from "express";
import { hasAdminOrStaffModuleAccess, requireAuth } from "../auth/helpers.js";
import {
  createManufacturer,
  deleteManufacturer,
  getManufacturerById,
  listManufacturers,
  patchManufacturerActive,
  updateManufacturer,
  listManufacturerApplications,
  getManufacturerApplicationById,
  updateManufacturerApplication,
} from "./repository.js";

function canManageManufacturers(me) {
  return hasAdminOrStaffModuleAccess(me, "AdminManufacturers");
}

function parseBoolQuery(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

// ─── Manufacturers CRUD ───────────────────────────────────────────────────────

export const manufacturersRouter = Router();
manufacturersRouter.use(requireAuth);

manufacturersRouter.get("/", async (req, res, next) => {
  try {
    const rows = await listManufacturers({
      isActive: parseBoolQuery(req.query?.is_active),
      isFeatured: parseBoolQuery(req.query?.is_featured),
      category: req.query?.category ? String(req.query.category) : undefined,
    });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

manufacturersRouter.get("/:id", async (req, res, next) => {
  try {
    const row = await getManufacturerById(req.params.id);
    if (!row) return res.status(404).json({ error: "Manufacturer not found" });
    res.json(row);
  } catch (error) {
    next(error);
  }
});

manufacturersRouter.post("/", async (req, res, next) => {
  try {
    if (!canManageManufacturers(req.me)) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const row = await createManufacturer(req.body || {});
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

manufacturersRouter.put("/:id", async (req, res, next) => {
  try {
    if (!canManageManufacturers(req.me)) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const row = await updateManufacturer(req.params.id, req.body || {});
    if (!row) return res.status(404).json({ error: "Manufacturer not found" });
    res.json(row);
  } catch (error) {
    next(error);
  }
});

manufacturersRouter.patch("/:id", async (req, res, next) => {
  try {
    if (!canManageManufacturers(req.me)) {
      return res.status(403).json({ error: "Forbidden." });
    }
    // PATCH used by the admin list to flip is_active without a full payload.
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "is_active") &&
        Object.keys(req.body).length === 1) {
      const row = await patchManufacturerActive(req.params.id, req.body.is_active);
      if (!row) return res.status(404).json({ error: "Manufacturer not found" });
      return res.json(row);
    }
    const row = await updateManufacturer(req.params.id, req.body || {});
    if (!row) return res.status(404).json({ error: "Manufacturer not found" });
    res.json(row);
  } catch (error) {
    next(error);
  }
});

manufacturersRouter.delete("/:id", async (req, res, next) => {
  try {
    if (!canManageManufacturers(req.me)) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const ok = await deleteManufacturer(req.params.id);
    if (!ok) return res.status(404).json({ error: "Manufacturer not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ─── Manufacturer Applications ────────────────────────────────────────────────

export const manufacturerApplicationsRouter = Router();
manufacturerApplicationsRouter.use(requireAuth);

manufacturerApplicationsRouter.get("/", async (req, res, next) => {
  try {
    const me = req.me || {};
    // Non-admins can only see their own applications; admins see all.
    const sortRaw = String(req.query?.sort || "-submitted_at");
    const sort = sortRaw.startsWith("-") ? sortRaw.slice(1) : sortRaw;
    const providerIdRaw = req.query?.provider_id
      ? String(req.query.provider_id)
      : undefined;
    const providerId = canManageManufacturers(me)
      ? providerIdRaw
      : String(me?.id || "");
    const rows = await listManufacturerApplications({
      providerId,
      manufacturerId: req.query?.manufacturer_id
        ? String(req.query.manufacturer_id)
        : undefined,
      status: req.query?.status ? String(req.query.status) : undefined,
      sort,
    });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

manufacturerApplicationsRouter.get("/:id", async (req, res, next) => {
  try {
    const me = req.me || {};
    const row = await getManufacturerApplicationById(req.params.id);
    if (!row) return res.status(404).json({ error: "Application not found" });
    if (!canManageManufacturers(me) && String(row.provider_id || "") !== String(me?.id || "")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(row);
  } catch (error) {
    next(error);
  }
});

manufacturerApplicationsRouter.patch("/:id", async (req, res, next) => {
  try {
    const me = req.me || {};
    if (!canManageManufacturers(me)) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const row = await updateManufacturerApplication(req.params.id, {
      ...(req.body || {}),
      reviewed_by: req.body?.reviewed_by ?? me?.id ?? null,
    });
    if (!row) return res.status(404).json({ error: "Application not found" });
    res.json(row);
  } catch (error) {
    next(error);
  }
});
