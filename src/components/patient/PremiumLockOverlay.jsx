import { Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PremiumLockOverlay({ onUpgrade, feature = "This feature" }) {
  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Blurred preview */}
      <div className="filter blur-sm pointer-events-none select-none p-5 space-y-3"
        style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
        <div className="h-3 bg-gray-200 rounded-full w-3/4" />
        <div className="h-3 bg-gray-200 rounded-full w-1/2" />
        <div className="flex gap-2">
          {["Wrinkle depth", "Volume loss", "Symmetry score"].map(t => (
            <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-600">{t}</span>
          ))}
        </div>
        <div className="h-3 bg-gray-200 rounded-full w-2/3" />
        <div className="h-3 bg-gray-200 rounded-full w-1/2" />
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center rounded-2xl"
        style={{ background: "rgba(20,15,40,0.82)", backdropFilter: "blur(2px)" }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
          style={{ background: "linear-gradient(135deg, #7B8EC8, #4a3070)" }}>
          <Lock className="w-5 h-5 text-white" />
        </div>
        <p className="text-white font-semibold text-sm mb-1">{feature} is Premium</p>
        <p className="text-white/60 text-xs mb-4 leading-relaxed">
          Unlock wrinkle depth mapping, symmetry scoring, volume loss analysis & your full treatment roadmap.
        </p>
        <Button onClick={onUpgrade} size="sm" className="gap-2 font-bold rounded-full px-5"
          style={{ background: "#C8E63C", color: "#1e2535" }}>
          <Sparkles className="w-3.5 h-3.5" /> Unlock Premium — $19/mo
        </Button>
        <p className="text-white/30 text-xs mt-2">Cancel anytime</p>
      </div>
    </div>
  );
}