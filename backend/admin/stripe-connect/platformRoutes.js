import { Router } from "express";
import { requireAdmin } from "../auth/helpers.js";
import { getFrontendBaseUrl } from "./config.js";
import {
  completePlatformLegacyOAuth,
  disconnectPlatformLegacyAccount,
  getPlatformLegacyConnectStatus,
  getPlatformLegacyOAuthAuthorizeUrl,
  refreshPlatformLegacyAccountFromStripe,
  updatePlatformFeeTransferEnabled,
} from "./platformLegacyService.js";
import { verifyPlatformLegacyOAuthState } from "./platformLegacyOAuth.js";

function adminDashboardRedirect(params = {}) {
  const base = getFrontendBaseUrl();
  const url = new URL("/AdminDashboard", base);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

export const stripeConnectPlatformRouter = Router();

stripeConnectPlatformRouter.get("/status", requireAdmin, async (_req, res, next) => {
  try {
    const status = await getPlatformLegacyConnectStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

stripeConnectPlatformRouter.get("/oauth/url", requireAdmin, async (req, res, next) => {
  try {
    const url = getPlatformLegacyOAuthAuthorizeUrl(req.me.id);
    res.json({ url });
  } catch (error) {
    next(error);
  }
});

stripeConnectPlatformRouter.get("/oauth/callback", async (req, res) => {
  try {
    const code = String(req.query?.code || "");
    const state = String(req.query?.state || "");
    const oauthError = String(req.query?.error || "");

    if (oauthError) {
      return res.redirect(adminDashboardRedirect({ stripe_platform_legacy: "denied" }));
    }
    if (!code || !state) {
      return res.redirect(adminDashboardRedirect({ stripe_platform_legacy: "error", reason: "missing_code" }));
    }

    const { adminAuthUserId } = verifyPlatformLegacyOAuthState(state);
    await completePlatformLegacyOAuth({ code, adminAuthUserId });

    return res.redirect(adminDashboardRedirect({ stripe_platform_legacy: "connected" }));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[stripe-connect/platform] oauth_callback_failed", error?.message || error);
    return res.redirect(
      adminDashboardRedirect({ stripe_platform_legacy: "error", reason: "callback_failed" })
    );
  }
});

stripeConnectPlatformRouter.post("/refresh", requireAdmin, async (_req, res, next) => {
  try {
    const status = await refreshPlatformLegacyAccountFromStripe();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

stripeConnectPlatformRouter.patch("/fee-transfer", requireAdmin, async (req, res, next) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const status = await updatePlatformFeeTransferEnabled(enabled);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

stripeConnectPlatformRouter.delete("/", requireAdmin, async (_req, res, next) => {
  try {
    const status = await disconnectPlatformLegacyAccount();
    res.json(status);
  } catch (error) {
    next(error);
  }
});
