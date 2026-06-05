import Stripe from "stripe";

let connectStripeClient = null;

export function isStripeConnectEnabled() {
  return String(process.env.STRIPE_CONNECT_ENABLED || "").trim().toLowerCase() === "true";
}

export function getStripeConnectSecretKey() {
  return String(process.env.STRIPE_CONNECT_SECRET_KEY || "").trim();
}

export function getStripeConnectWebhookSecret() {
  return String(process.env.STRIPE_CONNECT_WEBHOOK_SECRET || "").trim();
}

export function isStripeConnectConfigured() {
  return isStripeConnectEnabled() && Boolean(getStripeConnectSecretKey());
}

export function getConnectStripeClient() {
  const key = getStripeConnectSecretKey();
  if (!key) return null;
  if (!connectStripeClient) {
    connectStripeClient = new Stripe(key);
  }
  return connectStripeClient;
}

/** Platform fee in basis points (0–10000). Default 0 = provider receives full transfer. */
export function getConnectApplicationFeeBps() {
  const raw = Number(process.env.STRIPE_CONNECT_APPLICATION_FEE_BPS);
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return Math.min(10000, Math.floor(raw));
}

export const PAYMENT_TYPE_APPOINTMENT_DEPOSIT = "appointment_deposit";
export const PAYMENT_TYPE_APPOINTMENT_TREATMENT = "appointment_treatment";

/**
 * Platform fee applies only on approved-GFE treatment checkouts (never deposits).
 */
export function shouldApplyPlatformFee({ paymentType, requiresGfe, gfeStatus } = {}) {
  if (paymentType !== PAYMENT_TYPE_APPOINTMENT_TREATMENT) return false;
  if (requiresGfe !== true) return false;
  if (String(gfeStatus || "").toLowerCase() !== "approved") return false;
  return true;
}

export function resolveConnectApplicationFeeCents(amountCents, feeContext = {}) {
  if (!shouldApplyPlatformFee(feeContext)) return 0;
  const bps = getConnectApplicationFeeBps();
  if (bps <= 0 || amountCents <= 0) return 0;
  return Math.min(amountCents, Math.round((amountCents * bps) / 10000));
}

export function getStripeConnectClientId() {
  return String(process.env.STRIPE_CONNECT_CLIENT_ID || "").trim();
}

function getStripeConnectApiBaseUrl() {
  return String(
    process.env.ADMIN_API_BASE_URL ||
      process.env.API_BASE_URL ||
      process.env.APP_BASE_URL ||
      "http://127.0.0.1:8787"
  ).replace(/\/$/, "");
}

export function getStripeConnectOAuthRedirectUri() {
  const explicit = String(process.env.STRIPE_CONNECT_OAUTH_REDIRECT_URI || "").trim();
  if (explicit) return explicit;
  return `${getStripeConnectApiBaseUrl()}/admin/integrations/stripe-connect/platform/oauth/callback`;
}

/** Provider Standard OAuth callback (register this URI in Stripe Connect settings). */
export function getProviderStripeConnectOAuthRedirectUri() {
  const explicit = String(process.env.STRIPE_CONNECT_PROVIDER_OAUTH_REDIRECT_URI || "").trim();
  if (explicit) return explicit;
  return `${getStripeConnectApiBaseUrl()}/admin/integrations/stripe-connect/oauth/callback`;
}

export function isLegacyFeeTransferEnabled() {
  return String(process.env.STRIPE_CONNECT_LEGACY_FEE_TRANSFER_ENABLED || "").trim().toLowerCase() === "true";
}

export function getFrontendBaseUrl() {
  return String(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173").replace(
    /\/$/,
    ""
  );
}
