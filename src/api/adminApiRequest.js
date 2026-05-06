/** Shared fetch for Express admin API (template courses, scheduled courses). */

/**
 * If VITE_APP_API_BASE_URL points at localhost:
 * - In dev, use same-origin `/admin/...` so Vite proxy forwards to 127.0.0.1:8787.
 * - In non-local environments, also use same-origin so production does not try to call
 *   the viewer's own localhost by mistake.
 */
function resolveAdminApiBaseUrl() {
  const raw = (import.meta.env.VITE_APP_API_BASE_URL || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1") {
      if (import.meta.env.DEV) return "";
      if (typeof window !== "undefined") {
        const currentHost = window.location.hostname.toLowerCase();
        const isCurrentHostLocal = currentHost === "localhost" || currentHost === "127.0.0.1";
        if (!isCurrentHostLocal) return "";
      }
    }
  } catch {
    return raw;
  }
  return raw;
}

const API_BASE_URL = resolveAdminApiBaseUrl();
const ACCESS_TOKEN_KEY = "novi_auth_access_token";
const API_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_ADMIN_API_TIMEOUT_MS || 15000);

// Prepend "/api" to paths under /admin/ or /webhooks/ so API calls do not
// collide with React Router SPA routes (e.g. /admin dashboard page).
// Serverless functions live at /api/admin/[...path].js and /api/webhooks/[...path].js.
function toApiPath(path) {
  if (!path || typeof path !== "string") return path;
  if (path.startsWith("/api/")) return path;
  if (path.startsWith("/admin/") || path.startsWith("/webhooks/")) {
    return `/api${path}`;
  }
  return path;
}

export async function adminApiRequest(path, options = {}) {
  const url = `${API_BASE_URL}${toApiPath(path)}`;
  const timeoutMs = Number(options.timeoutMs || API_REQUEST_TIMEOUT_MS);
  const headers = { ...(options.headers || {}) };
  const hasContentType =
    Object.prototype.hasOwnProperty.call(headers, "Content-Type") ||
    Object.prototype.hasOwnProperty.call(headers, "content-type");

  if (!(options.body instanceof FormData) && !hasContentType) {
    headers["Content-Type"] = "application/json";
  }
  const hasAuthorization =
    Object.prototype.hasOwnProperty.call(headers, "Authorization") ||
    Object.prototype.hasOwnProperty.call(headers, "authorization");
  if (!hasAuthorization && typeof window !== "undefined") {
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY) || "";
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal =
      options.signal && typeof AbortSignal.any === "function"
        ? AbortSignal.any([options.signal, timeoutSignal])
        : options.signal || timeoutSignal;
    const { timeoutMs: _timeoutMs, ...fetchOptions } = options;
    response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal
    });
  } catch (e) {
    const isTimeout = String(e?.name || "").toLowerCase() === "timeouterror" || String(e?.message || "").toLowerCase().includes("timeout");
    const hint = isTimeout
      ? `Request timed out after ${timeoutMs}ms at ${url}.`
      : `Run npm run dev (Vite + admin API). Ensure .env has DATABASE_URL so backend/admin does not exit. Request: ${url}`;
    const err = new Error(`Cannot reach admin API. ${hint}`);
    err.cause = e;
    throw err;
  }

  if (!response.ok) {
    let body = {};
    const rawText = await response.text().catch(() => "");
    try {
      body = rawText ? JSON.parse(rawText) : {};
    } catch {
      body = {};
    }

    let message =
      body.error ||
      `Request failed (${response.status}) at ${url}. Ensure backend is running and VITE_APP_API_BASE_URL is correct.`;
    if (Array.isArray(body.details) && body.details.length > 0) {
      message = `${message}: ${body.details.join("; ")}`;
    }
    const error = new Error(message);
    error.details = body.details;
    error.status = response.status;
    error.responseText = rawText;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}
