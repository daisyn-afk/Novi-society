import { Router } from "express";
import { getMeFromAccessToken } from "../auth/service.js";
import {
  completeProviderOAuth,
  createStripeConnectOnboardingLink,
  getProviderOAuthAuthorizeUrl,
  getProviderStripeConnectStatus,
  providerPracticeRedirect,
  syncStripeAccountForProvider,
} from "./service.js";
import { isStripeConnectEnabled, isStripeConnectConfigured } from "./config.js";
import {
  isStripeConnectOAuthConfigured,
  OAUTH_PURPOSE_PROVIDER,
  verifyConnectOAuthState,
} from "./connectOAuth.js";

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

async function requireProvider(req) {
  const token = getBearerToken(req);
  if (!token) {
    const err = new Error("Missing bearer token.");
    err.statusCode = 401;
    throw err;
  }
  const me = await getMeFromAccessToken(token);
  const role = String(me.role || "").toLowerCase();
  if (role !== "provider") {
    const err = new Error("Only providers can manage Stripe Connect.");
    err.statusCode = 403;
    throw err;
  }
  return { me, token };
}

export const stripeConnectRouter = Router();

stripeConnectRouter.get("/status", async (req, res, next) => {
  try {
    const { me } = await requireProvider(req);
    if (req.query.refresh === "true" && isStripeConnectConfigured()) {
      const status = await syncStripeAccountForProvider(me.id);
      return res.json(status);
    }
    const live = req.query.live !== "false";
    const status = await getProviderStripeConnectStatus(me.id, { live });
    res.json(status);
  } catch (error) {
    next(error);
  }
});

stripeConnectRouter.get("/oauth/url", async (req, res, next) => {
  try {
    if (!isStripeConnectEnabled()) {
      return res.status(503).json({
        error: "Stripe Connect is disabled. Set STRIPE_CONNECT_ENABLED=true to enable.",
      });
    }
    if (!isStripeConnectOAuthConfigured()) {
      return res.status(503).json({
        error: "Stripe Connect OAuth is not configured. Set STRIPE_CONNECT_CLIENT_ID.",
      });
    }

    const { me } = await requireProvider(req);
    const returnPath = String(req.query.return_path || "/ProviderPractice").trim() || "/ProviderPractice";
    const result = getProviderOAuthAuthorizeUrl(
      me.id,
      returnPath.startsWith("/") ? returnPath : `/${returnPath}`
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

stripeConnectRouter.get("/oauth/callback", async (req, res) => {
  try {
    const code = String(req.query?.code || "");
    const state = String(req.query?.state || "");
    const oauthError = String(req.query?.error || "");

    if (oauthError) {
      return res.redirect(providerPracticeRedirect({ stripe_connect: "denied" }));
    }
    if (!code || !state) {
      return res.redirect(providerPracticeRedirect({ stripe_connect: "error", reason: "missing_code" }));
    }

    const parsed = verifyConnectOAuthState(state, { expectedPurpose: OAUTH_PURPOSE_PROVIDER });
    await completeProviderOAuth({ code, providerAuthUserId: parsed.providerAuthUserId });

    return res.redirect(providerPracticeRedirect({ stripe_connect: "connected" }));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[stripe-connect/provider] oauth_callback_failed", error?.message || error);
    return res.redirect(providerPracticeRedirect({ stripe_connect: "error", reason: "callback_failed" }));
  }
});

stripeConnectRouter.get("/connect-url", async (req, res, next) => {
  try {
    if (!isStripeConnectEnabled()) {
      return res.status(503).json({
        error: "Stripe Connect is disabled. Set STRIPE_CONNECT_ENABLED=true to enable.",
      });
    }
    if (!isStripeConnectConfigured()) {
      return res.status(503).json({
        error: "Stripe Connect is not configured. Set STRIPE_CONNECT_SECRET_KEY.",
      });
    }

    const { me } = await requireProvider(req);
    const returnPath = String(req.query.return_path || "/ProviderPractice").trim() || "/ProviderPractice";

    const result = await createStripeConnectOnboardingLink({
      authUserId: me.id,
      email: me.email,
      fullName: me.full_name,
      returnPath: returnPath.startsWith("/") ? returnPath : `/${returnPath}`,
    });

    res.json({
      url: result.url,
      method: result.method || null,
      account_id: result.account_id || null,
      expires_at: result.expires_at || null,
      status: result.status || null,
    });
  } catch (error) {
    next(error);
  }
});

stripeConnectRouter.post("/refresh", async (req, res, next) => {
  try {
    const { me } = await requireProvider(req);
    const status = await syncStripeAccountForProvider(me.id);
    res.json(status);
  } catch (error) {
    next(error);
  }
});
