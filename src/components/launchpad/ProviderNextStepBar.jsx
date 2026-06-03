import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { resolveNextStepNavigation } from "@/lib/launchRoadmapUtils";
import { ChevronRight } from "lucide-react";

/**
 * Global provider reminder bar — shows the current Next Best Action from Growth Studio.
 * Phase definitions are global; completion state is per-provider.
 */
export default function ProviderNextStepBar({ stats, className = "" }) {
  const navigate = useNavigate();
  const { nextAction, overallPct } = stats || {};

  if (!nextAction || overallPct >= 100) return null;

  const nav = resolveNextStepNavigation(nextAction, createPageUrl);
  if (!nav?.url) return null;

  const handleClick = () => {
    if (nav.type === "external") {
      window.open(nav.url, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(nav.url);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all hover:opacity-95 mb-5 ${className}`}
      style={{
        background: "linear-gradient(90deg, rgba(200,230,60,0.28) 0%, rgba(200,230,60,0.12) 100%)",
        border: "1.5px solid rgba(200,230,60,0.55)",
        boxShadow: "0 2px 12px rgba(200,230,60,0.12)",
      }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-1"
          style={{ color: "#4a6b10" }}
        >
          Next Step
        </p>
        <p
          className="text-base font-bold truncate"
          style={{ fontFamily: "'DM Serif Display', serif", color: "#1e2535" }}
        >
          {nextAction.label}
        </p>
      </div>
      <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: "#4a6b10" }} />
    </button>
  );
}
