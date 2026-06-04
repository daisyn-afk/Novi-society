import { adminApiRequest } from "./adminApiRequest";

const ACCESS_TOKEN_KEY = "novi_auth_access_token";

function getAccessToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

/**
 * Store email + Join-as-Provider choice in provider_join_choices table.
 * Pass email when not logged in yet; token alone is enough after login.
 */
export async function saveProviderJoinChoiceApi({ email, choice, goal, explore_skip }) {
  const token = getAccessToken();
  const body = {
    ...(email ? { email } : {}),
    ...(choice ? { choice } : {}),
    ...(goal ? { goal } : {}),
    ...(explore_skip === true ? { explore_skip: true } : {}),
  };
  return adminApiRequest("/admin/provider-onboarding/join-choice", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  });
}
