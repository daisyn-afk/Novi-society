import { Router } from "express";
import { getMeFromAccessToken } from "../auth/service.js";
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

async function requireAdmin(req) {
  const { me } = await requireAuth(req);
  if (!isAdminRole(me?.role)) {
    const err = new Error("Admin access required.");
    err.statusCode = 403;
    throw err;
  }
  return { me };
}

function parseBoolQuery(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

// ─── Manufacturers CRUD ───────────────────────────────────────────────────────

export const manufacturersRouter = Router();

manufacturersRouter.get("/", async (req, res, next) => {
  try {
    await requireAuth(req);
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
    await requireAuth(req);
    const row = await getManufacturerById(req.params.id);
    if (!row) return res.status(404).json({ error: "Manufacturer not found" });
    res.json(row);
  } catch (error) {
    next(error);
  }
});

manufacturersRouter.post("/", async (req, res, next) => {
  try {
    await requireAdmin(req);
    const row = await createManufacturer(req.body || {});
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

manufacturersRouter.put("/:id", async (req, res, next) => {
  try {
    await requireAdmin(req);
    const row = await updateManufacturer(req.params.id, req.body || {});
    if (!row) return res.status(404).json({ error: "Manufacturer not found" });
    res.json(row);
  } catch (error) {
    next(error);
  }
});

manufacturersRouter.patch("/:id", async (req, res, next) => {
  try {
    await requireAdmin(req);
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
    await requireAdmin(req);
    const ok = await deleteManufacturer(req.params.id);
    if (!ok) return res.status(404).json({ error: "Manufacturer not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ─── Manufacturer Applications ────────────────────────────────────────────────

export const manufacturerApplicationsRouter = Router();

manufacturerApplicationsRouter.get("/", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    // Non-admins can only see their own applications; admins see all.
    const sortRaw = String(req.query?.sort || "-submitted_at");
    const sort = sortRaw.startsWith("-") ? sortRaw.slice(1) : sortRaw;
    const providerIdRaw = req.query?.provider_id
      ? String(req.query.provider_id)
      : undefined;
    const providerId = isAdminRole(me?.role)
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
    const { me } = await requireAuth(req);
    const row = await getManufacturerApplicationById(req.params.id);
    if (!row) return res.status(404).json({ error: "Application not found" });
    if (!isAdminRole(me?.role) && String(row.provider_id || "") !== String(me?.id || "")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(row);
  } catch (error) {
    next(error);
  }
});

manufacturerApplicationsRouter.patch("/:id", async (req, res, next) => {
  try {
    const { me } = await requireAdmin(req);
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
