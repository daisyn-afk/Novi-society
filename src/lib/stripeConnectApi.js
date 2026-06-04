import { adminApiRequest } from "@/api/adminApiRequest";

const BASE = "/admin/integrations/stripe-connect";

export function fetchStripeConnectStatus({ refresh = false } = {}) {
  const qs = refresh ? "?refresh=true" : "";
  return adminApiRequest(`${BASE}/status${qs}`, { method: "GET" });
}

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

  if (status === "return") {
    return {
      type: "success",
      message: "Stripe setup updated. Refreshing your connection status…",
      shouldRefresh: true,
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
