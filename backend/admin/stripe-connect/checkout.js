import {
  getConnectStripeClient,
  isStripeConnectConfigured,
  resolveConnectApplicationFeeCents,
} from "./config.js";
import { assertProviderReadyForMarketplacePayments } from "./service.js";

export const STRIPE_PLATFORM_LEGACY = "legacy";
export const STRIPE_PLATFORM_CONNECT = "connect";

/**
 * Creates a Checkout Session for provider marketplace flows (deposit / treatment).
 * Uses Connect destination charges when enabled and provider is onboarded; otherwise legacy Stripe.
 */
export async function createMarketplaceCheckoutSession({
  legacyStripe,
  providerAuthUserId,
  sessionCreateParams,
  amountCents,
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
  const feeCents = resolveConnectApplicationFeeCents(amountCents);

  const metadata = {
    ...(sessionCreateParams.metadata || {}),
    stripe_platform: STRIPE_PLATFORM_CONNECT,
    stripe_connect_account_id: destination,
  };

  const paymentIntentData = {
    ...(sessionCreateParams.payment_intent_data || {}),
    metadata: {
      ...metadata,
      ...(sessionCreateParams.payment_intent_data?.metadata || {}),
    },
    transfer_data: { destination },
    ...(feeCents > 0 ? { application_fee_amount: feeCents } : {}),
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
