import { adminApiRequest } from "@/api/adminApiRequest";

const BASE = "/admin/integrations/gmail";

export function fetchGmailStatus() {
  return adminApiRequest(`${BASE}/status`, { method: "GET" });
}

export function fetchGmailConnectUrl() {
  return adminApiRequest(`${BASE}/connect-url`, { method: "GET" });
}

export function fetchRepThreadPointer({ repEmail, manufacturerId } = {}) {
  const params = new URLSearchParams();
  if (repEmail) params.set("rep_email", repEmail);
  if (manufacturerId) params.set("manufacturer_id", manufacturerId);
  const qs = params.toString();
  return adminApiRequest(`${BASE}/threads${qs ? `?${qs}` : ""}`, { method: "GET" });
}

export function fetchThreadMessages(threadId) {
  return adminApiRequest(`${BASE}/threads/${encodeURIComponent(threadId)}`, {
    method: "GET",
  });
}

export function startGmailThread({ repEmail, subject, body, manufacturerId } = {}) {
  return adminApiRequest(`${BASE}/threads`, {
    method: "POST",
    body: JSON.stringify({
      rep_email: repEmail,
      subject,
      body,
      manufacturer_id: manufacturerId || null,
    }),
  });
}

export function sendGmailReply(threadId, body, { repEmail } = {}) {
  return adminApiRequest(
    `${BASE}/threads/${encodeURIComponent(threadId)}/reply`,
    {
      method: "POST",
      body: JSON.stringify({ body, rep_email: repEmail || "" }),
    }
  );
}

export function buildAttachmentUrl({ threadId, messageId, attachment }) {
  const params = new URLSearchParams();
  if (attachment?.filename) params.set("filename", attachment.filename);
  if (attachment?.mime_type) params.set("mime_type", attachment.mime_type);
  return `${BASE}/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(
    messageId
  )}/attachments/${encodeURIComponent(attachment.id)}?${params.toString()}`;
}

// Resolve the admin API base URL the same way adminApiRequest does, so
// attachment downloads (which need a Blob, not JSON) hit the proxied path.
const ACCESS_TOKEN_KEY = "novi_auth_access_token";

function resolveBlobUrl(apiPath) {
  const base = (import.meta.env.VITE_APP_API_BASE_URL || "").trim();
  let prefixed = apiPath;
  if (apiPath.startsWith("/admin/") || apiPath.startsWith("/webhooks/")) {
    prefixed = `/api${apiPath}`;
  }
  // In dev the Vite proxy forwards /api/* to the admin server; production uses
  // same-origin /api/admin/[...path].js handlers.
  if (!base) return prefixed;
  try {
    const u = new URL(base);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      if (import.meta.env.DEV) return prefixed;
      if (typeof window !== "undefined") {
        const here = window.location.hostname.toLowerCase();
        if (here !== "localhost" && here !== "127.0.0.1") return prefixed;
      }
    }
  } catch {
    /* fall through */
  }
  return `${base}${prefixed}`;
}

export async function downloadAttachment({ threadId, messageId, attachment }) {
  const path = buildAttachmentUrl({ threadId, messageId, attachment });
  const url = resolveBlobUrl(path);
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem(ACCESS_TOKEN_KEY) || ""
      : "";

  const response = await fetch(url, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body?.error || "";
    } catch {
      /* ignore */
    }
    throw new Error(
      detail || `Could not download attachment (HTTP ${response.status}).`
    );
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = attachment.filename || "attachment";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

export function gmailCallbackMessage(searchParams) {
  const status = searchParams.get("gmail");
  if (!status) return null;

  if (status === "connected") {
    return { type: "success", message: "Gmail connected for Message Rep." };
  }
  if (status === "denied") {
    return { type: "error", message: "Gmail connection was cancelled." };
  }

  const reason = searchParams.get("reason");
  if (reason === "email_mismatch") {
    const expected = searchParams.get("expected");
    return {
      type: "error",
      message: `Connect with the same Google account as your NOVI email${
        expected ? ` (${expected})` : ""
      }.`,
    };
  }

  return {
    type: "error",
    message: "Could not connect Gmail. Please try again.",
  };
}
