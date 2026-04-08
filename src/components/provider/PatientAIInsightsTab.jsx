import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package, Calendar, Zap, BookOpen, ShieldCheck } from "lucide-react";

export default function PatientAIInsightsTab({ patientId, treatments, journey }) {
  const [generating, setGenerating] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);

  const { data: manufacturers = [] } = useQuery({
    queryKey: ["manufacturers-active"],
    queryFn: () => base44.entities.Manufacturer.filter({ is_active: true }),
  });

  // Provider's active MD subscriptions — to know which services they're covered for
  const { data: mySubscriptions = [] } = useQuery({
    queryKey: ["my-md-subscriptions"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.MDSubscription.filter({ provider_id: me.id, status: "active" });
    },
  });

  const coveredServiceNames = mySubscriptions.map(s => (s.service_type_name || "").toLowerCase());

  const allCheckins = treatments.flatMap(t =>
    (t.patient_checkins || []).map(c => ({ ...c, treatmentService: t.service }))
  );
  allCheckins.sort((a, b) => (a.day_number || 0) - (b.day_number || 0));

  const latestScan = journey?.scans?.[journey.scans?.length - 1];

  const isServiceCovered = (treatmentName) => {
    if (!treatmentName) return true; // no name, don't flag
    const name = treatmentName.toLowerCase();
    return coveredServiceNames.some(s => name.includes(s) || s.includes(name.split(" ")[0]));
  };

  const generateDeepInsights = async () => {
    setGenerating(true);
    setAiInsights(null);

    const checkinSummary = allCheckins.slice(-10).map(c =>
      `Day ${c.day_number} (${c.treatmentService}): comfort ${c.comfort_level}/5, swelling ${c.swelling_level}/5, bruising ${c.bruising_level}/5, stage: ${c.ai_recovery_stage || "?"}`
    ).join("\n");

    const scanData = latestScan?.ai_analysis
      ? `Baseline scan: ${latestScan.ai_analysis.overall_skin_health}. Concerns: ${latestScan.ai_analysis.detected_concerns?.join(", ")}.`
      : "";

    const marketplaceContext = manufacturers.length > 0
      ? `NOVI Marketplace brands (prefer these):\n${manufacturers.map(m => `- ${m.name}: ${(m.products || []).slice(0, 3).join(", ")}`).join("\n")}`
      : "";

    const prompt = `Summarize patient recovery data for provider pre-visit prep. Be brief, clinical, direct. No filler.

Check-in data:
${checkinSummary}
${scanData}
Goals: ${journey?.treatment_goals?.join(", ") || "not specified"}
Skin concerns: ${journey?.skin_concerns?.join(", ") || "not specified"}
${marketplaceContext}

Return:
1. recovery_summary: 1 sentence only. What does the data show? (e.g. "Comfort improved Day 1→7, swelling resolved by Day 5.")
2. product_recommendations: exactly 3 items. product = brand + product name only (short). rationale = 5 words max. marketplace_available = true if brand is in NOVI Marketplace list, else false.
3. next_treatments: exactly 2 items. treatment = short name only. rationale = 5 words max.`;

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            recovery_summary: { type: "string" },
            product_recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product: { type: "string" },
                  rationale: { type: "string" },
                  marketplace_available: { type: "boolean" },
                  manufacturer_name: { type: "string" }
                }
              }
            },
            next_treatments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  treatment: { type: "string" },
                  rationale: { type: "string" }
                }
              }
            }
          }
        }
      });
      setAiInsights(res);
    } catch (e) { /* non-fatal */ }
    setGenerating(false);
  };

  if (!allCheckins.length && !latestScan) {
    return (
      <div className="text-center py-16">
        <Zap className="w-8 h-8 mx-auto mb-3 opacity-20" />
        <p className="text-sm font-semibold" style={{ color: "rgba(30,37,53,0.4)" }}>No patient data yet</p>
        <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.3)" }}>Check-ins and scan data will appear here once the patient starts tracking.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Photo strip — compact */}
      {allCheckins.filter(c => c.photo_url).length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {allCheckins.filter(c => c.photo_url).map((c, i) => (
            <div key={i} className="flex-shrink-0 relative">
              <img src={c.photo_url} alt={`Day ${c.day_number}`} className="w-20 h-20 object-cover rounded-xl" />
              <div className="absolute bottom-1 left-1 text-xs font-bold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(30,37,53,0.75)", color: "#C8E63C" }}>
                Day {c.day_number}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate / Refresh button */}
      <button
        onClick={generateDeepInsights}
        disabled={generating || allCheckins.length === 0}
        className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(135deg, #1e2535, #2D4A7A)", color: "#C8E63C" }}
      >
        {generating ? (
          <><div className="w-4 h-4 border-2 border-lime-300/30 border-t-lime-300 rounded-full animate-spin" /> Analyzing…</>
        ) : (
          <><Zap className="w-4 h-4" /> {aiInsights ? "Refresh Summary" : "Run Pre-Visit Summary"}</>
        )}
      </button>

      {/* Results */}
      {aiInsights && (
        <div className="space-y-3">

          {/* Recovery snapshot — single line */}
          {aiInsights.recovery_summary && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(30,37,53,0.07)" }}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#7B8EC8" }} />
              <p className="text-sm font-medium" style={{ color: "#1e2535" }}>{aiInsights.recovery_summary}</p>
            </div>
          )}

          {/* Products */}
          {aiInsights.product_recommendations?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-widest px-0.5" style={{ color: "rgba(30,37,53,0.3)" }}>Recommend</p>
              {aiInsights.product_recommendations.map((p, i) => (
                <div key={i} className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(30,37,53,0.07)" }}>
                  <Package className="w-4 h-4 flex-shrink-0 opacity-30" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{p.product}</p>
                      {p.marketplace_available && (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(200,230,60,0.2)", color: "#3d5615" }}>Marketplace</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>{p.rationale}</p>
                  </div>
                  {p.marketplace_available && (
                    <button className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: "#C8E63C", color: "#1e2535" }}>
                      Order
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Next treatments */}
          {aiInsights.next_treatments?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-widest px-0.5" style={{ color: "rgba(30,37,53,0.3)" }}>Discuss at Next Visit</p>
              {aiInsights.next_treatments.map((t, i) => {
                const covered = isServiceCovered(t.treatment);
                return (
                  <div key={i} className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(30,37,53,0.07)" }}>
                    <Calendar className="w-4 h-4 flex-shrink-0 opacity-30" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{t.treatment}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>{t.rationale}</p>
                    </div>
                    {covered ? (
                      <button className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: "rgba(123,142,200,0.15)", color: "#4a5fa8", border: "1px solid rgba(123,142,200,0.25)" }}>
                        Book
                      </button>
                    ) : (
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ background: "rgba(218,106,99,0.12)", color: "#DA6A63" }}>Not covered</span>
                        <div className="flex gap-1">
                          <a href="/ProviderEnrollments" className="text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1" style={{ background: "rgba(200,230,60,0.15)", color: "#3d5615" }}>
                            <BookOpen className="w-3 h-3" /> Get Certified
                          </a>
                          <a href="/ProviderCredentialsCoverage" className="text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1" style={{ background: "rgba(123,142,200,0.12)", color: "#4a5fa8" }}>
                            <ShieldCheck className="w-3 h-3" /> Coverage
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Baseline scan — minimal */}
      {latestScan?.ai_analysis && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(30,37,53,0.06)" }}>
          {latestScan.scan_url && <img src={latestScan.scan_url} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" alt="scan" />}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold" style={{ color: "rgba(30,37,53,0.35)" }}>Baseline Scan</p>
            <p className="text-sm font-semibold truncate" style={{ color: "#1e2535" }}>{latestScan.ai_analysis.overall_skin_health}</p>
            {latestScan.ai_analysis.detected_concerns?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {latestScan.ai_analysis.detected_concerns.slice(0, 3).map(c => (
                  <span key={c} className="text-xs px-1.5 py-0.5 rounded-md capitalize" style={{ background: "rgba(250,111,48,0.08)", color: "#FA6F30" }}>{c}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}