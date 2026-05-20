import { Router } from "express";
import {
  createCourseCheckout,
  createServicePreOrder,
  getPreOrder,
  enrichPreOrderWithReturnContext,
  validateCoursePromoCode
} from "./service.js";

export const checkoutRouter = Router();

function getRequestIp(req) {
  const forwarded = req.get("x-forwarded-for");
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

function buildTrackingContext(req, defaultSourceContext) {
  return {
    source_context: req.get("x-novi-source-context") || req.body?.source_context || defaultSourceContext || null,
    source_origin: req.get("origin") || req.get("referer") || null,
    request_ip: getRequestIp(req),
    user_agent: req.get("user-agent") || null,
    // Optional ISO timestamp the frontend captured at the moment the user
    // clicked "Pay". Lets us detect stale frontend state by comparing it to
    // server_received_timestamp (set on arrival).
    client_timestamp:
      req.get("x-novi-client-timestamp") ||
      (typeof req.body?.client_timestamp === "string" ? req.body.client_timestamp : null) ||
      null,
    server_received_timestamp: new Date().toISOString()
  };
}

checkoutRouter.post("/course", async (req, res, next) => {
  try {
    const requestOrigin =
      req.get("origin") ||
      req.get("referer") ||
      `${req.get("x-forwarded-proto") || req.protocol}://${req.get("x-forwarded-host") || req.get("host")}`;
    const authorization = req.headers.authorization || "";
    const trackingContext = buildTrackingContext(req, "course_checkout");
    const result = await createCourseCheckout(req.body || {}, {
      requestOrigin,
      authorization,
      trackingContext
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

checkoutRouter.post("/service", async (req, res, next) => {
  try {
    const trackingContext = buildTrackingContext(req, "md_service_signup");
    const result = await createServicePreOrder(req.body || {}, { trackingContext });
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
    const enriched = await enrichPreOrderWithReturnContext(data, req.query.session_id || null);
    return res.json(enriched);
  } catch (error) {
    return next(error);
  }
});
