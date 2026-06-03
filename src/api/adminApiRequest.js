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
const REFRESH_TOKEN_KEY = "novi_auth_refresh_token";
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

async function tryRefreshAuthSession() {
  if (typeof window === "undefined") return false;
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY) || "";
  if (!refreshToken) return false;

  const response = await fetch(`${API_BASE_URL}${toApiPath("/admin/auth/refresh")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    return false;
  }

  const result = await response.json().catch(() => null);
  if (!result?.session?.access_token) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    return false;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, result.session.access_token);
  if (result.session.refresh_token) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, result.session.refresh_token);
  }
  return true;
}

function isAuthExpiredError(status, message) {
  if (status !== 401) return false;
  const m = String(message || "").toLowerCase();
  return (
    m.includes("expired") ||
    m.includes("invalid jwt") ||
    m.includes("invalid or expired token") ||
    m.includes("missing bearer token")
  );
}

export async function adminApiRequest(path, options = {}, retryOnAuthError = true) {
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
    const { timeoutMs: _timeoutMs, retryOnAuthError: _retry, ...fetchOptions } = options;
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

    if (retryOnAuthError && isAuthExpiredError(response.status, message)) {
      const refreshed = await tryRefreshAuthSession();
      if (refreshed) {
        return adminApiRequest(path, options, false);
      }
      message = "Your session expired. Please log in again.";
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
