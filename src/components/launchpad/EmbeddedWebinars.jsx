import { useState } from "react";
import { ChevronDown, ChevronUp, Video } from "lucide-react";

const SESSIONS = [
  {
    title: "Growing Your Aesthetics Practice in Year One",
    type: "Live",
    duration: "Next Thursday · 7:00 PM CT",
  },
  {
    title: "Instagram for Injectors: What Actually Converts",
    type: "On demand",
    duration: "45 min · Watch anytime",
  },
  {
    title: "Patient Retention & Rebooking Strategies",
    type: "On demand",
    duration: "38 min · Watch anytime",
  },
];

export default function EmbeddedWebinars() {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-all"
        style={{ background: "rgba(218,106,99,0.08)", border: "1.5px solid rgba(218,106,99,0.25)" }}
      >
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4" style={{ color: "#DA6A63" }} />
          <span className="text-sm font-semibold" style={{ color: "#1e2535" }}>
            View live + on-demand sessions
          </span>
        </div>
        <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.35)" }} />
      </button>
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "rgba(218,106,99,0.06)", border: "1.5px solid rgba(218,106,99,0.25)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ borderBottom: "1px solid rgba(218,106,99,0.15)" }}
      >
        <span className="text-sm font-bold" style={{ color: "#1e2535" }}>
          Webinars
        </span>
        <ChevronUp className="w-4 h-4" style={{ color: "rgba(30,37,53,0.35)" }} />
      </button>
      <div className="p-3 space-y-2">
        {SESSIONS.map((session) => (
          <div
            key={session.title}
            className="px-3 py-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(30,37,53,0.08)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>
              {session.title}
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.45)" }}>
              {session.type} · {session.duration}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
