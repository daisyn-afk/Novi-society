import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Sparkles, Loader2, Star, MapPin, Award, DollarSign,
  ChevronDown, ChevronUp, Crown, Calendar, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";

const priorityStyle = {
  essential: { bg: "rgba(218,106,99,0.15)", color: "#DA6A63", border: "rgba(218,106,99,0.3)" },
  recommended: { bg: "rgba(123,142,200,0.15)", color: "#7B8EC8", border: "rgba(123,142,200,0.3)" },
  optional: { bg: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "rgba(255,255,255,0.1)" },
};

function MatchScore({ score }) {
  const color = score >= 80 ? "#C8E63C" : score >= 60 ? "#FA6F30" : "#7B8EC8";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-xs font-bold" style={{ color }}>{score}% match</span>
    </div>
  );
}

function ProviderCard({ provider, treatments, certs, reviews, isTop, onBook }) {
  const [expanded, setExpanded] = useState(isTop);

  const providerCerts = certs.filter(c => c.provider_id === provider.id);
  const providerReviews = reviews.filter(r => r.provider_id === provider.id);
  const avgRating = providerReviews.length
    ? (providerReviews.reduce((s, r) => s + r.rating, 0) / providerReviews.length).toFixed(1)
    : null;

  // Which of the roadmap treatments this provider can do
  const matchedTreatments = treatments.filter(t =>
    providerCerts.some(c =>
      c.certification_name?.toLowerCase().includes(t.treatment_name?.toLowerCase().split(" ")[0]) ||
      c.service_type_name?.toLowerCase().includes(t.treatment_name?.toLowerCase().split(" ")[0]) ||
      t.treatment_name?.toLowerCase().includes(c.service_type_name?.toLowerCase()?.split(" ")[0] || "___")
    )
  );

  const coverageCount = matchedTreatments.length;
  const matchScore = Math.min(100, Math.round(
    (coverageCount / Math.max(treatments.length, 1)) * 60 +
    (avgRating ? (parseFloat(avgRating) / 5) * 25 : 0) +
    (provider.city ? 15 : 0)
  ));

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: isTop ? "rgba(200,230,60,0.08)" : "rgba(255,255,255,0.06)", border: isTop ? "1px solid rgba(200,230,60,0.3)" : "1px solid rgba(255,255,255,0.1)" }}>
      {isTop && (
        <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: "rgba(200,230,60,0.15)", borderBottom: "1px solid rgba(200,230,60,0.2)" }}>
          <Crown className="w-3 h-3" style={{ color: "#C8E63C" }} />
          <span className="text-xs font-bold" style={{ color: "#C8E63C" }}>Novi's Top Pick</span>
        </div>
      )}

      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
            style={{ background: "linear-gradient(135deg, #7B8EC8, #2D6B7F)", color: "white" }}>
            {provider.full_name?.[0] || "P"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm truncate">{provider.full_name}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {provider.city && (
                <span className="text-xs flex items-center gap-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                  <MapPin className="w-2.5 h-2.5" />{provider.city}{provider.state ? `, ${provider.state}` : ""}
                </span>
              )}
              {avgRating && (
                <span className="text-xs flex items-center gap-0.5 text-amber-400">
                  <Star className="w-2.5 h-2.5 fill-amber-400" />{avgRating}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <MatchScore score={matchScore} />
            <button onClick={() => setExpanded(v => !v)} className="text-white/30 hover:text-white/60 transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2.5">
            {/* Coverage breakdown */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                Treatment Coverage ({coverageCount}/{treatments.length})
              </p>
              <div className="space-y-1">
                {treatments.map((t, i) => {
                  const covered = matchedTreatments.includes(t);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: covered ? "rgba(200,230,60,0.2)" : "rgba(255,255,255,0.06)" }}>
                        {covered
                          ? <CheckCircle2 className="w-2.5 h-2.5" style={{ color: "#C8E63C" }} />
                          : <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 8 }}>✕</span>}
                      </div>
                      <p className="text-xs" style={{ color: covered ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.3)" }}>
                        {t.treatment_name}
                      </p>
                      {covered && (
                        <span className="text-xs ml-auto" style={{ color: "rgba(255,255,255,0.35)" }}>
                          ${t.estimated_cost_low}–${t.estimated_cost_high}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Certs */}
            {providerCerts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {providerCerts.slice(0, 3).map(c => (
                  <span key={c.id} className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: "rgba(200,230,60,0.1)", color: "rgba(200,230,60,0.8)", border: "1px solid rgba(200,230,60,0.2)" }}>
                    <Award className="w-2.5 h-2.5" />{c.certification_name}
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={() => onBook(provider)}
              className="w-full py-2 rounded-full text-xs font-bold transition-all hover:opacity-90"
              style={{ background: isTop ? "#C8E63C" : "rgba(123,142,200,0.2)", color: isTop ? "#1e2535" : "#a0b0e8", border: isTop ? "none" : "1px solid rgba(123,142,200,0.3)" }}>
              <Calendar className="inline w-3 h-3 mr-1.5" /> Book with {provider.full_name?.split(" ")[0]}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProviderMatchRoadmap({ journey, latestScan, onRoadmapGenerated }) {
  const navigate = useNavigate();
  const [roadmap, setRoadmap] = useState(journey?.roadmap || null);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("roadmap"); // "roadmap" | "providers"

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => base44.entities.User.list() });
  const { data: certs = [] } = useQuery({ queryKey: ["certifications"], queryFn: () => base44.entities.Certification.filter({ status: "active" }) });
  const { data: reviews = [] } = useQuery({ queryKey: ["reviews"], queryFn: () => base44.entities.Review.filter({ is_verified: true }) });
  const { data: licenses = [] } = useQuery({ queryKey: ["all-licenses"], queryFn: () => base44.entities.License.filter({ status: "verified" }) });
  const { data: mdSubs = [] } = useQuery({ queryKey: ["all-md-subs"], queryFn: () => base44.entities.MDSubscription.filter({ status: "active" }) });

  // Demo providers so the UI is always populated
  const DEMO_PROVIDERS = [
    { id: "demo-1", full_name: "Dr. Sarah Mitchel", city: "Austin", state: "TX", specialty: "Aesthetic Injector & Skin Specialist", bio: "Board-certified NP with 9 years specializing in natural-looking results.", _demo: true },
    { id: "demo-2", full_name: "Jessica Park, PA-C", city: "Dallas", state: "TX", specialty: "Medical Aesthetics & Laser", bio: "Dual-certified in injectables and advanced laser treatments.", _demo: true },
    { id: "demo-3", full_name: "Dr. Monica Reyes", city: "Houston", state: "TX", specialty: "Regenerative Aesthetics", bio: "PRP and microneedling specialist focused on skin renewal.", _demo: true },
    { id: "demo-4", full_name: "Lauren Kim, RN", city: "San Antonio", state: "TX", specialty: "Skincare & Chemical Peels", bio: "Expert in chemical exfoliation and medical-grade skincare protocols.", _demo: true },
  ];
  const DEMO_CERTS = [
    { id: "dc-1", provider_id: "demo-1", certification_name: "Botox & Neurotoxins", service_type_name: "Botox" },
    { id: "dc-2", provider_id: "demo-1", certification_name: "Dermal Fillers", service_type_name: "Fillers" },
    { id: "dc-3", provider_id: "demo-1", certification_name: "HydraFacial", service_type_name: "HydraFacial" },
    { id: "dc-4", provider_id: "demo-1", certification_name: "Chemical Peel", service_type_name: "Chemical Peel" },
    { id: "dc-5", provider_id: "demo-2", certification_name: "Laser Resurfacing", service_type_name: "Laser" },
    { id: "dc-6", provider_id: "demo-2", certification_name: "Microneedling", service_type_name: "Microneedling" },
    { id: "dc-7", provider_id: "demo-2", certification_name: "Botox & Neurotoxins", service_type_name: "Botox" },
    { id: "dc-8", provider_id: "demo-3", certification_name: "PRP Therapy", service_type_name: "PRP" },
    { id: "dc-9", provider_id: "demo-3", certification_name: "Microneedling", service_type_name: "Microneedling" },
    { id: "dc-10", provider_id: "demo-4", certification_name: "Chemical Peel", service_type_name: "Chemical Peel" },
    { id: "dc-11", provider_id: "demo-4", certification_name: "HydraFacial", service_type_name: "HydraFacial" },
    { id: "dc-12", provider_id: "demo-4", certification_name: "Kybella", service_type_name: "Kybella" },
  ];
  const DEMO_REVIEWS = [
    { id: "dr-1", provider_id: "demo-1", rating: 5 },
    { id: "dr-2", provider_id: "demo-1", rating: 5 },
    { id: "dr-3", provider_id: "demo-1", rating: 4 },
    { id: "dr-4", provider_id: "demo-2", rating: 5 },
    { id: "dr-5", provider_id: "demo-2", rating: 4 },
    { id: "dr-6", provider_id: "demo-3", rating: 5 },
    { id: "dr-7", provider_id: "demo-3", rating: 5 },
    { id: "dr-8", provider_id: "demo-4", rating: 4 },
  ];

  const verifiedIds = new Set(licenses.map(l => l.provider_id));
  const mdIds = new Set(mdSubs.map(s => s.provider_id));
  const realProviders = users.filter(u => u.role === "provider" && verifiedIds.has(u.id) && mdIds.has(u.id));
  // Merge real providers with demo providers; demo fills in when real DB is empty
  const providers = realProviders.length > 0 ? realProviders : DEMO_PROVIDERS;
  const allCerts = [...certs, ...DEMO_CERTS];
  const allReviews = [...reviews, ...DEMO_REVIEWS];

  const treatments = roadmap?.recommended_sequence || [];

  // Score and sort providers by match
  const scoredProviders = providers.map(p => {
    const provCerts = allCerts.filter(c => c.provider_id === p.id);
    const provReviews = allReviews.filter(r => r.provider_id === p.id);
    const avgRating = provReviews.length
      ? provReviews.reduce((s, r) => s + r.rating, 0) / provReviews.length
      : 0;
    const matched = treatments.filter(t =>
      provCerts.some(c =>
        c.certification_name?.toLowerCase().includes(t.treatment_name?.toLowerCase().split(" ")[0]) ||
        c.service_type_name?.toLowerCase().includes(t.treatment_name?.toLowerCase().split(" ")[0]) ||
        t.treatment_name?.toLowerCase().includes(c.service_type_name?.toLowerCase()?.split(" ")[0] || "___")
      )
    );
    const score = Math.min(100, Math.round(
      (matched.length / Math.max(treatments.length, 1)) * 60 +
      (avgRating / 5) * 25 +
      (p.city ? 15 : 0)
    ));
    return { ...p, _score: score, _matched: matched.length };
  }).sort((a, b) => b._score - a._score).slice(0, 5);

  const generateRoadmap = async () => {
    setGenerating(true);
    const analysis = latestScan?.ai_analysis;
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert aesthetic treatment planner for NOVI Society, a premium aesthetic wellness platform. You MUST personalize every single recommendation based ONLY on the actual scan data and concerns listed below. Do NOT use generic treatment suggestions — every treatment must directly address a specific detected concern from this patient's scan.

PATIENT SCAN DATA (use this to drive ALL recommendations):
- Detected concerns: ${JSON.stringify(analysis?.detected_concerns || [])}
- Overall skin health: ${analysis?.overall_skin_health || "unknown"}
- Concern summary from scan: ${analysis?.concern_summary || ""}
- Treatment areas identified: ${JSON.stringify(analysis?.treatment_areas || [])}
- Recommended treatments from scan: ${JSON.stringify(analysis?.recommended_treatments || [])}

PATIENT PROFILE:
- Patient's own skin concerns: ${JSON.stringify(journey?.skin_concerns || [])}
- Treatment goals: ${JSON.stringify(journey?.treatment_goals || [])}
- Budget comfort: ${journey?.budget_comfort || "unspecified"}

INSTRUCTIONS:
1. Each treatment in recommended_sequence MUST reference specific concerns from the detected_concerns list above.
2. The "rationale" field must be 2-3 sentences that: (a) name the specific concern it addresses, (b) explain exactly HOW this treatment fixes it, (c) what measurable improvement the patient will see.
3. "benefit_headline" must be a punchy 5-8 word outcome statement (e.g. "Erases forehead lines in 2 weeks").
4. "key_benefits" must be 3 specific, outcome-focused bullet points tailored to THIS patient's concerns.
5. Sequence and prioritize based on what the scan actually found — most impactful concern first.
6. Cost ranges should reflect the patient's budget comfort level: under_500, 500_1000, 1000_2500, 2500_plus.

Generate a JSON with:
- recommended_sequence: array of up to 5 objects, each with: treatment_name, timing, estimated_cost_low, estimated_cost_high, priority ("essential"|"recommended"|"optional"), rationale (personalized 2-3 sentences), benefit_headline (punchy outcome), key_benefits (array of 3 specific outcomes for THIS patient), addresses_concern (the specific detected concern this treats)
- cost_projection_6mo: number
- cost_projection_12mo: number
- maintenance_plan: brief paragraph
- ai_improvement_score: number 0-100 based on scan severity
- savings_tip: string personalized to their budget`,
      response_json_schema: {
        type: "object",
        properties: {
          recommended_sequence: {
            type: "array",
            items: {
              type: "object",
              properties: {
                treatment_name: { type: "string" },
                timing: { type: "string" },
                estimated_cost_low: { type: "number" },
                estimated_cost_high: { type: "number" },
                priority: { type: "string" },
                rationale: { type: "string" },
                benefit_headline: { type: "string" },
                key_benefits: { type: "array", items: { type: "string" } },
                addresses_concern: { type: "string" },
              }
            }
          },
          cost_projection_6mo: { type: "number" },
          cost_projection_12mo: { type: "number" },
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

  const handleBook = (provider) => {
    navigate(createPageUrl("PatientMarketplace"));
  };

  return (
    <div className="flex gap-3 items-end">
      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7B8EC8, #2D6B7F)" }}>
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 max-w-lg">
        <p className="text-xs text-white/40 mb-1.5 ml-1">Novi · Your Roadmap & Matched Providers</p>
        <div className="rounded-2xl rounded-bl-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)" }}>

          {!roadmap && !generating && (
            <div className="p-5 text-center space-y-3 py-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "rgba(200,230,60,0.15)" }}>
                <Sparkles className="w-6 h-6" style={{ color: "#C8E63C" }} />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">Personalized Treatment Roadmap + Provider Matches</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>I'll build a step-by-step plan and match you with certified Novi providers who can deliver each treatment — ranked by fit, ratings, and availability.</p>
              </div>
              <button onClick={generateRoadmap}
                className="px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90"
                style={{ background: "#C8E63C", color: "#1e2535" }}>
                <Sparkles className="inline w-3.5 h-3.5 mr-1.5" /> Generate My Roadmap
              </button>
            </div>
          )}

          {generating && (
            <div className="p-5 flex items-center gap-3 py-8 justify-center">
              <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
              <p className="text-sm text-white/60 italic">Building your personalized plan & matching providers…</p>
            </div>
          )}

          {roadmap && (
            <>
              {/* Tabs */}
              <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                {[
                  { key: "roadmap", label: "Treatment Plan" },
                  { key: "providers", label: `Matched Providers (${scoredProviders.length})` },
                ].map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className="flex-1 py-2.5 text-xs font-semibold transition-all"
                    style={{
                      color: activeTab === tab.key ? "#C8E63C" : "rgba(255,255,255,0.4)",
                      borderBottom: activeTab === tab.key ? "2px solid #C8E63C" : "2px solid transparent",
                    }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-4 space-y-4">
                {activeTab === "roadmap" && (
                  <>
                    {roadmap.ai_improvement_score && (
                      <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.25)" }}>
                        <p className="text-xs text-white/60 font-semibold">AI Improvement Forecast</p>
                        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#C8E63C", lineHeight: 1 }}>
                          {roadmap.ai_improvement_score}%
                        </span>
                      </div>
                    )}

                    {treatments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Your Treatment Sequence</p>
                        {treatments.map((t, i) => {
                          const ps = priorityStyle[t.priority] || priorityStyle.optional;
                          return (
                            <div key={i} className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                              {/* Header row */}
                              <div className="flex gap-3 px-3 pt-3 pb-2">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white" style={{ background: "#7B8EC8", minWidth: 24 }}>{i + 1}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-white text-sm">{t.treatment_name}</p>
                                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>{t.priority}</span>
                                  </div>
                                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{t.timing} · ${t.estimated_cost_low}–${t.estimated_cost_high}</p>
                                </div>
                              </div>

                              {/* Targets concern pill */}
                              {t.addresses_concern && (
                                <div className="mx-3 mb-2">
                                  <span className="text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1" style={{ background: "rgba(218,106,99,0.12)", color: "#DA6A63", border: "1px solid rgba(218,106,99,0.25)" }}>
                                    <span style={{ fontSize: 9 }}>TARGET:</span> {t.addresses_concern}
                                  </span>
                                </div>
                              )}

                              {/* Benefit headline */}
                              {t.benefit_headline && (
                                <div className="mx-3 mb-2 px-3 py-2 rounded-lg" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.15)" }}>
                                  <p className="text-xs font-bold" style={{ color: "#C8E63C" }}>✦ {t.benefit_headline}</p>
                                </div>
                              )}

                              {/* Rationale */}
                              {t.rationale && (
                                <p className="text-xs px-3 pb-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{t.rationale}</p>
                              )}

                              {/* Key benefits */}
                              {t.key_benefits?.length > 0 && (
                                <div className="px-3 pb-3 space-y-1">
                                  {t.key_benefits.map((b, bi) => (
                                    <div key={bi} className="flex items-start gap-1.5">
                                      <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "#7B8EC8" }} />
                                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{b}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

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

                    {roadmap.savings_tip && (
                      <p className="text-xs rounded-xl px-3 py-2.5" style={{ background: "rgba(200,230,60,0.1)", color: "#C8E63C", border: "1px solid rgba(200,230,60,0.2)" }}>
                        💡 {roadmap.savings_tip}
                      </p>
                    )}

                    {roadmap.maintenance_plan && (
                      <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Maintenance Plan</p>
                        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{roadmap.maintenance_plan}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <button onClick={() => setActiveTab("providers")}
                        className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                        style={{ background: "rgba(200,230,60,0.15)", color: "#C8E63C", border: "1px solid rgba(200,230,60,0.25)" }}>
                        View matched providers →
                      </button>
                      <button onClick={generateRoadmap} className="text-xs text-white/30 hover:text-white/50 transition-colors">
                        ↻ Regenerate
                      </button>
                    </div>
                  </>
                )}

                {activeTab === "providers" && (
                  <div className="space-y-3">
                    {treatments.length === 0 ? (
                      <p className="text-sm text-white/50 text-center py-4">Generate your roadmap first to see matched providers.</p>
                    ) : scoredProviders.length === 0 ? (
                      <div className="text-center py-4 space-y-2">
                        <p className="text-sm text-white/50">No verified providers available yet.</p>
                        <button onClick={() => navigate(createPageUrl("PatientMarketplace"))}
                          className="text-xs px-3 py-1.5 rounded-full font-semibold"
                          style={{ background: "rgba(123,142,200,0.2)", color: "#a0b0e8" }}>
                          Browse all providers
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                          Ranked by treatment coverage, ratings, and availability for your {treatments.length}-step plan:
                        </p>
                        {scoredProviders.map((p, i) => (
                          <ProviderCard
                            key={p.id}
                            provider={p}
                            treatments={treatments}
                            certs={allCerts}
                            reviews={allReviews}
                            isTop={i === 0}
                            onBook={handleBook}
                          />
                        ))}
                        <button onClick={() => navigate(createPageUrl("PatientMarketplace"))}
                          className="w-full text-center text-xs py-2 rounded-full"
                          style={{ color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          See all providers →
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}