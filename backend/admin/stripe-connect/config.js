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

/** Flat GFE platform fee in cents. Default $29.00 (override via STRIPE_CONNECT_GFE_PLATFORM_FEE_CENTS). */
export const DEFAULT_GFE_PLATFORM_FEE_CENTS = 2900;

export function getConnectGfePlatformFeeCents() {
  const centsRaw = Number(process.env.STRIPE_CONNECT_GFE_PLATFORM_FEE_CENTS);
  if (Number.isFinite(centsRaw) && centsRaw >= 0) {
    return Math.floor(centsRaw);
  }

  const usdRaw = Number(process.env.STRIPE_CONNECT_GFE_PLATFORM_FEE_USD);
  if (Number.isFinite(usdRaw) && usdRaw >= 0) {
    return Math.round(usdRaw * 100);
  }

  // Legacy env: treat BPS env as disabled; flat fee is the source of truth.
  return DEFAULT_GFE_PLATFORM_FEE_CENTS;
}

/** @deprecated Use getConnectGfePlatformFeeCents — kept for admin status compatibility */
export function getConnectApplicationFeeBps() {
  return 0;
}

export const PAYMENT_TYPE_APPOINTMENT_DEPOSIT = "appointment_deposit";
export const PAYMENT_TYPE_APPOINTMENT_TREATMENT = "appointment_treatment";

/**
 * GFE platform fee applies on treatment checkouts when chargeGfeFee is true (never deposits).
 * Fee is charged once per category validity period when a new approved GFE is in effect.
 */
export function shouldApplyPlatformFee({ paymentType, chargeGfeFee, requiresGfe } = {}) {
  if (paymentType !== PAYMENT_TYPE_APPOINTMENT_TREATMENT) return false;
  if (chargeGfeFee === true) return true;
  if (chargeGfeFee === false) return false;
  return requiresGfe === true;
}

/** Flat GFE platform fee (added on top of treatment at checkout). */
export function resolveConnectPlatformFeeCents(feeContext = {}) {
  if (!shouldApplyPlatformFee(feeContext)) return 0;
  return getConnectGfePlatformFeeCents();
}

/** @deprecated Alias for resolveConnectPlatformFeeCents */
export function resolveConnectApplicationFeeCents(_treatmentCents, feeContext = {}) {
  return resolveConnectPlatformFeeCents(feeContext);
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
