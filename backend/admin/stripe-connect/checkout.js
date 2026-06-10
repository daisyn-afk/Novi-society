import {
  getConnectStripeClient,
  isStripeConnectConfigured,
  PAYMENT_TYPE_APPOINTMENT_DEPOSIT,
  resolveConnectPlatformFeeCents,
} from "./config.js";
import { assertProviderReadyForMarketplacePayments } from "./service.js";

export const STRIPE_PLATFORM_LEGACY = "legacy";
export const STRIPE_PLATFORM_CONNECT = "connect";

/**
 * Creates a Checkout Session for provider marketplace flows (deposit / treatment).
 * Uses platform-owned charges; provider + legacy payouts run on payment_intent.succeeded.
 */
export async function createMarketplaceCheckoutSession({
  legacyStripe,
  providerAuthUserId,
  sessionCreateParams,
  amountCents,
  feeContext = {},
}) {
  const route = await assertProviderReadyForMarketplacePayments(providerAuthUserId);

  if (!route.useConnect) {
    if (!legacyStripe) {
      const err = new Error("Stripe is not configured.");
      err.statusCode = 500;
      throw err;
    }
    const session = await legacyStripe.checkout.sessions.create(sessionCreateParams);
    return { session, stripePlatform: STRIPE_PLATFORM_LEGACY, stripe: legacyStripe };
  }

  const stripe = route.stripe || getConnectStripeClient();
  const destination = route.connectAccountId;
  const paymentType = feeContext.paymentType || "";
  const treatmentCents =
    Number(feeContext.treatmentCents) > 0 ? Number(feeContext.treatmentCents) : amountCents;
  const platformFeeCents = resolveConnectPlatformFeeCents({
    ...feeContext,
    chargeGfeFee: feeContext.chargeGfeFee,
    requiresGfe: feeContext.requiresGfe,
  });
  const providerTransferCents =
    paymentType === PAYMENT_TYPE_APPOINTMENT_DEPOSIT ? amountCents : treatmentCents;
  const chargeCents =
    paymentType === PAYMENT_TYPE_APPOINTMENT_DEPOSIT ? amountCents : treatmentCents + platformFeeCents;

  const appointmentId = String(sessionCreateParams.metadata?.appointment_id || "").trim();
  const transferGroup = appointmentId ? `marketplace_appt_${appointmentId}` : undefined;

  const feeAuditMetadata = {
    platform_fee_applied: String(platformFeeCents > 0),
    platform_fee_cents: String(platformFeeCents),
    provider_transfer_cents: String(providerTransferCents),
    treatment_amount_cents: String(treatmentCents),
    total_charge_cents: String(chargeCents),
    ...(feeContext.paymentType ? { payment_type: String(feeContext.paymentType) } : {}),
    ...(feeContext.requiresGfe != null ? { requires_gfe: String(feeContext.requiresGfe) } : {}),
    ...(feeContext.gfeStatus != null ? { gfe_status: String(feeContext.gfeStatus) } : {}),
  };

  const metadata = {
    ...(sessionCreateParams.metadata || {}),
    stripe_platform: STRIPE_PLATFORM_CONNECT,
    stripe_connect_account_id: destination,
    ...feeAuditMetadata,
  };

  const paymentIntentData = {
    ...(sessionCreateParams.payment_intent_data || {}),
    metadata: {
      ...metadata,
      ...(sessionCreateParams.payment_intent_data?.metadata || {}),
    },
    ...(transferGroup ? { transfer_group: transferGroup } : {}),
  };

  const session = await stripe.checkout.sessions.create({
    ...sessionCreateParams,
    metadata,
    payment_intent_data: paymentIntentData,
  });

  return { session, stripePlatform: STRIPE_PLATFORM_CONNECT, stripe };
}

export async function retrieveMarketplaceCheckoutSession({ legacyStripe, sessionId }) {
  const sid = String(sessionId || "").trim();
  if (!sid) {
    const err = new Error("Stripe session id is required.");
    err.statusCode = 400;
    throw err;
  }

  const connect = isStripeConnectConfigured() ? getConnectStripeClient() : null;
  if (connect) {
    try {
      const session = await connect.checkout.sessions.retrieve(sid);
      return {
        session,
        stripe: connect,
        stripePlatform: String(session?.metadata?.stripe_platform || STRIPE_PLATFORM_CONNECT),
      };
    } catch (error) {
      if (error?.code !== "resource_missing") throw error;
    }
  }

  if (!legacyStripe) {
    const err = new Error("Stripe is not configured.");
    err.statusCode = 500;
    throw err;
  }

  const session = await legacyStripe.checkout.sessions.retrieve(sid);
  return {
    session,
    stripe: legacyStripe,
    stripePlatform: String(session?.metadata?.stripe_platform || STRIPE_PLATFORM_LEGACY),
  };
}
