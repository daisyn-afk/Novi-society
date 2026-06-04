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
