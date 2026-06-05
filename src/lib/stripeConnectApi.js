import { adminApiRequest } from "@/api/adminApiRequest";

const BASE = "/admin/integrations/stripe-connect";

export function fetchStripeConnectStatus({ refresh = false, live = true } = {}) {
  const params = new URLSearchParams();
  if (refresh) params.set("refresh", "true");
  else if (live) params.set("live", "true");
  const qs = params.toString() ? `?${params.toString()}` : "";
  return adminApiRequest(`${BASE}/status${qs}`, { method: "GET" });
}

export function fetchStripeConnectOAuthUrl(returnPath = "/ProviderPractice") {
  const params = new URLSearchParams({ return_path: returnPath });
  return adminApiRequest(`${BASE}/oauth/url?${params.toString()}`, { method: "GET" });
}

/** Routes to OAuth (new providers) or account-link continue setup (existing accounts). */
export function fetchStripeConnectUrl(returnPath = "/ProviderPractice") {
  const params = new URLSearchParams({ return_path: returnPath });
  return adminApiRequest(`${BASE}/connect-url?${params.toString()}`, { method: "GET" });
}

export function refreshStripeConnectStatus() {
  return adminApiRequest(`${BASE}/refresh`, { method: "POST" });
}

export function stripeConnectCallbackMessage(searchParams) {
  const status = searchParams.get("stripe_connect");
  if (!status) return null;

  if (status === "connected") {
    return {
      type: "success",
      message: "Stripe account connected. Your setup status is shown below.",
      shouldRefresh: true,
    };
  }
  if (status === "return") {
    return {
      type: "success",
      message: "Returned from Stripe. Your setup status is shown below.",
      shouldRefresh: true,
    };
  }
  if (status === "denied") {
    return {
      type: "error",
      message: "Stripe connection was cancelled. You can try again when ready.",
    };
  }
  if (status === "error") {
    return {
      type: "error",
      message: "Stripe connection failed. Please try again or contact support.",
    };
  }
  if (status === "refresh") {
    return {
      type: "error",
      message: "Stripe setup link expired. Click Connect Stripe to continue.",
    };
  }
  return null;
}
