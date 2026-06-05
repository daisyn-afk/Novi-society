import { adminApiRequest } from "@/api/adminApiRequest";

const BASE = "/admin/integrations/stripe-connect/platform";

export function fetchPlatformLegacyConnectStatus() {
  return adminApiRequest(`${BASE}/status`, { method: "GET" });
}

export function fetchPlatformLegacyOAuthUrl() {
  return adminApiRequest(`${BASE}/oauth/url`, { method: "GET" });
}

export function refreshPlatformLegacyConnectStatus() {
  return adminApiRequest(`${BASE}/refresh`, { method: "POST" });
}

export function disconnectPlatformLegacyConnect() {
  return adminApiRequest(`${BASE}`, { method: "DELETE" });
}

export function setPlatformLegacyFeeTransferEnabled(enabled) {
  return adminApiRequest(`${BASE}/fee-transfer`, {
    method: "PATCH",
    body: JSON.stringify({ enabled: Boolean(enabled) }),
  });
}

export function platformLegacyCallbackMessage(searchParams) {
  const status = searchParams.get("stripe_platform_legacy");
  if (!status) return null;

  if (status === "connected") {
    return { type: "success", message: "Legacy Stripe account connected to the Connect platform." };
  }
  if (status === "denied") {
    return { type: "error", message: "Stripe connection was cancelled." };
  }
  return {
    type: "error",
    message: "Could not connect the legacy Stripe account. Please try again.",
  };
}
