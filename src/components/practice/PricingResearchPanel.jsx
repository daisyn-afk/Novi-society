import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { TrendingUp, Loader2 } from "lucide-react";

export default function PricingResearchPanel() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const city = me?.city;
  const state = me?.state;
  const location = city && state ? `${city}, ${state}` : city || state || null;

  const { data: marketData, isLoading, error } = useQuery({
    queryKey: ["local-market-pricing", location],
    queryFn: async () => {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `What are typical local market prices for medical aesthetic services in ${location}? Give me a SHORT summary (3-4 bullet points max) covering: Botox (per unit or area), lip filler, cheek filler. Format: "• [Service]: $X–$Y range". Be concise. Real local market data only.`,
        add_context_from_internet: true,
        model: "gemini_3_flash",
        response_json_schema: {
          type: "object",
          properties: {
            bullets: { type: "array", items: { type: "string" }, description: "3-4 pricing bullets" },
            summary: { type: "string", description: "One sentence of strategic pricing advice for this market" }
          }
        }
      });
      return result;
    },
    enabled: !!location,
    staleTime: 1000 * 60 * 60, // Cache 1 hour
  });

  return (
    <div className="rounded-xl p-4 mt-3" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.15)" }}>
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: "#7B8EC8" }} />
        <p className="text-xs font-bold" style={{ color: "#7B8EC8" }}>
          Local Market Data{location ? ` · ${location}` : ""}
        </p>
      </div>

      {!location ? (
        <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>
          Add your city & state in your <a href="/ProviderPractice" className="underline font-semibold">profile</a> to see local pricing data.
        </p>
      ) : isLoading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" style={{ color: "#7B8EC8" }} />
          <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>Pulling {location} market data...</p>
        </div>
      ) : error || !marketData ? (
        <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>Couldn't load market data. Use the calculator to set your pricing.</p>
      ) : (
        <div className="space-y-1.5">
          {(marketData.bullets || []).map((b, i) => (
            <p key={i} className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.7)" }}>{b}</p>
          ))}
          {marketData.summary && (
            <p className="text-xs mt-2 font-medium" style={{ color: "#7B8EC8" }}>{marketData.summary}</p>
          )}
        </div>
      )}
    </div>
  );
}