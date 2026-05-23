import { Router } from "express";
import {
  createCourse,
  deleteCourse,
  getCourseById,
  listCourses,
  updateCourse
} from "./repository.js";
import { validateCourseInput } from "./validation.js";
import { getMeFromAccessToken } from "../auth/service.js";
import { getBearerTokenFromRequest, hasAdminAccess, hasStaffModuleAccess } from "../auth/helpers.js";

export const coursesRouter = Router();

async function getOptionalAuthUser(req) {
  const token = getBearerTokenFromRequest(req);
  if (!token) return null;
  return getMeFromAccessToken(token);
}

coursesRouter.get("/", async (req, res, next) => {
  try {
    const publicCatalog =
      req.query.public === "1" ||
      req.query.public === "true" ||
      req.query.catalog === "public";
    const me = await getOptionalAuthUser(req);

    if (!publicCatalog) {
      if (!me) {
        return res.status(401).json({ error: "Unauthorized." });
      }
      const role = String(me.role || "").trim().toLowerCase();
      const isAdmin = hasAdminAccess(role);
      const isStaffAllowed =
        hasStaffModuleAccess(me, "AdminEnrollments") ||
        hasStaffModuleAccess(me, "AdminModelSignups") ||
        hasStaffModuleAccess(me, "admincourses");
      if (!isAdmin && role === "staff" && !isStaffAllowed) {
        return res.status(403).json({ error: "Forbidden." });
      }
    }

    const courses = await listCourses({ type: req.query.type, publicCatalog });
    res.set("Cache-Control", "no-store, max-age=0");
    res.json(courses);
  } catch (error) {
    next(error);
  }
});

coursesRouter.get("/:id", async (req, res, next) => {
  try {
    const me = await getOptionalAuthUser(req);
    if (!me) return res.status(401).json({ error: "Unauthorized." });
    const role = String(me.role || "").trim().toLowerCase();
    if (
      role === "staff" &&
      !hasStaffModuleAccess(me, "AdminEnrollments") &&
      !hasStaffModuleAccess(me, "AdminModelSignups") &&
      !hasStaffModuleAccess(me, "admincourses")
    ) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const course = await getCourseById(req.params.id);
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json(course);
  } catch (error) {
    next(error);
  }
});

coursesRouter.post("/", async (req, res, next) => {
  try {
    const me = await getOptionalAuthUser(req);
    if (!me || (!hasAdminAccess(me.role) && !hasStaffModuleAccess(me, "admincourses"))) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const payload = validateCourseInput(req.body, { partial: false });
    const createdByEmail = me.email || req.headers["x-admin-email"] || null;
    const course = await createCourse(payload, createdByEmail);
    res.status(201).json(course);
  } catch (error) {
    next(error);
  }
});

coursesRouter.put("/:id", async (req, res, next) => {
  try {
    const me = await getOptionalAuthUser(req);
    if (!me || (!hasAdminAccess(me.role) && !hasStaffModuleAccess(me, "admincourses"))) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const existing = await getCourseById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Course not found" });

    const merged = { ...existing, ...req.body };
    const validated = validateCourseInput(merged, {
      partial: false,
      previousSessionDates: existing.session_dates
    });
    const updated = await updateCourse(req.params.id, validated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

coursesRouter.delete("/:id", async (req, res, next) => {
  try {
    const me = await getOptionalAuthUser(req);
    if (!me || (!hasAdminAccess(me.role) && !hasStaffModuleAccess(me, "admincourses"))) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const deleted = await deleteCourse(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Course not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

