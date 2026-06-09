import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { formatScanChartDate } from "@/lib/journeyStreak";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar,
} from "recharts";
import {
  Sparkles, Lock, TrendingUp, Sun, DollarSign, Loader2, ChevronRight, Target,
} from "lucide-react";

const BUDGET_LABELS = {
  under_500: "Under $500",
  "500_1000": "$500 – $1,000",
  "1000_2500": "$1,000 – $2,500",
  "2500_plus": "$2,500+",
};

const SEASONAL_HINTS = {
  winter: "Winter air strips moisture fast — prioritize barrier repair with ceramides and a rich night cream.",
  spring: "Spring is ideal for peels and laser prep — start SPF now before sun intensity ramps up.",
  summer: "UV is your biggest aging accelerator — daily SPF 50+, antioxidants, and hydration touch-ups.",
  fall: "Fall is recovery season — great time for collagen-stimulating treatments before the holidays.",
};

function seasonKey() {
  const m = new Date().getMonth();
  if (m <= 1 || m === 11) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "fall";
}

function parseAmount(appt) {
  const raw = appt?.amount_paid ?? appt?.treatment_amount ?? appt?.deposit_amount ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function JourneyInsights({ journey, appointments = [], isPremium, onUpgrade }) {
  const navigate = useNavigate();
  const [nextStep, setNextStep] = useState(null);
  const [seasonalGuide, setSeasonalGuide] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const scans = journey?.scans || [];
  const completedAppts = (appointments || []).filter((a) => a.status === "completed");

  const trendData = useMemo(() => {
    return scans
      .filter((s) => s?.ai_analysis)
      .map((scan) => ({
        label: formatScanChartDate(scan),
        symmetry: scan.ai_analysis.symmetry_score ?? null,
        hydration: scan.ai_analysis.hydration_score ?? null,
        pigmentation: scan.ai_analysis.pigmentation_score ?? null,
        wrinkles: scan.ai_analysis.wrinkle_depth_score != null
          ? 100 - scan.ai_analysis.wrinkle_depth_score
          : null,
      }))
      .filter((row) => row.symmetry != null || row.hydration != null || row.pigmentation != null);
  }, [scans]);

  const budgetStats = useMemo(() => {
    const rows = completedAppts
      .map((a) => ({
        service: a.service || "Treatment",
        amount: parseAmount(a),
        date: a.completed_at || a.appointment_date,
      }))
      .filter((r) => r.amount > 0);

    const totalSpent = rows.reduce((sum, r) => sum + r.amount, 0);
    const monthsActive = Math.max(
      1,
      new Set(rows.map((r) => String(r.date || "").slice(0, 7)).filter(Boolean)).size
    );
    const monthlyAvg = totalSpent / monthsActive;
    const projectedAnnual = monthlyAvg * 12;

    return { rows, totalSpent, monthlyAvg, projectedAnnual };
  }, [completedAppts]);

  useEffect(() => {
    if (!isPremium || !journey) return;

    let cancelled = false;
    const latestScan = scans[scans.length - 1];
    const analysis = latestScan?.ai_analysis;

    async function loadInsights() {
      setLoadingAi(true);
      try {
        const season = seasonKey();
        const [stepRes, guideRes] = await Promise.all([
          base44.integrations.Core.InvokeLLM({
            prompt: `You are Novi, an expert aesthetic wellness guide. Recommend the SINGLE most impactful next treatment step for this patient.

Patient concerns: ${JSON.stringify(journey.skin_concerns || [])}
Goals: ${JSON.stringify(journey.treatment_goals || [])}
Budget comfort: ${journey.budget_comfort || "unspecified"}
Latest scan concerns: ${JSON.stringify(analysis?.detected_concerns || [])}
Prior treatments: ${JSON.stringify(completedAppts.map((a) => a.service))}
Scan recommendations: ${JSON.stringify(analysis?.recommended_treatments?.map((t) => t.name) || [])}

Return one clear next step with real brand/treatment names, why it matters now, and expected outcome in patient-friendly language.`,
            response_json_schema: {
              type: "object",
              properties: {
                treatment_name: { type: "string" },
                rationale: { type: "string" },
                expected_outcome: { type: "string" },
                timing: { type: "string" },
                category: { type: "string" },
              },
            },
          }),
          base44.integrations.Core.InvokeLLM({
            prompt: `You are Novi. Write a short seasonal skin guide for ${season} for a patient with concerns: ${JSON.stringify(analysis?.detected_concerns || journey.skin_concerns || [])}.
Include 2-3 specific product or treatment tips with real brand names. Keep it warm and practical.`,
            response_json_schema: {
              type: "object",
              properties: {
                season: { type: "string" },
                headline: { type: "string" },
                tips: { type: "array", items: { type: "string" } },
                featured_product: { type: "string" },
              },
            },
          }),
        ]);
        if (!cancelled) {
          setNextStep(stepRes);
          setSeasonalGuide(guideRes);
        }
      } catch {
        if (!cancelled) {
          setSeasonalGuide({
            season: seasonKey(),
            headline: SEASONAL_HINTS[seasonKey()],
            tips: [SEASONAL_HINTS[seasonKey()]],
          });
        }
      } finally {
        if (!cancelled) setLoadingAi(false);
      }
    }

    loadInsights();
    return () => { cancelled = true; };
  }, [isPremium, journey?.id, scans.length, completedAppts.length]);

  if (!isPremium) {
    return (
      <div className="p-6 rounded-2xl text-center" style={{ background: "#fff", border: "1.5px solid rgba(123,142,200,0.2)" }}>
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(123,142,200,0.1)" }}>
          <Lock className="w-6 h-6" style={{ color: "#7B8EC8" }} />
        </div>
        <p className="font-semibold mb-2" style={{ color: "#2a3050", fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: 18 }}>
          Premium Insights ✨
        </p>
        <p className="text-sm mb-5 leading-relaxed" style={{ color: "rgba(42,48,80,0.55)" }}>
          Unlock skin score trends, your next best treatment step, seasonal guides, and budget tracking.
        </p>
        <button onClick={onUpgrade}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: "#7B8EC8", color: "white" }}>
          Upgrade — $19/mo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Skin score trend */}
      <div className="p-5 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(30,37,53,0.07)" }}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4" style={{ color: "#7B8EC8" }} />
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.12em" }}>
            Skin Score Trend
          </p>
        </div>
        {trendData.length < 2 ? (
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.45)" }}>
            Complete 2+ NOVI scans to see your symmetry, hydration, and pigmentation trends.
          </p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,37,53,0.06)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(30,37,53,0.4)" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "rgba(30,37,53,0.4)" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                <Line type="monotone" dataKey="symmetry" stroke="#2D6B7F" strokeWidth={2} dot={false} name="Symmetry" />
                <Line type="monotone" dataKey="hydration" stroke="#7B8EC8" strokeWidth={2} dot={false} name="Hydration" />
                <Line type="monotone" dataKey="pigmentation" stroke="#DA6A63" strokeWidth={2} dot={false} name="Pigmentation" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Next best step */}
      <div className="p-5 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(123,142,200,0.08), rgba(45,107,127,0.06))", border: "1px solid rgba(123,142,200,0.18)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4" style={{ color: "#7B8EC8" }} />
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(123,142,200,0.8)", letterSpacing: "0.12em" }}>
            Next Best Step
          </p>
        </div>
        {loadingAi && !nextStep ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(42,48,80,0.5)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> NOVI is analyzing your journey…
          </div>
        ) : nextStep ? (
          <div>
            <p className="text-lg font-semibold mb-2" style={{ color: "#2a3050", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>
              {nextStep.treatment_name}
            </p>
            <p className="text-sm leading-relaxed mb-2" style={{ color: "rgba(42,48,80,0.6)" }}>{nextStep.rationale}</p>
            {nextStep.expected_outcome && (
              <p className="text-xs mb-3" style={{ color: "rgba(42,48,80,0.45)" }}>✦ {nextStep.expected_outcome}</p>
            )}
            <button
              onClick={() => navigate(createPageUrl(`PatientMarketplace${nextStep.category ? `?category=${encodeURIComponent(nextStep.category)}` : ""}`))}
              className="text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1"
              style={{ background: "rgba(123,142,200,0.15)", color: "#7B8EC8" }}>
              Find providers <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <p className="text-sm" style={{ color: "rgba(42,48,80,0.5)" }}>Upload a scan to get your personalized next step.</p>
        )}
      </div>

      {/* Seasonal guide */}
      <div className="p-5 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(30,37,53,0.07)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Sun className="w-4 h-4" style={{ color: "#FA6F30" }} />
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.12em" }}>
            Seasonal Guide
          </p>
        </div>
        {seasonalGuide ? (
          <div>
            <p className="font-semibold text-sm mb-2 capitalize" style={{ color: "#2a3050" }}>
              {seasonalGuide.headline || SEASONAL_HINTS[seasonKey()]}
            </p>
            <ul className="space-y-2">
              {(seasonalGuide.tips || []).map((tip, i) => (
                <li key={i} className="text-sm flex items-start gap-2" style={{ color: "rgba(42,48,80,0.6)" }}>
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#7B8EC8" }} />
                  {tip}
                </li>
              ))}
            </ul>
            {seasonalGuide.featured_product && (
              <p className="text-xs mt-3 px-3 py-2 rounded-xl" style={{ background: "rgba(250,111,48,0.07)", color: "#c45f30" }}>
                Featured: {seasonalGuide.featured_product}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm" style={{ color: "rgba(42,48,80,0.5)" }}>{SEASONAL_HINTS[seasonKey()]}</p>
        )}
      </div>

      {/* Budget tracker */}
      <div className="p-5 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(30,37,53,0.07)" }}>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4" style={{ color: "#5a7a20" }} />
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.12em" }}>
            Budget Tracker
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Total spent", value: `$${budgetStats.totalSpent.toFixed(0)}` },
            { label: "Monthly avg", value: `$${budgetStats.monthlyAvg.toFixed(0)}` },
            { label: "Projected/yr", value: `$${budgetStats.projectedAnnual.toFixed(0)}` },
          ].map((s) => (
            <div key={s.label} className="text-center p-3 rounded-xl" style={{ background: "rgba(30,37,53,0.03)" }}>
              <p className="text-lg font-bold" style={{ color: "#2a3050", fontFamily: "'DM Serif Display', serif" }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.4)" }}>{s.label}</p>
            </div>
          ))}
        </div>
        {journey?.budget_comfort && (
          <p className="text-xs mb-3" style={{ color: "rgba(30,37,53,0.45)" }}>
            Your comfort zone: <strong>{BUDGET_LABELS[journey.budget_comfort] || journey.budget_comfort}</strong>
          </p>
        )}
        {budgetStats.rows.length > 0 ? (
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetStats.rows.slice(0, 6)} layout="vertical" margin={{ left: 8, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="service" width={90} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`$${Number(v).toFixed(0)}`, "Spent"]} />
                <Bar dataKey="amount" fill="#7B8EC8" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.4)" }}>Treatment spend will appear here after your first completed appointment.</p>
        )}
      </div>
    </div>
  );
}
