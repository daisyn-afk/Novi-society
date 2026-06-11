/**
 * Single source of truth for resolving the public frontend base URL used in
 * Supabase auth email links (invite, recovery, password-reset redirectTo).
 *
 * Priority (highest → lowest):
 *   1. frontend_origin / Origin / Referer from the incoming request (trusted hosts)
 *   2. APP_BASE_URL env var (skipped on preview when it points at live)
 *   3. Vercel production → https://novisociety.com
 *   4. Local dev fallback (http://localhost:5173)
 *   5. Vercel preview URL (non-production deployments only)
 *
 * Email links must NEVER use *.vercel.app on the live site — users receive
 * novisociety.com links even when admins or env vars still reference Vercel.
 */

const LOCAL_DEV_ORIGIN = "http://localhost:5173";
const CANONICAL_LIVE_ORIGIN = "https://novisociety.com";

const _isDev = !process.env.VERCEL && process.env.NODE_ENV !== "production";
const _isLiveDeployment =
  process.env.VERCEL_ENV === "production" ||
  (process.env.VERCEL === "1" && process.env.NODE_ENV === "production");

const CANONICAL_PRODUCTION_URL = CANONICAL_LIVE_ORIGIN;

function _isPreviewDeployment() {
  return process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development";
}

/** Resolved once at module load from explicit env only (never Vercel injection). */
function _resolveEnvBaseUrl() {
  const explicit = String(process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!explicit) return "";
  const resolved = toPublicFrontendBaseUrl(explicit);
  // Preview/staging often copies APP_BASE_URL=novisociety.com from production — ignore that.
  if (_isPreviewDeployment() && resolved === CANONICAL_PRODUCTION_URL) {
    return "";
  }
  return resolved;
}

const _envBaseUrl = _resolveEnvBaseUrl();

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
    // Only the production deployment uses the custom domain in outbound links.
    // Preview/staging *.vercel.app URLs must stay on preview so Stripe returns
    // users to the same environment they started from (not live).
    if (process.env.VERCEL_ENV === "production" || _isLiveDeployment) {
      return CANONICAL_PRODUCTION_URL;
    }
    return normalized;
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
 * @param {object|null} req  Express request object, or a plain {origin, referer, body}
 *                           shape, or null for background/cron callers.
 * @returns {string}         e.g. "https://novisociety.com" or "http://localhost:5173"
 */
export function resolveAppBaseUrl(req) {
  // 1. Browser / client origin — must win over APP_BASE_URL so dev preview checkouts
  //    return to the same host the user started on (not novisociety.com).
  const requestOrigin = _readFrontendOriginFromReq(req);
  if (requestOrigin && _isTrustedFrontendOrigin(requestOrigin)) {
    const resolved = toPublicFrontendBaseUrl(requestOrigin);
    console.info(`[frontendBaseUrl] using request origin: ${resolved}`);
    return resolved;
  }

  // 2. Operator-configured env (canonicalized so vercel.app → novisociety.com on prod only)
  if (_envBaseUrl) {
    console.info(`[frontendBaseUrl] using APP_BASE_URL: ${_envBaseUrl}`);
    return _envBaseUrl;
  }

  // 3. Production API with no trusted origin → canonical live domain
  if (_isLiveDeployment) {
    console.info(`[frontendBaseUrl] using canonical production URL: ${CANONICAL_PRODUCTION_URL}`);
    return CANONICAL_PRODUCTION_URL;
  }

  // 4. Local dev fallback
  if (_isDev) {
    console.warn(
      "[frontendBaseUrl] APP_BASE_URL not set and no request origin available; " +
        `falling back to ${LOCAL_DEV_ORIGIN}. ` +
        "Set APP_BASE_URL in .env for consistent redirect URLs."
    );
    return LOCAL_DEV_ORIGIN;
  }

  // 5. Vercel preview / staging deployment URL
  const vercel = process.env.VERCEL_URL || "";
  if (vercel) {
    const preview = `https://${vercel}`.replace(/\/+$/, "");
    console.info(`[frontendBaseUrl] using Vercel preview URL: ${preview}`);
    return preview;
  }

  return LOCAL_DEV_ORIGIN;
}

/**
 * Build the complete redirectTo URL for Supabase generateLink / password reset.
 * This is the ONLY place `/set-password` should be appended.
 *
 * @param {object|null} req  Same as resolveAppBaseUrl.
 * @returns {string}         e.g. "https://novisociety.com/set-password"
 */
export function resolveSetPasswordUrl(req) {
  const url = `${resolveAppBaseUrl(req)}/set-password`;
  console.info(`[frontendBaseUrl] set-password redirectTo: ${url}`);
  return url;
}

// ---------------------------------------------------------------------------
// Legacy exports – kept so callers that haven't been migrated yet still compile.
// ---------------------------------------------------------------------------

/**
 * @deprecated Use resolveAppBaseUrl(req) instead.
 */
export function resolveFrontendBaseUrl({ frontendOrigin, requestOrigin } = {}) {
  const fakeReq = {
    origin: frontendOrigin || requestOrigin || "",
    referer: requestOrigin || "",
    body: { frontend_origin: frontendOrigin || requestOrigin || "" },
  };
  return resolveAppBaseUrl(fakeReq);
}

/**
 * @deprecated Use resolveSetPasswordUrl(req) instead.
 */
export function buildSetPasswordRedirectUrl(baseUrl) {
  if (baseUrl && _isValidHttpUrl(baseUrl)) {
    return `${toPublicFrontendBaseUrl(baseUrl)}/set-password`;
  }
  return resolveSetPasswordUrl(null);
}
