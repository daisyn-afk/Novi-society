import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getStepActionUrl } from "@/lib/launchRoadmapUtils";
import { LAUNCH_PAD } from "@/lib/launchRoadmapTheme";
import { ArrowRight } from "lucide-react";

export default function LaunchRoadmapHero({ stats }) {
  const navigate = useNavigate();
  const {
    overallPct,
    readyToGoLivePct,
    profileCompletePct,
    phasesDone,
    totalPhases,
    isReadyForPatients,
    nextAction,
  } = stats;

  const statusColor = isReadyForPatients ? LAUNCH_PAD.ready : LAUNCH_PAD.notReady;
  const statusLabel = isReadyForPatients
    ? "Ready to Accept Patients"
    : "Not Yet Ready";

  const actionUrl = nextAction ? getStepActionUrl(nextAction, createPageUrl) : null;
  const isExternal = !!(nextAction?.link && !nextAction?.navigate_to);

  const handleStart = () => {
    if (!actionUrl) return;
    if (isExternal) {
      window.open(actionUrl, "_blank", "noopener,noreferrer");
    } else {
      navigate(actionUrl);
    }
  };

  return (
    <div className="space-y-5">
      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-xs font-bold uppercase tracking-widest mb-1"
            style={{ color: "rgba(30,37,53,0.4)" }}
          >
            Growth Studio
          </p>
          <h2
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 28,
              color: LAUNCH_PAD.navy,
              lineHeight: 1.15,
            }}
          >
            Your Launch Roadmap
          </h2>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: statusColor }}
          />
          <span className="text-sm font-semibold" style={{ color: statusColor }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Overall progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold" style={{ color: LAUNCH_PAD.grey }}>
            Overall progress
          </p>
          <p className="text-sm font-bold" style={{ color: LAUNCH_PAD.navy }}>
            {overallPct}%
          </p>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: LAUNCH_PAD.greyLight }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${overallPct}%`,
              background: `linear-gradient(90deg, ${LAUNCH_PAD.lime}, ${LAUNCH_PAD.blue})`,
            }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div
        className="grid grid-cols-3 rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.75)",
          border: `1px solid ${LAUNCH_PAD.greyBorder}`,
        }}
      >
        {[
          { value: `${readyToGoLivePct}%`, label: "Ready to Go Live" },
          { value: `${profileCompletePct}%`, label: "Profile Complete" },
          { value: `${phasesDone} / ${totalPhases}`, label: "Phases Done" },
        ].map(({ value, label }, i) => (
          <div
            key={label}
            className="px-4 py-4 text-center"
            style={{
              borderRight: i < 2 ? `1px solid ${LAUNCH_PAD.greyBorder}` : "none",
            }}
          >
            <p
              className="text-xl font-bold"
              style={{ fontFamily: "'DM Serif Display', serif", color: LAUNCH_PAD.navy }}
            >
              {value}
            </p>
            <p
              className="text-[10px] font-bold uppercase tracking-widest mt-1"
              style={{ color: "rgba(30,37,53,0.4)" }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Next best action */}
      {nextAction && (
        <div
          className="rounded-2xl px-5 py-4"
          style={{
            background: "rgba(255,255,255,0.8)",
            border: `1px solid ${LAUNCH_PAD.greyBorder}`,
            borderLeft: `4px solid ${LAUNCH_PAD.blue}`,
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
            style={{ color: LAUNCH_PAD.blue }}
          >
            Next Best Action
          </p>
          <p
            className="text-base font-bold italic"
            style={{ fontFamily: "'DM Serif Display', serif", color: LAUNCH_PAD.navy }}
          >
            Next: {nextAction.label}
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(30,37,53,0.55)" }}>
            {nextAction.desc}
          </p>
          {(actionUrl || nextAction.embedded_tool) && (
            <button
              type="button"
              onClick={handleStart}
              disabled={!actionUrl}
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ color: LAUNCH_PAD.blue }}
            >
              Start <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
