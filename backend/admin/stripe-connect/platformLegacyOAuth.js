import {
  getStripeConnectOAuthRedirectUri,
} from "./config.js";
import {
  buildConnectOAuthAuthorizeUrl,
  exchangeConnectOAuthCode,
  isStripeConnectOAuthConfigured,
  OAUTH_PURPOSE_PLATFORM_LEGACY,
  signConnectOAuthState,
  verifyConnectOAuthState,
} from "./connectOAuth.js";

export { isStripeConnectOAuthConfigured };

export function signPlatformLegacyOAuthState(payload) {
  return signConnectOAuthState(payload);
}

export function verifyPlatformLegacyOAuthState(state) {
  const parsed = verifyConnectOAuthState(state, { expectedPurpose: OAUTH_PURPOSE_PLATFORM_LEGACY });
  return { adminAuthUserId: parsed.adminAuthUserId };
}

export function buildPlatformLegacyOAuthUrl({ adminAuthUserId }) {
  const redirectUri = getStripeConnectOAuthRedirectUri();
  return buildConnectOAuthAuthorizeUrl({
    redirectUri,
    statePayload: {
      adminAuthUserId: String(adminAuthUserId || ""),
      exp: Date.now() + 15 * 60 * 1000,
      purpose: OAUTH_PURPOSE_PLATFORM_LEGACY,
    },
  });
}

export async function exchangePlatformLegacyOAuthCode(code) {
  return exchangeConnectOAuthCode(code, getStripeConnectOAuthRedirectUri());
}
