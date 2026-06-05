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

export function resolveConnectApplicationFeeCents(amountCents) {
  const bps = getConnectApplicationFeeBps();
  if (bps <= 0 || amountCents <= 0) return 0;
  return Math.min(amountCents, Math.round((amountCents * bps) / 10000));
}

export function getStripeConnectClientId() {
  return String(process.env.STRIPE_CONNECT_CLIENT_ID || "").trim();
}

export function getStripeConnectOAuthRedirectUri() {
  const explicit = String(process.env.STRIPE_CONNECT_OAUTH_REDIRECT_URI || "").trim();
  if (explicit) return explicit;

  const apiBase = String(
    process.env.ADMIN_API_BASE_URL ||
      process.env.API_BASE_URL ||
      process.env.APP_BASE_URL ||
      "http://127.0.0.1:8787"
  ).replace(/\/$/, "");

  return `${apiBase}/admin/integrations/stripe-connect/platform/oauth/callback`;
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
