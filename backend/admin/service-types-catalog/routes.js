import { Router } from "express";
import {
  createServiceType,
  deleteServiceType,
  getServiceTypeById,
  listServiceTypesForAdmin,
  updateServiceType
} from "./repository.js";

export const serviceTypesCatalogRouter = Router();

serviceTypesCatalogRouter.get("/", async (req, res, next) => {
  try {
    const raw = req.query?.is_active;
    const isActive =
      raw === "true" ? true : raw === "false" ? false : undefined;
    const rows = await listServiceTypesForAdmin({ isActive });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

serviceTypesCatalogRouter.get("/:id", async (req, res, next) => {
  try {
    const row = await getServiceTypeById(req.params.id);
    if (!row) return res.status(404).json({ error: "Service type not found" });
    res.json(row);
  } catch (error) {
    next(error);
  }
});

serviceTypesCatalogRouter.post("/", async (req, res, next) => {
  try {
    const row = await createServiceType(req.body || {});
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

serviceTypesCatalogRouter.put("/:id", async (req, res, next) => {
  try {
    const row = await updateServiceType(req.params.id, req.body || {});
    if (!row) return res.status(404).json({ error: "Service type not found" });
    res.json(row);
  } catch (error) {
    next(error);
  }
});

serviceTypesCatalogRouter.delete("/:id", async (req, res, next) => {
  try {
    const ok = await deleteServiceType(req.params.id);
    if (!ok) return res.status(404).json({ error: "Service type not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
