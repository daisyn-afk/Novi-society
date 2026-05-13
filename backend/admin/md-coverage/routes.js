import { Router } from "express";
import { getMeFromAccessToken } from "../auth/service.js";
import {
  createMedicalDirectorRelationship,
  createNotification,
  deleteMedicalDirectorRelationship,
  getUserSetupWizardCompleted,
  listMedicalDirectorRelationships,
  listMdSubscriptions,
  listNotifications,
  setUserSetupWizardCompleted,
  updateMedicalDirectorRelationship,
  updateMdSubscription,
  updateNotification,
} from "./repository.js";

export const mdCoverageRouter = Router();

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

mdCoverageRouter.get("/md-subscriptions", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const filters = { ...req.query };
    const role = String(me.role || "").toLowerCase();
    if (!["admin", "super_admin", "owner", "medical_director"].includes(role)) {
      filters.provider_id = me.id;
    }
    const rows = await listMdSubscriptions(filters);
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

mdCoverageRouter.patch("/md-subscriptions/:id", async (req, res, next) => {
  try {
    await requireAuth(req);
    const row = await updateMdSubscription(String(req.params.id || ""), req.body || {});
    return res.json(row);
  } catch (error) {
    return next(error);
  }
});

mdCoverageRouter.get("/md-relationships", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const filters = { ...req.query };
    const role = String(me.role || "").toLowerCase();
    if (role === "medical_director") {
      filters.medical_director_id = me.id;
    } else if (!["admin", "super_admin", "owner"].includes(role)) {
      filters.provider_id = me.id;
    }
    const rows = await listMedicalDirectorRelationships(filters);
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

mdCoverageRouter.post("/md-relationships", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const row = await createMedicalDirectorRelationship({
      ...req.body,
      provider_id: req.body?.provider_id || me.id,
      provider_email: req.body?.provider_email || me.email,
      provider_name: req.body?.provider_name || me.full_name,
    });
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
});

mdCoverageRouter.patch("/md-relationships/:id", async (req, res, next) => {
  try {
    await requireAuth(req);
    const row = await updateMedicalDirectorRelationship(String(req.params.id || ""), req.body || {});
    return res.json(row);
  } catch (error) {
    return next(error);
  }
});

mdCoverageRouter.delete("/md-relationships/:id", async (req, res, next) => {
  try {
    await requireAuth(req);
    await deleteMedicalDirectorRelationship(String(req.params.id || ""));
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

mdCoverageRouter.get("/notifications", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const limit = Number(req.query.limit || 50);
    const sort = String(req.query.sort || "-created_at");
    const rows = await listNotifications(
      { user_id: me.id, user_email: me.email },
      { sort, limit }
    );
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

mdCoverageRouter.post("/notifications", async (req, res, next) => {
  try {
    await requireAuth(req);
    const row = await createNotification(req.body || {});
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
});

mdCoverageRouter.patch("/notifications/:id", async (req, res, next) => {
  try {
    await requireAuth(req);
    const row = await updateNotification(String(req.params.id || ""), req.body || {});
    return res.json(row);
  } catch (error) {
    return next(error);
  }
});

mdCoverageRouter.get("/provider-setup-wizard", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const completed = await getUserSetupWizardCompleted(me.id);
    return res.json({ setup_wizard_completed: completed });
  } catch (error) {
    return next(error);
  }
});

mdCoverageRouter.post("/provider-setup-wizard/complete", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const row = await setUserSetupWizardCompleted(me.id, true);
    return res.json({ success: true, setup_wizard_completed: Boolean(row?.setup_wizard_completed) });
  } catch (error) {
    return next(error);
  }
});
