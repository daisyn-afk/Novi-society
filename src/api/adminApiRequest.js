/** Shared fetch for Express admin API (template courses, scheduled courses). */

/**
 * In dev, if VITE_APP_API_BASE_URL points at localhost, use same-origin `/admin/...` so Vite's
 * proxy forwards to 127.0.0.1:8787. Avoids the browser opening :8787 directly (IPv6 / firewall issues).
 * Remote staging URLs in dev stay as-is.
 */
function resolveAdminApiBaseUrl() {
  const raw = (import.meta.env.VITE_APP_API_BASE_URL || "").trim();
  if (!import.meta.env.DEV) return raw;
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1") return "";
  } catch {
    return raw;
  }
  return raw;
}

const API_BASE_URL = resolveAdminApiBaseUrl();

export async function adminApiRequest(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  let response;
  try {
    response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
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
