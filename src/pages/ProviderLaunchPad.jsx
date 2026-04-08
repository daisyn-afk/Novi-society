import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import PracticeLaunchTab from "@/components/practice/PracticeLaunchTab";
import ROICalculator from "@/components/launchpad/ROICalculator";
import CreativeStudio from "@/components/launchpad/CreativeStudio";
import BrainstormChat from "@/components/launchpad/BrainstormChat";
import { Rocket, DollarSign, Sparkles, Brain } from "lucide-react";

const TABS = [
  { id: "setup", label: "Setup Guide", icon: Rocket, desc: "Your launch checklist" },
  { id: "roi", label: "ROI Calculator", icon: DollarSign, desc: "What to charge" },
  { id: "creative", label: "Creative Studio", icon: Sparkles, desc: "Content & copy" },
  { id: "brainstorm", label: "Ask Your Mentor", icon: Brain, desc: "AI business coach" },
];

export default function ProviderLaunchPad() {
  const [activeTab, setActiveTab] = useState("setup");

  const qc = useQueryClient();
  const navigate = useNavigate();
  const [suggestedPrice, setSuggestedPrice] = useState(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const handleUsePrice = (price) => {
    setSuggestedPrice(price);
    setActiveTab("setup");
    // Navigate to Treatments tab on Practice page with the price pre-filled via sessionStorage
    sessionStorage.setItem("roi_suggested_price", price);
    navigate("/ProviderPractice?tab=treatments");
  };

  const { data: appointments = [] } = useQuery({
    queryKey: ["my-appointments-launchpad"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.Appointment.filter({ provider_id: u.id }, "-created_date", 200);
    },
    enabled: !!me,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["my-reviews-launchpad"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.Review.filter({ provider_id: u.id }, "-created_date", 100);
    },
    enabled: !!me,
  });

  return (
    <div className="max-w-4xl mx-auto">

      {/* Page header */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#7B8EC8" }}>Provider</p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, color: "#1e2535", lineHeight: 1.15 }}>Growth Studio</h1>
        <p className="mt-1 text-sm" style={{ color: "rgba(30,37,53,0.5)" }}>
          Your personal business workspace — build, create, calculate, and grow.
        </p>
      </div>

      {/* Tab nav */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {TABS.map(({ id, label, icon: Icon, desc }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex flex-col items-center justify-center gap-1.5 px-2 py-3.5 rounded-2xl text-center transition-all outline-none"
              style={{
                background: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)",
                border: isActive ? "2px solid rgba(123,142,200,0.45)" : "1.5px solid rgba(30,37,53,0.07)",
                boxShadow: isActive ? "0 4px 16px rgba(30,37,53,0.1)" : "none",
              }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: isActive ? "rgba(123,142,200,0.18)" : "rgba(30,37,53,0.05)" }}>
                <Icon className="w-[18px] h-[18px]" style={{ color: isActive ? "#7B8EC8" : "rgba(30,37,53,0.45)" }} />
              </div>
              <p className="text-xs font-bold leading-tight" style={{ color: isActive ? "#1e2535" : "rgba(30,37,53,0.5)" }}>{label}</p>
              <p className="text-[10px] leading-tight hidden sm:block" style={{ color: isActive ? "rgba(30,37,53,0.5)" : "rgba(30,37,53,0.35)" }}>{desc}</p>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "setup" && <PracticeLaunchTab appointments={appointments} reviews={reviews} />}
      {activeTab === "roi" && <ROICalculator onUsePrice={handleUsePrice} />}
      {activeTab === "creative" && <CreativeStudio me={me} />}
      {activeTab === "brainstorm" && <BrainstormChat me={me} />}
    </div>
  );
}