import { buildSetPasswordErrorUrl } from "./passwordResetHash.js";

const RECOVERY_HASH_KEY = "novi_recovery_hash";

function parseHashParams(hash) {
  const raw = String(hash || "");
  if (!raw || raw === "#") return null;
  return new URLSearchParams(raw.startsWith("#") ? raw.slice(1) : raw);
}

/**
 * Redirect before React loads. Returns true if app boot should be skipped.
 */
export function bootstrapPasswordResetFromHash() {
  if (typeof window === "undefined") return false;

  const hash = window.location.hash || "";
  const params = parseHashParams(hash);
  if (!params) return false;

  const error = params.get("error");
  const errorCode = params.get("error_code");
  const type = String(params.get("type") || "").toLowerCase();
  const accessToken = params.get("access_token") || "";

  const isAuthError = Boolean(error || errorCode);
  const isRecovery = (type === "recovery" || type === "invite") && Boolean(accessToken);

  if (!isAuthError && !isRecovery) return false;

  if (window.location.pathname === "/set-password") {
    return false;
  }

  if (isAuthError) {
    const description = decodeURIComponent(
      String(params.get("error_description") || "").replace(/\+/g, " ")
    );
    const path = buildSetPasswordErrorUrl({ error, errorCode, description });
    window.location.replace(`${window.location.origin}${path}`);
    return true;
  }

  try {
    sessionStorage.setItem(RECOVERY_HASH_KEY, hash);
  } catch {
    // ignore
  }
  window.location.replace(`${window.location.origin}/set-password?auth_recovery=1`);
  return true;
}
