import { Router } from "express";
import { getCourseRevenueStats, listCoursePayments } from "./repository.js";
import { requireAdminOrStaffWithModule } from "../auth/helpers.js";

export const coursePaymentsRouter = Router();
coursePaymentsRouter.use(requireAdminOrStaffWithModule("AdminPreOrders"));

coursePaymentsRouter.get("/stats", async (_req, res, next) => {
  try {
    const stats = await getCourseRevenueStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

coursePaymentsRouter.get("/", async (req, res, next) => {
  try {
    const limit = req.query?.limit;
    const rows = await listCoursePayments({ limit });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});
