import { useState, useEffect } from "react";
import { Users, Shield, Sparkles } from "lucide-react";
import AppPreviewMockup from "./AppPreviewMockup";

export default function FeatureShowcase() {
  const [activeTab, setActiveTab] = useState(0);

  const features = [
    {
      icon: Users,
      title: "Complete Practice Management",
      subtitle: "Everything you need to run your aesthetic practice",
      description: "Real-time scheduling, patient tracking, treatment documentation, and performance analytics—all in one elegant dashboard.",
      view: "dashboard",
      color: "#7B8EC8",
      highlights: ["Patient scheduling", "Treatment history", "Revenue tracking", "MD compliance status"]
    },
    {
      icon: Sparkles,
      title: "AI-Powered Patient Matching",
      subtitle: "Intelligent provider-patient connections",
      description: "Advanced facial analysis and goal-based matching connects patients with providers who specialize in exactly what they need.",
      view: "patient",
      color: "#C8E63C",
      highlights: ["Facial analysis", "Goal matching", "Provider ratings", "Instant booking"]
    },
    {
      icon: Shield,
      title: "Integrated Medical Oversight",
      subtitle: "Built-in physician supervision",
      description: "Medical Directors review charts, verify scope compliance, and monitor treatment outcomes—all through the NOVI platform.",
      view: "compliance",
      color: "#2D6B7F",
      highlights: ["Real-time chart review", "Scope monitoring", "Automated compliance", "Risk alerts"]
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % features.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Tab Selector */}
      <div className="grid md:grid-cols-3 gap-4 mb-12">
        {features.map((feature, idx) => {
          const Icon = feature.icon;
          const isActive = activeTab === idx;
          return (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className="group text-left p-6 rounded-2xl transition-all duration-300"
              style={{
                background: isActive ? "white" : "rgba(255,255,255,0.4)",
                border: isActive ? "2px solid" : "1px solid rgba(0,0,0,0.08)",
                borderColor: isActive ? feature.color : "rgba(0,0,0,0.08)",
                transform: isActive ? "translateY(-4px)" : "translateY(0)",
                boxShadow: isActive ? "0 16px 48px rgba(0,0,0,0.15)" : "0 2px 12px rgba(0,0,0,0.06)"
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all" style={{ 
                  background: isActive ? feature.color : `${feature.color}20`
                }}>
                  <Icon className="w-5 h-5" style={{ color: isActive ? "white" : feature.color }} />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm mb-0.5" style={{ color: "#1e2535" }}>
                    {feature.title}
                  </h4>
                  <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
                    {feature.subtitle}
                  </p>
                </div>
              </div>
              <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(30,37,53,0.7)" }}>
                {feature.description}
              </p>
              {isActive && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {feature.highlights.map((item, i) => (
                    <div key={i} className="text-xs px-2 py-1 rounded-lg" style={{ background: `${feature.color}10`, color: feature.color }}>
                      • {item}
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* App Preview with smooth transition */}
      <div className="relative">
        <div className="absolute inset-0 rounded-3xl blur-3xl opacity-15 transition-all duration-500" style={{ background: features[activeTab].color }} />
        <div className="relative transition-all duration-500">
          <AppPreviewMockup view={features[activeTab].view} />
        </div>
      </div>

      {/* Feature indicator */}
      <div className="flex justify-center gap-2 mt-8">
        {features.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx)}
            className="transition-all duration-300"
            style={{
              width: activeTab === idx ? "32px" : "8px",
              height: "8px",
              borderRadius: "4px",
              background: activeTab === idx ? features[idx].color : "rgba(0,0,0,0.15)"
            }}
          />
        ))}
      </div>
    </div>
  );
}