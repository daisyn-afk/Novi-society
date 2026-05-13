import Stripe from "stripe";
import {
  createMdSubscription,
  createMdSubscriptionIntent,
  createMedicalDirectorRelationship,
  createNotification,
  getMdSubscriptionIntent,
  listMedicalDirectorRelationships,
  listMdSubscriptions,
  updateMdSubscriptionIntent,
  updateMedicalDirectorRelationship,
} from "./repository.js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export const NOVI_BOARD_MD = {
  id: "699c9815c81b2b13b2643a49",
  name: "ashlan.brookes.lane",
  email: "ashlan.brookes.lane@gmail.com",
};

function resolveProviderName(provider) {
  return (
    String(provider?.full_name || "").trim() ||
    [provider?.first_name, provider?.last_name].filter(Boolean).join(" ").trim() ||
    String(provider?.email || "").trim() ||
    "Provider"
  );
}

export async function ensurePendingBoardMdSupervision({
  provider,
  serviceTypeId,
  serviceTypeName,
}) {
  if (!provider?.id) return null;
  const existing = await listMedicalDirectorRelationships({
    provider_id: provider.id,
    medical_director_id: NOVI_BOARD_MD.id,
  });
  const active = existing.find((rel) => rel.status === "active");
  if (active) return active;

  const pending = existing.find((rel) => rel.status === "pending");
  if (pending) {
    if (serviceTypeId && pending.service_type_id && pending.service_type_id !== serviceTypeId) {
      return updateMedicalDirectorRelationship(pending.id, {
        service_type_id: serviceTypeId,
        service_type_name: serviceTypeName || pending.service_type_name || null,
        supervision_notes: `Requested MD supervision for ${serviceTypeName || "clinical services"}.`,
      });
    }
    return pending;
  }

  const relationship = await createMedicalDirectorRelationship({
    provider_id: provider.id,
    provider_email: provider.email,
    provider_name: resolveProviderName(provider),
    medical_director_id: NOVI_BOARD_MD.id,
    medical_director_email: NOVI_BOARD_MD.email,
    medical_director_name: NOVI_BOARD_MD.name,
    status: "pending",
    service_type_id: serviceTypeId || null,
    service_type_name: serviceTypeName || null,
    supervision_notes: `Requested MD supervision for ${serviceTypeName || "clinical services"}.`,
  });

  const providerLabel = resolveProviderName(provider);
  const serviceLabel = serviceTypeName || "clinical services";

  await createNotification({
    user_id: NOVI_BOARD_MD.id,
    user_email: NOVI_BOARD_MD.email,
    type: "md_relationship_pending",
    message: `${providerLabel} requested supervision for ${serviceLabel}.`,
    link_page: "MDProviderRelationships",
  });

  await createNotification({
    user_id: provider.id,
    user_email: provider.email,
    type: "md_relationship_pending",
    message: `Your MD Board supervision request for ${serviceLabel} is awaiting medical director approval.`,
    link_page: "ProviderCredentialsCoverage?tab=coverage",
  });

  return relationship;
}

export async function activateMdSubscriptionForProvider({
  provider,
  serviceTypeId,
  serviceTypeName,
  signatureData,
  enrollmentId = null,
  stripeSessionId = null,
  stripePaymentIntentId = null,
}) {
  const now = new Date().toISOString();
  const existing = await listMdSubscriptions({
    provider_id: provider.id,
    status: "active",
  });
  const alreadyActive = existing.some((sub) => String(sub.service_type_id || "") === String(serviceTypeId || ""));
  let subscription = alreadyActive
    ? existing.find((sub) => String(sub.service_type_id || "") === String(serviceTypeId || ""))
    : null;

  if (!subscription) {
    subscription = await createMdSubscription({
      provider_id: provider.id,
      provider_email: provider.email,
      provider_name: resolveProviderName(provider),
      service_type_id: serviceTypeId,
      service_type_name: serviceTypeName,
      status: "active",
      signed_at: now,
      signed_by_name: resolveProviderName(provider),
      signature_data: signatureData || null,
      activated_at: now,
      enrollment_id: enrollmentId || null,
      stripe_session_id: stripeSessionId || null,
      stripe_payment_intent_id: stripePaymentIntentId || null,
    });
  }

  await ensurePendingBoardMdSupervision({
    provider,
    serviceTypeId,
    serviceTypeName,
  });

  return subscription;
}

