import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getPhaseTheme, LAUNCH_PAD } from "@/lib/launchRoadmapTheme";
import { isPhaseComingSoon } from "@/lib/launchRoadmapUtils";
import { hasFoundationPlaybook } from "@/lib/foundationStepProgress";
import FoundationStepPlaybook from "@/components/launchpad/FoundationStepPlaybook";
import { CheckCircle2, ExternalLink, Globe, Lock } from "lucide-react";
import EmbeddedPricingTool from "../launchpad/EmbeddedPricingTool";
import EmbeddedEducationHub from "../launchpad/EmbeddedEducationHub";
import EmbeddedWebinars from "../launchpad/EmbeddedWebinars";
import BrainstormChat from "../launchpad/BrainstormChat";
import EmbeddedComingSoonTool from "../launchpad/EmbeddedComingSoonTool";
import EmbeddedVendorDirectory from "../launchpad/EmbeddedVendorDirectory";
import PricingResearchPanel from "../practice/PricingResearchPanel";

const COMING_SOON_TOOLS = {
  pricing_calculator: {
    label: "ROI Calculator",
    teaser: "Run your service pricing numbers",
  },
  vendor_directory: {
    label: "Trusted Vendor Directory",
    teaser: "Browse NOVI-vetted vendors",
  },
  brand_builder: {
    label: "Brand Builder",
    teaser: "Launch the 8-step brand identity wizard",
  },
  referral_program_builder: {
    label: "Referral Program Builder",
    teaser: "Generate your AI referral kit",
  },
  creative_studio: {
    label: "Creative Studio",
    teaser: "Generate ready-to-post content with AI",
  },
  provider_community: {
    label: "Provider Community",
    teaser: "Browse the peer network and spotlights",
  },
  education_hub: {
    label: "Education Hub",
    teaser: "Browse clinical + business articles",
  },
  webinars: {
    label: "Webinars",
    teaser: "View live + on-demand sessions",
  },
  ask_mentor: {
    label: "Ask Your Mentor",
    teaser: "Chat with your AI business coach",
  },
};

function getDefaultStepIndex(steps, focusStepId) {
  if (focusStepId) {
    const idx = steps.findIndex((s) => s.id === focusStepId);
    if (idx >= 0) return idx;
  }
  const firstIncomplete = steps.findIndex((s) => !s.done);
  return firstIncomplete >= 0 ? firstIncomplete : 0;
}

