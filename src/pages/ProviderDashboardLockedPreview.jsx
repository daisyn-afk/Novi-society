import { useMemo, useState } from "react";
import ProviderDashboardUnlock from "@/components/ProviderDashboardUnlock";
import { Lock, BookOpen, Clock, CheckCircle2 } from "lucide-react";

const STATES = [
  { id: "locked", label: "Locked Provider" },
  { id: "studying", label: "Studying Provider" },
  { id: "external_pending", label: "External Cert Pending Review" },
  { id: "active_preview", label: "Active Provider (Reference)" },
];

function DemoStateCards({ stateId }) {
  const cards = useMemo(() => {
    if (stateId === "studying") {
      return [
        { title: "Course Progress", status: "In progress", icon: BookOpen, color: "#7B8EC8" },
        { title: "Attendance", status: "Visible during live class", icon: Clock, color: "#FA6F30" },
        { title: "Practice Tools", status: "Locked until certification", icon: Lock, color: "#DA6A63" },
      ];
    }
    if (stateId === "external_pending") {
      return [
        { title: "External Certification", status: "Under review", icon: Clock, color: "#FA6F30" },
        { title: "Courses", status: "Optional fallback path", icon: BookOpen, color: "#7B8EC8" },
        { title: "Practice Tools", status: "Partially restricted", icon: Lock, color: "#DA6A63" },
      ];
    }
    if (stateId === "active_preview") {
      return [
        { title: "Dashboard Modules", status: "Fully unlocked", icon: CheckCircle2, color: "#4a6b10" },
        { title: "Attendance", status: "Available only when live", icon: Clock, color: "#FA6F30" },
        { title: "Provider Tools", status: "Enabled", icon: CheckCircle2, color: "#4a6b10" },
      ];
    }
    return [
      { title: "Onboarding", status: "Required to proceed", icon: Lock, color: "#DA6A63" },
      { title: "Certification", status: "Not started", icon: Lock, color: "#DA6A63" },
      { title: "Provider Modules", status: "Locked state preview", icon: Lock, color: "#DA6A63" },
    ];
  }, [stateId]);

  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(30,37,53,0.1)" }}
        >
          <div className="flex items-center gap-2">
            <card.icon className="w-4 h-4" style={{ color: card.color }} />
            <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{card.title}</p>
          </div>
          <p className="text-xs mt-2" style={{ color: "rgba(30,37,53,0.6)" }}>{card.status}</p>
        </div>
      ))}
    </div>
  );
}

export default function ProviderDashboardLockedPreview() {
  const [stateId, setStateId] = useState("locked");

  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        style={{ background: "rgba(123,142,200,0.1)", border: "1px solid rgba(123,142,200,0.25)" }}
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#4a5fa0" }}>
            Demo Preview
          </p>
          <h2 className="text-lg font-semibold mt-1" style={{ color: "#1e2535" }}>
            Locked Dashboard Prototype
          </h2>
          <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.6)" }}>
            This is a separate preview flow and does not replace the current provider dashboard.
          </p>
        </div>
        <select
          value={stateId}
          onChange={(e) => setStateId(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm"
          style={{ background: "white", border: "1px solid rgba(30,37,53,0.15)" }}
        >
          {STATES.map((state) => (
            <option key={state.id} value={state.id}>
              {state.label}
            </option>
          ))}
        </select>
      </div>

      <DemoStateCards stateId={stateId} />

      <div
        className="rounded-2xl p-4"
        style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(30,37,53,0.08)" }}
      >
        <p className="text-sm font-semibold mb-2" style={{ color: "#1e2535" }}>
          Locked Experience Visual
        </p>
        <ProviderDashboardUnlock />
      </div>
    </div>
  );
}
