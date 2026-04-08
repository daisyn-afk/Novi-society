import { BarChart2, Activity, Droplets, Sun, Zap } from "lucide-react";

function MetricBar({ label, value, max = 100, color = "#7B8EC8", unit = "", invert = false }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const displayPct = invert ? 100 - pct : pct;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <p className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.65)" }}>{label}</p>
        <p className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>{value}{unit}</p>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.07)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${displayPct}%`, background: color }} />
      </div>
    </div>
  );
}

function ZoneMap({ map }) {
  if (!map || Object.keys(map).length === 0) return null;
  const zones = [
    { key: "forehead", label: "Forehead" },
    { key: "glabella", label: "Glabella" },
    { key: "crow_feet", label: "Crow's Feet" },
    { key: "nasolabial", label: "Nasolabial" },
    { key: "marionette", label: "Marionette" },
    { key: "perioral", label: "Perioral" },
  ];
  const getSeverityColor = (v) => {
    if (v <= 2) return "#C8E63C";
    if (v <= 5) return "#FA6F30";
    return "#DA6A63";
  };
  const getSeverityLabel = (v) => {
    if (v <= 2) return "Minimal";
    if (v <= 5) return "Moderate";
    return "Significant";
  };

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(30,37,53,0.4)" }}>Wrinkle Depth Map</p>
      <div className="grid grid-cols-2 gap-1.5">
        {zones.map(z => {
          const val = map[z.key];
          if (val == null) return null;
          const color = getSeverityColor(val);
          return (
            <div key={z.key} className="flex items-center justify-between rounded-lg px-2.5 py-2" style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)" }}>
              <p className="text-xs font-medium" style={{ color: "rgba(30,37,53,0.65)" }}>{z.label}</p>
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5,6,7,8,9,10].map(i => (
                    <div key={i} className="w-1 rounded-full" style={{ height: 10, background: i <= val ? color : "rgba(0,0,0,0.08)" }} />
                  ))}
                </div>
                <span className="text-xs font-bold w-16 text-right" style={{ color }}>{getSeverityLabel(val)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PremiumMetrics({ analysis }) {
  if (!analysis) return null;

  const symmetry = analysis.symmetry_score ?? analysis.symmetry ?? null;
  const wrinkleDepth = analysis.wrinkle_depth_score ?? analysis.wrinkle_depth ?? null;
  const volumeLoss = analysis.volume_loss_score ?? analysis.volume_loss ?? null;
  const skinAge = analysis.estimated_skin_age ?? analysis.skin_age_estimate ?? null;
  const confidence = analysis.confidence_score ?? null;
  const hydration = analysis.hydration_score ?? null;
  const pigmentation = analysis.pigmentation_score ?? null;
  const wrinkleMap = analysis.wrinkle_depth_map ?? null;

  const hasMetrics = symmetry !== null || wrinkleDepth !== null || volumeLoss !== null || hydration !== null;

  if (!hasMetrics && !skinAge) {
    // Fallback: derive rough metrics from detected_concerns text
    const concerns = analysis.detected_concerns || [];
    const hasWrinkles = concerns.some(c => c.toLowerCase().includes("wrinkle") || c.toLowerCase().includes("line") || c.toLowerCase().includes("crease"));
    const hasVolume = concerns.some(c => c.toLowerCase().includes("volume") || c.toLowerCase().includes("hollow") || c.toLowerCase().includes("droop"));
    const hasPigment = concerns.some(c => c.toLowerCase().includes("pigment") || c.toLowerCase().includes("spot") || c.toLowerCase().includes("discolor"));
    return (
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(123,142,200,0.2)" }}>
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4" style={{ color: "#7B8EC8" }} />
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7B8EC8" }}>Full Depth Analysis</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Wrinkle Activity", present: hasWrinkles, color: "#DA6A63" },
            { label: "Volume Concern", present: hasVolume, color: "#FA6F30" },
            { label: "Pigmentation", present: hasPigment, color: "#7B8EC8" },
          ].map(({ label, present, color }) => (
            <div key={label} className="text-center rounded-xl p-3" style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)" }}>
              <div className="w-2.5 h-2.5 rounded-full mx-auto mb-2" style={{ background: present ? color : "rgba(0,0,0,0.12)" }} />
              <p className="text-xs font-medium" style={{ color: "rgba(30,37,53,0.6)" }}>{label}</p>
              <p className="text-xs font-bold mt-0.5" style={{ color: present ? color : "rgba(30,37,53,0.3)" }}>{present ? "Detected" : "Minimal"}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-center" style={{ color: "rgba(30,37,53,0.35)" }}>Upload a new scan to generate full depth scores →</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 space-y-5" style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(123,142,200,0.2)" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4" style={{ color: "#7B8EC8" }} />
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7B8EC8" }}>Full Depth Analysis</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(200,230,60,0.15)", color: "#5a7a20", border: "1px solid rgba(200,230,60,0.3)" }}>Premium</span>
      </div>

      {/* Skin age highlight */}
      {skinAge !== null && (
        <div className="flex items-center gap-4 rounded-xl px-4 py-3" style={{ background: "linear-gradient(135deg, rgba(123,142,200,0.1), rgba(45,107,127,0.08))", border: "1px solid rgba(123,142,200,0.2)" }}>
          <Activity className="w-5 h-5 flex-shrink-0" style={{ color: "#7B8EC8" }} />
          <div className="flex-1">
            <p className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.55)" }}>Estimated Skin Age</p>
            <p className="text-2xl font-black" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>{skinAge} <span className="text-sm font-normal">years</span></p>
          </div>
          {confidence !== null && (
            <div className="text-right">
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>Confidence</p>
              <p className="text-sm font-bold" style={{ color: "#7B8EC8" }}>{confidence}%</p>
            </div>
          )}
        </div>
      )}

      {/* Core metrics */}
      <div className="space-y-4">
        {symmetry !== null && (
          <MetricBar label="Facial Symmetry" value={symmetry} max={100} color="#C8E63C" unit="%" />
        )}
        {wrinkleDepth !== null && (
          <MetricBar label="Wrinkle Depth Index" value={wrinkleDepth} max={100} color="#DA6A63" />
        )}
        {volumeLoss !== null && (
          <MetricBar label="Volume Loss Index" value={volumeLoss} max={100} color="#FA6F30" />
        )}
        {hydration !== null && (
          <MetricBar label="Hydration Score" value={hydration} max={100} color="#4a8fa8" unit="%" />
        )}
        {pigmentation !== null && (
          <MetricBar label="Skin Tone Evenness" value={pigmentation} max={100} color="#7B8EC8" unit="%" />
        )}
      </div>

      {/* Wrinkle depth map */}
      {wrinkleMap && <ZoneMap map={wrinkleMap} />}

      {/* Treatment areas */}
      {analysis.treatment_areas?.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(30,37,53,0.4)" }}>Priority Treatment Areas</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.treatment_areas.map(a => (
              <span key={a} className="text-xs px-2.5 py-1 rounded-full capitalize font-medium" style={{ background: "rgba(123,142,200,0.1)", color: "#4a5fa8", border: "1px solid rgba(123,142,200,0.2)" }}>
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}