import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { expandActiveServiceIds, servicesInMembership } from "@/lib/serviceTypeMembershipModel";

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

  const { data: serviceTypes = [], isLoading: loadingServiceTypes } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => base44.entities.ServiceType.list(),
    enabled: !!me,
  });

  const isLoading = loadingSubs || loadingEnrollments || loadingCerts || loadingServiceTypes;

  const activeSubscriptions = mySubscriptions.filter(s => s.status === "active");
  const activeServiceIds = useMemo(
    () => expandActiveServiceIds(activeSubscriptions, serviceTypes),
    [activeSubscriptions, serviceTypes]
  );
  const hasActiveMD = activeSubscriptions.length > 0;
  const hasPendingActivity = (myEnrollments.length > 0 || myCerts.length > 0) && !hasActiveMD;

  const canAccessService = (serviceTypeId) => {
    if (!serviceTypeId) return hasActiveMD; // no specific service required = just needs any active MD
    return activeServiceIds.has(serviceTypeId);
  };

  const getSubscription = (serviceTypeId) => {
    const direct = activeSubscriptions.find((s) => s.service_type_id === serviceTypeId);
    if (direct) return direct;

    const service = serviceTypes.find((st) => String(st.id) === String(serviceTypeId));
    if (!service) return undefined;

    for (const sub of activeSubscriptions) {
      const membership = serviceTypes.find((st) => String(st.id) === String(sub.service_type_id));
      if (!membership) continue;
      const included = (membership.included_service_ids || []).map(String);
      if (!included.includes(String(serviceTypeId))) continue;
      return sub;
    }

    const parentId = String(service.legacy_parent_membership_id || "").trim();
    if (parentId) {
      return activeSubscriptions.find((s) => s.service_type_id === parentId);
    }

    return undefined;
  };

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