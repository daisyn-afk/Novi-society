import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { ArrowRight, ArrowLeft, CheckCircle2, Sparkles, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SKIN_CONCERNS = [
  "Fine Lines & Wrinkles", "Volume Loss", "Skin Laxity",
  "Dark Spots / Pigmentation", "Pores & Texture", "Acne / Scarring",
  "Under-Eye Hollows", "Jawline Definition", "Lip Volume", "Brow Lift",
];

const TREATMENT_GOALS = [
  "Look naturally refreshed", "Preventative anti-aging", "Address specific areas",
  "Boost confidence", "Restore youthful volume", "Even skin tone",
  "Minimal downtime", "Long-lasting results",
];

const BUDGET_OPTIONS = [
  { value: "under_500", label: "Under $500", sub: "Starting to explore" },
  { value: "500_1000", label: "$500 – $1,000", sub: "Occasional treatments" },
  { value: "1000_2500", label: "$1,000 – $2,500", sub: "Regular maintenance" },
  { value: "2500_plus", label: "$2,500+", sub: "Comprehensive plan" },
];

export default function PatientOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showQuickReg, setShowQuickReg] = useState(false);

  const [concerns, setConcerns] = useState([]);
  const [goals, setGoals] = useState([]);
  const [budget, setBudget] = useState("");
  const [scanUrl, setScanUrl] = useState("");

  // Quick registration form state
  const [regForm, setRegForm] = useState({
    phone: "",
    date_of_birth: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });

  const toggleItem = (list, setList, item) => {
    setList(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({
      file,
      kind: "patient_journey_selfie",
    });
    setScanUrl(file_url);
    setUploadingPhoto(false);
  };

  const calculateAge = (dob) => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const handleQuickRegister = async () => {
    if (!regForm.phone || !regForm.date_of_birth || !regForm.address || !regForm.city || !regForm.state || !regForm.zip) {
      alert("Please fill in all required fields.");
      return;
    }
    
    const age = calculateAge(regForm.date_of_birth);
    if (age < 18) {
      alert("You must be at least 18 years old to register.");
      return;
    }

    setSaving(true);
    await base44.auth.updateMe({
      phone: regForm.phone,
      date_of_birth: regForm.date_of_birth,
      address: regForm.address,
      city: regForm.city,
      state: regForm.state,
      zip: regForm.zip,
    });

    const me = await base44.auth.me();
    const existing = await base44.entities.PatientJourney.filter({ patient_id: me.id });
    const journeyData = {
      patient_id: me.id,
      patient_email: me.email,
      onboarding_completed: true,
      skin_concerns: [],
      treatment_goals: [],
    };
    
    if (existing.length > 0) {
      await base44.entities.PatientJourney.update(existing[0].id, journeyData);
    } else {
      await base44.entities.PatientJourney.create(journeyData);
    }
    
    navigate(createPageUrl("PatientJourney"));
  };

  const handleFinish = async () => {
    setSaving(true);
    
    // Save basic registration info to user profile
    await base44.auth.updateMe({
      phone: regForm.phone,
      date_of_birth: regForm.date_of_birth,
      address: regForm.address,
      city: regForm.city,
      state: regForm.state,
      zip: regForm.zip,
    });
    
    const me = await base44.auth.me();
    const existing = await base44.entities.PatientJourney.filter({ patient_id: me.id });
    const journeyData = {
      patient_id: me.id,
      patient_email: me.email,
      skin_concerns: concerns,
      treatment_goals: goals,
      budget_comfort: budget || undefined,
      onboarding_completed: true,
      scans: scanUrl ? [{ scan_url: scanUrl, scanned_at: new Date().toISOString(), label: "Initial Scan" }] : [],
    };
    if (existing.length > 0) {
      await base44.entities.PatientJourney.update(existing[0].id, journeyData);
    } else {
      await base44.entities.PatientJourney.create(journeyData);
    }
    navigate(createPageUrl("PatientJourney"));
  };

  const handleNext = () => {
    // Validate first step (registration info)
    if (step === 0) {
      if (!regForm.phone || !regForm.date_of_birth || !regForm.address || !regForm.city || !regForm.state || !regForm.zip) {
        alert("Please fill in all required fields.");
        return;
      }
      
      const age = calculateAge(regForm.date_of_birth);
      if (age < 18) {
        alert("You must be at least 18 years old to register.");
        return;
      }
    }
    
    setStep(s => s + 1);
  };

  const steps = [
    {
      title: "Let's start with your contact information",
      subtitle: "We need some basic info to create your account.",
      content: (
        <div className="space-y-4 bg-white rounded-2xl p-6">
          <div>
            <Label>Phone Number *</Label>
            <Input type="tel" value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} placeholder="(555) 123-4567" />
          </div>
          
          <div>
            <Label>Date of Birth * <span className="text-xs text-gray-400">(Must be 18+)</span></Label>
            <Input type="date" value={regForm.date_of_birth} onChange={(e) => setRegForm({ ...regForm, date_of_birth: e.target.value })} />
          </div>

          <div>
            <Label>Street Address *</Label>
            <Input value={regForm.address} onChange={(e) => setRegForm({ ...regForm, address: e.target.value })} placeholder="123 Main St" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>City *</Label>
              <Input value={regForm.city} onChange={(e) => setRegForm({ ...regForm, city: e.target.value })} placeholder="Austin" />
            </div>
            <div>
              <Label>State *</Label>
              <Input value={regForm.state} onChange={(e) => setRegForm({ ...regForm, state: e.target.value })} placeholder="TX" maxLength={2} />
            </div>
          </div>

          <div>
            <Label>ZIP Code *</Label>
            <Input value={regForm.zip} onChange={(e) => setRegForm({ ...regForm, zip: e.target.value })} placeholder="78701" />
          </div>
        </div>
      ),
      canSkip: false,
      requiresValidation: true,
    },
    {
      title: "What are your main skin concerns?",
      subtitle: "Select all that apply — we'll build your roadmap around these.",
      content: (
        <div className="flex flex-wrap gap-2">
          {SKIN_CONCERNS.map(c => (
            <button key={c} onClick={() => toggleItem(concerns, setConcerns, c)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={concerns.includes(c)
                ? { background: "linear-gradient(135deg,#2D6B7F,#7B8EC8)", color: "#fff", boxShadow: "0 3px 10px rgba(123,142,200,0.45)", border: "none" }
                : { background: "#f5f3ef", color: "#1e2535", border: "1.5px solid #e5e7eb" }
              }>
              {concerns.includes(c) && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />}{c}
            </button>
          ))}
        </div>
      ),
      canSkip: true,
    },
    {
      title: "What are your treatment goals?",
      subtitle: "This helps us match you with the right treatments and providers.",
      content: (
        <div className="flex flex-wrap gap-2">
          {TREATMENT_GOALS.map(g => (
            <button key={g} onClick={() => toggleItem(goals, setGoals, g)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={goals.includes(g)
                ? { background: "linear-gradient(135deg,#DA6A63,#e8956d)", color: "#fff", boxShadow: "0 3px 10px rgba(218,106,99,0.45)", border: "none" }
                : { background: "#f5f3ef", color: "#1e2535", border: "1.5px solid #e5e7eb" }
              }>
              {goals.includes(g) && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />}{g}
            </button>
          ))}
        </div>
      ),
      canSkip: true,
    },
    {
      title: "What's your budget comfort level?",
      subtitle: "No commitment — just helps us tailor suggestions for you.",
      content: (
        <div className="grid grid-cols-2 gap-3">
          {BUDGET_OPTIONS.map(b => (
            <button key={b.value} onClick={() => setBudget(b.value)}
              className="p-4 rounded-2xl text-left transition-all"
              style={budget === b.value
                ? { background: "linear-gradient(135deg,#2D6B7F,#7B8EC8)", color: "#fff", border: "2px solid transparent", boxShadow: "0 6px 20px rgba(123,142,200,0.4)" }
                : { background: "#fff", border: "2px solid #e5e7eb", color: "#1e2535" }
              }>
              <p className="font-bold text-sm">{b.label}</p>
              <p className="text-xs mt-0.5 opacity-70">{b.sub}</p>
            </button>
          ))}
        </div>
      ),
      canSkip: true,
    },
    {
      title: "Upload your first facial scan",
      subtitle: "Optional but recommended — our AI will generate your personalized roadmap.",
      content: (
        <div className="space-y-4">
          <label className="block w-full border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors hover:border-indigo-300"
            style={{ borderColor: scanUrl ? "#7B8EC8" : "#d1d5db", background: scanUrl ? "#f0f3fc" : "#fafafa" }}>
            {scanUrl ? (
              <div className="space-y-2">
                <img src={scanUrl} alt="Scan" className="w-40 h-40 object-cover rounded-xl mx-auto" />
                <p className="text-sm font-semibold text-indigo-700">Scan uploaded! ✓</p>
              </div>
            ) : (
              <div className="space-y-3">
                {uploadingPhoto
                  ? <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  : <Camera className="w-10 h-10 mx-auto text-gray-300" />
                }
                <p className="text-sm text-gray-500">Take or upload a clear, well-lit selfie</p>
                <p className="text-xs text-gray-400">JPEG or PNG · Max 10MB</p>
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </label>
          <p className="text-xs text-center text-gray-400">Your photo is encrypted and only used for AI analysis. It is never shared without your consent.</p>
        </div>
      ),
      canSkip: true,
    },
  ];

  const currentStep = steps[step];
  const isLast = step === steps.length - 1;

  // Quick registration dialog
  if (showQuickReg) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "linear-gradient(135deg,#2D6B7F 0%,#4a8fa8 38%,#7B8EC8 68%,#DA6A63 100%)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "fixed", top: "-20%", left: "-8%", width: "55%", height: "130%", borderRadius: "60% 40% 70% 30%/50% 60% 40% 50%", background: "rgba(218,106,99,0.35)", filter: "blur(50px)", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "fixed", bottom: "-10%", right: "-5%", width: "45%", height: "110%", borderRadius: "40% 60% 30% 70%/60% 40% 60% 40%", background: "rgba(200,230,60,0.2)", filter: "blur(55px)", pointerEvents: "none", zIndex: 0 }} />
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="mb-8" style={{ position: "relative", zIndex: 1 }}>
            <div style={{ background: "#1e2535", padding: "10px 20px", borderRadius: 14, display: "inline-flex", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              <img src="/novi-logo-neon-green.png" alt="NOVI Society" style={{ height: 32, width: "auto", display: "block" }} />
            </div>
          </div>

          <div className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.65)", position: "relative", zIndex: 1 }}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: "#1e2535", marginBottom: 4 }}>
              Quick Registration
            </h2>
            <p className="text-sm text-gray-500 mb-6">Complete your basic info to access your patient dashboard.</p>

            <div className="space-y-4">
              <div>
                <Label>Phone Number *</Label>
                <Input type="tel" value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} placeholder="(555) 123-4567" />
              </div>
              
              <div>
                <Label>Date of Birth * <span className="text-xs text-gray-400">(Must be 18+)</span></Label>
                <Input type="date" value={regForm.date_of_birth} onChange={(e) => setRegForm({ ...regForm, date_of_birth: e.target.value })} />
              </div>

              <div>
                <Label>Street Address *</Label>
                <Input value={regForm.address} onChange={(e) => setRegForm({ ...regForm, address: e.target.value })} placeholder="123 Main St" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>City *</Label>
                  <Input value={regForm.city} onChange={(e) => setRegForm({ ...regForm, city: e.target.value })} placeholder="Austin" />
                </div>
                <div>
                  <Label>State *</Label>
                  <Input value={regForm.state} onChange={(e) => setRegForm({ ...regForm, state: e.target.value })} placeholder="TX" maxLength={2} />
                </div>
              </div>

              <div>
                <Label>ZIP Code *</Label>
                <Input value={regForm.zip} onChange={(e) => setRegForm({ ...regForm, zip: e.target.value })} placeholder="78701" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowQuickReg(false)} className="flex-1">
                Back
              </Button>
              <Button onClick={handleQuickRegister} disabled={saving} className="flex-1 font-semibold" style={{ background: "#1e2535", color: "#fff" }}>
                {saving ? "Saving..." : "Complete Registration"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "linear-gradient(135deg,#2D6B7F 0%,#4a8fa8 38%,#7B8EC8 68%,#DA6A63 100%)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", top: "-20%", left: "-8%", width: "55%", height: "130%", borderRadius: "60% 40% 70% 30%/50% 60% 40% 50%", background: "rgba(218,106,99,0.35)", filter: "blur(50px)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "-10%", right: "-5%", width: "45%", height: "110%", borderRadius: "40% 60% 30% 70%/60% 40% 60% 40%", background: "rgba(200,230,60,0.2)", filter: "blur(55px)", pointerEvents: "none", zIndex: 0 }} />
      <div className="w-full max-w-lg" style={{ position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div className="mb-6">
          <div style={{ background: "#1e2535", padding: "10px 20px", borderRadius: 14, display: "inline-flex", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <img src="/novi-logo-neon-green.png" alt="NOVI Society" style={{ height: 32, width: "auto", display: "block" }} />
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {steps.map((_, i) => (
            <div key={i} className="h-1.5 flex-1 rounded-full transition-all" style={{
              background: i < step
                ? "linear-gradient(90deg,#2D6B7F,#C8E63C)"
                : i === step
                  ? "#C8E63C"
                  : "rgba(255,255,255,0.2)"
            }} />
          ))}
        </div>

        {/* Skip to dashboard option */}
        {step === 0 && (
          <div className="mb-6 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "1.5px dashed rgba(255,255,255,0.35)" }}>
            <p className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.85)" }}>
              <strong>Already know your provider?</strong> Complete basic registration and skip to your dashboard.
            </p>
            <button onClick={() => setShowQuickReg(true)} style={{ fontSize: 13, fontWeight: 700, color: "#C8E63C", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              Skip Personalization →
            </button>
          </div>
        )}

        {/* Step card */}
        <div style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderRadius: 24, padding: "32px 28px", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.65)" }}>
          {/* Badge */}
          <div className="flex items-center gap-2 mb-5">
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#DA6A63,#7B8EC8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles style={{ width: 14, height: 14, color: "white" }} />
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#2D6B7F", margin: 0 }}>Your Novi Journey · Step {step + 1} of {steps.length}</p>
          </div>

          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: "#1e2535", marginBottom: 8, lineHeight: 1.2, fontStyle: "italic" }}>
            {currentStep.title}
          </h1>
          <p style={{ fontSize: 14, color: "rgba(30,37,53,0.55)", marginBottom: 24, lineHeight: 1.6 }}>{currentStep.subtitle}</p>

          <div className="mb-8">{currentStep.content}</div>

          <div className="flex items-center justify-between gap-3">
            {step > 0
              ? <button onClick={() => setStep(s => s - 1)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(30,37,53,0.5)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  <ArrowLeft style={{ width: 15, height: 15 }} /> Back
                </button>
              : <div />
            }
            <div className="flex gap-2">
              {currentStep.canSkip && (
                <button onClick={isLast ? handleFinish : () => setStep(s => s + 1)}
                  style={{ fontSize: 13, color: "rgba(30,37,53,0.4)", background: "none", border: "none", cursor: "pointer", padding: "0 12px" }}>
                  Skip
                </button>
              )}
              <Button onClick={isLast ? handleFinish : handleNext}
                disabled={saving}
                className="gap-2 font-bold"
                style={{ background: "#C8E63C", color: "#1e2535", borderRadius: 100, padding: "10px 24px", fontSize: 13, boxShadow: "0 4px 16px rgba(200,230,60,0.4)", border: "none" }}>
                {saving ? "Saving..." : isLast ? "View My Journey" : "Next"}
                {!saving && <ArrowRight style={{ width: 15, height: 15 }} />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}