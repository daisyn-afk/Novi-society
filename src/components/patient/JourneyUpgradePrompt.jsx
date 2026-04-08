import { Sparkles, Lock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const PREMIUM_FEATURES = [
  "Detailed wrinkle depth analysis",
  "Skin condition detection",
  "Volume loss indicators & symmetry scoring",
  "Before/after scan comparison",
  "AI improvement scoring over time",
  "Personalized treatment sequence",
  "Cost forecasting & savings calculator",
  "Touch-up interval predictions",
  "Long-term maintenance plan",
];

export default function JourneyUpgradePrompt({ onUpgrade }) {
  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1e2535 0%, #2D4A7A 60%, #7B8EC8 100%)" }}>
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-yellow-300" />
          <p className="text-xs font-bold uppercase tracking-widest text-yellow-300">Novi Premium</p>
        </div>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: "#fff", marginBottom: 6, lineHeight: 1.2 }}>
          A New Way to Be Seen
        </h2>
        <p className="text-sm text-white/70 mb-6 max-w-md">
          Unlock your full AI-powered facial analysis, personalized treatment roadmap, and predictive cost planning — all for $19/month.
        </p>

        <div className="grid sm:grid-cols-2 gap-2 mb-6">
          {PREMIUM_FEATURES.map(f => (
            <div key={f} className="flex items-center gap-2.5 text-sm text-white/80">
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 text-yellow-300" />
              {f}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <Button onClick={onUpgrade}
            className="gap-2 font-bold px-6 py-2.5 rounded-full"
            style={{ background: "#C8E63C", color: "#1e2535" }}>
            <Sparkles className="w-4 h-4" />
            Unlock Premium — $19/mo
          </Button>
          <p className="text-xs text-white/40">Cancel anytime · No commitment</p>
        </div>
      </div>
    </div>
  );
}