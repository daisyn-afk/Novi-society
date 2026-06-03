import crypto from "node:crypto";
import { google } from "googleapis";
import {
  getProviderGoogleConnection,
  updateProviderGoogleTokens,
} from "./providerGoogleConnectionRepository.js";

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${process.env.APP_BASE_URL || "http://127.0.0.1:8787"}/admin/integrations/google-calendar/callback`;

  if (!clientId || !clientSecret) {
    const err = new Error(
      "Google Calendar OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET."
    );
    err.statusCode = 503;
    throw err;
  }

  return { clientId, clientSecret, redirectUri };
}

export function isGoogleCalendarOAuthConfigured() {
  try {
    getOAuthConfig();
    return true;
  } catch {
    return false;
  }
}

export function createOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function getStateSecret() {
  return (
    process.env.GOOGLE_OAUTH_STATE_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    "novi-google-oauth-state"
  );
}

export function signOAuthState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getStateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyOAuthState(state) {
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
  if (!parsed?.providerId || !parsed?.exp || Date.now() > Number(parsed.exp)) {
    const err = new Error("OAuth state expired.");
    err.statusCode = 400;
    throw err;
  }
  return parsed;
}

export function buildGoogleCalendarAuthUrl({ providerId, expectedEmail }) {
  const oauth2 = createOAuth2Client();
  const state = signOAuthState({
    providerId: String(providerId),
    expectedEmail: String(expectedEmail || "").trim().toLowerCase(),
    exp: Date.now() + 10 * 60 * 1000,
  });

  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: CALENDAR_SCOPES,
    state,
    login_hint: expectedEmail || undefined,
  });
}

export async function exchangeGoogleCalendarCode(code) {
  const oauth2 = createOAuth2Client();
  const { tokens } = await oauth2.getToken(String(code || ""));
  oauth2.setCredentials(tokens);

  const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
  const { data: userInfo } = await oauth2Api.userinfo.get();
  const googleEmail = String(userInfo?.email || "").trim().toLowerCase();

  return {
    googleEmail,
    accessToken: tokens.access_token || "",
    refreshToken: tokens.refresh_token || "",
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scopes: Array.isArray(tokens.scope) ? tokens.scope.join(" ") : String(tokens.scope || ""),
  };
}

async function getAuthedCalendarClient(providerId) {
  const connection = await getProviderGoogleConnection(providerId);
  if (!connection?.access_token) {
    const err = new Error(
      "Google Calendar is not connected. Connect Google Calendar in your Profile settings first."
    );
    err.statusCode = 400;
    err.code = "GOOGLE_CALENDAR_NOT_CONNECTED";
    throw err;
  }

  const oauth2 = createOAuth2Client();
  oauth2.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token || undefined,
    expiry_date: connection.token_expiry ? new Date(connection.token_expiry).getTime() : undefined,
  });

  oauth2.on("tokens", (tokens) => {
    if (!tokens?.access_token) return;
    Promise.resolve(
      updateProviderGoogleTokens(providerId, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || undefined,
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      })
    ).catch((err) => {
      console.error("[google-calendar] token_refresh_save_failed", {
        provider_id: providerId,
        error_message: err?.message || String(err),
      });
    });
  });

  return {
    calendar: google.calendar({ version: "v3", auth: oauth2 }),
    connection,
  };
}

/**
 * Create a Google Meet event on the provider's primary calendar (invite sent from their email).
 */
export async function createProviderGoogleMeetEvent({
  providerId,
  summary,
  description = "",
  startDateTime,
  endDateTime,
  timeZone,
  attendeeEmails = [],
}) {
  const { calendar } = await getAuthedCalendarClient(providerId);

  const attendees = attendeeEmails
    .map((email) => String(email || "").trim().toLowerCase())
    .filter(Boolean)
    .map((email) => ({ email }));

  const event = {
    summary,
    description,
    start: { dateTime: startDateTime, timeZone },
    end: { dateTime: endDateTime, timeZone },
    attendees,
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  const response = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: event,
  });

  const meetLink =
    response.data?.hangoutLink ||
    response.data?.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")
      ?.uri ||
    "";

  return {
    eventId: response.data?.id || "",
    meetLink,
    htmlLink: response.data?.htmlLink || "",
  };
}
