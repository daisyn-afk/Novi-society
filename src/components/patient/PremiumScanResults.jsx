import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, TrendingUp, DollarSign, Clock, Shield, BarChart2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PremiumScanResults({ scan, patientJourney, allScans = [] }) {
  const [roadmap, setRoadmap] = useState(patientJourney?.roadmap || null);
  const [generating, setGenerating] = useState(false);

  const analysis = scan?.ai_analysis;

  const generateRoadmap = async () => {
    setGenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert aesthetic treatment planner. Based on the following patient profile, create a detailed personalized treatment roadmap.

Patient concerns: ${JSON.stringify(patientJourney?.skin_concerns || [])}
Treatment goals: ${JSON.stringify(patientJourney?.treatment_goals || [])}
Budget comfort: ${patientJourney?.budget_comfort || "unspecified"}
AI scan analysis: ${JSON.stringify(analysis || {})}

Generate a comprehensive treatment roadmap with:
- recommended_sequence: array of treatment objects (treatment_name, timing, estimated_cost_low, estimated_cost_high, priority: "essential"|"recommended"|"optional", rationale)
- cost_projection_6mo: number
- cost_projection_12mo: number
- cost_projection_24mo: number
- touch_up_intervals: array of objects (treatment, interval_months)
- maintenance_plan: string (paragraph)
- ai_improvement_score: number 0-100 (predicted improvement with treatment)
- savings_tip: string`,
      response_json_schema: {
        type: "object",
        properties: {
          recommended_sequence: { type: "array", items: { type: "object" } },
          cost_projection_6mo: { type: "number" },
          cost_projection_12mo: { type: "number" },
          cost_projection_24mo: { type: "number" },
          touch_up_intervals: { type: "array", items: { type: "object" } },
          maintenance_plan: { type: "string" },
          ai_improvement_score: { type: "number" },
          savings_tip: { type: "string" },
        }
      }
    });
    setRoadmap(result);
    setGenerating(false);

    // Persist
    if (patientJourney?.id) {
      await base44.entities.PatientJourney.update(patientJourney.id, { roadmap: result, ai_score: result.ai_improvement_score });
    }
  };

  const priorityStyle = { essential: { bg: "#fee2e2", text: "#dc2626" }, recommended: { bg: "#dbeafe", text: "#1d4ed8" }, optional: { bg: "#f3f4f6", text: "#6b7280" } };

  return (
    <div className="space-y-5">
      {/* AI improvement score */}
      {(roadmap?.ai_improvement_score || patientJourney?.ai_score) && (
        <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg, #1e2535, #2D4A7A)" }}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">AI Improvement Forecast</p>
          <div className="flex items-end gap-3">
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 48, lineHeight: 1, color: "#C8E63C" }}>
              {roadmap?.ai_improvement_score || patientJourney?.ai_score}%
            </span>
            <p className="text-sm text-white/70 mb-1">predicted improvement with your personalized plan</p>
          </div>
        </div>
      )}

      {/* Depth analysis */}
      {analysis && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Full Depth Analysis</p>
          </div>
          <p className="text-sm text-gray-600">{analysis.concern_summary}</p>
          {analysis.detected_concerns?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {analysis.detected_concerns.map(c => <Badge key={c} className="bg-indigo-50 text-indigo-700 border-indigo-100">{c}</Badge>)}
            </div>
          )}
          {analysis.treatment_areas?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Treatment Areas Identified</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.treatment_areas.map(a => <Badge key={a} variant="outline">{a}</Badge>)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Before/after comparison */}
      {allScans.length >= 2 && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Scan Comparison</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">Before</p>
              <img src={allScans[0].scan_url} className="w-full h-32 object-cover rounded-xl" alt="before" />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Latest</p>
              <img src={allScans[allScans.length - 1].scan_url} className="w-full h-32 object-cover rounded-xl" alt="latest" />
            </div>
          </div>
        </div>
      )}

      {/* Treatment roadmap */}
      {!roadmap ? (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 text-center">
          <Sparkles className="w-8 h-8 text-indigo-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700 mb-1">Generate Your Personalized Roadmap</p>
          <p className="text-sm text-gray-400 mb-4">Our AI will create a customized treatment plan, cost forecast, and maintenance schedule just for you.</p>
          <Button onClick={generateRoadmap} disabled={generating} className="gap-2" style={{ background: "#7B8EC8", color: "#fff" }}>
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate My Roadmap</>}
          </Button>
        </div>
      ) : (
        <>
          {/* Recommended sequence */}
          {roadmap.recommended_sequence?.length > 0 && (
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Your Treatment Sequence</p>
              {roadmap.recommended_sequence.map((t, i) => {
                const ps = priorityStyle[t.priority] || priorityStyle.optional;
                return (
                  <div key={i} className="flex gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: "#7B8EC8" }}>{i + 1}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-gray-800">{t.treatment_name}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: ps.bg, color: ps.text }}>{t.priority}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{t.timing} · ${t.estimated_cost_low}–${t.estimated_cost_high}</p>
                      {t.rationale && <p className="text-xs text-gray-400 mt-1">{t.rationale}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Cost projections */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-green-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Cost Forecast</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "6 Months", val: roadmap.cost_projection_6mo },
                { label: "12 Months", val: roadmap.cost_projection_12mo },
                { label: "24 Months", val: roadmap.cost_projection_24mo },
              ].map(p => (
                <div key={p.label} className="text-center p-3 rounded-xl bg-gray-50">
                  <p className="text-lg font-bold text-gray-800">${p.val?.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{p.label}</p>
                </div>
              ))}
            </div>
            {roadmap.savings_tip && (
              <p className="text-xs text-green-600 mt-3 bg-green-50 rounded-xl p-3">💡 {roadmap.savings_tip}</p>
            )}
          </div>

          {/* Touch-up intervals */}
          {roadmap.touch_up_intervals?.length > 0 && (
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-blue-500" />
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Maintenance Schedule</p>
              </div>
              <div className="space-y-2">
                {roadmap.touch_up_intervals.map((t, i) => (
                  <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-gray-50">
                    <span className="text-gray-700">{t.treatment}</span>
                    <span className="text-gray-400">Every {t.interval_months} months</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Long-term plan */}
          {roadmap.maintenance_plan && (
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Long-Term Maintenance Plan</p>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{roadmap.maintenance_plan}</p>
            </div>
          )}

          <Button onClick={generateRoadmap} disabled={generating} variant="outline" size="sm" className="gap-1.5 text-gray-500">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Regenerate Roadmap
          </Button>
        </>
      )}
    </div>
  );
}