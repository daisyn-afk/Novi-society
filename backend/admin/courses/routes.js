import { Router } from "express";
import {
  createCourse,
  deleteCourse,
  getCourseById,
  listCourses,
  updateCourse
} from "./repository.js";
import { validateCourseInput } from "./validation.js";

export const coursesRouter = Router();

coursesRouter.get("/", async (req, res, next) => {
  try {
    const courses = await listCourses({ type: req.query.type });
    res.json(courses);
  } catch (error) {
    next(error);
  }
});

coursesRouter.get("/:id", async (req, res, next) => {
  try {
    const course = await getCourseById(req.params.id);
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json(course);
  } catch (error) {
    next(error);
  }
});

coursesRouter.post("/", async (req, res, next) => {
  try {
    const payload = validateCourseInput(req.body, { partial: false });
    const createdByEmail = req.headers["x-admin-email"] || null;
    const course = await createCourse(payload, createdByEmail);
    res.status(201).json(course);
  } catch (error) {
    next(error);
  }
});

coursesRouter.put("/:id", async (req, res, next) => {
  try {
    const existing = await getCourseById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Course not found" });

    const merged = { ...existing, ...req.body };
    const validated = validateCourseInput(merged, { partial: false });
    const updated = await updateCourse(req.params.id, validated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

coursesRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await deleteCourse(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Course not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

