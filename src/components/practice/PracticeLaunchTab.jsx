import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { computeLaunchRoadmapStats } from "@/lib/launchRoadmapUtils";
import LaunchRoadmapHero from "@/components/launchpad/LaunchRoadmapHero";
import LaunchPhaseCarousel from "@/components/launchpad/LaunchPhaseCarousel";

export default function PracticeLaunchTab() {
  const qc = useQueryClient();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const { data: licenses = [] } = useQuery({
    queryKey: ["my-licenses"],
    queryFn: () => base44.entities.License.filter({}),
    enabled: !!me,
  });

  const { data: certs = [] } = useQuery({
    queryKey: ["my-certs"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.Certification.filter({ provider_id: u.id });
    },
    enabled: !!me,
  });

  const { data: enrollments = [] } = useQuery({
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
    enabled: !!me,
  });

  const { data: mdSubs = [] } = useQuery({
    queryKey: ["my-md-subscriptions"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.MDSubscription.filter({ provider_id: u.id });
    },
    enabled: !!me,
  });

  const stats = computeLaunchRoadmapStats({ me, licenses, certs, enrollments, mdSubs });

  const toggleMutation = useMutation({
    mutationFn: (newChecklist) => base44.auth.updateMe({ launch_checklist: newChecklist }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  const toggle = (stepId) => {
    const updated = { ...stats.manualChecklist, [stepId]: !stats.manualChecklist[stepId] };
    toggleMutation.mutate(updated);
  };

  const canToggle = (step) => !step.autoCheck;

  return (
    <div className="max-w-3xl space-y-10">
      <LaunchRoadmapHero stats={stats} />

      {stats.phases.map((phase) => (
        <LaunchPhaseCarousel
          key={phase.id}
          phase={phase}
          onToggle={toggle}
          canToggle={canToggle}
          me={me}
        />
      ))}
    </div>
  );
}
