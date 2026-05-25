/**
 * Single source of truth for resolving the public frontend base URL used in
 * Supabase auth email links (invite, recovery, password-reset redirectTo).
 *
 * Priority (highest → lowest):
 *   1. APP_BASE_URL env var (explicit operator config – always wins in production)
 *   2. VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL (Vercel runtime injection)
 *   3. Request origin header (browser-sent, exact value trusted)
 *   4. Hard localhost:5173 fallback (local dev only)
 *
 * The original `resolveFrontendBaseUrl` had an ambiguous two-argument signature
 * and silently dropped localhost origins when they arrived as `requestOrigin`
 * instead of `frontendOrigin`.  `resolveSetPasswordUrl` is the replacement for
 * all email-link `redirectTo` construction.
 */

const _isDev = !process.env.VERCEL && process.env.NODE_ENV !== "production";

/** Resolved once at module load from env; never changes at runtime. */
const _envBaseUrl = (() => {
  const explicit = String(process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (explicit) return explicit;

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "";
  if (vercel) return `https://${vercel}`.replace(/\/+$/, "");

  return ""; // resolved at call-time from request origin or dev fallback
})();

function _isValidHttpUrl(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    return /^https?:$/.test(u.protocol);
  } catch {
    return false;
  }
}

function _origin(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    if (!/^https?:$/.test(u.protocol)) return "";
    return `${u.protocol}//${u.host}`.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

/**
 * Resolve the public frontend base URL for a Supabase auth redirectTo value.
 *
 * @param {object|null} req  Express request object, or a plain {origin, referer}
 *                           shape, or null for background/cron callers.
 * @returns {string}         e.g. "https://app.novisociety.com" or "http://localhost:5173"
 */
export function resolveAppBaseUrl(req) {
  // 1. Operator-configured env (highest authority; always wins when set)
  if (_envBaseUrl) return _envBaseUrl;

  // 2. Origin header from the incoming request
  const originHeader =
    (req?.headers?.origin) ||
    (req?.origin) ||
    "";
  const fromOrigin = _origin(originHeader);
  if (fromOrigin) {
    if (_isDev) {
      // eslint-disable-next-line no-console
      console.info(`[frontendBaseUrl] using request origin: ${fromOrigin}`);
    }
    return fromOrigin;
  }

  // 3. Referer header (strip to origin)
  const refererHeader =
    (req?.headers?.referer) ||
    (req?.referer) ||
    "";
  const fromReferer = _origin(refererHeader);
  if (fromReferer && _isValidHttpUrl(fromReferer)) {
    if (_isDev) {
      // eslint-disable-next-line no-console
      console.info(`[frontendBaseUrl] using referer origin: ${fromReferer}`);
    }
    return fromReferer;
  }

  // 4. Local dev fallback
  if (_isDev) {
    // eslint-disable-next-line no-console
    console.warn(
      "[frontendBaseUrl] APP_BASE_URL not set and no request origin available; " +
        "falling back to http://localhost:5173. " +
        "Set APP_BASE_URL in .env for consistent redirect URLs."
    );
  }
  return "http://localhost:5173";
}

/**
 * Build the complete redirectTo URL for Supabase generateLink / password reset.
 * This is the ONLY place `/set-password` should be appended.
 *
 * @param {object|null} req  Same as resolveAppBaseUrl.
 * @returns {string}         e.g. "https://app.novisociety.com/set-password"
 */
export function resolveSetPasswordUrl(req) {
  return `${resolveAppBaseUrl(req)}/set-password`;
}

// ---------------------------------------------------------------------------
// Legacy exports – kept so callers that haven't been migrated yet still compile.
// They now delegate to the canonical helpers above.
// ---------------------------------------------------------------------------

/**
 * @deprecated Use resolveAppBaseUrl(req) instead.
 */
export function resolveFrontendBaseUrl({ frontendOrigin, requestOrigin } = {}) {
  // Build a minimal req-like object from the old positional args.
  const fakeReq = {
    origin: frontendOrigin || requestOrigin || "",
    referer: requestOrigin || "",
  };
  return resolveAppBaseUrl(fakeReq);
}

/**
 * @deprecated Use resolveSetPasswordUrl(req) instead.
 */
export function buildSetPasswordRedirectUrl(baseUrl) {
  // When a concrete base URL is passed (old callers already resolved it),
  // just append the path.  Otherwise fall back to the canonical resolver.
  if (baseUrl && _isValidHttpUrl(baseUrl)) {
    return `${String(baseUrl).replace(/\/+$/, "")}/set-password`;
  }
  return resolveSetPasswordUrl(null);
}
