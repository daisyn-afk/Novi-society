import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Central hook for all service-level access checks.
 *
 * Returns:
 *   - isLoading: boolean
 *   - hasActiveMD: bool — has ANY active MDSubscription
 *   - activeSubscriptions: MDSubscription[] — all active subs
 *   - activeServiceIds: Set<string> — IDs of services with active coverage
 *   - canAccessService(serviceTypeId): bool — is THIS specific service covered?
 *   - getSubscription(serviceTypeId): MDSubscription | undefined
 *   - hasPendingActivity: bool — has enrollments/certs but no active MD
 *   - enrollments: Enrollment[]
 *   - certs: Certification[]
 */
export function useServiceAccess() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const { data: mySubscriptions = [], isLoading: loadingSubs } = useQuery({
    queryKey: ["my-md-subscriptions"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.MDSubscription.filter({ provider_id: user.id });
    },
    enabled: !!me,
  });

  const { data: myEnrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.Enrollment.filter({ provider_id: user.id });
    },
    enabled: !!me,
  });

  const { data: myCerts = [], isLoading: loadingCerts } = useQuery({
    queryKey: ["my-certs"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.Certification.filter({ provider_id: user.id });
    },
    enabled: !!me,
  });

  const isLoading = loadingSubs || loadingEnrollments || loadingCerts;

  const activeSubscriptions = mySubscriptions.filter(s => s.status === "active");
  const activeServiceIds = new Set(activeSubscriptions.map(s => s.service_type_id));
  const hasActiveMD = activeSubscriptions.length > 0;
  const hasPendingActivity = (myEnrollments.length > 0 || myCerts.length > 0) && !hasActiveMD;

  const canAccessService = (serviceTypeId) => {
    if (!serviceTypeId) return hasActiveMD; // no specific service required = just needs any active MD
    return activeServiceIds.has(serviceTypeId);
  };

  const getSubscription = (serviceTypeId) =>
    activeSubscriptions.find(s => s.service_type_id === serviceTypeId);

  return {
    isLoading,
    me,
    hasActiveMD,
    activeSubscriptions,
    activeServiceIds,
    canAccessService,
    getSubscription,
    hasPendingActivity,
    enrollments: myEnrollments,
    certs: myCerts,
  };
}