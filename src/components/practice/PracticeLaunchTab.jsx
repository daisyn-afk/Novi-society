import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateLaunchRoadmapProgress } from "@/api/launchRoadmapApi";
import { useLaunchRoadmapStats } from "@/components/launchpad/useLaunchRoadmapStats";
import LaunchRoadmapHero from "@/components/launchpad/LaunchRoadmapHero";
import LaunchPhaseCarousel from "@/components/launchpad/LaunchPhaseCarousel";

export default function PracticeLaunchTab() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const focusPhaseId = searchParams.get("phase");
  const focusStepId = searchParams.get("step");

  const { me, stats, isLoading } = useLaunchRoadmapStats();

  const toggleMutation = useMutation({
    mutationFn: (newChecklist) => updateLaunchRoadmapProgress(newChecklist),
    onMutate: async (newChecklist) => {
      await qc.cancelQueries({ queryKey: ["me"] });
      const previousMe = qc.getQueryData(["me"]);
      if (previousMe) {
        qc.setQueryData(["me"], { ...previousMe, launch_checklist: newChecklist });
      }
      return { previousMe };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMe) {
        qc.setQueryData(["me"], context.previousMe);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const updateChecklist = (nextChecklist) => {
    toggleMutation.mutate(nextChecklist);
  };

  const toggle = (stepId) => {
    const updated = { ...stats.manualChecklist, [stepId]: !stats.manualChecklist[stepId] };
    updateChecklist(updated);
  };

  const canToggle = (step) =>
    !step.autoCheck && !step.coming_soon && !step.embedded_tool && !step.playbook;

  return (
    <div className="max-w-3xl space-y-10">
      <LaunchRoadmapHero stats={stats} isLoading={isLoading} />

      {!isLoading &&
        stats.phases.map((phase) => (
          <LaunchPhaseCarousel
            key={phase.id}
            phase={phase}
            onToggle={toggle}
            onUpdateChecklist={updateChecklist}
            canToggle={canToggle}
            me={me}
            licenses={stats.licenses}
            certs={stats.certs}
            focusStepId={phase.id === focusPhaseId ? focusStepId : undefined}
          />
        ))}
    </div>
  );
}
