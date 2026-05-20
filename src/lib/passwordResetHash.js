const PASSWORD_RESET_ERROR_KEY = "novi_password_reset_error";

export function parseAuthHash(rawHash) {
  const hash = String(rawHash || "").startsWith("#")
    ? String(rawHash || "").slice(1)
    : String(rawHash || "");
  const params = new URLSearchParams(hash);

  const error = params.get("error");
  const errorCode = params.get("error_code");
  if (error || errorCode) {
    const description = decodeURIComponent(
      String(params.get("error_description") || "").replace(/\+/g, " ")
    );
    return {
      kind: "error",
      error,
      errorCode,
      message: formatPasswordResetErrorMessage({ error, errorCode, description })
    };
  }

  const type = String(params.get("type") || "").toLowerCase();
  const isPasswordSetupFlow = type === "recovery" || type === "invite";
  const accessToken = params.get("access_token") || "";
  const refreshToken = params.get("refresh_token") || "";
  if (isPasswordSetupFlow && accessToken) {
    return {
      kind: "recovery",
      accessToken,
      refreshToken,
      type
    };
  }

  return null;
}

export function formatPasswordResetErrorMessage({ error, errorCode, description }) {
  const code = String(errorCode || "").toLowerCase();
  const desc = String(description || "").toLowerCase();

  if (code === "otp_expired" || desc.includes("expired")) {
    return "This password reset link has expired. Please ask the NOVI team to send you a new reset email.";
  }
  if (code === "otp_disabled" || desc.includes("invalid")) {
    return "This password reset link is invalid or has already been used. Please request a new reset email.";
  }
  if (String(error || "").toLowerCase() === "access_denied") {
    return "This password reset link is no longer valid. Please request a new reset email from the NOVI team.";
  }
  if (description) {
    return description.charAt(0).toUpperCase() + description.slice(1);
  }
  return "This password reset link is invalid. Please request a new reset email.";
}

export function storePasswordResetError(payload) {
  try {
    sessionStorage.setItem(PASSWORD_RESET_ERROR_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function consumePasswordResetError() {
  try {
    const raw = sessionStorage.getItem(PASSWORD_RESET_ERROR_KEY);
    sessionStorage.removeItem(PASSWORD_RESET_ERROR_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPasswordResetError() {
  try {
    sessionStorage.removeItem(PASSWORD_RESET_ERROR_KEY);
  } catch {
    // ignore
  }
}

/** Read auth error passed via query string (works when sessionStorage is unavailable). */
export function parseAuthSearchQuery(search = "") {
  const params = new URLSearchParams(search || (typeof window !== "undefined" ? window.location.search : ""));
  if (params.get("auth_error") !== "1") return null;
  const description = decodeURIComponent(
    String(params.get("error_description") || "").replace(/\+/g, " ")
  );
  return {
    kind: "error",
    error: params.get("error") || "access_denied",
    errorCode: params.get("error_code") || "",
    message: formatPasswordResetErrorMessage({
      error: params.get("error"),
      errorCode: params.get("error_code"),
      description
    })
  };
}

export function buildSetPasswordErrorUrl({ error, errorCode, description }) {
  const qs = new URLSearchParams();
  qs.set("auth_error", "1");
  if (error) qs.set("error", error);
  if (errorCode) qs.set("error_code", errorCode);
  if (description) qs.set("error_description", description);
  return `/set-password?${qs.toString()}`;
}
