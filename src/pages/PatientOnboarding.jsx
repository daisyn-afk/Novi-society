import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { ArrowRight, ArrowLeft, CheckCircle2, Sparkles, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TOTAL_STEPS = 6;
const PATIENT_SELFIE_MAX_BYTES = 10 * 1024 * 1024;
const PATIENT_SELFIE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
const PATIENT_SELFIE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

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

const EXPERIENCE_OPTIONS = [
  { value: "brand_new", emoji: "✨", label: "Brand New", sub: "Never had aesthetic treatments" },
  { value: "explored", emoji: "🌿", label: "Explored a Little", sub: "Had 1–2 treatments before" },
  { value: "regular", emoji: "💅", label: "Regular Client", sub: "Ongoing aesthetic routine" },
  { value: "very_experienced", emoji: "🏆", label: "Very Experienced", sub: "Deep knowledge of treatments" },
];

const BUDGET_OPTIONS = [
  { value: "under_500", emoji: "🌱", label: "Under $500", sub: "Starting to explore" },
  { value: "500_1000", emoji: "✨", label: "$500 – $1,000", sub: "Occasional treatments" },
  { value: "1000_2500", emoji: "💎", label: "$1,000 – $2,500", sub: "Regular maintenance" },
  { value: "2500_plus", emoji: "👑", label: "$2,500+", sub: "Comprehensive plan" },
];

function NoviLogo() {
  return (
    <div className="flex items-baseline gap-1.5 mb-6">
      <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", fontWeight: 400, lineHeight: 1 }}>
        novi
      </span>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(123,142,200,0.7)" }}>
        Society
      </span>
    </div>
  );
}

function ProgressBar({ step, total }) {
  return (
    <div className="flex gap-1 mb-3">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1 flex-1 rounded-full transition-all duration-300"
          style={{
            background: i < step ? "#7B8EC8" : i === step ? "#FA6F30" : "#e8e6e1",
          }}
        />
      ))}
    </div>
  );
}

function StepBadge({ step, total }) {
  return (
    <div className="flex items-center gap-1.5 mb-5">
      <Sparkles style={{ width: 12, height: 12, color: "#7B8EC8" }} />
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7B8EC8" }}>
        Step {step + 1} of {total}
      </span>
    </div>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(30,37,53,0.45)", display: "block", marginBottom: 6 }}>
      {children}{required && <span style={{ color: "#DA6A63" }}> *</span>}
    </label>
  );
}

