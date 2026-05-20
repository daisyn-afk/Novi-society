const appBaseUrl = (() => {
  const configured = String(process.env.APP_BASE_URL || "").trim();
  const runtimeVercelUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "";
  const fallback = configured || (runtimeVercelUrl ? `https://${runtimeVercelUrl}` : "http://localhost:5173");
  return fallback.replace(/\/+$/, "");
})();

/**
 * Resolve the public app URL for auth email links.
 * Prefers the browser origin sent by the admin UI, then request headers, then env.
 */
export function resolveFrontendBaseUrl({ frontendOrigin, requestOrigin } = {}) {
  const candidates = [
    frontendOrigin,
    requestOrigin,
    requestOrigin ? String(requestOrigin).split("/").slice(0, 3).join("/") : ""
  ].filter(Boolean);

  for (const raw of candidates) {
    try {
      const parsed = new URL(String(raw).trim());
      if (!/^https?:$/i.test(parsed.protocol)) continue;
      const host = String(parsed.hostname || "").toLowerCase();
      const isLocalHost =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.endsWith(".local");
      const explicitOrigin = Boolean(
        frontendOrigin && String(raw).trim() === String(frontendOrigin).trim()
      );
      if (isLocalHost && !explicitOrigin) {
        continue;
      }
      return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
    } catch {
      // try next candidate
    }
  }

  return appBaseUrl;
}

export function buildSetPasswordRedirectUrl(baseUrl) {
  const root = String(baseUrl || appBaseUrl).replace(/\/+$/, "");
  return `${root}/set-password`;
}
