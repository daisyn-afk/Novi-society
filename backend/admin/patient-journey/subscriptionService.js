import Stripe from "stripe";
import { query } from "../db.js";
import { resolveAppBaseUrl } from "../lib/frontendBaseUrl.js";

const CHECKOUT_TYPE = "patient_journey_premium";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

function premiumCents() {
  const raw = Number(process.env.PATIENT_JOURNEY_PREMIUM_CENTS);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 1900;
}

async function getJourneyByPatientId(patientId) {
  const { rows } = await query(
    `select * from public.patient_journeys where patient_id = $1 limit 1`,
    [String(patientId)]
  );
  return rows?.[0] || null;
}

export async function createPatientSubscriptionCheckout({ patientId, patientEmail, req }) {
  if (!stripe) {
    const err = new Error("Stripe is not configured (STRIPE_SECRET_KEY).");
    err.statusCode = 500;
    throw err;
  }

  const journey = await getJourneyByPatientId(patientId);
  const base = resolveAppBaseUrl(req).replace(/\/$/, "");
  const successUrl = `${base}/PatientJourney?subscription=success`;
  const cancelUrl = `${base}/PatientJourney?subscription=cancel`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: patientEmail || undefined,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      checkout_type: CHECKOUT_TYPE,
      patient_id: String(patientId),
      journey_id: journey?.id ? String(journey.id) : "",
    },
    subscription_data: {
      metadata: {
        checkout_type: CHECKOUT_TYPE,
        patient_id: String(patientId),
        journey_id: journey?.id ? String(journey.id) : "",
      },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: premiumCents(),
          recurring: { interval: "month" },
          product_data: {
            name: "NOVI Journey Premium",
            description: "Full skin analysis, daily recovery check-ins, insights & trends",
          },
        },
      },
    ],
  });

  if (!session?.url) {
    const err = new Error("Checkout session did not return a URL.");
    err.statusCode = 500;
    throw err;
  }

  return { url: session.url, session_id: session.id };
}

export async function activatePatientJourneyFromStripeSession(session) {
  const checkoutType = String(session?.metadata?.checkout_type || "").toLowerCase();
  if (checkoutType !== CHECKOUT_TYPE) return { skipped: true };

  const patientId = String(session?.metadata?.patient_id || "").trim();
  if (!patientId) return { skipped: true, reason: "missing_patient_id" };

  const stripeSubscriptionId = String(session?.subscription || "").trim() || null;
  const stripeCustomerId = String(session?.customer || "").trim() || null;

  await query(
    `update public.patient_journeys set
      tier = 'premium',
      subscription_status = 'active',
      stripe_subscription_id = coalesce($2, stripe_subscription_id),
      stripe_customer_id = coalesce($3, stripe_customer_id),
      updated_at = now()
    where patient_id = $1`,
    [patientId, stripeSubscriptionId, stripeCustomerId]
  );

  return { ok: true, patient_id: patientId };
}

export async function cancelPatientSubscriptionForUser({ patientId }) {
  const journey = await getJourneyByPatientId(patientId);
  if (!journey) {
    const err = new Error("Patient journey not found.");
    err.statusCode = 404;
    throw err;
  }

  const stripeSubscriptionId = String(journey.stripe_subscription_id || "").trim();
  if (stripe && stripeSubscriptionId) {
    await stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
  }

  await query(
    `update public.patient_journeys set
      subscription_status = 'canceling',
      updated_at = now()
    where patient_id = $1`,
    [String(patientId)]
  );

  return { ok: true, cancel_at_period_end: true };
}

export async function processPatientJourneyStripeEvent(event) {
  const type = event?.type;
  const obj = event?.data?.object || {};

  if (type === "checkout.session.completed") {
    return activatePatientJourneyFromStripeSession(obj);
  }

  if (type === "customer.subscription.deleted") {
    const checkoutType = String(obj?.metadata?.checkout_type || "").toLowerCase();
    const patientId = String(obj?.metadata?.patient_id || "").trim();
    if (checkoutType !== CHECKOUT_TYPE && !patientId) return { skipped: true };

    const subId = String(obj?.id || "").trim();
    await query(
      `update public.patient_journeys set
        tier = 'free',
        subscription_status = 'canceled',
        updated_at = now()
      where stripe_subscription_id = $1 or patient_id = $2`,
      [subId, patientId || null]
    );
    return { ok: true };
  }

  if (type === "customer.subscription.updated") {
    const checkoutType = String(obj?.metadata?.checkout_type || "").toLowerCase();
    if (checkoutType !== CHECKOUT_TYPE) return { skipped: true };

    const patientId = String(obj?.metadata?.patient_id || "").trim();
    const status = String(obj?.status || "").toLowerCase();
    let subscriptionStatus = "active";
    if (status === "canceled" || status === "unpaid") subscriptionStatus = "canceled";
    else if (obj?.cancel_at_period_end) subscriptionStatus = "canceling";
    else if (status === "active" || status === "trialing") subscriptionStatus = "active";

    const tier = subscriptionStatus === "canceled" ? "free" : "premium";

    await query(
      `update public.patient_journeys set
        tier = $2,
        subscription_status = $3,
        stripe_subscription_id = coalesce($4, stripe_subscription_id),
        updated_at = now()
      where patient_id = $1`,
      [patientId, tier, subscriptionStatus, String(obj?.id || "").trim() || null]
    );
    return { ok: true };
  }

  return { skipped: true };
}
