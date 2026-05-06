import { Router } from "express";
import {
  createCourseCheckout,
  createServicePreOrder,
  getPreOrder,
  validateCoursePromoCode
} from "./service.js";

export const checkoutRouter = Router();

checkoutRouter.post("/course", async (req, res, next) => {
  try {
    const requestOrigin =
      req.get("origin") ||
      req.get("referer") ||
      `${req.get("x-forwarded-proto") || req.protocol}://${req.get("x-forwarded-host") || req.get("host")}`;
    const result = await createCourseCheckout(req.body || {}, { requestOrigin });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

checkoutRouter.post("/service", async (req, res, next) => {
  try {
    const result = await createServicePreOrder(req.body || {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

checkoutRouter.post("/promo/validate", async (req, res, next) => {
  try {
    const result = await validateCoursePromoCode({
      courseId: req.body?.course_id,
      promoCode: req.body?.promo_code
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

checkoutRouter.get("/pre-order", async (req, res, next) => {
  try {
    const data = await getPreOrder({
      id: req.query.id || null,
      sessionId: req.query.session_id || null
    });
    if (!data) return res.status(404).json({ error: "Pre-order not found." });
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});
