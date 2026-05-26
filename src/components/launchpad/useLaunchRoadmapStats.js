import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { fetchLaunchRoadmapPhases } from "@/api/launchRoadmapApi";
import {
  computeLaunchRoadmapStats,
  getStaticLaunchRoadmapPhases,
  mergeLaunchRoadmapPhases,
} from "@/lib/launchRoadmapUtils";

/** Shared Growth Studio stats for roadmap UI + global Next Step bar. */
export function useLaunchRoadmapStats({ enabled = true } = {}) {
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    enabled,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const { data: dbPhases, isLoading: phasesLoading } = useQuery({
    queryKey: ["launch-roadmap-phases"],
    queryFn: fetchLaunchRoadmapPhases,
    enabled: enabled && !!me,
    staleTime: 5 * 60 * 1000,
  });

  const { data: licenses = [], isLoading: licensesLoading } = useQuery({
    queryKey: ["my-licenses"],
    queryFn: () => base44.entities.License.filter({}),
    enabled: enabled && !!me,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const { data: certs = [], isLoading: certsLoading } = useQuery({
    queryKey: ["my-certs"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.Certification.filter({ provider_id: u.id });
    },
    enabled: enabled && !!me,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const u = await base44.auth.me();
      const [byProviderId, byEmail] = await Promise.all([
        u?.id ? base44.entities.Enrollment.filter({ provider_id: u.id }) : [],
        u?.email ? base44.entities.Enrollment.filter({ provider_email: u.email }) : [],
      ]);
      return Array.from(
        new Map([...(byProviderId || []), ...(byEmail || [])].map((r) => [r.id, r])).values()
      );
    },
    enabled: enabled && !!me,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const { data: mdSubs = [], isLoading: mdSubsLoading } = useQuery({
    queryKey: ["my-md-subscriptions"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.MDSubscription.filter({ provider_id: u.id });
    },
    enabled: enabled && !!me,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const roadmapPhases = useMemo(
    () =>
      dbPhases
        ? mergeLaunchRoadmapPhases(dbPhases, getStaticLaunchRoadmapPhases())
        : getStaticLaunchRoadmapPhases(),
    [dbPhases]
  );

  const stats = useMemo(
    () =>
      computeLaunchRoadmapStats({
        me,
        licenses,
        certs,
        enrollments,
        mdSubs,
        phases: roadmapPhases,
      }),
    [me, licenses, certs, enrollments, mdSubs, roadmapPhases]
  );

  const isLoading =
    meLoading ||
    phasesLoading ||
    licensesLoading ||
    certsLoading ||
    enrollmentsLoading ||
    mdSubsLoading;

  return {
    me,
    stats,
    isLoading: enabled ? isLoading || !me : false,
  };
}
