import { format } from "date-fns";
import { Camera, ChevronRight, X } from "lucide-react";

export default function ScanHistoryPanel({ scans = [], onClose, onSelectScan, selectedIndex }) {
  if (!scans.length) return null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)" }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-white/60" />
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">Scan History ({scans.length})</p>
        </div>
        {onClose && <button onClick={onClose}><X className="w-3.5 h-3.5 text-white/40 hover:text-white/70" /></button>}
      </div>
      <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
        {[...scans].reverse().map((scan, revIdx) => {
          const idx = scans.length - 1 - revIdx;
          const health = scan.ai_analysis?.overall_skin_health;
          const healthColor = { "Excellent": "#16a34a", "Good": "#1d4ed8", "Fair": "#a16207", "Needs Attention": "#dc2626" };
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={idx}
              onClick={() => onSelectScan(idx)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:brightness-110"
              style={{ background: isSelected ? "rgba(200,230,60,0.15)" : "rgba(255,255,255,0.07)", border: isSelected ? "1px solid rgba(200,230,60,0.35)" : "1px solid transparent" }}
            >
              <img src={scan.scan_url} alt="scan" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{scan.label || `Scan ${idx + 1}`}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {scan.scanned_at ? format(new Date(scan.scanned_at), "MMM d, yyyy") : "Unknown date"}
                </p>
                {health && (
                  <p className="text-xs font-medium mt-0.5" style={{ color: healthColor[health] || "#1d4ed8" }}>{health}</p>
                )}
              </div>
              {isSelected ? (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(200,230,60,0.2)", color: "#C8E63C" }}>Viewing</span>
              ) : (
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-white/30" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}