/**
 * Single source of truth for resolving the public frontend base URL used in
 * Supabase auth email links (invite, recovery, password-reset redirectTo).
 *
 * Priority (highest → lowest):
 *   1. APP_BASE_URL env var (canonicalized – vercel.app remapped in production)
 *   2. frontend_origin from API body (browser-sent by admin UI)
 *   3. Request Origin / Referer headers (trusted hosts only)
 *   4. Vercel production → https://novisociety.com
 *   5. Local dev fallback (http://localhost:5173)
 *   6. Vercel preview URL (non-production deployments only)
 *
 * Email links must NEVER use *.vercel.app on the live site — users receive
 * novisociety.com links even when admins or env vars still reference Vercel.
 */

const LOCAL_DEV_ORIGIN = "http://localhost:5173";
const CANONICAL_LIVE_ORIGIN = "https://novisociety.com";

const _isDev = !process.env.VERCEL && process.env.NODE_ENV !== "production";

const CANONICAL_PRODUCTION_URL = CANONICAL_LIVE_ORIGIN;

/** Resolved once at module load from explicit env only (never Vercel injection). */
const _envBaseUrl = (() => {
  const explicit = String(process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (explicit) return explicit;

const TRUSTED_FRONTEND_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "novisociety.com",
  "www.novisociety.com",
]);

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

function _hostname(raw) {
  try {
    return new URL(String(raw || "").trim()).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function _isVercelHost(host) {
  return String(host || "").toLowerCase().endsWith(".vercel.app");
}

function _isLocalHost(host) {
  const normalized = String(host || "").toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1";
}

function _isLegacyTypoHost(host) {
  const normalized = String(host || "").toLowerCase();
  return normalized === "novisocity.com" || normalized === "www.novisocity.com";
}

function _isProductionAliasHost(host) {
  return String(host || "").toLowerCase() === "www.novisociety.com";
}

function _isProductionCanonicalHost(host) {
  return String(host || "").toLowerCase() === "novisociety.com";
}

/**
 * Convert any candidate URL into the public frontend origin used in email links.
 * Live deployments never emit *.vercel.app — always novisociety.com instead.
 */
export function toPublicFrontendBaseUrl(candidate) {
  const normalized = _origin(candidate) || String(candidate || "").trim().replace(/\/+$/, "");
  if (!normalized || !_isValidHttpUrl(normalized)) return "";

  const host = _hostname(normalized);
  if (_isLocalHost(host)) return normalized;

  if (_isVercelHost(host)) {
    return _isLiveDeployment || !_isDev ? CANONICAL_PRODUCTION_URL : normalized;
  }

  if (_isLegacyTypoHost(host) || _isProductionAliasHost(host) || _isProductionCanonicalHost(host)) {
    return CANONICAL_PRODUCTION_URL;
  }

  return normalized;
}

function _isTrustedFrontendOrigin(origin) {
  const host = _hostname(origin);
  if (!host) return false;
  if (TRUSTED_FRONTEND_HOSTS.has(host)) return true;
  if (_isVercelHost(host)) return true;
  return false;
}

function _readFrontendOriginFromReq(req) {
  const fromBody = _origin(req?.body?.frontend_origin || req?.frontendOrigin || "");
  if (fromBody) return fromBody;

  const fromHeader = _origin(req?.headers?.origin || req?.origin || "");
  if (fromHeader) return fromHeader;

  const fromReferer = _origin(req?.headers?.referer || req?.referer || "");
  if (fromReferer) return fromReferer;

  return "";
}

/**
 * Resolve the public frontend base URL for a Supabase auth redirectTo value.
 *
 * @param {object|null} req  Express request object, or a plain {origin, referer}
 *                           shape, or null for background/cron callers.
 * @returns {string}         e.g. "https://novisociety.com" or "http://localhost:5173"
 */
export function resolveAppBaseUrl(req) {
  // 1. Operator-configured env (canonicalized so vercel.app → novisociety.com)
  if (_envBaseUrl) {
    console.info(`[frontendBaseUrl] using APP_BASE_URL: ${_envBaseUrl}`);
    return _envBaseUrl;
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
 * @returns {string}         e.g. "https://novisociety.com/set-password"
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
