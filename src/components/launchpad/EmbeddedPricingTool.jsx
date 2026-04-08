import { useState, useMemo } from "react";
import { DollarSign, ChevronDown, ChevronUp } from "lucide-react";

export default function EmbeddedPricingTool() {
  const [expanded, setExpanded] = useState(false);
  const [productCost, setProductCost] = useState(40);
  const [timeMinutes, setTimeMinutes] = useState(30);
  const [overhead, setOverhead] = useState(15);
  const [targetMargin, setTargetMargin] = useState(65);

  const results = useMemo(() => {
    const hourlyRate = 150;
    const timeCost = (timeMinutes / 60) * hourlyRate;
    const totalCost = productCost + timeCost + overhead;
    const recommendedPrice = Math.round(totalCost / (1 - targetMargin / 100) / 5) * 5;
    const profitPerService = recommendedPrice - totalCost;
    return { recommendedPrice, profitPerService, totalCost };
  }, [productCost, timeMinutes, overhead, targetMargin]);

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-all"
        style={{ background: "rgba(250,111,48,0.08)", border: "1.5px solid rgba(250,111,48,0.25)" }}>
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4" style={{ color: "#FA6F30" }} />
          <span className="text-sm font-semibold" style={{ color: "#1e2535" }}>Use the pricing calculator below to lock in your prices</span>
        </div>
        <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.35)" }} />
      </button>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "rgba(250,111,48,0.06)", border: "1.5px solid rgba(250,111,48,0.25)" }}>
      <button onClick={() => setExpanded(false)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ borderBottom: "1px solid rgba(250,111,48,0.15)" }}>
        <span className="text-sm font-bold" style={{ color: "#1e2535" }}>Real cost calculator</span>
        <ChevronUp className="w-4 h-4" style={{ color: "rgba(30,37,53,0.35)" }} />
      </button>

      <div className="p-4 space-y-3">
        <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>
          Enter your actual costs — we'll tell you exactly what to charge to hit your profit margin goal.
        </p>

        {/* Inputs */}
        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold" style={{ color: "#1e2535" }}>Product cost</label>
              <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(250,111,48,0.12)", color: "#b84a10" }}>${productCost}</span>
            </div>
            <input type="range" min={5} max={300} step={5} value={productCost} onChange={e => setProductCost(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: "#FA6F30" }} />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold" style={{ color: "#1e2535" }}>Time per service</label>
              <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(250,111,48,0.12)", color: "#b84a10" }}>{timeMinutes} min</span>
            </div>
            <input type="range" min={15} max={180} step={15} value={timeMinutes} onChange={e => setTimeMinutes(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: "#FA6F30" }} />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold" style={{ color: "#1e2535" }}>Overhead per service</label>
              <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(250,111,48,0.12)", color: "#b84a10" }}>${overhead}</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={overhead} onChange={e => setOverhead(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: "#FA6F30" }} />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold" style={{ color: "#1e2535" }}>Target profit margin</label>
              <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(250,111,48,0.12)", color: "#b84a10" }}>{targetMargin}%</span>
            </div>
            <input type="range" min={30} max={85} step={5} value={targetMargin} onChange={e => setTargetMargin(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: "#FA6F30" }} />
          </div>
        </div>

        {/* Result */}
        <div className="rounded-lg grid grid-cols-2 gap-2 mt-4 pt-3" style={{ borderTop: "1px solid rgba(250,111,48,0.2)" }}>
          <div className="rounded-lg px-3 py-2" style={{ background: "rgba(250,111,48,0.12)" }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#b84a10" }}>Charge this</p>
            <p className="font-bold text-base" style={{ color: "#1e2535", marginTop: "2px" }}>${results.recommendedPrice}</p>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: "rgba(250,111,48,0.12)" }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#b84a10" }}>Profit per visit</p>
            <p className="font-bold text-base" style={{ color: "#1e2535", marginTop: "2px" }}>${Math.round(results.profitPerService)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}