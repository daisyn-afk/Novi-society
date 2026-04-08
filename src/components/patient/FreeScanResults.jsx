import { Sparkles, Lock, AlertCircle, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const healthColor = {
  "Excellent": { bg: "#dcfce7", text: "#16a34a" },
  "Good": { bg: "#dbeafe", text: "#1d4ed8" },
  "Fair": { bg: "#fef9c3", text: "#a16207" },
  "Needs Attention": { bg: "#fee2e2", text: "#dc2626" },
};

export default function FreeScanResults({ scan }) {
  const analysis = scan?.ai_analysis;
  if (!analysis) return null;

  const health = healthColor[analysis.overall_skin_health] || healthColor["Good"];

  return (
    <div className="space-y-4">
      {/* Overall health */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Skin Health Score</p>
          <p className="text-sm text-gray-600">{analysis.concern_summary}</p>
        </div>
        <span className="ml-4 flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: health.bg, color: health.text }}>
          {analysis.overall_skin_health}
        </span>
      </div>

      {/* Concerns */}
      {analysis.detected_concerns?.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-orange-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Areas of Focus</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {analysis.detected_concerns.map(c => (
              <Badge key={c} className="bg-orange-50 text-orange-700 border-orange-100">{c}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Educational suggestions */}
      {analysis.educational_suggestions?.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-yellow-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Treatment Categories to Explore</p>
          </div>
          <ul className="space-y-2">
            {analysis.educational_suggestions.map(s => (
              <li key={s} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-2" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Premium teaser — locked */}
      <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50 space-y-2 relative overflow-hidden">
        <div className="absolute inset-0 backdrop-blur-[2px] bg-white/50 flex flex-col items-center justify-center z-10 rounded-2xl">
          <Lock className="w-5 h-5 text-indigo-400 mb-1" />
          <p className="text-xs font-bold text-indigo-600">Premium unlock required</p>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Depth Analysis Preview</p>
        <div className="space-y-1.5">
          {["Wrinkle depth: ██████ 6.2 / 10", "Volume loss index: ████████ 7.1 / 10", "Symmetry score: ████ 3.9 / 10"].map(l => (
            <div key={l} className="text-sm text-gray-400 flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-yellow-300 flex-shrink-0" />{l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}