function NavFooter({ step, isLast, canSkip, saving, onBack, onSkip, onNext }) {
  return (
    <div className="flex items-center justify-between gap-3 mt-8">
      {step > 0 ? (
        <button type="button" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(123,142,200,0.85)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
          <ArrowLeft style={{ width: 15, height: 15 }} /> Back
        </button>
      ) : <div />}
      <div className="flex items-center gap-3">
        {canSkip && (
          <button type="button" onClick={onSkip} style={{ fontSize: 13, color: "rgba(123,142,200,0.75)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            Skip
          </button>
        )}
        <Button
          type="button"
          onClick={onNext}
          disabled={saving}
          className="gap-2 font-semibold"
          style={{ background: "#1e2535", color: "#fff", borderRadius: 100, padding: "10px 22px", fontSize: 13, border: "none" }}
        >
          {saving ? "Saving…" : isLast ? "Find My Matches" : "Next"}
          {!saving && <ArrowRight style={{ width: 15, height: 15 }} />}
        </Button>
      </div>
    </div>
  );
}

export default function PatientOnboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState("form");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [experience, setExperience] = useState("");
  const [concerns, setConcerns] = useState([]);
  const [goals, setGoals] = useState([]);
  const [budget, setBudget] = useState("");
  const [scanUrl, setScanUrl] = useState("");

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

    setUploadError("");
    if (!PATIENT_SELFIE_MIME_TYPES.has(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || "")) {
      setUploadError("Please upload a JPG, PNG, WEBP, or HEIC image.");
      e.target.value = "";
      return;
    }
    if (file.size > PATIENT_SELFIE_MAX_BYTES) {
      setUploadError("Image must be 10MB or smaller.");
      e.target.value = "";
      return;
    }

    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({
        file,
        kind: "patient_journey_selfie",
      });
      setScanUrl(file_url);
    } catch (err) {
      setUploadError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const calculateAge = (dob) => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const persistOnboarding = async () => {
    await base44.auth.updateMe({
      phone: regForm.phone,
      date_of_birth: regForm.date_of_birth,
      address: regForm.address || undefined,
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
    await queryClient.invalidateQueries({ queryKey: ["patient-onboarding-gate"] });
  };

  const handleFinish = async () => {
    setSaving(true);
    setPhase("loading");
    try {
      await Promise.all([
        persistOnboarding(),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
      setPhase("all_set");
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
      alert("We couldn't save your profile. Please try again.");
      setPhase("form");
    } finally {
      setSaving(false);
    }
  };

  const validateStep0 = () => {
    if (!regForm.phone || !regForm.date_of_birth || !regForm.city || !regForm.state || !regForm.zip) {
      alert("Please fill in all required fields.");
      return false;
    }
    if (calculateAge(regForm.date_of_birth) < 18) {
      alert("You must be at least 18 years old to register.");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep0()) return;
    setStep(s => s + 1);
  };

  const isLast = step === TOTAL_STEPS - 1;

  const steps = [
    {
      emoji: "👋",
      title: "Let's get you set up",
      subtitle: "Basic info to create your patient profile.",
      canSkip: false,
      content: (
        <div className="space-y-4">
          <div>
            <FieldLabel required>Phone</FieldLabel>
            <Input type="tel" value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} placeholder="(555) 123-4567" className="rounded-xl border-gray-200" />
          </div>
          <div>
            <FieldLabel required>Date of Birth <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>(18+ only)</span></FieldLabel>
            <Input type="date" value={regForm.date_of_birth} onChange={(e) => setRegForm({ ...regForm, date_of_birth: e.target.value })} className="rounded-xl border-gray-200" />
          </div>
          <div>
            <FieldLabel>Street Address</FieldLabel>
            <Input value={regForm.address} onChange={(e) => setRegForm({ ...regForm, address: e.target.value })} placeholder="123 Main St" className="rounded-xl border-gray-200" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <FieldLabel required>City</FieldLabel>
              <Input value={regForm.city} onChange={(e) => setRegForm({ ...regForm, city: e.target.value })} placeholder="Austin" className="rounded-xl border-gray-200" />
            </div>
            <div>
              <FieldLabel required>State</FieldLabel>
              <Input value={regForm.state} onChange={(e) => setRegForm({ ...regForm, state: e.target.value })} placeholder="TX" maxLength={2} className="rounded-xl border-gray-200" />
            </div>
            <div>
              <FieldLabel required>Zip</FieldLabel>
              <Input value={regForm.zip} onChange={(e) => setRegForm({ ...regForm, zip: e.target.value })} placeholder="78701" className="rounded-xl border-gray-200" />
            </div>
          </div>
        </div>
      ),
    },
    {
      emoji: null,
      title: "How experienced are you?",
      subtitle: "This helps us tailor your recommendations perfectly.",
      canSkip: true,
      content: (
        <div className="grid grid-cols-2 gap-3">
          {EXPERIENCE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setExperience(opt.value)}
              className="p-4 rounded-2xl text-left transition-all"
              style={experience === opt.value
                ? { background: "#fff", border: "2px solid #1e2535", boxShadow: "0 4px 16px rgba(30,37,53,0.08)" }
                : { background: "#fff", border: "1.5px solid #e8e6e1", color: "#1e2535" }
              }
            >
              <span className="text-xl mb-2 block">{opt.emoji}</span>
              <p className="font-bold text-sm">{opt.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{opt.sub}</p>
            </button>
          ))}
        </div>
      ),
    },
    {
      emoji: "🔍",
      title: "What are your skin concerns?",
      subtitle: "Select all that apply — we'll build your roadmap around these.",
      canSkip: true,
      content: (
        <div className="flex flex-wrap gap-2">
          {SKIN_CONCERNS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => toggleItem(concerns, setConcerns, c)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={concerns.includes(c)
                ? { background: "#1e2535", color: "#fff", border: "none" }
                : { background: "#fff", color: "#1e2535", border: "1.5px solid #e8e6e1" }
              }
            >
              {concerns.includes(c) && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />}{c}
            </button>
          ))}
        </div>
      ),
    },
    {
      emoji: "🎯",
      title: "What are your goals?",
      subtitle: "This helps match you with the right treatments and providers.",
      canSkip: true,
      content: (
        <div className="flex flex-wrap gap-2">
          {TREATMENT_GOALS.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => toggleItem(goals, setGoals, g)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={goals.includes(g)
                ? { background: "#1e2535", color: "#fff", border: "none" }
                : { background: "#fff", color: "#1e2535", border: "1.5px solid #e8e6e1" }
              }
            >
              {goals.includes(g) && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />}{g}
            </button>
          ))}
        </div>
      ),
    },
    {
      emoji: "💰",
      title: "What's your budget comfort?",
      subtitle: "No commitment — just helps us tailor suggestions for you.",
      canSkip: true,
      content: (
        <div className="grid grid-cols-2 gap-3">
          {BUDGET_OPTIONS.map(b => (
            <button
              key={b.value}
              type="button"
              onClick={() => setBudget(b.value)}
              className="p-4 rounded-2xl text-left transition-all"
              style={budget === b.value
                ? { background: "#fff", border: "2px solid #1e2535", boxShadow: "0 4px 16px rgba(30,37,53,0.08)" }
                : { background: "#fff", border: "1.5px solid #e8e6e1", color: "#1e2535" }
              }
            >
              <span className="text-xl mb-2 block">{b.emoji}</span>
              <p className="font-bold text-sm">{b.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{b.sub}</p>
            </button>
          ))}
        </div>
      ),
    },
    {
      emoji: "📸",
      title: "Upload your first facial scan",
      subtitle: "Optional — our AI will generate your personalized roadmap.",
      canSkip: true,
      content: (
        <div className="space-y-3">
          <label
            className="block w-full border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors hover:border-gray-300"
            style={{ borderColor: scanUrl ? "#7B8EC8" : "#e8e6e1", background: scanUrl ? "#f8f9fc" : "#fafafa" }}
          >
            {scanUrl ? (
              <div className="space-y-2">
                <img src={scanUrl} alt="Scan" className="w-40 h-40 object-cover rounded-xl mx-auto" />
                <p className="text-sm font-semibold" style={{ color: "#4a5fa8" }}>Scan uploaded ✓</p>
              </div>
            ) : (
              <div className="space-y-3">
                {uploadingPhoto
                  ? <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  : <Camera className="w-10 h-10 mx-auto text-gray-300" />
                }
                <p className="text-sm text-gray-500">Take or upload a clear, well-lit selfie</p>
                <p className="text-xs text-gray-400">JPEG, PNG, WEBP, or HEIC · Max 10MB</p>
              </div>
            )}
            <input type="file" accept={PATIENT_SELFIE_ACCEPT} className="hidden" onChange={handlePhotoUpload} />
          </label>
          {uploadError && (
            <p className="text-xs text-center text-red-600">{uploadError}</p>
          )}
          <p className="text-xs text-center text-gray-400">
            Your photo is encrypted and only used for AI analysis. Never shared without consent.
          </p>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];

  const shell = (children) => (
    <div className="w-full max-w-xl mx-auto py-4">
      {children}
    </div>
  );

  if (phase === "loading") {
    return shell(
      <>
        <NoviLogo />
        <div className="rounded-3xl p-10 text-center" style={{ background: "#fff", border: "1px solid #e8e6e1" }}>
          <div className="flex justify-center mb-6">
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#DA6A63,#7B8EC8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 className="animate-spin" style={{ width: 28, height: 28, color: "#fff" }} />
            </div>
          </div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: "#1e2535", marginBottom: 8, lineHeight: 1.2 }}>
            Finding the best provider…
          </h1>
          <p style={{ fontSize: 14, color: "rgba(30,37,53,0.55)", lineHeight: 1.6 }}>
            Our AI is reviewing your profile and matching you with providers near you. Hang tight — this only takes a moment.
          </p>
        </div>
      </>
    );
  }

  if (phase === "all_set") {
    return shell(
      <>
        <NoviLogo />
        <div className="rounded-3xl p-10 text-center" style={{ background: "#fff", border: "1px solid #e8e6e1" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#7B8EC8", marginBottom: 12 }}>
            Your AI Matches
          </p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: 36, color: "#1e2535", marginBottom: 12, lineHeight: 1.15 }}>
            You're all set!
          </h1>
          <p style={{ fontSize: 14, color: "rgba(30,37,53,0.55)", lineHeight: 1.6, marginBottom: 28 }}>
            No providers match your profile yet, but you can browse all providers in the marketplace.
          </p>
          <Button
            onClick={() => navigate(createPageUrl("PatientMarketplace"))}
            className="w-full gap-2 font-bold"
            style={{ background: "#FA6F30", color: "#fff", borderRadius: 100, padding: "16px 24px", fontSize: 15, border: "none", height: "auto" }}
          >
            Browse All Providers <ArrowRight style={{ width: 16, height: 16 }} />
          </Button>
          <button
            type="button"
            onClick={() => navigate(createPageUrl("PatientJourney"))}
            style={{ marginTop: 16, fontSize: 13, fontWeight: 600, color: "rgba(123,142,200,0.85)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
          >
            Go to my dashboard instead
          </button>
        </div>
      </>
    );
  }

  return shell(
    <>
      <NoviLogo />
      <ProgressBar step={step} total={TOTAL_STEPS} />
      <StepBadge step={step} total={TOTAL_STEPS} />

      {currentStep.emoji && (
        <span className="text-2xl mb-3 block">{currentStep.emoji}</span>
      )}

      <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", marginBottom: 8, lineHeight: 1.2 }}>
        {currentStep.title}
      </h1>
      <p style={{ fontSize: 14, color: "rgba(30,37,53,0.5)", marginBottom: 24, lineHeight: 1.6 }}>
        {currentStep.subtitle}
      </p>

      {currentStep.content}

      <NavFooter
        step={step}
        isLast={isLast}
        canSkip={currentStep.canSkip}
        saving={saving}
        onBack={() => setStep(s => s - 1)}
        onSkip={isLast ? handleFinish : () => setStep(s => s + 1)}
        onNext={isLast ? handleFinish : handleNext}
      />
    </>
  );
}
