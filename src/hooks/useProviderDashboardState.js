/**
 * useProviderDashboardState
 *
 * React-query-backed hook that returns the canonical provider dashboard state
 * (locked / active / rejected / non_provider) for the currently authenticated
 * user. Driven by `resolveProviderDashboardState` in
 * `src/lib/providerDashboardState.js`.
 *
 * This is the SINGLE source of truth for "is this provider unlocked?" across
 * the entire app — used by ProviderDashboard, Layout (sidebar), App
 * (route guard) and any feature lock overlays.
 *
 * Caching:
 *   - The underlying queries reuse existing app query keys (`["me"]`,
 *     `["my-licenses"]`, `["my-certs"]`, `["my-md-subscriptions"]`,
 *     `["my-enrollments"]`, `["provider-basic-onboarding"]`) so data is
 *     shared with the rest of the app and there is no duplicate fetching.
 *   - The resolved state itself is memoized via useMemo, so consumers can call
 *     this hook freely.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { providerOnboardingApi } from "@/api/providerOnboardingApi";
import { normalizeRole } from "@/lib/routeAccessPolicy";
import {
  resolveProviderDashboardState,
  PROVIDER_DASHBOARD_STATES,
} from "@/lib/providerDashboardState";

const PROVIDER_FAILSAFE_STATE = Object.freeze({
  state: PROVIDER_DASHBOARD_STATES.LOCKED,
  lockedSubState: "none",
  isUnlocked: false,
  isLocked: true,
  isRejected: false,
  hasCompletedBasic: false,
  signals: {},
  nextAction: null,
});

const NON_PROVIDER_STATE = Object.freeze({
  state: PROVIDER_DASHBOARD_STATES.NON_PROVIDER,
  lockedSubState: null,
  isUnlocked: true,
  isLocked: false,
  isRejected: false,
  hasCompletedBasic: true,
  signals: {},
  nextAction: null,
});

export function useProviderDashboardState() {
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const role = normalizeRole(user?.role);
  const isProvider = role === "provider";
  const isProviderReady = isProvider && Boolean(user?.id || user?.email);

  const { data: onboarding, isLoading: isLoadingOnboarding } = useQuery({
    queryKey: ["provider-basic-onboarding"],
    queryFn: async () => {
      try {
        return await providerOnboardingApi.getMe();
      } catch {
        return null;
      }
    },
    enabled: isProvider,
    retry: false,
  });

  const { data: licenses = [], isLoading: isLoadingLicenses } = useQuery({
    queryKey: ["my-licenses"],
    queryFn: async () => base44.entities.License.filter({}),
    enabled: isProviderReady,
  });

  const { data: certs = [], isLoading: isLoadingCerts } = useQuery({
    queryKey: ["my-certs"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Certification.filter({ provider_id: me.id });
    },
    enabled: isProviderReady,
  });

  const { data: mdSubs = [], isLoading: isLoadingMdSubs } = useQuery({
    queryKey: ["my-md-subscriptions"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.MDSubscription.filter({ provider_id: me.id });
    },
    enabled: isProviderReady,
  });

  const { data: enrollments = [], isLoading: isLoadingEnrollments } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const me = await base44.auth.me();
      const [byIdResult, byEmailResult] = await Promise.allSettled([
        me?.id ? base44.entities.Enrollment.filter({ provider_id: me.id }) : Promise.resolve([]),
        me?.email ? base44.entities.Enrollment.filter({ provider_email: me.email }) : Promise.resolve([]),
      ]);
      const byId = byIdResult.status === "fulfilled" ? byIdResult.value || [] : [];
      const byEmail = byEmailResult.status === "fulfilled" ? byEmailResult.value || [] : [];
      return Array.from(
        new Map([...byId, ...byEmail].map((row) => [row.id, row])).values()
      );
    },
    enabled: isProviderReady,
    staleTime: 30_000,
  });

  const isLoading = isLoadingUser ||
    (isProvider && (
      isLoadingOnboarding ||
      isLoadingLicenses ||
      isLoadingCerts ||
      isLoadingMdSubs ||
      isLoadingEnrollments
    ));

  const state = useMemo(() => {
    if (!user) return PROVIDER_FAILSAFE_STATE;
    if (!isProvider) return NON_PROVIDER_STATE;
    return resolveProviderDashboardState({
      user,
      onboarding,
      licenses,
      certs,
      mdSubs,
      enrollments,
    });
  }, [user, isProvider, onboarding, licenses, certs, mdSubs, enrollments]);

  return {
    ...state,
    isLoading,
    user,
    role,
    // Raw data is exposed so locked-dashboard sub-views (course countdown,
    // cert pending card, etc.) can render without re-fetching.
    enrollments,
    licenses,
    certs,
    mdSubs,
    onboarding,
  };
}
