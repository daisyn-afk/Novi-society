import { createPageUrl } from "@/utils";

export const CHECKOUT_RETURN_LANDING = "landing";
export const CHECKOUT_RETURN_PROVIDER = "provider";
export const CHECKOUT_RETURN_STORAGE_KEY = "novi_checkout_return_to";

/** Remember return target before Stripe redirect (same-tab navigation). */
export function stashCheckoutReturnTo(returnTo) {
  try {
    sessionStorage.setItem(CHECKOUT_RETURN_STORAGE_KEY, returnTo);
  } catch {
    // ignore private mode / blocked storage
  }
}

function readAndClearStashedReturnTo() {
  try {
    const value = sessionStorage.getItem(CHECKOUT_RETURN_STORAGE_KEY);
    sessionStorage.removeItem(CHECKOUT_RETURN_STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}

function normalizeReturnTo(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === CHECKOUT_RETURN_PROVIDER || raw === "provider_dashboard") {
    return CHECKOUT_RETURN_PROVIDER;
  }
  return CHECKOUT_RETURN_LANDING;
}

/**
 * Where "Return to NOVI Society" should go after course payment.
 * Prefer explicit checkout origin over auth state (logged-in users can pay from landing).
 */
export function resolvePostCheckoutReturnPath({ returnTo } = {}) {
  const stashed = readAndClearStashedReturnTo();
  const context = normalizeReturnTo(returnTo ?? stashed ?? CHECKOUT_RETURN_LANDING);

  if (context === CHECKOUT_RETURN_PROVIDER) {
    return createPageUrl("ProviderDashboard");
  }
  return "/";
}
