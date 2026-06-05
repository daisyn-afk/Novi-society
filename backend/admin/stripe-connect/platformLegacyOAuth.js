import crypto from "node:crypto";
import {
  getStripeConnectClientId,
  getStripeConnectOAuthRedirectUri,
  getStripeConnectSecretKey,
} from "./config.js";

function getStateSecret() {
  return (
    process.env.STRIPE_CONNECT_OAUTH_STATE_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    getStripeConnectSecretKey() ||
    "novi-stripe-connect-oauth-state"
  );
}

export function isStripeConnectOAuthConfigured() {
  return Boolean(getStripeConnectClientId() && getStripeConnectSecretKey());
}

export function signPlatformLegacyOAuthState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getStateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPlatformLegacyOAuthState(state) {
  const raw = String(state || "");
  const [body, sig] = raw.split(".");
  if (!body || !sig) {
    const err = new Error("Invalid OAuth state.");
    err.statusCode = 400;
    throw err;
  }
  const expected = crypto.createHmac("sha256", getStateSecret()).update(body).digest("base64url");
  if (sig !== expected) {
    const err = new Error("Invalid OAuth state signature.");
    err.statusCode = 400;
    throw err;
  }
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!parsed?.adminAuthUserId || !parsed?.exp || Date.now() > Number(parsed.exp)) {
    const err = new Error("OAuth state expired.");
    err.statusCode = 400;
    throw err;
  }
  return parsed;
}

export function buildPlatformLegacyOAuthUrl({ adminAuthUserId }) {
  if (!isStripeConnectOAuthConfigured()) {
    const err = new Error(
      "Stripe Connect OAuth is not configured. Set STRIPE_CONNECT_CLIENT_ID and STRIPE_CONNECT_SECRET_KEY."
    );
    err.statusCode = 503;
    throw err;
  }

  const clientId = getStripeConnectClientId();
  const redirectUri = getStripeConnectOAuthRedirectUri();
  const state = signPlatformLegacyOAuthState({
    adminAuthUserId: String(adminAuthUserId || ""),
    exp: Date.now() + 15 * 60 * 1000,
    purpose: "platform_legacy",
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_write",
    redirect_uri: redirectUri,
    state,
  });

  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

export async function exchangePlatformLegacyOAuthCode(code) {
  const clientId = getStripeConnectClientId();
  const clientSecret = getStripeConnectSecretKey();
  const redirectUri = getStripeConnectOAuthRedirectUri();

  if (!clientId || !clientSecret) {
    const err = new Error("Stripe Connect OAuth is not configured.");
    err.statusCode = 503;
    throw err;
  }

  const body = new URLSearchParams({
    client_secret: clientSecret,
    client_id: clientId,
    grant_type: "authorization_code",
    code: String(code || ""),
    redirect_uri: redirectUri,
  });

  const response = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const raw = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const err = new Error(`Stripe OAuth token exchange failed (${response.status}).`);
    err.statusCode = 502;
    throw err;
  }

  if (!response.ok || parsed.error) {
    const err = new Error(parsed.error_description || parsed.error || "Stripe OAuth token exchange failed.");
    err.statusCode = 502;
    throw err;
  }

  return {
    connectedAccountId: String(parsed.stripe_user_id || "").trim() || null,
    scope: parsed.scope || null,
    livemode: Boolean(parsed.livemode),
  };
}
