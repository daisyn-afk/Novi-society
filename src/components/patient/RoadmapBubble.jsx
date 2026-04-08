import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, DollarSign, Clock, Shield, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const priorityStyle = {
  essential: { bg: "rgba(218,106,99,0.2)", color: "#DA6A63", border: "rgba(218,106,99,0.3)" },
  recommended: { bg: "rgba(74,95,160,0.2)", color: "#7B8EC8", border: "rgba(74,95,160,0.3)" },
  optional: { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", border: "rgba(255,255,255,0.1)" },
};

export default function RoadmapBubble({ journey, latestScan, onRoadmapGenerated }) {
  const [roadmap, setRoadmap] = useState(journey?.roadmap || null);
  const [generating, setGenerating] = useState(false);

  const generateRoadmap = async () => {
    setGenerating(true);
    const analysis = latestScan?.ai_analysis;
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert aesthetic treatment planner for NOVI Society. You MUST personalize every recommendation based ONLY on the actual scan findings below. Do NOT use generic suggestions — every treatment must directly address a specific detected concern.

SCAN FINDINGS (drive ALL recommendations from this):
- Detected concerns: ${JSON.stringify(analysis?.detected_concerns || [])}
- Overall skin health: ${analysis?.overall_skin_health || "unknown"}
- Concern summary: ${analysis?.concern_summary || ""}
- Treatment areas: ${JSON.stringify(analysis?.treatment_areas || [])}
- Scan-recommended treatments: ${JSON.stringify(analysis?.recommended_treatments || [])}

PATIENT PROFILE:
- Skin concerns: ${JSON.stringify(journey?.skin_concerns || [])}
- Goals: ${JSON.stringify(journey?.treatment_goals || [])}
- Budget: ${journey?.budget_comfort || "unspecified"}

Each treatment rationale must reference specific detected concerns and explain exactly what improvement the patient will see. Generate:
- recommended_sequence: array of up to 5 objects (treatment_name, timing, estimated_cost_low, estimated_cost_high, priority: "essential"|"recommended"|"optional", rationale, addresses_concern)
- cost_projection_6mo: number
- cost_projection_12mo: number
- touch_up_intervals: array of objects (treatment, interval_months)
- maintenance_plan: brief paragraph
- ai_improvement_score: number 0-100
- savings_tip: string`,
      response_json_schema: {
        type: "object",
        properties: {
          recommended_sequence: { type: "array", items: { type: "object" } },
          cost_projection_6mo: { type: "number" },
          cost_projection_12mo: { type: "number" },
          touch_up_intervals: { type: "array", items: { type: "object" } },
          maintenance_plan: { type: "string" },
          ai_improvement_score: { type: "number" },
          savings_tip: { type: "string" },
        }
      }
    });
    setRoadmap(result);
    setGenerating(false);
    if (journey?.id) {
      await base44.entities.PatientJourney.update(journey.id, { roadmap: result, ai_score: result.ai_improvement_score });
    }
    if (onRoadmapGenerated) onRoadmapGenerated(result);
  };

  return (
    <div className="flex gap-3 items-end">
      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7B8EC8, #2D6B7F)" }}>
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 max-w-lg">
        <p className="text-xs text-white/40 mb-1.5 ml-1">Novi · Your Roadmap</p>
        <div className="rounded-2xl rounded-bl-sm p-5 space-y-4" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)" }}>

          {!roadmap && !generating && (
            <div className="text-center space-y-3 py-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "rgba(200,230,60,0.15)" }}>
                <Sparkles className="w-6 h-6" style={{ color: "#C8E63C" }} />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">Your Personalized Treatment Roadmap</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>I'll build a step-by-step plan with cost estimates and a maintenance schedule based on your scan.</p>
              </div>
              <button onClick={generateRoadmap}
                className="px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90"
                style={{ background: "#C8E63C", color: "#1e2535" }}>
                <Sparkles className="inline w-3.5 h-3.5 mr-1.5" /> Generate My Roadmap
              </button>
            </div>
          )}

          {generating && (
            <div className="flex items-center gap-3 py-4 justify-center">
              <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
              <p className="text-sm text-white/60 italic">Building your personalized plan…</p>
            </div>
          )}

          {roadmap && (
            <div className="space-y-4">
              {/* Score */}
              {roadmap.ai_improvement_score && (
                <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.25)" }}>
                  <p className="text-xs text-white/60 font-semibold">AI Improvement Forecast</p>
                  <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#C8E63C", lineHeight: 1 }}>
                    {roadmap.ai_improvement_score}%
                  </span>
                </div>
              )}

              {/* Treatment sequence */}
              {roadmap.recommended_sequence?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Your Treatment Sequence</p>
                  {roadmap.recommended_sequence.map((t, i) => {
                    const ps = priorityStyle[t.priority] || priorityStyle.optional;
                    return (
                      <div key={i} className="flex gap-3 px-3 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white" style={{ background: "#7B8EC8", minWidth: 24 }}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-white text-sm">{t.treatment_name}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>{t.priority}</span>
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{t.timing} · ${t.estimated_cost_low}–${t.estimated_cost_high}</p>
                          {t.rationale && <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>{t.rationale}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cost projections */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "6 Month Estimate", val: roadmap.cost_projection_6mo },
                  { label: "12 Month Estimate", val: roadmap.cost_projection_12mo },
                ].map(p => p.val ? (
                  <div key={p.label} className="text-center rounded-xl py-3" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <p className="text-lg font-bold text-white">${p.val?.toLocaleString()}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{p.label}</p>
                  </div>
                ) : null)}
              </div>

              {/* Savings tip */}
              {roadmap.savings_tip && (
                <p className="text-xs rounded-xl px-3 py-2.5" style={{ background: "rgba(200,230,60,0.1)", color: "#C8E63C", border: "1px solid rgba(200,230,60,0.2)" }}>
                  💡 {roadmap.savings_tip}
                </p>
              )}

              {/* Maintenance */}
              {roadmap.maintenance_plan && (
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Maintenance Plan</p>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{roadmap.maintenance_plan}</p>
                </div>
              )}

              <button onClick={generateRoadmap} className="text-xs text-white/30 hover:text-white/50 transition-colors">
                ↻ Regenerate roadmap
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}