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

export async function adminApiRequest(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = { ...(options.headers || {}) };
  const hasContentType =
    Object.prototype.hasOwnProperty.call(headers, "Content-Type") ||
    Object.prototype.hasOwnProperty.call(headers, "content-type");

  if (!(options.body instanceof FormData) && !hasContentType) {
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(url, {
      headers,
      ...options,
    });
  } catch (e) {
    const hint = `Run npm run dev (Vite + admin API). Ensure .env has DATABASE_URL so backend/admin does not exit. Request: ${url}`;
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

    const message =
      body.error ||
      `Request failed (${response.status}) at ${url}. Ensure backend is running and VITE_APP_API_BASE_URL is correct.`;
    const error = new Error(message);
    error.details = body.details;
    error.status = response.status;
    error.responseText = rawText;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}
