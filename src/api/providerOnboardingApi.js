import { adminApiRequest } from "@/api/adminApiRequest";

const ACCESS_TOKEN_KEY = "novi_auth_access_token";

function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

export const providerOnboardingApi = {
  submitBasic: async (payload) => {
    const token = getAccessToken();
    if (!token) {
      throw new Error("Please login as a provider to continue.");
    }
    return adminApiRequest("/admin/provider-onboarding/basic", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload || {})
    });
  }
};