export async function createMdSubscriptionCheckout({
  provider,
  serviceTypeId,
  serviceTypeName,
  amount,
  enrollmentId,
  signatureData,
  directActivate = false,
}) {
  const normalizedAmount = Math.max(0, Number(amount || 0));
  if (directActivate || normalizedAmount <= 0) {
    const subscription = await activateMdSubscriptionForProvider({
      provider,
      serviceTypeId,
      serviceTypeName,
      signatureData,
      enrollmentId,
    });
    return { success: true, subscription };
  }

  if (!stripe) {
    const error = new Error("Stripe is not configured.");
    error.statusCode = 500;
    throw error;
  }

  const intent = await createMdSubscriptionIntent({
    provider_id: provider.id,
    provider_email: provider.email,
    payload: {
      service_type_id: serviceTypeId,
      service_type_name: serviceTypeName,
      enrollment_id: enrollmentId || null,
      signature_data: signatureData || null,
      amount_cents: Math.round(normalizedAmount * 100),
    },
  });

  const successUrl = `${appBaseUrl}/ProviderLaunchPad?md_payment_status=success&service_type_id=${encodeURIComponent(serviceTypeId || "")}&enrollment_id=${encodeURIComponent(enrollmentId || "")}&intent_id=${encodeURIComponent(intent.id)}`;
  const cancelUrl = `${appBaseUrl}/ProviderCredentialsCoverage?md_payment_status=cancelled`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: provider.email || undefined,
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(normalizedAmount * 100),
        product_data: {
          name: `${serviceTypeName || "MD Board Coverage"} — NOVI Society`,
          description: "Monthly MD Board coverage membership",
        },
      },
    }],
    metadata: {
      checkout_type: "md_subscription",
      intent_id: String(intent.id),
      provider_id: String(provider.id || ""),
      provider_email: String(provider.email || ""),
      service_type_id: String(serviceTypeId || ""),
    },
  });

  await updateMdSubscriptionIntent(intent.id, {
    stripe_session_id: session.id,
    status: "checkout_created",
  });

  return { url: session.url, intent_id: intent.id };
}

export async function completeMdSubscriptionCheckoutSession(session) {
  const intentId = String(session?.metadata?.intent_id || "").trim();
  if (!intentId) return null;
  const intent = await getMdSubscriptionIntent(intentId);
  if (!intent || intent.status === "completed") return null;

  const payload = intent.payload && typeof intent.payload === "object" ? intent.payload : {};
  const provider = {
    id: String(session?.metadata?.provider_id || intent.provider_id || "").trim(),
    email: String(session?.metadata?.provider_email || intent.provider_email || "").trim(),
    full_name: String(payload.provider_name || "").trim() || null,
  };

  const subscription = await activateMdSubscriptionForProvider({
    provider,
    serviceTypeId: payload.service_type_id || session?.metadata?.service_type_id,
    serviceTypeName: payload.service_type_name || null,
    signatureData: payload.signature_data || null,
    enrollmentId: payload.enrollment_id || null,
    stripeSessionId: session?.id || null,
    stripePaymentIntentId: session?.payment_intent ? String(session.payment_intent) : null,
  });

  await updateMdSubscriptionIntent(intentId, { status: "completed" });
  return subscription;
}

export async function completeMdSubscriptionIntent({
  provider,
  intentId,
  serviceTypeId,
  enrollmentId,
}) {
  const intent = intentId ? await getMdSubscriptionIntent(intentId) : null;
  const payload = intent?.payload && typeof intent.payload === "object" ? intent.payload : {};
  const subscription = await activateMdSubscriptionForProvider({
    provider,
    serviceTypeId: serviceTypeId || payload.service_type_id,
    serviceTypeName: payload.service_type_name || null,
    signatureData: payload.signature_data || null,
    enrollmentId: enrollmentId || payload.enrollment_id || null,
    stripeSessionId: intent?.stripe_session_id || null,
  });
  if (intent?.id) {
    await updateMdSubscriptionIntent(intent.id, { status: "completed" });
  }
  return subscription;
}
