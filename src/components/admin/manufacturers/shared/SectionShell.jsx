import { ChevronDown } from "lucide-react";

const LIME = "rgba(200,230,60,0.55)";
const LIME_BG = "rgba(200,230,60,0.12)";
const LIME_ICON_BG = "rgba(200,230,60,0.22)";

export default function SectionShell({
  icon: Icon,
  title,
  subtitle,
  open,
  onToggle,
  children,
}) {
  return (
    <div
      className="rounded-xl bg-white transition-all overflow-hidden"
      style={{
        border: open ? `1.5px solid ${LIME}` : "1px solid #e5e7eb",
        boxShadow: open ? "0 1px 0 rgba(200,230,60,0.18)" : "none",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        style={{ background: open ? LIME_BG : "transparent" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: open ? LIME_ICON_BG : "#f3f4f6" }}
          >
            {Icon ? (
              <Icon
                className="w-4 h-4"
                style={{ color: open ? "#5a7a20" : "#475569" }}
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 text-sm">{title}</p>
            {subtitle ? (
              <p className="text-xs text-slate-500 truncate">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <ChevronDown
          className="w-4 h-4 text-slate-400 transition-transform flex-shrink-0"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open ? (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}
