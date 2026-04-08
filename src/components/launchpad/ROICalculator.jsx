import { useState, useMemo } from "react";
import { DollarSign, Clock, TrendingUp, Target, Lightbulb, RefreshCw } from "lucide-react";

const GLASS = { background: "rgba(255,255,255,0.82)", border: "1px solid rgba(30,37,53,0.08)", borderRadius: 16 };

function Slider({ label, value, min, max, step, onChange, prefix = "", suffix = "" }) {
  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-semibold" style={{ color: "#1e2535" }}>{label}</label>
        <span className="text-sm font-bold px-2.5 py-1 rounded-lg" style={{ background: "rgba(200,230,60,0.18)", color: "#4a6b10" }}>
          {prefix}{value.toLocaleString()}{suffix}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: "#C8E63C" }}
      />
      <div className="flex justify-between mt-1">
        <span className="text-[10px]" style={{ color: "rgba(30,37,53,0.35)" }}>{prefix}{min.toLocaleString()}{suffix}</span>
        <span className="text-[10px]" style={{ color: "rgba(30,37,53,0.35)" }}>{prefix}{max.toLocaleString()}{suffix}</span>
      </div>
    </div>
  );
}

function ResultCard({ label, value, sub, color = "#C8E63C", textColor = "#4a6b10" }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: `${color}14`, border: `1.5px solid ${color}40` }}>
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: textColor }}>{label}</p>
      <p className="font-black" style={{ fontSize: 28, color: "#1e2535", fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>{value}</p>
      {sub && <p className="text-[11px] leading-relaxed" style={{ color: "rgba(30,37,53,0.5)" }}>{sub}</p>}
    </div>
  );
}

export default function ROICalculator({ onUsePrice }) {
  const [productCost, setProductCost] = useState(40);
  const [timeMinutes, setTimeMinutes] = useState(45);
  const [overhead, setOverhead] = useState(15);
  const [targetMargin, setTargetMargin] = useState(65);
  const [clientsPerWeek, setClientsPerWeek] = useState(8);
  const [presets] = useState([
    { label: "Botox (20u)", productCost: 40, time: 30, overhead: 10 },
    { label: "Lip Filler", productCost: 85, time: 45, overhead: 15 },
    { label: "Cheek Filler", productCost: 120, time: 60, overhead: 20 },
    { label: "Microneedling", productCost: 25, time: 75, overhead: 30 },
    { label: "Chemical Peel", productCost: 20, time: 45, overhead: 15 },
  ]);

  const results = useMemo(() => {
    const hourlyRate = 150; // assumed provider opportunity cost
    const timeCost = (timeMinutes / 60) * hourlyRate;
    const totalCost = productCost + timeCost + overhead;
    const recommendedPrice = Math.round(totalCost / (1 - targetMargin / 100) / 5) * 5;
    const profitPerService = recommendedPrice - totalCost;
    const weeklyRevenue = clientsPerWeek * recommendedPrice;
    const weeklyProfit = clientsPerWeek * profitPerService;
    const monthlyRevenue = weeklyRevenue * 4.3;
    const monthlyProfit = weeklyProfit * 4.3;
    const annualRevenue = monthlyRevenue * 12;
    const breakEven = Math.ceil(overhead / profitPerService);
    return { recommendedPrice, profitPerService, weeklyRevenue, weeklyProfit, monthlyRevenue, monthlyProfit, annualRevenue, breakEven, totalCost };
  }, [productCost, timeMinutes, overhead, targetMargin, clientsPerWeek]);

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #1e2535, #2D6B7F)", boxShadow: "0 4px 20px rgba(30,37,53,0.15)" }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(200,230,60,0.2)" }}>
            <DollarSign className="w-5 h-5" style={{ color: "#C8E63C" }} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(200,230,60,0.7)" }}>ROI Calculator</p>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "#fff", lineHeight: 1.2 }}>What should you charge?</h2>
          </div>
        </div>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          Plug in your real costs. We'll tell you exactly what to charge to hit your margin goals.
        </p>
      </div>

      {/* Quick presets */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(30,37,53,0.4)" }}>Quick presets</p>
        <div className="flex flex-wrap gap-2">
          {presets.map(p => (
            <button key={p.label} onClick={() => { setProductCost(p.productCost); setTimeMinutes(p.time); setOverhead(p.overhead); }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs */}
      <div className="rounded-2xl p-5" style={GLASS}>
        <p className="text-sm font-bold mb-4" style={{ color: "#1e2535" }}>Your costs</p>
        <Slider label="Product / supply cost" value={productCost} min={5} max={300} step={5} onChange={setProductCost} prefix="$" />
        <Slider label="Time per service" value={timeMinutes} min={15} max={180} step={15} onChange={setTimeMinutes} suffix=" min" />
        <Slider label="Overhead per service (rent, supplies)" value={overhead} min={0} max={100} step={5} onChange={setOverhead} prefix="$" />
        <Slider label="Target profit margin" value={targetMargin} min={30} max={85} step={5} onChange={setTargetMargin} suffix="%" />
        <Slider label="Clients per week" value={clientsPerWeek} min={1} max={30} step={1} onChange={setClientsPerWeek} />
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-3">
        <ResultCard label="Charge this" value={`$${results.recommendedPrice}`} sub={`Your real cost: $${Math.round(results.totalCost)}`} color="#C8E63C" textColor="#4a6b10" />
        <ResultCard label="Profit per visit" value={`$${Math.round(results.profitPerService)}`} sub={`${targetMargin}% margin after all costs`} color="#7B8EC8" textColor="#3a4e8c" />
        <ResultCard label="Monthly revenue" value={`$${Math.round(results.monthlyRevenue).toLocaleString()}`} sub={`At ${clientsPerWeek} clients/week`} color="#FA6F30" textColor="#b84a10" />
        <ResultCard label="Monthly profit" value={`$${Math.round(results.monthlyProfit).toLocaleString()}`} sub={`$${Math.round(results.annualRevenue / 1000)}K projected annually`} color="#DA6A63" textColor="#a03030" />
      </div>

      {/* Insight */}
      <div className="rounded-xl px-4 py-3 flex items-start gap-2.5" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.25)" }}>
        <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#4a6b10" }} />
        <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>
          At <strong>${results.recommendedPrice}</strong>/service with {clientsPerWeek} clients/week, you'd hit <strong>${Math.round(results.annualRevenue / 1000)}K</strong> in annual revenue.
          Adding one add-on worth $30 per client adds <strong>${Math.round(clientsPerWeek * 30 * 4.3 * 12 / 1000)}K</strong> more annually with zero new clients.
        </p>
      </div>

      {onUsePrice && (
        <button onClick={() => onUsePrice(results.recommendedPrice)}
          className="w-full py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #C8E63C, #a8c020)", color: "#1e2535" }}>
          Use ${results.recommendedPrice} in my Treatments tab →
        </button>
      )}
    </div>
  );
}