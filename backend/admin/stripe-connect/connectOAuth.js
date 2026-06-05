import crypto from "node:crypto";
import {
  getStripeConnectClientId,
  getStripeConnectSecretKey,
} from "./config.js";

export const OAUTH_PURPOSE_PLATFORM_LEGACY = "platform_legacy";
export const OAUTH_PURPOSE_PROVIDER = "provider";

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

export function signConnectOAuthState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getStateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyConnectOAuthState(state, { expectedPurpose } = {}) {
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
  if (!parsed?.exp || Date.now() > Number(parsed.exp)) {
    const err = new Error("OAuth state expired.");
    err.statusCode = 400;
    throw err;
  }

  const purpose = String(parsed.purpose || "").trim();
  if (expectedPurpose && purpose !== expectedPurpose) {
    const err = new Error("Invalid OAuth state purpose.");
    err.statusCode = 400;
    throw err;
  }

  if (purpose === OAUTH_PURPOSE_PLATFORM_LEGACY && !parsed.adminAuthUserId) {
    const err = new Error("Invalid OAuth state.");
    err.statusCode = 400;
    throw err;
  }

  if (purpose === OAUTH_PURPOSE_PROVIDER && !parsed.providerAuthUserId) {
    const err = new Error("Invalid OAuth state.");
    err.statusCode = 400;
    throw err;
  }

  return parsed;
}

export function buildConnectOAuthAuthorizeUrl({ redirectUri, statePayload }) {
  if (!isStripeConnectOAuthConfigured()) {
    const err = new Error(
      "Stripe Connect OAuth is not configured. Set STRIPE_CONNECT_CLIENT_ID and STRIPE_CONNECT_SECRET_KEY."
    );
    err.statusCode = 503;
    throw err;
  }

  const clientId = getStripeConnectClientId();
  const uri = String(redirectUri || "").trim();
  if (!uri) {
    const err = new Error("OAuth redirect URI is required.");
    err.statusCode = 500;
    throw err;
  }

  const state = signConnectOAuthState(statePayload);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_write",
    redirect_uri: uri,
    state,
  });

  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeConnectOAuthCode(code, redirectUri) {
  const clientId = getStripeConnectClientId();
  const clientSecret = getStripeConnectSecretKey();
  const uri = String(redirectUri || "").trim();

  if (!clientId || !clientSecret) {
    const err = new Error("Stripe Connect OAuth is not configured.");
    err.statusCode = 503;
    throw err;
  }
  if (!uri) {
    const err = new Error("OAuth redirect URI is required.");
    err.statusCode = 500;
    throw err;
  }

  const body = new URLSearchParams({
    client_secret: clientSecret,
    client_id: clientId,
    grant_type: "authorization_code",
    code: String(code || ""),
    redirect_uri: uri,
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
