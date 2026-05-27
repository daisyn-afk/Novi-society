import { Router } from "express";
import { requireAdminOrStaffWithModule } from "../auth/helpers.js";
import { createClassSession, listClassSessions, updateClassSession } from "./repository.js";

export const classSessionsRouter = Router();
classSessionsRouter.use(requireAdminOrStaffWithModule("admincourses"));

classSessionsRouter.get("/", async (req, res, next) => {
  try {
    const rows = await listClassSessions(req.query || {});
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

classSessionsRouter.post("/", async (req, res, next) => {
  try {
    const created = await createClassSession(req.body || {});
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
});

classSessionsRouter.patch("/:id", async (req, res, next) => {
  try {
    const updated = await updateClassSession(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: "Class session not found." });
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});
