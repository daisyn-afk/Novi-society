import { Router } from "express";
import { listCoursePayments } from "./repository.js";
import { requireAdminOrStaffWithModule } from "../auth/helpers.js";

export const coursePaymentsRouter = Router();
coursePaymentsRouter.use(requireAdminOrStaffWithModule("AdminPreOrders"));

coursePaymentsRouter.get("/", async (req, res, next) => {
  try {
    const limit = req.query?.limit;
    const rows = await listCoursePayments({ limit });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});
