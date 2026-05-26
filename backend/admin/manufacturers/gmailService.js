import { google } from "googleapis";
import {
  createOAuth2Client,
  signOAuthState,
} from "./googleCalendarService.js";
import {
  getProviderGoogleConnection,
  hasGmailScope,
  updateProviderGoogleTokens,
  upsertProviderGoogleConnection,
} from "./providerGoogleConnectionRepository.js";
import {
  getRepThread,
  touchRepThreadSync,
  upsertRepThread,
} from "./providerRepGmailThreadsRepository.js";

// Gmail-side of the provider's Google connection.
//
// Scopes (Q8): we ask for gmail.modify (read + mark-as-read) and gmail.send.
// gmail.modify is a strict superset of gmail.readonly, so we omit readonly to
// keep the consent screen short.

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
];

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function gmailRedirectUri() {
  return (
    process.env.GOOGLE_GMAIL_REDIRECT_URI ||
    `${process.env.APP_BASE_URL || "http://127.0.0.1:8787"}/admin/integrations/gmail/callback`
  );
}

function gmailOAuth2Client() {
  const oauth2 = createOAuth2Client();
  // Override the redirect URI with the Gmail-specific callback so the same
  // OAuth client app handles both flows distinctly.
  oauth2.redirectUri = gmailRedirectUri();
  return oauth2;
}

export function isGmailOAuthConfigured() {
  try {
    createOAuth2Client();
    return true;
  } catch {
    return false;
  }
}

function notConnectedError() {
  const err = new Error(
    "Google is not connected. Connect Google in your Profile settings first."
  );
  err.statusCode = 400;
  err.code = "GOOGLE_NOT_CONNECTED";
  return err;
}

function gmailScopeMissingError() {
  const err = new Error(
    "Gmail messaging permission is not granted. Click Connect Gmail in Message Rep to add it."
  );
  err.statusCode = 400;
  err.code = "GMAIL_SCOPE_MISSING";
  return err;
}

export function buildGmailAuthUrl({ providerId, expectedEmail }) {
  const oauth2 = gmailOAuth2Client();
  const state = signOAuthState({
    providerId: String(providerId),
    expectedEmail: String(expectedEmail || "").trim().toLowerCase(),
    purpose: "gmail",
    exp: Date.now() + 10 * 60 * 1000,
  });

  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    include_granted_scopes: true, // Q2: merge with any existing Calendar grant.
    state,
    login_hint: expectedEmail || undefined,
  });
}

export async function exchangeGmailCode(code) {
  const oauth2 = gmailOAuth2Client();
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

export async function persistGmailGrant({
  providerId,
  googleEmail,
  accessToken,
  refreshToken,
  expiryDate,
  scopes,
}) {
  return upsertProviderGoogleConnection({
    provider_id: providerId,
    google_email: googleEmail,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expiry: expiryDate,
    scopes,
    merge_scopes: true, // Keep Calendar scopes from any prior grant.
  });
}

async function getAuthedGmail(providerId) {
  const connection = await getProviderGoogleConnection(providerId);
  if (!connection?.access_token) throw notConnectedError();
  if (!hasGmailScope(connection)) throw gmailScopeMissingError();

  const oauth2 = gmailOAuth2Client();
  oauth2.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token || undefined,
    expiry_date: connection.token_expiry
      ? new Date(connection.token_expiry).getTime()
      : undefined,
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
      console.error("[gmail] token_refresh_save_failed", {
        provider_id: providerId,
        error_message: err?.message || String(err),
      });
    });
  });

  return { gmail: google.gmail({ version: "v1", auth: oauth2 }), connection };
}

// ---------- Thread discovery (Q4 first-open behavior) ----------

/**
 * Returns the stored thread row if fresh; otherwise asks Gmail for the most
 * recent thread matching from:repEmail OR to:repEmail and upserts the
 * pointer. May return null if the provider has never emailed this rep.
 */
export async function findOrDiscoverThread({ providerId, repEmail, manufacturerId }) {
  const email = String(repEmail || "").trim().toLowerCase();
  if (!email) return null;

  const existing = await getRepThread({ providerId, repEmail: email });
  const isStale =
    existing && Date.now() - new Date(existing.last_synced_at).getTime() > THIRTY_DAYS_MS;

  if (existing && !isStale) return existing;

  const { gmail } = await getAuthedGmail(providerId);
  const { data } = await gmail.users.threads.list({
    userId: "me",
    q: `from:${email} OR to:${email}`,
    maxResults: 1,
  });
  const found = data.threads?.[0];
  if (!found) return existing || null;

  return upsertRepThread({
    provider_id: providerId,
    rep_email: email,
    manufacturer_id: manufacturerId || existing?.manufacturer_id || null,
    thread_id: found.id,
    last_history_id: found.historyId || null,
    last_synced_at: new Date(),
  });
}

