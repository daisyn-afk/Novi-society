import { Router } from "express";
import { backfillPaidEnrollments } from "./repository.js";

export const enrollmentsRouter = Router();

enrollmentsRouter.post("/repair", async (_req, res, next) => {
  try {
    const result = await backfillPaidEnrollments();
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});
