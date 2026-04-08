import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  MapPin, TrendingUp, DollarSign, Zap, Star, CheckCircle,
  AlertTriangle, Loader2, ChevronDown, ChevronUp, Lightbulb
} from "lucide-react";
import { Button } from "@/components/ui/button";

const GLASS = {
  background: "rgba(255,255,255,0.5)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.75)",
  boxShadow: "0 2px 12px rgba(30,37,53,0.06)",
  borderRadius: 16,
};

export default function LocalMarketIntelligence({ appointments, reviews, myStats }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const myServices = useMemo(() => {
    const set = new Set();
    appointments.forEach(a => { if (a.service) set.add(a.service); });
    return Array.from(set);
  }, [appointments]);

  const avgRevPerAppt = useMemo(() => {
    const completed = appointments.filter(a => a.status === "completed" && (a.amount_paid || a.total_amount));
    if (!completed.length) return 0;
    return Math.round(completed.reduce((s, a) => s + (a.amount_paid || a.total_amount || 0), 0) / completed.length);
  }, [appointments]);

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const generate = async () => {
    setLoading(true);
    setReport(null);
    try {
      const location = [me?.city, me?.state].filter(Boolean).join(", ") || "your area";
      const isNewProvider = myStats.totalPatients === 0 && myStats.totalRevenue === 0;

      const prompt = `You are a med spa market analyst. Generate a brief, actionable market report for a provider in ${location}.

Provider details: ${myServices.length > 0 ? myServices.join(", ") : "No services tracked yet"}. ${isNewProvider ? "New startup." : `${myStats.totalPatients} patients, ${myStats.conversionRate}% conversion.`}

Provide realistic market data for this location. Return concise, specific insights (no placeholders).

Return valid JSON:
{
  "location_summary": "1-2 sentences on market size and competition",
  "high_demand_services": [
    {"service": "Service", "price_range": "$X–$X", "note": "Why demand is high"}
  ],
  "pricing_recommendation": "Specific pricing strategy for this market",
  "top_opportunities": [
    {"title": "Opportunity", "description": "Action and expected impact"}
  ],
  "competitive_edge": "How to win market share in this area"
}`;

      const result = await Promise.race([
        base44.integrations.Core.InvokeLLM({
          prompt,
          add_context_from_internet: true,
          model: "gemini_3_flash",
          response_json_schema: {
            type: "object",
            properties: {
              location_summary: { type: "string" },
              high_demand_services: { type: "array" },
              pricing_recommendation: { type: "string" },
              top_opportunities: { type: "array" },
              competitive_edge: { type: "string" },
            }
          }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout")), 30000))
      ]);
      setReport(result);
    } catch (e) {
      setReport({ error: e.message?.includes("timeout") ? "Request took too long. Please try again." : "Failed to generate report. Please try again." });
    }
    setLoading(false);
  };

  const location = [me?.city, me?.state].filter(Boolean).join(", ");

  return (
    <div className="rounded-2xl overflow-hidden" style={GLASS}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" style={{ color: "#DA6A63" }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>Local Market Intelligence</p>
          </div>
          {report && !report.error && (
            <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-1 text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
        <p className="text-xs mb-4" style={{ color: "rgba(30,37,53,0.45)" }}>
          How you stack up against real med spas{location ? ` in ${location}` : " in your area"} — pricing, services, and growth opportunities.
        </p>

        {!report && !loading && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(218,106,99,0.12)" }}>
              <Lightbulb className="w-6 h-6" style={{ color: "#DA6A63" }} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: "#1e2535" }}>Get your local market report</p>
            <p className="text-xs mb-4 max-w-xs mx-auto" style={{ color: "rgba(30,37,53,0.5)" }}>
              AI-powered analysis of real med spa pricing, service demand, and your competitive position{location ? ` in ${location}` : ""}.
            </p>
            {!location && (
              <p className="text-xs mb-3 px-3 py-2 rounded-xl" style={{ background: "rgba(250,111,48,0.1)", color: "#FA6F30" }}>
                Tip: Add your city & state in Profile for a more localized report.
              </p>
            )}
            <Button onClick={generate} style={{ background: "#DA6A63", color: "#fff" }} className="gap-2 font-bold">
              <MapPin className="w-4 h-4" />Generate Market Report
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#DA6A63" }} />
            <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Analyzing local market data…</p>
          </div>
        )}

        {report?.error && (
          <div className="text-center py-6">
            <p className="text-sm text-red-500 mb-3">{report.error}</p>
            <Button onClick={generate} variant="outline" size="sm">Try Again</Button>
          </div>
        )}

        {report && !report.error && expanded && (
          <div className="space-y-5">

            {/* Location summary */}
            {report.location_summary && (
              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(218,106,99,0.06)", border: "1px solid rgba(218,106,99,0.2)" }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "#DA6A63" }}>Market Overview</p>
                <p className="text-sm leading-relaxed" style={{ color: "#1e2535" }}>{report.location_summary}</p>
              </div>
            )}

            {/* Competitive edge */}
            {report.competitive_edge && (
              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)" }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "#7B8EC8" }}>How to Win Market Share</p>
                <p className="text-sm leading-relaxed" style={{ color: "#1e2535" }}>{report.competitive_edge}</p>
              </div>
            )}

            {/* Pricing */}
            {report.pricing_recommendation && (
              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.25)" }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "#4a6b10" }}>Pricing Strategy</p>
                <p className="text-sm leading-relaxed" style={{ color: "#1e2535" }}>{report.pricing_recommendation}</p>
              </div>
            )}

            {/* High demand services */}
            {report.high_demand_services?.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.25)" }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#4a6b10" }}>🔥 High Demand Services in Your Area</p>
                <div className="space-y-2.5">
                  {report.high_demand_services.map((s, i) => (
                    <div key={i}>
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-semibold" style={{ color: "#1e2535" }}>{s.service}</p>
                        <span className="text-xs font-bold" style={{ color: "#4a6b10" }}>{s.price_range}</span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{s.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top opportunities */}
            {report.top_opportunities?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: "rgba(30,37,53,0.4)" }}>Growth Opportunities</p>
                <div className="space-y-2">
                  {report.top_opportunities.map((o, i) => (
                    <div key={i} className="rounded-xl p-3 flex items-start gap-3" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(30,37,53,0.07)" }}>
                      <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#FA6F30" }} />
                      <div>
                        <p className="text-sm font-bold" style={{ color: "#1e2535" }}>{o.title}</p>
                        <p className="text-xs leading-relaxed mt-0.5" style={{ color: "rgba(30,37,53,0.6)" }}>{o.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regenerate */}
            <div className="flex justify-end pt-1">
              <button onClick={generate} className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "rgba(30,37,53,0.4)" }}>
                <Loader2 className="w-3 h-3" />Refresh report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}