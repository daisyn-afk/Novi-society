import { base44 } from "@/api/base44Client";
import { providerOnboardingApi } from "@/api/providerOnboardingApi";
import { getDashboardPathForRole, normalizeRole } from "@/lib/routeAccessPolicy";
import { createPageUrl } from "@/utils";

const PROVIDER_ONBOARDING_PATH = createPageUrl("ProviderBasicOnboarding");

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
    return { state: "onboarding_incomplete", isComplete: false };
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

  const providerState = await resolveProviderOnboardingState(user);
  if (!providerState.isComplete) {
    logPostAuthRedirectDecision({
      resolvedRole: normalizedRole,
      redirectTarget: PROVIDER_ONBOARDING_PATH,
      reason: "provider_onboarding_incomplete",
      onboardingState: providerState.state,
    });
    return PROVIDER_ONBOARDING_PATH;
  }

  const providerDashboard = getDashboardPathForRole(user?.role);
  logPostAuthRedirectDecision({
    resolvedRole: normalizedRole,
    redirectTarget: providerDashboard,
    reason: "provider_onboarding_complete",
    onboardingState: providerState.state,
  });
  return providerDashboard;
}

export function getProviderOnboardingPath() {
  return PROVIDER_ONBOARDING_PATH;
}
