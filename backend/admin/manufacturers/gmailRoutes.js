import { Router } from "express";
import { getMeFromAccessToken } from "../auth/service.js";
import { verifyOAuthState } from "./googleCalendarService.js";
import {
  buildGmailAuthUrl,
  exchangeGmailCode,
  fetchThread,
  findOrDiscoverThread,
  isGmailOAuthConfigured,
  persistGmailGrant,
  replyToThread,
  sendNewMessage,
  streamAttachment,
} from "./gmailService.js";
import {
  getProviderGoogleConnection,
  hasGmailScope,
} from "./providerGoogleConnectionRepository.js";
import { getRepThread } from "./providerRepGmailThreadsRepository.js";

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
  const base =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:5173";
  const url = new URL("/ProviderProfile", base.replace(/\/$/, ""));
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

export const gmailRouter = Router();

// ---------- Status + connect URL ----------

gmailRouter.get("/status", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const connection = await getProviderGoogleConnection(me?.id);
    const providerEmail = String(me?.email || "").trim().toLowerCase();

    res.json({
      configured: isGmailOAuthConfigured(),
      gmail_connected: Boolean(connection?.access_token) && hasGmailScope(connection),
      google_connected: Boolean(connection?.access_token),
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

gmailRouter.get("/connect-url", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const providerEmail = String(me?.email || "").trim().toLowerCase();
    if (!providerEmail) {
      return res
        .status(400)
        .json({ error: "Provider email is required on your NOVI account." });
    }

    const url = buildGmailAuthUrl({
      providerId: me.id,
      expectedEmail: providerEmail,
    });

    res.json({ url, provider_email: providerEmail });
  } catch (error) {
    next(error);
  }
});

gmailRouter.get("/callback", async (req, res) => {
  try {
    const code = String(req.query?.code || "");
    const state = String(req.query?.state || "");
    const oauthError = String(req.query?.error || "");

    if (oauthError) {
      return res.redirect(profileRedirect({ gmail: "denied" }));
    }
    if (!code || !state) {
      return res.redirect(
        profileRedirect({ gmail: "error", reason: "missing_code" })
      );
    }

    const { providerId, expectedEmail } = verifyOAuthState(state);
    const tokenData = await exchangeGmailCode(code);

    if (!tokenData.googleEmail) {
      return res.redirect(profileRedirect({ gmail: "error", reason: "no_email" }));
    }

    if (expectedEmail && tokenData.googleEmail !== expectedEmail) {
      return res.redirect(
        profileRedirect({
          gmail: "error",
          reason: "email_mismatch",
          expected: expectedEmail,
          got: tokenData.googleEmail,
        })
      );
    }

    await persistGmailGrant({
      providerId,
      googleEmail: tokenData.googleEmail,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiryDate: tokenData.expiryDate,
      scopes: tokenData.scopes,
    });

    return res.redirect(profileRedirect({ gmail: "connected" }));
  } catch (error) {
    console.error("[gmail] oauth_callback_failed", error?.message || error);
    return res.redirect(
      profileRedirect({ gmail: "error", reason: "callback_failed" })
    );
  }
});

// ---------- Threads ----------

// Look up the (provider, rep) thread without fetching messages. Returns
// { thread: null } when no thread exists yet so the dialog can render the
// first-message compose form.
gmailRouter.get("/threads", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const repEmail = String(req.query?.rep_email || "").trim().toLowerCase();
    const manufacturerId = String(req.query?.manufacturer_id || "").trim() || null;
    if (!repEmail) {
      return res.status(400).json({ error: "rep_email is required." });
    }

    const thread = await findOrDiscoverThread({
      providerId: me.id,
      repEmail,
      manufacturerId,
    });

    res.json({ thread });
  } catch (error) {
    next(error);
  }
});

// Live-fetch the full thread (Q5) and mark-as-read (Q8).
gmailRouter.get("/threads/:threadId", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const threadId = String(req.params.threadId || "").trim();
    if (!threadId) return res.status(400).json({ error: "threadId is required." });

    const data = await fetchThread({ providerId: me.id, threadId });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Start a new thread (first-message templated compose).
gmailRouter.post("/threads", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const { rep_email, subject, body, manufacturer_id } = req.body || {};
    const cleanBody = String(body || "").trim();
    if (!rep_email || !subject || !cleanBody) {
      return res
        .status(400)
        .json({ error: "rep_email, subject, and body are required." });
    }
    const result = await sendNewMessage({
      providerId: me.id,
      repEmail: rep_email,
      manufacturerId: manufacturer_id || null,
      subject,
      body: cleanBody,
      me,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// Reply to an existing thread (Q9 reply box).
gmailRouter.post("/threads/:threadId/reply", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const threadId = String(req.params.threadId || "").trim();
    const body = String(req.body?.body || "").trim();
    if (!threadId || !body) {
      return res.status(400).json({ error: "threadId and body are required." });
    }

    // Confirm the provider actually owns this thread before forwarding the
    // send to Gmail. (Defense in depth — the underlying call is also scoped
    // to the provider's own credentials.)
    const stored = await getRepThread({
      providerId: me.id,
      repEmail: req.body?.rep_email || "",
    });
    if (stored && stored.thread_id !== threadId) {
      return res
        .status(403)
        .json({ error: "Thread does not belong to this provider." });
    }

    const result = await replyToThread({
      providerId: me.id,
      threadId,
      body,
      me,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ---------- Attachments ----------

gmailRouter.get(
  "/threads/:threadId/messages/:messageId/attachments/:attachmentId",
  async (req, res, next) => {
    try {
      const { me } = await requireAuth(req);
      const messageId = String(req.params.messageId || "").trim();
      const attachmentId = String(req.params.attachmentId || "").trim();
      if (!messageId || !attachmentId) {
        return res
          .status(400)
          .json({ error: "messageId and attachmentId are required." });
      }

      const filename = String(req.query?.filename || "attachment");
      const mimeType =
        String(req.query?.mime_type || "") || "application/octet-stream";

      const buffer = await streamAttachment({
        providerId: me.id,
        messageId,
        attachmentId,
      });

      res.setHeader("Content-Type", mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(filename)}"`
      );
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
);
