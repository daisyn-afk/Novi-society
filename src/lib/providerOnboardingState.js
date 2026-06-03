import { base44 } from "@/api/base44Client";
import { providerOnboardingApi } from "@/api/providerOnboardingApi";
import { getDashboardPathForRole, normalizeRole } from "@/lib/routeAccessPolicy";
import { createPageUrl } from "@/utils";

const PROVIDER_ONBOARDING_PATH = createPageUrl("ProviderBasicOnboarding");
const PROVIDER_DASHBOARD_PATH = createPageUrl("ProviderDashboard");

function hasVerifiedLicense(licenses) {
  return Array.isArray(licenses) && licenses.some((item) => item?.status === "verified");
}

function hasActiveCertification(certs) {
  return Array.isArray(certs) && certs.some((item) => item?.status === "active");
}

function hasActiveMdSubscription(subscriptions) {
  return Array.isArray(subscriptions) && subscriptions.some((item) => item?.status === "active");
}

async function getLegacyProviderSignals(user) {
  if (!user?.id) {
    return { hasLegacyActivation: false };
  }
  const [licensesResult, certsResult, subscriptionsResult] = await Promise.allSettled([
    // Empty filter relies on backend auth scoping and preserves legacy email-linked rows.
    base44.entities.License.filter({}),
    base44.entities.Certification.filter({ provider_id: user.id }),
    base44.entities.MDSubscription.filter({ provider_id: user.id }),
  ]);

  const licenses = licensesResult.status === "fulfilled" ? licensesResult.value || [] : [];
  const certs = certsResult.status === "fulfilled" ? certsResult.value || [] : [];
  const subscriptions = subscriptionsResult.status === "fulfilled" ? subscriptionsResult.value || [] : [];

  return {
    hasLegacyActivation:
      hasVerifiedLicense(licenses) || hasActiveCertification(certs) || hasActiveMdSubscription(subscriptions),
  };
}

/**
 * @deprecated Use `useProviderDashboardState` (or `resolveProviderDashboardState`)
 * for any new gating logic. This function is preserved for backward compatibility
 * with the post-auth redirect flow and any external callers.
 *
 * NOTE: It now always returns `isComplete: true` for providers because the
 * canonical Locked/Active decision lives inside `<ProviderDashboard />` itself
 * (which renders `<ProviderDashboardLocked />` when locked). We no longer
 * force-redirect providers away from `/ProviderDashboard` based on
 * `has_completed_basic`; the locked dashboard surfaces the basic-onboarding
 * CTA when needed. This eliminates the redirect loop where providers with
 * incomplete onboarding bounced between `/ProviderDashboard` and
 * `/ProviderBasicOnboarding`.
 */
export async function resolveProviderOnboardingState(user) {
  const normalizedRole = normalizeRole(user?.role);
  if (normalizedRole !== "provider") {
    return { state: "non_provider", isComplete: true };
  }

  try {
    const onboarding = await providerOnboardingApi.getMe();
    if (onboarding?.has_completed_basic === true) {
      return { state: "active", isComplete: true };
    }
    const legacy = await getLegacyProviderSignals(user);
    if (legacy.hasLegacyActivation) {
      return { state: "active_legacy", isComplete: true };
    }
    // Provider with no basic profile + no legacy activation: still allow them
    // through to /ProviderDashboard so the locked dashboard can render the
    // "complete basic onboarding" CTA. The locked dashboard is the source of
    // truth for what these users should do next.
    return { state: "locked_dashboard", isComplete: true };
  } catch {
    // Fail open to avoid locking out active providers during transient API issues.
    return { state: "onboarding_check_unavailable", isComplete: true };
  }
}

function logPostAuthRedirectDecision(context) {
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[auth-redirect]", context);
  }
}

export async function getPostAuthRedirectPath({ user, nextPath }) {
  const normalizedRole = normalizeRole(user?.role);

  if (nextPath) {
    logPostAuthRedirectDecision({
      resolvedRole: normalizedRole,
      redirectTarget: nextPath,
      reason: "explicit_next_path",
    });
    return nextPath;
  }

  if (normalizedRole !== "provider") {
    const roleDashboard = getDashboardPathForRole(user?.role);
    logPostAuthRedirectDecision({
      resolvedRole: normalizedRole,
      redirectTarget: roleDashboard,
      reason: "role_dashboard",
      staffPermissions: normalizedRole === "staff" ? user?.permissions : undefined,
    });
    return roleDashboard;
  }

  // All providers — regardless of onboarding completeness — land on
  // /ProviderDashboard. The page itself renders either the locked or active
  // dashboard based on `useProviderDashboardState`. This keeps a single
  // canonical entry point and removes the redirect-loop risk between
  // /ProviderDashboard and /ProviderBasicOnboarding.
  logPostAuthRedirectDecision({
    resolvedRole: normalizedRole,
    redirectTarget: PROVIDER_DASHBOARD_PATH,
    reason: "provider_canonical_entry",
  });
  return PROVIDER_DASHBOARD_PATH;
}

export function getProviderOnboardingPath() {
  return PROVIDER_ONBOARDING_PATH;
}
