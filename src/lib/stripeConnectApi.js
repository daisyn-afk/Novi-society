import { adminApiRequest } from "@/api/adminApiRequest";

const BASE = "/admin/integrations/stripe-connect";

export function fetchStripeConnectStatus({ refresh = false, live = true } = {}) {
  const params = new URLSearchParams();
  if (refresh) params.set("refresh", "true");
  else if (live) params.set("live", "true");
  const qs = params.toString() ? `?${params.toString()}` : "";
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
      message: "Returned from Stripe. Your setup status is shown below.",
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
