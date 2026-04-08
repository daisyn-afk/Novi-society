import { useState } from "react";
import { Award, Shield, Calendar, CheckCircle, ArrowRight } from "lucide-react";

export default function InteractiveFlow() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      number: 1,
      title: "Complete NOVI Training",
      subtitle: "Board-certified education",
      icon: Award,
      color: "#7B8EC8",
      visual: (
        <div className="p-8 rounded-2xl" style={{ background: "white", border: "1px solid rgba(123,142,200,0.2)" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7B8EC8, #2D6B7F)" }}>
              <Award className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(30,37,53,0.5)" }}>Course Enrollment</p>
              <h4 className="font-bold text-lg" style={{ color: "#1e2535" }}>Advanced Dermal Fillers</h4>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { module: "Facial Anatomy Fundamentals", status: "complete" },
              { module: "Injection Techniques", status: "complete" },
              { module: "Hands-On Practice", status: "in-progress" },
              { module: "Safety & Complications", status: "locked" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ 
                background: item.status === 'complete' ? 'rgba(200,230,60,0.1)' : item.status === 'in-progress' ? 'rgba(123,142,200,0.08)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${item.status === 'complete' ? 'rgba(200,230,60,0.3)' : 'rgba(0,0,0,0.06)'}`
              }}>
                {item.status === 'complete' ? (
                  <CheckCircle className="w-5 h-5" style={{ color: "#C8E63C" }} />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: item.status === 'in-progress' ? '#7B8EC8' : 'rgba(0,0,0,0.2)' }}>
                    {item.status === 'in-progress' && <div className="w-2 h-2 rounded-full m-0.5" style={{ background: '#7B8EC8' }} />}
                  </div>
                )}
                <span className="text-sm font-medium flex-1" style={{ color: "#1e2535" }}>{item.module}</span>
                {item.status === 'in-progress' && <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(123,142,200,0.15)", color: "#2D6B7F" }}>50%</span>}
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      number: 2,
      title: "Activate MD Coverage",
      subtitle: "Built-in supervision",
      icon: Shield,
      color: "#2D6B7F",
      visual: (
        <div className="p-8 rounded-2xl" style={{ background: "white", border: "1px solid rgba(45,107,127,0.2)" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2D6B7F, #C8E63C)" }}>
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(30,37,53,0.5)" }}>Medical Director Board</p>
              <h4 className="font-bold text-lg" style={{ color: "#1e2535" }}>Dermal Fillers Coverage</h4>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-4 rounded-xl" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.25)" }}>
              <p className="text-xs font-bold mb-1" style={{ color: "#5a7a20" }}>Status</p>
              <p className="font-bold" style={{ color: "#1e2535" }}>Active</p>
            </div>
            <div className="p-4 rounded-xl" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.15)" }}>
              <p className="text-xs font-bold mb-1" style={{ color: "#2D6B7F" }}>Monthly Fee</p>
              <p className="font-bold" style={{ color: "#1e2535" }}>$299</p>
            </div>
          </div>
          <div className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.02)" }}>
            <p className="text-xs font-bold mb-2" style={{ color: "rgba(30,37,53,0.6)" }}>Scope Permissions</p>
            <div className="space-y-2">
              {["Lips & Perioral", "Nasolabial Folds", "Marionette Lines"].map((area, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <CheckCircle className="w-4 h-4" style={{ color: "#C8E63C" }} />
                  <span style={{ color: "rgba(30,37,53,0.75)" }}>{area}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      number: 3,
      title: "Start Treating Patients",
      subtitle: "AI-matched bookings",
      icon: Calendar,
      color: "#C8E63C",
      visual: (
        <div className="p-8 rounded-2xl" style={{ background: "white", border: "1px solid rgba(200,230,60,0.2)" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #C8E63C, #DA6A63)" }}>
              <Calendar className="w-8 h-8" style={{ color: "#1a2540" }} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(30,37,53,0.5)" }}>New Booking Request</p>
              <h4 className="font-bold text-lg" style={{ color: "#1e2535" }}>Emily Chen · Lip Enhancement</h4>
            </div>
          </div>
          <div className="p-5 rounded-xl mb-4" style={{ background: "linear-gradient(135deg, rgba(200,230,60,0.12), rgba(200,230,60,0.06))", border: "1px solid rgba(200,230,60,0.25)" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: "#C8E63C", color: "#1a2540" }}>
                95% AI Match
              </div>
              <span className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>Excellent compatibility</span>
            </div>
            <p className="text-sm mb-3" style={{ color: "rgba(30,37,53,0.75)" }}>
              <strong>Goals:</strong> Natural lip enhancement, subtle volume increase
            </p>
            <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>
              Previous treatments: None · Budget: $500-750 · Prefers minimal downtime
            </p>
          </div>
          <div className="flex gap-3">
            <button className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: "#2D6B7F", color: "white" }}>
              Accept Booking
            </button>
            <button className="px-6 py-3 rounded-xl font-bold text-sm" style={{ background: "rgba(0,0,0,0.05)", color: "rgba(30,37,53,0.6)" }}>
              Decline
            </button>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Step Navigation */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = activeStep === idx;
          const isPast = activeStep > idx;
          
          return (
            <div key={idx} className="relative">
              <button
                onClick={() => setActiveStep(idx)}
                className="w-full text-left p-6 rounded-2xl transition-all duration-300"
                style={{
                  background: isActive ? "white" : isPast ? "rgba(200,230,60,0.08)" : "rgba(0,0,0,0.03)",
                  border: isActive ? `2px solid ${step.color}` : "1px solid rgba(0,0,0,0.08)",
                  transform: isActive ? "scale(1.05)" : "scale(1)",
                  boxShadow: isActive ? `0 12px 32px ${step.color}30` : "none"
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg" style={{ 
                    background: isPast ? "#C8E63C" : isActive ? step.color : "rgba(0,0,0,0.08)",
                    color: isPast || isActive ? "white" : "rgba(30,37,53,0.4)"
                  }}>
                    {isPast ? <CheckCircle className="w-6 h-6" /> : step.number}
                  </div>
                  <Icon className="w-6 h-6" style={{ color: isActive ? step.color : "rgba(30,37,53,0.3)" }} />
                </div>
                <h4 className="font-bold mb-1" style={{ color: "#1e2535" }}>{step.title}</h4>
                <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>{step.subtitle}</p>
              </button>
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 z-10">
                  <ArrowRight className="w-6 h-6" style={{ color: isPast ? "#C8E63C" : "rgba(30,37,53,0.15)" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Visual Demo with smooth transition */}
      <div className="relative">
        <div className="absolute inset-0 rounded-3xl blur-3xl opacity-10 transition-all duration-500" style={{ background: steps[activeStep].color }} />
        <div className="relative transition-all duration-500">
          {steps[activeStep].visual}
        </div>
      </div>
    </div>
  );
}