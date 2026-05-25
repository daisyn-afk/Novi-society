import { Router } from "express";
import { getMeFromAccessToken } from "../auth/service.js";
import {
  buildGoogleCalendarAuthUrl,
  exchangeGoogleCalendarCode,
  isGoogleCalendarOAuthConfigured,
  verifyOAuthState,
} from "./googleCalendarService.js";
import {
  deleteProviderGoogleCalendarConnection,
  getProviderGoogleCalendarConnection,
  upsertProviderGoogleCalendarConnection,
} from "./providerGoogleCalendarRepository.js";

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

async function requireAuth(req) {
  const token = getBearerToken(req);
  if (!token) {
    const err = new Error("Missing bearer token.");
    err.statusCode = 401;
    throw err;
  }
  const me = await getMeFromAccessToken(token);
  return { me };
}

function profileRedirect(params = {}) {
  const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
  const url = new URL("/ProviderProfile", base.replace(/\/$/, ""));
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

export const googleCalendarRouter = Router();

googleCalendarRouter.get("/status", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const connection = await getProviderGoogleCalendarConnection(me?.id);
    const providerEmail = String(me?.email || "").trim().toLowerCase();

    res.json({
      configured: isGoogleCalendarOAuthConfigured(),
      connected: Boolean(connection?.access_token),
      google_email: connection?.google_email || "",
      provider_email: providerEmail,
      email_matches:
        Boolean(connection?.google_email) &&
        connection.google_email.toLowerCase() === providerEmail,
    });
  } catch (error) {
    next(error);
  }
});

googleCalendarRouter.get("/connect-url", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const providerEmail = String(me?.email || "").trim().toLowerCase();
    if (!providerEmail) {
      return res.status(400).json({ error: "Provider email is required on your NOVI account." });
    }

    const url = buildGoogleCalendarAuthUrl({
      providerId: me.id,
      expectedEmail: providerEmail,
    });

    res.json({ url, provider_email: providerEmail });
  } catch (error) {
    next(error);
  }
});

googleCalendarRouter.get("/callback", async (req, res) => {
  try {
    const code = String(req.query?.code || "");
    const state = String(req.query?.state || "");
    const oauthError = String(req.query?.error || "");

    if (oauthError) {
      return res.redirect(profileRedirect({ google_calendar: "denied" }));
    }
    if (!code || !state) {
      return res.redirect(profileRedirect({ google_calendar: "error", reason: "missing_code" }));
    }

    const { providerId, expectedEmail } = verifyOAuthState(state);
    const tokenData = await exchangeGoogleCalendarCode(code);

    if (!tokenData.googleEmail) {
      return res.redirect(profileRedirect({ google_calendar: "error", reason: "no_email" }));
    }

    if (expectedEmail && tokenData.googleEmail !== expectedEmail) {
      return res.redirect(
        profileRedirect({
          google_calendar: "error",
          reason: "email_mismatch",
          expected: expectedEmail,
          got: tokenData.googleEmail,
        })
      );
    }

    await upsertProviderGoogleCalendarConnection({
      provider_id: providerId,
      google_email: tokenData.googleEmail,
      access_token: tokenData.accessToken,
      refresh_token: tokenData.refreshToken,
      token_expiry: tokenData.expiryDate,
      scopes: tokenData.scopes,
    });

    return res.redirect(profileRedirect({ google_calendar: "connected" }));
  } catch (error) {
    console.error("[google-calendar] oauth_callback_failed", error?.message || error);
    return res.redirect(profileRedirect({ google_calendar: "error", reason: "callback_failed" }));
  }
});

googleCalendarRouter.delete("/", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const removed = await deleteProviderGoogleCalendarConnection(me?.id);
    res.json({ ok: true, disconnected: removed });
  } catch (error) {
    next(error);
  }
});
