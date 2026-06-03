import { Router } from "express";
import { getMeFromAccessToken } from "../auth/service.js";
import { listActivePhases, replacePhase, getProviderLaunchChecklist, upsertProviderLaunchChecklist } from "./repository.js";

export const launchRoadmapRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function hasAdminAccess(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "super_admin" || normalized === "owner";
}

async function requireUser(req) {
  const token = getBearerToken(req);
  if (!token) {
    const err = new Error("Missing bearer token.");
    err.statusCode = 401;
    throw err;
  }
  return getMeFromAccessToken(token);
}

launchRoadmapRouter.get("/phases", async (req, res, next) => {
  try {
    await requireUser(req);
    const phases = await listActivePhases();
    res.json(phases);
  } catch (error) {
    next(error);
  }
});

launchRoadmapRouter.get("/progress", async (req, res, next) => {
  try {
    const me = await requireUser(req);
    const launch_checklist = await getProviderLaunchChecklist(me.id);
    res.json({ provider_id: me.id, launch_checklist });
  } catch (error) {
    next(error);
  }
});

launchRoadmapRouter.patch("/progress", async (req, res, next) => {
  try {
    const me = await requireUser(req);
    if (!Object.prototype.hasOwnProperty.call(req.body || {}, "launch_checklist")) {
      return res.status(400).json({ error: "launch_checklist is required." });
    }
    const launch_checklist = await upsertProviderLaunchChecklist(me.id, req.body.launch_checklist);
    res.json({ provider_id: me.id, launch_checklist });
  } catch (error) {
    next(error);
  }
});

launchRoadmapRouter.put("/phases/:phaseId", async (req, res, next) => {
  try {
    const me = await requireUser(req);
    if (!hasAdminAccess(me.role)) {
      const err = new Error("Forbidden.");
      err.statusCode = 403;
      throw err;
    }
    const phase = await replacePhase(req.params.phaseId, req.body || {});
    if (!phase) {
      return res.status(404).json({ error: "Phase not found." });
    }
    return res.json(phase);
  } catch (error) {
    return next(error);
  }
});
