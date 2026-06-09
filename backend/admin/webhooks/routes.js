import express, { Router } from "express";
import { processCompletedCheckoutSession, verifyStripeWebhook } from "../checkout/service.js";
import { processModelCheckoutCompletedSession } from "../functions/routes.js";
import { processAppointmentCheckoutCompletedSession } from "../appointments/paymentService.js";
import { processAppointmentTreatmentCheckoutCompletedSession } from "../appointments/treatmentPaymentService.js";
import { processMdBoardStripeEvent } from "../mdBillingService.js";
import { recordStripeWebhookEvent } from "../payments/service.js";
import { handleQualiphyExamWebhook } from "../qualiphy/webhookHandler.js";
import {
  verifyStripeConnectWebhook,
  processStripeConnectWebhookEvent,
} from "../stripe-connect/webhookHandler.js";
import { isStripeConnectConfigured } from "../stripe-connect/config.js";

export const webhooksRouter = Router();

// Stripe event types we want to mirror into the centralized payment tracking
// tables. Any other events are still verified and acknowledged, but not
// persisted - keeping the surface area predictable.
const TRACKED_STRIPE_EVENT_TYPES = new Set([
  "checkout.session.created",
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "payment_intent.created",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "payment_intent.processing",
  "payment_intent.requires_action",
  "charge.succeeded",
  "charge.failed",
  "charge.refunded",
  "charge.captured",
  "charge.dispute.created",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted"
]);

// Qualiphy sends JSON; mount parser here because this router is registered before app-level express.json().
webhooksRouter.post("/qualiphy", express.json({ limit: "1mb" }), handleQualiphyExamWebhook);

webhooksRouter.post("/stripe-connect", async (req, res, next) => {
  try {
    if (!isStripeConnectConfigured()) {
      return res.status(503).json({ error: "Stripe Connect webhooks are not configured." });
    }

    const signatureHeader = req.headers["stripe-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) {
      return res.status(400).send("Missing stripe-signature header.");
    }
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).send("Webhook body was pre-parsed; raw bytes required for signature verification.");
    }

    let event;
    try {
      event = verifyStripeConnectWebhook(req.body, signature);
    } catch (verifyError) {
      // eslint-disable-next-line no-console
      console.error("[webhook/stripe-connect] signature verification FAILED:", verifyError?.message || verifyError);
      return res.status(400).send(`Signature verification failed: ${verifyError?.message || "unknown"}`);
    }

    await processStripeConnectWebhookEvent(event);
    // eslint-disable-next-line no-console
    console.log("[webhook/stripe-connect] processed", event.type, event.id);
    return res.json({ received: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[webhook/stripe-connect] handler threw:", error?.message || error);
    return next(error);
  }
});

webhooksRouter.post("/stripe", async (req, res, next) => {
  try {
    const signatureHeader = req.headers["stripe-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) {
      // eslint-disable-next-line no-console
      console.warn("[webhook/stripe] rejected: missing stripe-signature header");
      return res.status(400).send("Missing stripe-signature header.");
    }

    // express.raw() should have delivered a Buffer. If a misconfigured platform
    // (e.g. Vercel without `bodyParser: false`) parses the JSON first, req.body
    // will be a plain object — in which case constructEvent always fails with
    // a confusing "no signatures matching" message. Catch that up front.
    if (!Buffer.isBuffer(req.body)) {
      // eslint-disable-next-line no-console
      console.error(
        "[webhook/stripe] rejected: req.body is not a Buffer (got %s). " +
          "Check that the host runtime does NOT pre-parse the body — on Vercel set " +
          "`api.bodyParser = false` in api/index.js so express.raw() can capture the raw bytes.",
        typeof req.body
      );
      return res.status(400).send("Webhook body was pre-parsed; raw bytes required for signature verification.");
    }

    let event;
    try {
      event = verifyStripeWebhook(req.body, signature);
    } catch (verifyError) {
      // eslint-disable-next-line no-console
      console.error("[webhook/stripe] signature verification FAILED:", verifyError?.message || verifyError);
      return res.status(400).send(`Signature verification failed: ${verifyError?.message || "unknown"}`);
    }

    // Always record every tracked event into the centralized tracker first.
    // recordStripeWebhookEvent is fail-soft, idempotent (by stripe event id),
    // and will not throw - so it cannot break existing business flows.
    if (TRACKED_STRIPE_EVENT_TYPES.has(event.type)) {
      await recordStripeWebhookEvent(event);
    }

    // eslint-disable-next-line no-console
    console.log("[webhook/stripe] processed", event.type, event.id);

    // Continue running existing business handlers so we don't disrupt the
    // current behaviour (enrollment creation, seat decrement, emails, etc.).
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const checkoutType = String(session?.metadata?.checkout_type || "").toLowerCase();
      if (checkoutType === "model") {
        await processModelCheckoutCompletedSession(session);
      } else if (checkoutType === "appointment") {
        await processAppointmentCheckoutCompletedSession(session);
      } else if (checkoutType === "appointment_treatment") {
        await processAppointmentTreatmentCheckoutCompletedSession(session);
      } else if (checkoutType === "md_board_coverage") {
        await processMdBoardStripeEvent(event);
      } else if (checkoutType === "patient_journey_premium") {
        const { activatePatientJourneyFromStripeSession } = await import("../patient-journey/subscriptionService.js");
        await activatePatientJourneyFromStripeSession(session);
      } else {
        await processCompletedCheckoutSession(session);
      }
    } else if (event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      const asyncType = String(session?.metadata?.checkout_type || "").toLowerCase();
      if (asyncType === "appointment") {
        await processAppointmentCheckoutCompletedSession(session);
      } else if (asyncType === "appointment_treatment") {
        await processAppointmentTreatmentCheckoutCompletedSession(session);
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const { processPatientJourneyStripeEvent } = await import("../patient-journey/subscriptionService.js");
      const patientResult = await processPatientJourneyStripeEvent(event);
      if (!patientResult?.skipped) {
        return res.json({ received: true });
      }
      await processMdBoardStripeEvent(event);
    } else {
      await processMdBoardStripeEvent(event);
    }

    return res.json({ received: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[webhook/stripe] handler threw:", error?.message || error);
    return next(error);
  }
});