// ---------- Thread fetch + mark-as-read (Q5 + Q8) ----------

function headerValue(message, name) {
  const headers = message?.payload?.headers || [];
  const found = headers.find(
    (h) => String(h.name || "").toLowerCase() === name.toLowerCase()
  );
  return found?.value || "";
}

function decodeBase64UrlToString(b64url) {
  if (!b64url) return "";
  try {
    return Buffer.from(b64url, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

/**
 * Walk the MIME parts tree and pull out:
 *   - bodyText  (first text/plain part)
 *   - bodyHtml  (first text/html part)
 *   - attachments [{ id, filename, mimeType, size }]
 */
function flattenMessageParts(payload) {
  const result = { bodyText: "", bodyHtml: "", attachments: [] };
  if (!payload) return result;

  const visit = (part) => {
    if (!part) return;
    const mime = String(part.mimeType || "");
    const filename = part.filename || "";
    const isAttachment = Boolean(filename) && Boolean(part.body?.attachmentId);

    if (isAttachment) {
      result.attachments.push({
        id: part.body.attachmentId,
        filename,
        mime_type: mime,
        size: part.body.size || 0,
      });
    } else if (mime === "text/plain" && !result.bodyText && part.body?.data) {
      result.bodyText = decodeBase64UrlToString(part.body.data);
    } else if (mime === "text/html" && !result.bodyHtml && part.body?.data) {
      result.bodyHtml = decodeBase64UrlToString(part.body.data);
    }

    if (Array.isArray(part.parts)) {
      for (const child of part.parts) visit(child);
    }
  };

  visit(payload);
  // Single-part messages put the body directly on payload.body.data.
  if (!result.bodyText && !result.bodyHtml && payload.body?.data) {
    const mime = String(payload.mimeType || "");
    const decoded = decodeBase64UrlToString(payload.body.data);
    if (mime === "text/html") result.bodyHtml = decoded;
    else result.bodyText = decoded;
  }
  return result;
}

function serializeMessage(message) {
  const { bodyText, bodyHtml, attachments } = flattenMessageParts(message.payload);
  return {
    id: message.id,
    thread_id: message.threadId,
    from: headerValue(message, "From"),
    to: headerValue(message, "To"),
    cc: headerValue(message, "Cc"),
    subject: headerValue(message, "Subject"),
    date: headerValue(message, "Date"),
    snippet: message.snippet || "",
    label_ids: message.labelIds || [],
    is_unread: (message.labelIds || []).includes("UNREAD"),
    body_text: bodyText,
    body_html: bodyHtml,
    attachments,
    internal_date: message.internalDate || null,
  };
}

export async function fetchThread({ providerId, threadId }) {
  const { gmail } = await getAuthedGmail(providerId);
  const { data } = await gmail.users.threads.get({
    userId: "me",
    id: String(threadId),
    format: "full",
  });

  const messages = (data.messages || []).map(serializeMessage);

  // Mark-as-read in batch (Q8). Failures are non-fatal.
  const unreadIds = messages.filter((m) => m.is_unread).map((m) => m.id);
  if (unreadIds.length > 0) {
    try {
      await gmail.users.messages.batchModify({
        userId: "me",
        requestBody: { ids: unreadIds, removeLabelIds: ["UNREAD"] },
      });
      for (const m of messages) m.is_unread = false;
    } catch (err) {
      console.warn(
        "[gmail] mark_read_failed",
        err?.message || String(err)
      );
    }
  }

  return {
    thread_id: data.id,
    history_id: data.historyId || null,
    subject: messages[0]?.subject || "",
    messages,
  };
}

// ---------- RFC 2822 assembly + send/reply (Q3 + Q9 + Q13) ----------

function encodeRfc2047Word(value) {
  // Encode non-ASCII characters in header values per RFC 2047, so display
  // names like "José Smith" survive transit.
  const s = String(value || "");
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  return `=?utf-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

function formatAddress(displayName, email) {
  const addr = String(email || "").trim();
  if (!displayName) return addr;
  return `${encodeRfc2047Word(displayName)} <${addr}>`;
}

function buildQuotedBlock(previousMessage) {
  if (!previousMessage) return "";
  const date = headerValue(previousMessage, "Date") || "";
  const from = headerValue(previousMessage, "From") || "";
  const { bodyText, bodyHtml } = flattenMessageParts(previousMessage.payload);
  const source = bodyText || stripTags(bodyHtml);
  if (!source) return "";

  const quoted = source
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

  const intro = [date, from].filter(Boolean).join(", ");
  return intro ? `On ${intro} wrote:\n${quoted}` : quoted;
}

function stripTags(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

function buildSignature(me) {
  return [me?.full_name, me?.practice_name, me?.email]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join("\n");
}

function buildRawMessage({
  fromAddress,
  toAddress,
  subject,
  body,
  inReplyTo,
  references,
  quotedBlock,
  signature,
}) {
  const safeSubject = encodeRfc2047Word(subject || "(no subject)");
  const fullBody = [
    String(body || "").trim(),
    quotedBlock ? `\n\n${quotedBlock}` : "",
    signature ? `\n\n-- \n${signature}` : "",
  ]
    .join("")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "\r\n");

  const headers = [
    `From: ${fromAddress}`,
    `To: ${toAddress}`,
    `Subject: ${safeSubject}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references ? `References: ${references}` : null,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
  ]
    .filter(Boolean)
    .join("\r\n");

  const raw = `${headers}\r\n\r\n${fullBody}`;
  return Buffer.from(raw, "utf8").toString("base64url");
}

export async function sendNewMessage({
  providerId,
  repEmail,
  manufacturerId,
  subject,
  body,
  me,
}) {
  const { gmail, connection } = await getAuthedGmail(providerId);
  const cleanRepEmail = String(repEmail || "").trim().toLowerCase();
  if (!cleanRepEmail) {
    const err = new Error("Recipient email is required.");
    err.statusCode = 400;
    throw err;
  }

  const fromAddress = formatAddress(me?.full_name, connection.google_email);
  const toAddress = formatAddress(null, cleanRepEmail);

  const raw = buildRawMessage({
    fromAddress,
    toAddress,
    subject: subject || "(no subject)",
    body,
    signature: buildSignature(me),
  });

  const { data } = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  await upsertRepThread({
    provider_id: providerId,
    rep_email: cleanRepEmail,
    manufacturer_id: manufacturerId || null,
    thread_id: data.threadId,
    last_message_id: data.id,
    last_synced_at: new Date(),
  });

  return { id: data.id, thread_id: data.threadId };
}

export async function replyToThread({ providerId, threadId, body, me }) {
  const { gmail, connection } = await getAuthedGmail(providerId);

  const { data: thread } = await gmail.users.threads.get({
    userId: "me",
    id: String(threadId),
    format: "full",
  });
  const messages = thread.messages || [];
  if (messages.length === 0) {
    const err = new Error("Thread is empty; cannot reply.");
    err.statusCode = 400;
    throw err;
  }

  const lastMessage = messages[messages.length - 1];
  const baseSubject =
    headerValue(messages[0], "Subject") ||
    headerValue(lastMessage, "Subject") ||
    "(no subject)";
  const reSubject = /^re:\s*/i.test(baseSubject)
    ? baseSubject
    : `Re: ${baseSubject}`;
  const lastMessageId = headerValue(lastMessage, "Message-ID") || headerValue(lastMessage, "Message-Id");
  const existingRefs = headerValue(lastMessage, "References");
  const references = [existingRefs, lastMessageId].filter(Boolean).join(" ").trim();

  // Reply to whoever sent the most recent message (the rep, or — if the last
  // message is the provider's own reply — the original To address). For the
  // simple "rep <-> provider" case this is just the rep's address.
  const fromHeader = headerValue(lastMessage, "From");
  const toHeader = headerValue(lastMessage, "To");
  const replyTo = inferReplyRecipient({
    fromHeader,
    toHeader,
    providerEmail: connection.google_email,
  });

  const fromAddress = formatAddress(me?.full_name, connection.google_email);

  const raw = buildRawMessage({
    fromAddress,
    toAddress: replyTo,
    subject: reSubject,
    body,
    inReplyTo: lastMessageId || undefined,
    references: references || lastMessageId || undefined,
    quotedBlock: buildQuotedBlock(lastMessage),
    signature: buildSignature(me),
  });

  const { data } = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId: String(threadId) },
  });

  const stored = await getRepThread({
    providerId,
    repEmail: extractEmail(replyTo),
  });
  if (stored) {
    await touchRepThreadSync(stored.id, {
      lastMessageId: data.id,
    });
  }

  return { id: data.id, thread_id: data.threadId };
}

function extractEmail(addressHeader) {
  const m = String(addressHeader || "").match(/<([^>]+)>/);
  return (m ? m[1] : String(addressHeader || "")).trim().toLowerCase();
}

function inferReplyRecipient({ fromHeader, toHeader, providerEmail }) {
  const fromEmail = extractEmail(fromHeader);
  const toEmail = extractEmail(toHeader);
  const me = String(providerEmail || "").trim().toLowerCase();

  // If the last message is from the rep, reply to that From address.
  // If the last message is from us, reply to whoever it was originally sent to.
  if (fromEmail && fromEmail !== me) return fromHeader || fromEmail;
  return toHeader || toEmail || fromHeader;
}

// ---------- Attachment streaming (Q7) ----------

export async function streamAttachment({
  providerId,
  messageId,
  attachmentId,
}) {
  const { gmail } = await getAuthedGmail(providerId);
  const { data } = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId: String(messageId),
    id: String(attachmentId),
  });
  return Buffer.from(String(data.data || ""), "base64url");
}
