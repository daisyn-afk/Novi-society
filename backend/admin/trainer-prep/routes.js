import { Router } from "express";
import {
  createSupplyList,
  createSupplyItem,
  getTrainerPrepCourses,
  listSupplyLists,
  resetChecklistForCourse,
  setChecklistItemStatus
} from "./repository.js";

export const trainerPrepRouter = Router();

trainerPrepRouter.get("/supply-lists", async (_req, res, next) => {
  try {
    const lists = await listSupplyLists();
    res.json(lists);
  } catch (error) {
    next(error);
  }
});

trainerPrepRouter.post("/supply-lists", async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!name) return res.status(400).json({ error: "name is required" });
    const created = await createSupplyList({ name, items });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

trainerPrepRouter.post("/supply-lists/:id/items", async (req, res, next) => {
  try {
    const supplyListId = req.params.id;
    const itemName = String(req.body?.item_name || "").trim();
    const purchaseType = req.body?.purchase_type === "one_time" ? "one_time" : "every_course";
    const qty = req.body?.qty === null || req.body?.qty === undefined || req.body?.qty === "" ? null : Number(req.body.qty);
    if (!supplyListId || !itemName) {
      return res.status(400).json({ error: "supply list id and item_name are required" });
    }
    const created = await createSupplyItem({ supplyListId, itemName, purchaseType, qty });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

trainerPrepRouter.post("/courses", async (req, res, next) => {
  try {
    const courseIds = Array.isArray(req.body?.course_ids) ? req.body.course_ids : [];
    const rows = await getTrainerPrepCourses(courseIds);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

trainerPrepRouter.post("/progress", async (req, res, next) => {
  try {
    const scheduledCourseId = req.body?.scheduled_course_id;
    const supplyItemId = req.body?.supply_item_id;
    const isChecked = Boolean(req.body?.is_checked);
    if (!scheduledCourseId || !supplyItemId) {
      return res.status(400).json({ error: "scheduled_course_id and supply_item_id are required" });
    }
    await setChecklistItemStatus({ scheduledCourseId, supplyItemId, isChecked });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

trainerPrepRouter.post("/reset", async (req, res, next) => {
  try {
    const scheduledCourseId = req.body?.scheduled_course_id;
    if (!scheduledCourseId) {
      return res.status(400).json({ error: "scheduled_course_id is required" });
    }
    await resetChecklistForCourse(scheduledCourseId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
