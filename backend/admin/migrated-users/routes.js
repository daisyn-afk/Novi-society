import { Router } from "express";
import {
  getPasswordSetupStatusForEmail,
  getPasswordSetupTrackingSummary,
  listPaidPreOrdersNeedingPasswordReset,
  sendPaidUserPasswordResetEmail
} from "./service.js";

export const migratedUsersRouter = Router();

migratedUsersRouter.post("/send-password-reset", async (req, res, next) => {
  try {
    const result = await sendPaidUserPasswordResetEmail({
      email: req.body?.email,
      customerName: req.body?.customer_name,
      frontendOrigin: req.body?.frontend_origin,
      requestOrigin: req.headers.origin || req.headers.referer
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

migratedUsersRouter.get("/tracking-summary", async (req, res, next) => {
  try {
    const summary = await getPasswordSetupTrackingSummary();
    return res.json(summary);
  } catch (error) {
    return next(error);
  }
});

migratedUsersRouter.get("/password-setup-status", async (req, res, next) => {
  try {
    const email = req.query?.email;
    const result = await getPasswordSetupStatusForEmail(email);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

migratedUsersRouter.get("/paid-pre-orders", async (req, res, next) => {
  try {
    const rows = await listPaidPreOrdersNeedingPasswordReset({ limit: req.query?.limit });
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});
