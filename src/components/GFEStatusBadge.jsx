import { ShieldCheck, Clock, XCircle, AlertCircle, Minus } from "lucide-react";

const GFE_CONFIG = {
  approved: {
    icon: ShieldCheck,
    label: "GFE Approved",
    bg: "rgba(74,222,128,0.15)",
    color: "#16a34a",
    border: "rgba(74,222,128,0.35)",
  },
  pending: {
    icon: Clock,
    label: "GFE Pending",
    bg: "rgba(251,191,36,0.15)",
    color: "#d97706",
    border: "rgba(251,191,36,0.35)",
  },
  deferred: {
    icon: XCircle,
    label: "GFE Deferred",
    bg: "rgba(239,68,68,0.12)",
    color: "#dc2626",
    border: "rgba(239,68,68,0.3)",
  },
  not_available: {
    icon: AlertCircle,
    label: "GFE N/A",
    bg: "rgba(148,163,184,0.15)",
    color: "#64748b",
    border: "rgba(148,163,184,0.3)",
  },
  not_required: {
    icon: Minus,
    label: "No GFE Required",
    bg: "rgba(148,163,184,0.1)",
    color: "#94a3b8",
    border: "rgba(148,163,184,0.2)",
  },
};

export default function GFEStatusBadge({ status, examUrl, size = "sm" }) {
  if (!status || status === "not_required") return null;

  const cfg = GFE_CONFIG[status] || GFE_CONFIG.pending;
  const Icon = cfg.icon;
  const isSmall = size === "sm";

  const badge = (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${isSmall ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"}`}
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      <Icon className={isSmall ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {cfg.label}
    </span>
  );

  if (examUrl && status === "approved") {
    return (
      <a href={examUrl} target="_blank" rel="noopener noreferrer" title="View GFE document">
        {badge}
      </a>
    );
  }

  return badge;
}