import { Router } from "express";
import { getMeFromAccessToken } from "../auth/service.js";
import {
  createStripeConnectOnboardingLink,
  getProviderStripeConnectStatus,
  syncStripeAccountForProvider,
} from "./service.js";
import { isStripeConnectEnabled, isStripeConnectConfigured } from "./config.js";

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
      account_id: result.account_id,
      expires_at: result.expires_at,
      status: result.status,
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
