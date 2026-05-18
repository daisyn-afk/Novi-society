import { Router } from "express";
import { processCompletedCheckoutSession, verifyStripeWebhook } from "../checkout/service.js";
import { processModelCheckoutCompletedSession } from "../functions/routes.js";
import { recordStripeWebhookEvent } from "../payments/service.js";

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
  "charge.dispute.created"
]);

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
      } else {
        await processCompletedCheckoutSession(session);
      }
    }

    return res.json({ received: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[webhook/stripe] handler threw:", error?.message || error);
    return next(error);
  }
});