function PhaseComingSoonBlock({ phase, theme }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3
            className="font-bold"
            style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: LAUNCH_PAD.navy }}
          >
            {phase.label}
          </h3>
          <span
            className="text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full"
            style={{ background: "rgba(250,111,48,0.15)", color: "#b84a10" }}
          >
            Coming Soon
          </span>
        </div>
        <div
          className="h-1 rounded-full mt-2 overflow-hidden"
          style={{ background: LAUNCH_PAD.greyLight }}
        />
        <p className="text-xs mt-1.5" style={{ color: LAUNCH_PAD.grey }}>
          {phase.description}
        </p>
      </div>

      <div
        className="rounded-2xl px-5 py-8 text-center"
        style={{
          background: "rgba(255,255,255,0.75)",
          border: `1.5px solid ${LAUNCH_PAD.greyBorder}`,
          boxShadow: "0 2px 12px rgba(30,37,53,0.06)",
        }}
      >
        <div
          className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: `${theme.color}18` }}
        >
          <Lock className="w-5 h-5" style={{ color: theme.color }} />
        </div>
        <p
          className="text-base font-bold mb-2"
          style={{ fontFamily: "'DM Serif Display', serif", color: LAUNCH_PAD.navy }}
        >
          This phase is coming soon
        </p>
        <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ color: "rgba(30,37,53,0.55)" }}>
          Education Hub, Webinars, and Ask Your Mentor will unlock here. Focus on Foundation, Activation, and Growth for now.
        </p>
        <ul className="mt-5 space-y-2 text-left max-w-xs mx-auto">
          {(phase.steps || []).map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl"
              style={{
                background: "rgba(30,37,53,0.03)",
                color: "rgba(30,37,53,0.45)",
              }}
            >
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function LaunchPhaseCarousel({
  phase,
  onToggle,
  onUpdateChecklist = () => {},
  canToggle,
  me,
  licenses = [],
  certs = [],
  focusStepId,
}) {
  const navigate = useNavigate();
  const theme = getPhaseTheme(phase.id);
  const phaseLocked = isPhaseComingSoon(phase);
  const [stepIndex, setStepIndex] = useState(() => getDefaultStepIndex(phase.steps, focusStepId));

  useEffect(() => {
    if (phaseLocked) return;
    setStepIndex(getDefaultStepIndex(phase.steps, focusStepId));
  }, [phase.id, phase.doneCount, focusStepId, phaseLocked]);

  if (phaseLocked) {
    return <PhaseComingSoonBlock phase={phase} theme={theme} />;
  }

  const step = phase.steps[stepIndex];
  if (!step) return null;

  const isDone = step.done;
  const total = phase.steps.length;
  const atStart = stepIndex === 0;
  const atEnd = stepIndex === total - 1;

  const goPrev = () => setStepIndex((i) => Math.max(0, i - 1));
  const goNext = () => setStepIndex((i) => Math.min(total - 1, i + 1));

  const actionUrl = step.navigate_to
    ? createPageUrl(step.navigate_to) + (step.navigate_params || "")
    : step.link;

  const showPlaybook = hasFoundationPlaybook(step);

  return (
    <div className="space-y-4">
      {/* Phase header */}
      <div>
        <div className="flex items-baseline gap-2">
          <h3
            className="font-bold"
            style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: LAUNCH_PAD.navy }}
          >
            {phase.label}
          </h3>
          <span className="text-sm font-bold" style={{ color: theme.color }}>
            {phase.pct === 100 ? "Complete" : `${phase.pct ?? 0}%`}
          </span>
        </div>
        <div
          className="h-1 rounded-full mt-2 overflow-hidden"
          style={{ background: LAUNCH_PAD.greyLight }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${phase.pct}%`, background: theme.color }}
          />
        </div>
        <p className="text-xs mt-1.5" style={{ color: LAUNCH_PAD.grey }}>
          {phase.description}
        </p>
      </div>

      {/* Step card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: isDone ? theme.completedBodyBg : LAUNCH_PAD.white,
          border: isDone
            ? `1.5px solid ${theme.completedBorder}`
            : `1.5px solid ${LAUNCH_PAD.greyBorder}`,
          boxShadow: "0 2px 12px rgba(30,37,53,0.06)",
        }}
      >
        {isDone && (
          <div
            className="px-5 py-2"
            style={{ background: theme.completedHeaderBg }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"
              style={{ color: theme.completedText }}
            >
              Completed <CheckCircle2 className="w-3 h-3" />
            </p>
          </div>
        )}

        <div className="px-5 py-5">
          <div className="flex items-start gap-2 flex-wrap">
            <p
              className="text-base font-bold leading-snug"
              style={{
                fontFamily: "'DM Serif Display', serif",
                color: isDone ? theme.completedText : LAUNCH_PAD.navy,
                textDecoration: isDone ? "line-through" : "none",
              }}
            >
              {step.label}
            </p>
            {!isDone && step.coming_soon && (
              <span
                className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                style={{ background: "rgba(250,111,48,0.15)", color: "#b84a10" }}
              >
                Coming Soon
              </span>
            )}
          </div>

          {!showPlaybook && (
            <p
              className="text-sm mt-2 leading-relaxed"
              style={{
                color: isDone ? theme.completedText : "rgba(30,37,53,0.55)",
                opacity: isDone ? 0.85 : 1,
              }}
            >
              {step.desc}
            </p>
          )}

          {showPlaybook && (
            <FoundationStepPlaybook
              step={step}
              accent={theme.color}
              isDone={isDone}
              onToggle={onToggle}
            />
          )}

          {!showPlaybook && !isDone && step.links?.length > 0 &&
            step.links.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 mt-4 px-4 py-3 rounded-xl text-sm transition-all hover:opacity-90"
                style={{
                  background: "rgba(30,37,53,0.04)",
                  border: `1px solid ${LAUNCH_PAD.greyBorder}`,
                  color: theme.color,
                }}
              >
                <Globe className="w-4 h-4 flex-shrink-0" style={{ color: theme.color }} />
                <span className="flex-1 truncate font-medium">{item.label || item.url}</span>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(30,37,53,0.35)" }} />
              </a>
            ))}

          {!showPlaybook && !isDone && !step.links?.length && step.link && (
            <a
              href={step.link}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 mt-4 px-4 py-3 rounded-xl text-sm transition-all hover:opacity-90"
              style={{
                background: "rgba(30,37,53,0.04)",
                border: `1px solid ${LAUNCH_PAD.greyBorder}`,
                color: theme.color,
              }}
            >
              <Globe className="w-4 h-4 flex-shrink-0" style={{ color: theme.color }} />
              <span className="flex-1 truncate font-medium">{step.linkLabel || step.link}</span>
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(30,37,53,0.35)" }} />
            </a>
          )}

          {!showPlaybook && !isDone && step.navigate_to && (
            <button
              type="button"
              onClick={() => navigate(actionUrl)}
              className="flex items-center gap-2 mt-4 px-4 py-3 rounded-xl text-sm w-full text-left transition-all hover:opacity-90"
              style={{
                background: "rgba(30,37,53,0.04)",
                border: `1px solid ${LAUNCH_PAD.greyBorder}`,
                color: theme.color,
              }}
            >
              <Globe className="w-4 h-4 flex-shrink-0" style={{ color: theme.color }} />
              <span className="flex-1 font-medium">
                Go to {step.navigate_to.replace(/([A-Z])/g, " $1").trim()}
              </span>
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(30,37,53,0.35)" }} />
            </button>
          )}

          {!isDone && step.id === "pricing_research" && (
            <div className="mt-4">
              <PricingResearchPanel />
            </div>
          )}

          {!isDone && step.coming_soon && step.embedded_tool && COMING_SOON_TOOLS[step.embedded_tool] && (
            <div className="mt-4">
              <EmbeddedComingSoonTool
                label={COMING_SOON_TOOLS[step.embedded_tool].label}
                teaser={COMING_SOON_TOOLS[step.embedded_tool].teaser}
                accent={theme.color}
              />
            </div>
          )}

          {!isDone && !step.coming_soon && step.embedded_tool === "pricing_calculator" && (
            <div className="mt-4">
              <EmbeddedPricingTool />
            </div>
          )}

          {!isDone && !step.coming_soon && step.embedded_tool === "vendor_directory" && (
            <div className="mt-4">
              <EmbeddedVendorDirectory />
            </div>
          )}

          {!isDone && !step.coming_soon && step.embedded_tool === "education_hub" && (
            <div className="mt-4">
              <EmbeddedEducationHub />
            </div>
          )}

          {!isDone && !step.coming_soon && step.embedded_tool === "webinars" && (
            <div className="mt-4">
              <EmbeddedWebinars />
            </div>
          )}

          {!isDone && !step.coming_soon && step.embedded_tool === "ask_mentor" && (
            <div className="mt-4">
              <BrainstormChat me={me} embedded />
            </div>
          )}

          {(isDone || !showPlaybook) && (
            <div className="mt-5">
              {isDone ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5"
                  style={{
                    background: theme.completedButtonBg,
                    color: theme.completedButtonText,
                    border: `1.5px solid ${theme.completedButtonBorder}`,
                  }}
                >
                  Completed <CheckCircle2 className="w-4 h-4" />
                </button>
              ) : canToggle(step) && !step.coming_soon && !step.embedded_tool ? (
                <button
                  type="button"
                  onClick={() => onToggle(step.id)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-slate-50"
                  style={{
                    background: LAUNCH_PAD.white,
                    border: `1.5px solid ${LAUNCH_PAD.greyBorder}`,
                    color: "rgba(30,37,53,0.55)",
                  }}
                >
                  Mark Done <CheckCircle2 className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    actionUrl && (step.link ? window.open(actionUrl, "_blank") : navigate(actionUrl))
                  }
                  disabled={!actionUrl}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-slate-50 disabled:opacity-40"
                  style={{
                    background: LAUNCH_PAD.white,
                    border: `1.5px solid ${LAUNCH_PAD.greyBorder}`,
                    color: "rgba(30,37,53,0.55)",
                  }}
                >
                  {step.autoCheck ? "Complete This Step" : "Mark Done"}{" "}
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Prev / Next nav */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={atStart}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-25"
            style={{
              background: "rgba(255,255,255,0.75)",
              border: `1px solid ${LAUNCH_PAD.greyBorder}`,
              color: "rgba(30,37,53,0.5)",
            }}
          >
            ← Prev
          </button>

          <div className="flex items-center gap-1.5 flex-1 justify-center">
            {phase.steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStepIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                className="transition-all"
                style={{
                  width: i === stepIndex ? 20 : 6,
                  height: 6,
                  borderRadius: 999,
                  background:
                    i === stepIndex
                      ? theme.color
                      : s.done
                        ? `${theme.color}66`
                        : LAUNCH_PAD.greyLight,
                }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={atEnd}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-25"
            style={{
              background: "rgba(255,255,255,0.75)",
              border: `1px solid ${LAUNCH_PAD.greyBorder}`,
              color: "rgba(30,37,53,0.5)",
            }}
          >
            Next →
          </button>
        </div>

        <p className="text-center text-xs mt-2" style={{ color: "rgba(30,37,53,0.4)" }}>
          {stepIndex + 1} of {total}
        </p>
      </div>
    </div>
  );
}
