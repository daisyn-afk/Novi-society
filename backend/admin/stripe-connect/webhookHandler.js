import Stripe from "stripe";
import { getStripeConnectWebhookSecret } from "./config.js";
import { handleConnectAccountUpdated } from "./service.js";
import { processMarketplacePaymentSplit } from "./marketplaceSplitTransfers.js";
import { handlePlatformLegacyAccountUpdated } from "./platformLegacyService.js";
import { processAppointmentCheckoutCompletedSession } from "../appointments/paymentService.js";
import { processAppointmentTreatmentCheckoutCompletedSession } from "../appointments/treatmentPaymentService.js";
import { recordStripeWebhookEvent } from "../payments/service.js";

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
  "account.updated",
]);

export function verifyStripeConnectWebhook(rawBody, signature) {
  const secret = getStripeConnectWebhookSecret();
  if (!secret) {
    throw new Error("STRIPE_CONNECT_WEBHOOK_SECRET is not configured.");
  }
  return Stripe.webhooks.constructEvent(rawBody, signature, secret);
}

async function handleCheckoutSessionEvent(session) {
  const checkoutType = String(session?.metadata?.checkout_type || "").toLowerCase();
  if (checkoutType === "appointment") {
    await processAppointmentCheckoutCompletedSession(session);
  } else if (checkoutType === "appointment_treatment") {
    await processAppointmentTreatmentCheckoutCompletedSession(session);
  }
}

export async function processStripeConnectWebhookEvent(event) {
  if (TRACKED_STRIPE_EVENT_TYPES.has(event.type)) {
    await recordStripeWebhookEvent(event);
  }

  if (event.type === "account.updated") {
    const account = event.data.object;
    await handleConnectAccountUpdated(account);
    await handlePlatformLegacyAccountUpdated(account);
    return;
  }

  if (event.type === "payment_intent.succeeded") {
    await processMarketplacePaymentSplit(event.data.object);
    return;
  }

  if (event.type === "checkout.session.completed") {
    await handleCheckoutSessionEvent(event.data.object);
    return;
  }

  if (event.type === "checkout.session.async_payment_succeeded") {
    await handleCheckoutSessionEvent(event.data.object);
  }
}
