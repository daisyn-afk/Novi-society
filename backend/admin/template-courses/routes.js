import { Router } from "express";
import {
  createTemplateCourse,
  deleteTemplateCourse,
  getTemplateCourseById,
  listTemplateCourses,
  updateTemplateCourse
} from "./repository.js";
import { validateTemplateInput } from "./validation.js";

export const templateCoursesRouter = Router();

function buildServiceTypeLookup(body) {
  const map = new Map();
  const list = body._service_types;
  if (Array.isArray(list)) {
    for (const st of list) {
      if (st?.id) map.set(st.id, st.name || st.id);
    }
  }
  for (const c of body.certifications_awarded || []) {
    if (c.service_type_id && c.service_type_name) {
      map.set(c.service_type_id, c.service_type_name);
    }
  }
  return map;
}

templateCoursesRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await listTemplateCourses();
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

templateCoursesRouter.get("/:id", async (req, res, next) => {
  try {
    const row = await getTemplateCourseById(req.params.id);
    if (!row) return res.status(404).json({ error: "Template not found" });
    res.json(row);
  } catch (error) {
    next(error);
  }
});

templateCoursesRouter.post("/", async (req, res, next) => {
  try {
    const validated = validateTemplateInput(req.body, { partial: false });
    const createdBy = req.headers["x-admin-email"] || null;
    const lookup = buildServiceTypeLookup(req.body);
    const row = await createTemplateCourse(validated, createdBy, lookup);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

templateCoursesRouter.put("/:id", async (req, res, next) => {
  try {
    const validated = validateTemplateInput(req.body, { partial: false });
    const lookup = buildServiceTypeLookup(req.body);
    const row = await updateTemplateCourse(req.params.id, validated, lookup);
    if (!row) return res.status(404).json({ error: "Template not found" });
    res.json(row);
  } catch (error) {
    next(error);
  }
});

templateCoursesRouter.delete("/:id", async (req, res, next) => {
  try {
    const ok = await deleteTemplateCourse(req.params.id);
    if (!ok) return res.status(404).json({ error: "Template not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
