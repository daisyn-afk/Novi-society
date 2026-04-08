import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Sparkles, Send, Camera, Users, Lock, CheckCircle, Crown, X, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import ScanHistoryPanel from "@/components/patient/ScanHistoryPanel";
import PremiumMetrics from "@/components/patient/PremiumMetrics";
import ProviderMatchRoadmap from "@/components/patient/ProviderMatchRoadmap";
import DailyCheckIn from "@/components/patient/DailyCheckIn";
import PatientJourneyDashboard from "@/components/patient/PatientJourneyDashboard";

function NoviAvatar() {
  return (
    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #7B8EC8, #2D6B7F)" }}>
      <Sparkles className="w-4 h-4 text-white" />
    </div>
  );
}

function ScanDropzone({ onUpload }) {
  const [uploading, setUploading] = useState(false);
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploading(false);
    onUpload(file_url);
  };
  return (
    <label className="block cursor-pointer">
      <div className="rounded-xl border-2 border-dashed p-5 text-center transition-colors hover:border-indigo-300"
        style={{ borderColor: "#d1d5db", background: "#fafafa" }}>
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-400">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Camera className="w-8 h-8 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">Tap to upload a selfie</p>
            <p className="text-xs text-gray-400">Well-lit, straight-on · JPEG or PNG</p>
          </div>
        )}
      </div>
      <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </label>
  );
}

function Bubble({ msg, onChoice, onScanUpload, isPremium, onUpgrade, journey, latestScan, navigate }) {
  const isNovi = msg.role === "ai";

  if (msg.type === "scan_request") {
    return (
      <div className="flex gap-3 items-end">
        <NoviAvatar />
        <div className="flex-1 max-w-sm">
          <p className="text-xs text-gray-400 mb-1.5 ml-1">Novi</p>
          <div className="rounded-2xl rounded-bl-sm p-4 space-y-3" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
            <p className="text-sm text-gray-700">{msg.content}</p>
            <ScanDropzone onUpload={onScanUpload} />
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === "scan_analyzing") {
    return (
      <div className="flex gap-3 items-end">
        <NoviAvatar />
        <div className="max-w-sm">
          <p className="text-xs text-gray-400 mb-1.5 ml-1">Novi</p>
          <div className="rounded-2xl rounded-bl-sm px-5 py-4 flex items-center gap-3" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-indigo-400"
                  style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
            <p className="text-sm text-gray-500 italic">Analyzing your scan…</p>
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === "scan_result") {
    const a = msg.analysis;
    const healthColor = { "Excellent": "#16a34a", "Good": "#1d4ed8", "Fair": "#a16207", "Needs Attention": "#dc2626" };
    return (
      <div className="flex gap-3 items-end">
        <NoviAvatar />
        <div className="flex-1 max-w-lg">
          <p className="text-xs text-gray-400 mb-1.5 ml-1">Novi</p>
          <div className="rounded-2xl rounded-bl-sm p-5 space-y-4" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
            {msg.scanUrl && <img src={msg.scanUrl} className="w-full max-h-48 object-cover rounded-xl" alt="your scan" />}
            <p className="font-semibold text-gray-800">Your skin looks <span style={{ color: healthColor[a?.overall_skin_health] || "#1d4ed8" }}>{a?.overall_skin_health || "Good"}</span></p>
            <p className="text-sm text-gray-600 leading-relaxed">{a?.concern_summary}</p>
            {a?.detected_concerns?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">What I noticed</p>
                <div className="flex flex-wrap gap-1.5">
                  {a.detected_concerns.map(c => (
                    <span key={c} className="text-xs px-2.5 py-1 rounded-full font-medium bg-orange-50 text-orange-700 border border-orange-100">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {a?.recommended_treatments?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Recommended Treatments</p>
                <div className="space-y-2">
                  {a.recommended_treatments.map((t, i) => (
                    <div key={i} className="rounded-xl p-3 flex items-start gap-3" style={{ background: "rgba(123,142,200,0.07)", border: "1px solid rgba(123,142,200,0.15)" }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{t.reason}</p>
                      </div>
                      <button
                        onClick={() => navigate(createPageUrl(`PatientMarketplace?category=${t.category || ""}`))}
                        className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-full font-semibold whitespace-nowrap"
                        style={{ background: "rgba(123,142,200,0.15)", color: "#4a5fa8", border: "1px solid rgba(123,142,200,0.25)" }}>
                        Find providers →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(!a?.recommended_treatments?.length) && a?.educational_suggestions?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Treatments to explore</p>
                <ul className="space-y-1.5">
                  {a.educational_suggestions.map(s => (
                    <li key={s} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {isPremium ? (
              <PremiumMetrics analysis={a} />
            ) : (
              <div className="relative rounded-xl overflow-hidden">
                {/* Blurred premium preview */}
                <div className="filter blur-sm pointer-events-none select-none p-3 space-y-2"
                  style={{ background: "rgba(123,142,200,0.06)", border: "1px solid rgba(123,142,200,0.15)" }}>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Premium Analysis</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Wrinkle depth: Moderate", "Volume loss: Mild", "Symmetry: 87%", "Skin age estimate", "Treatment priority map"].map(t => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">{t}</span>
                    ))}
                  </div>
                </div>
                {/* Lock overlay */}
                <div className="absolute inset-0 flex items-center justify-center rounded-xl"
                  style={{ background: "rgba(20,15,40,0.75)", backdropFilter: "blur(1px)" }}>
                  <div className="text-center px-4">
                    <Lock className="w-4 h-4 text-white/60 mx-auto mb-1.5" />
                    <p className="text-xs text-white/80 font-semibold mb-2">Unlock full analysis</p>
                    <button onClick={onUpgrade}
                      className="text-xs px-4 py-1.5 rounded-full font-bold flex items-center gap-1.5 mx-auto"
                      style={{ background: "#C8E63C", color: "#1e2535" }}>
                      <Sparkles className="w-3 h-3" /> Premium — $19/mo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === "choices") {
    return (
      <div className="flex gap-3 items-end">
        <NoviAvatar />
        <div className="max-w-lg">
          <p className="text-xs text-gray-400 mb-1.5 ml-1">Novi</p>
          <div className="rounded-2xl rounded-bl-sm p-4 space-y-3" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
            {msg.content && <p className="text-sm text-gray-700">{msg.content}</p>}
            <div className="flex flex-wrap gap-2 mt-1">
              {msg.choices.map(c => (
                <button key={c.value} onClick={() => onChoice(c)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
                  style={{ background: "#f0f3fc", color: "#4a5fa8", border: "1px solid rgba(123,142,200,0.3)" }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === "roadmap") {
    return <ProviderMatchRoadmap journey={journey} latestScan={latestScan} />;
  }

  if (msg.type === "providers_cta") {
    return (
      <div className="flex gap-3 items-end">
        <NoviAvatar />
        <div className="max-w-sm">
          <p className="text-xs text-gray-400 mb-1.5 ml-1">Novi</p>
          <div className="rounded-2xl rounded-bl-sm p-5 space-y-3" style={{ background: "linear-gradient(135deg, #1e2535, #2D4A7A)" }}>
            <p className="text-sm text-white/90 leading-relaxed">{msg.content}</p>
            <Button onClick={msg.onAction} className="w-full gap-2 font-bold rounded-full"
              style={{ background: "#C8E63C", color: "#1e2535" }}>
              <Users className="w-4 h-4" /> Browse Matched Providers
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === "upgrade_cta") {
    return (
      <div className="flex gap-3 items-end">
        <NoviAvatar />
        <div className="max-w-sm">
          <p className="text-xs text-gray-400 mb-1.5 ml-1">Novi</p>
          <div className="rounded-2xl rounded-bl-sm p-5 space-y-3" style={{ background: "linear-gradient(135deg, #1e2535, #4a3070)" }}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <p className="text-xs font-bold uppercase tracking-widest text-yellow-300">Novi Premium</p>
            </div>
            <p className="text-sm text-white/90 leading-relaxed">{msg.content}</p>
            <Button onClick={msg.onAction} className="w-full gap-2 font-bold rounded-full"
              style={{ background: "#C8E63C", color: "#1e2535" }}>
              <Sparkles className="w-4 h-4" /> Unlock Premium — $19/mo
            </Button>
            {msg.onSkip && (
              <button onClick={msg.onSkip} className="w-full text-center text-xs text-white/40 hover:text-white/60 transition-colors">
                Not right now
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default text bubble
  return (
    <div className={`flex gap-3 items-end ${!isNovi ? "flex-row-reverse" : ""}`}>
      {isNovi && <NoviAvatar />}
      <div className={`max-w-md ${!isNovi ? "ml-auto" : ""}`}>
        {isNovi && <p className="text-xs text-gray-400 mb-1.5 ml-1">Novi</p>}
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${isNovi ? "rounded-bl-sm text-gray-700" : "rounded-br-sm text-white"}`}
          style={isNovi ? { background: "#fff", border: "1px solid #e5e7eb" } : { background: "#7B8EC8" }}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}

export default function PatientJourney() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("loading");
  const [journey, setJourney] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [upgradingLoading, setUpgradingLoading] = useState(false);
  const [cancellingLoading, setCancellingLoading] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);
  const [showScanHistory, setShowScanHistory] = useState(false);
  const [viewingScanIndex, setViewingScanIndex] = useState(null);

  const { data: journeyList = [], isLoading } = useQuery({
    queryKey: ["patient-journey"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.PatientJourney.filter({ patient_id: user.id });
    },
  });

  const { data: myAppointments = [] } = useQuery({
    queryKey: ["my-appointments"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.Appointment.filter({ patient_id: user.id });
    },
    enabled: isPremium,
  });

  // Show full journey dashboard once patient has had at least one treatment
  const hasCompletedAppointments = myAppointments.some(a => a.status === "completed");
  const showJourneyDashboard = hasCompletedAppointments && journey?.onboarding_completed;

  // Check for subscription success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") === "success") {
      setSubscriptionSuccess(true);
      setTimeout(() => setSubscriptionSuccess(false), 5000);
      window.history.replaceState({}, "", window.location.pathname);
      qc.invalidateQueries(["patient-journey"]);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isLoading) return;
    const j = journeyList[0] || null;
    setJourney(j);
    const premium = j?.tier === "premium" && j?.subscription_status === "active";
    setIsPremium(premium);

    const hasScans = j?.scans?.length > 0;
    const hasConcerns = j?.skin_concerns?.length > 0;

    if (!j?.onboarding_completed) {
      addMessages([
        { role: "ai", type: "text", content: "Hi! I'm Novi — your personal aesthetic guide. 👋\n\nI'm here to help you understand your skin, explore the right treatments, and connect you with a certified provider who's a great fit.\n\nWhat brings you here today?" },
        { role: "ai", type: "choices", content: "", choices: [
          { label: "I want to look more refreshed", value: "refreshed" },
          { label: "I have specific concerns I'd like to address", value: "concerns" },
          { label: "I'm just exploring, not sure yet", value: "explore" },
          { label: "I have a treatment in mind already", value: "specific" },
        ]},
      ]);
      setPhase("intro");
    } else if (hasScans && j?.scans?.[j.scans.length - 1]?.ai_analysis) {
      const lastScan = j.scans[j.scans.length - 1];
      const msgs = [
        { role: "ai", type: "text", content: `Welcome back! Here's where we left off with your ${lastScan.label || "latest scan"}.` },
        { role: "ai", type: "scan_result", analysis: lastScan.ai_analysis, scanUrl: lastScan.scan_url },
        { role: "ai", type: "choices", content: "What would you like to do next?", choices: premium
          ? [
              { label: "Add a new scan", value: "new_scan" },
              { label: "Find a provider for me", value: "find_provider" },
              { label: "Tell me about my roadmap", value: "roadmap" },
            ]
          : [
              { label: "Add a new scan", value: "new_scan" },
              { label: "Find a provider for me", value: "find_provider" },
              { label: "Upgrade to see my full roadmap", value: "upgrade" },
            ]
        },
      ];
      addMessages(msgs);
      setPhase("chat");
    } else {
      addMessages([
        { role: "ai", type: "text", content: hasConcerns
          ? `Good to see you again! You mentioned you're concerned about ${j.skin_concerns.slice(0, 2).join(" and ")}. Ready to take the next step?`
          : "Good to see you again! Ready to continue your journey?" },
        { role: "ai", type: "text", content: "To give you a truly personalized analysis, I'd love to see a photo of you. It's completely private." },
        { role: "ai", type: "scan_request", content: "Upload a clear, well-lit selfie and I'll get to work:" },
      ]);
      setPhase("chat");
    }
  }, [isLoading, journeyList]);

  function addMessages(newMsgs) {
    setMessages(prev => [...prev, ...newMsgs]);
  }

  function addMsg(msg) {
    setMessages(prev => [...prev, msg]);
  }

  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function handleChoice(choice) {
    setMessages(prev => {
      const filtered = prev.filter(m => m.type !== "choices");
      return [...filtered, { role: "user", type: "text", content: choice.label }];
    });

    await delay(500);

    if (choice.value === "refreshed" || choice.value === "explore") {
      addMsg({ role: "ai", type: "text", content: "Love that! The best results always start with really understanding where you're at right now." });
      await delay(600);
      addMsg({ role: "ai", type: "scan_request", content: "Upload a clear selfie — I'll analyze your skin and map out what would make the biggest difference for you." });
    } else if (choice.value === "concerns" || choice.value === "specific") {
      addMsg({ role: "ai", type: "text", content: "Perfect — let's get specific. A photo will help me give you much more targeted advice than a general checklist ever could." });
      await delay(600);
      addMsg({ role: "ai", type: "scan_request", content: "Share a well-lit, straight-on selfie to get started:" });
    } else if (choice.value === "new_scan") {
      addMsg({ role: "ai", type: "scan_request", content: "Go ahead — upload your new photo and I'll run a fresh analysis:" });
    } else if (choice.value === "find_provider") {
      const latestScan = journey?.scans?.[journey.scans.length - 1];
      const topTreatment = latestScan?.ai_analysis?.recommended_treatments?.[0];
      const category = topTreatment?.category || "";
      addMsg({ role: "ai", type: "text", content: topTreatment
        ? `Based on your scan, I'd prioritize finding a provider certified in **${topTreatment.name}** — ${topTreatment.reason}`
        : "Great call. Based on what I know about your skin and goals, I'll help you find a certified Novi provider who's the right match." });
      await delay(700);
      addMsg({
        role: "ai", type: "providers_cta",
        content: topTreatment
          ? `I've filtered our provider network to show you certified specialists in ${topTreatment.name}. They're Novi-verified, covered, and ready to see you.`
          : "I've filtered our provider network to show you certified specialists who work with your specific concerns. They're verified, covered, and ready to see you.",
        onAction: () => navigate(createPageUrl(`PatientMarketplace${category ? "?category=" + category : ""}`)),
      });
    } else if (choice.value === "scan_history") {
      setShowScanHistory(true);
    } else if (choice.value === "upgrade") {
      addMsg({
        role: "ai", type: "upgrade_cta",
        content: "With Premium, I'll give you a full wrinkle depth map, volume loss analysis, symmetry scoring, AND a step-by-step treatment plan with real cost estimates.",
        onAction: handleUpgrade,
        onSkip: () => {
          addMsg({ role: "user", type: "text", content: "Maybe later" });
          addMsg({ role: "ai", type: "text", content: "No worries! You can always upgrade when you're ready. Shall I help you find a provider to talk through your options in person?" });
          setTimeout(() => {
            addMsg({ role: "ai", type: "choices", content: "", choices: [
              { label: "Yes, find me a provider", value: "find_provider" },
              { label: "Add another scan first", value: "new_scan" },
            ]});
          }, 500);
        }
      });
    } else if (choice.value === "roadmap") {
      addMsg({ role: "ai", type: "roadmap" });
    }
  }

  async function handleScanUpload(fileUrl) {
    setMessages(prev => prev.filter(m => m.type !== "scan_request"));
    addMsg({ role: "user", type: "text", content: "Here's my photo!" });
    await delay(300);
    addMsg({ role: "ai", type: "scan_analyzing" });

    let analysis = {};
    try {
      const premiumFields = isPremium ? `
- wrinkle_depth_score: 0-100 integer (0=no wrinkles, 100=deep wrinkles) — map visible lines, creases, and folds
- volume_loss_score: 0-100 integer (0=no volume loss, 100=severe hollowing) — assess cheeks, temples, under-eye
- symmetry_score: 0-100 integer (100=perfectly symmetrical) — evaluate facial balance
- estimated_skin_age: integer — estimated biological skin age based on texture and tone
- hydration_score: 0-100 integer — skin hydration/plumpness level
- pigmentation_score: 0-100 integer (100=perfectly even, 0=severe uneven) — assess evenness of skin tone
- wrinkle_depth_map: object with keys for facial zones (forehead, glabella, crow_feet, nasolabial, marionette, perioral) and integer 0-10 severity values` : "";

      analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Novi — a warm, professional aesthetic wellness guide with complete knowledge of every aesthetic product, brand, treatment, and ingredient on the market. Analyze this facial photo and respond in friendly, patient-accessible language (never clinical jargon).

Your product knowledge includes: neurotoxins (Botox, Dysport, Xeomin, Daxxify, Jeuveau), dermal fillers (Juvederm Voluma/Volbella/Vollure/Ultra, Restylane Lyft/Silk/Kysse/Defyne, Sculptra, Radiesse, Belotero Balance), skincare (SkinMedica TNS, ZO Skin Health, iS Clinical, SkinCeuticals C E Ferulic, EltaMD UV, Obagi Nu-Derm, Alastin Restorative Skin Complex, PCA Skin), facials (HydraFacial, Aquagold, BBL Hero, DiamondGlow), chemical peels (VI Peel, ZO 3-Step Stimulation Peel), laser (Clear + Brilliant, Fraxel, IPL, Halo), microneedling (SkinPen, Morpheus8 RF), PRP/PRF, Kybella, CoolSculpting, body contouring, IV vitamin therapy, acne treatments (Accutane, Spironolactone topicals, AviClear laser), and more.

Analyze the photo and return:
- overall_skin_health: "Excellent" | "Good" | "Fair" | "Needs Attention"
- concern_summary: 2-3 warm, encouraging sentences describing what you observe in patient-friendly terms
- detected_concerns: array of 3-6 specific observable concerns using friendly language (e.g. "Fine lines around eyes" not "periorbital rhytids")
- recommended_treatments: array of 3-5 REAL, SPECIFIC treatments with actual brand/product names that directly address the detected concerns. Each item:
  - name: specific treatment or product name (e.g. "Botox for forehead lines", "Juvederm Voluma for cheek volume", "HydraFacial for skin texture", "SkinCeuticals C E Ferulic for uneven tone")
  - reason: 1 sentence in patient language explaining WHY this specific treatment helps THEIR specific concern
  - category: one of "injectables" | "fillers" | "laser" | "skincare" | "prp" | "other"
- treatment_areas: array of facial areas that may benefit
- confidence_score: 0-100${premiumFields}`,
        file_urls: [fileUrl],
        response_json_schema: {
          type: "object",
          properties: {
            overall_skin_health: { type: "string" },
            concern_summary: { type: "string" },
            detected_concerns: { type: "array", items: { type: "string" } },
            recommended_treatments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  reason: { type: "string" },
                  category: { type: "string" }
                }
              }
            },
            educational_suggestions: { type: "array", items: { type: "string" } },
            treatment_areas: { type: "array", items: { type: "string" } },
            confidence_score: { type: "number" },
            ...(isPremium ? {
              wrinkle_depth_score: { type: "number" },
              volume_loss_score: { type: "number" },
              symmetry_score: { type: "number" },
              estimated_skin_age: { type: "number" },
              hydration_score: { type: "number" },
              pigmentation_score: { type: "number" },
              wrinkle_depth_map: { type: "object" },
            } : {})
          }
        }
      });
    } catch(e) {
      analysis = { overall_skin_health: "Good", concern_summary: "I wasn't able to fully analyze this image, but I can still help guide you!", detected_concerns: [], educational_suggestions: [] };
    }

    setMessages(prev => prev.filter(m => m.type !== "scan_analyzing"));

    const scanData = { scan_url: fileUrl, scanned_at: new Date().toISOString(), ai_analysis: analysis, label: "Scan" };

    const user = await base44.auth.me();
    let currentJourney = journey;
    if (currentJourney) {
      const updatedScans = [...(currentJourney.scans || []), scanData];
      await base44.entities.PatientJourney.update(currentJourney.id, { scans: updatedScans, onboarding_completed: true });
    } else {
      const created = await base44.entities.PatientJourney.create({
        patient_id: user.id,
        patient_email: user.email,
        scans: [scanData],
        tier: "free",
        onboarding_completed: true,
      });
      setJourney(created);
    }
    qc.invalidateQueries(["patient-journey"]);

    addMsg({ role: "ai", type: "scan_result", analysis, scanUrl: fileUrl });
    await delay(1200);
    addMsg({ role: "ai", type: "text", content: "Based on this, I have a pretty clear picture of what would help you most. The next best step is connecting with a certified provider who can build a real plan for you." });
    await delay(800);
    addMsg({ role: "ai", type: "choices", content: "What would you like to do next?", choices: isPremium
      ? [
          { label: "Show me matched providers", value: "find_provider" },
          { label: "Generate my treatment roadmap", value: "roadmap" },
          { label: "Add another scan", value: "new_scan" },
          { label: "View scan history", value: "scan_history" },
        ]
      : [
          { label: "Find me a provider", value: "find_provider" },
          { label: "Unlock my full roadmap", value: "upgrade" },
          { label: "Add another scan", value: "new_scan" },
          { label: "View scan history", value: "scan_history" },
        ]
    });
  }

  async function handleUpgrade() {
    setUpgradingLoading(true);
    const res = await base44.functions.invoke("createPatientSubscription", {});
    setUpgradingLoading(false);
    if (res.data?.url) {
      window.location.href = res.data.url;
    }
  }

  async function handleCancel() {
    setCancellingLoading(true);
    await base44.functions.invoke("cancelPatientSubscription", {});
    setCancellingLoading(false);
    setShowManage(false);
    qc.invalidateQueries(["patient-journey"]);
  }

  async function handleSend() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    addMsg({ role: "user", type: "text", content: text });

    await delay(700);

    const journeyContext = journey ? `
Patient context:
- Skin concerns: ${journey.skin_concerns?.join(", ") || "none yet"}
- Treatment goals: ${journey.treatment_goals?.join(", ") || "none yet"}
- Budget comfort: ${journey.budget_comfort || "unknown"}
- Latest scan concerns: ${journey.scans?.[journey.scans.length-1]?.ai_analysis?.detected_concerns?.join(", ") || "no scan yet"}
- Recommended treatments from scan: ${journey.scans?.[journey.scans.length-1]?.ai_analysis?.recommended_treatments?.map(t => t.name).join(", ") || "none"}
` : "";

    const reply = await base44.integrations.Core.InvokeLLM({
      prompt: `You are Novi, a warm and deeply knowledgeable aesthetic wellness guide with expert-level knowledge of every aesthetic product, treatment, brand, and ingredient on the market — including neurotoxins (Botox, Dysport, Xeomin, Daxxify, Jeuveau), dermal fillers (Juvederm, Restylane, Sculptra, Radiesse, Belotero), IV therapy, skincare (medical-grade and OTC), facials (HydraFacial, Aquagold, BBL), chemical peels, microneedling, laser treatments, PRP/PRF, Kybella, CoolSculpting, RF microneedling, body contouring, acne treatments, and more.

${journeyContext}

The patient just said: "${text}"

Your job:
1. If they mention any concern, product, or treatment — give them a warm, SPECIFIC, educational 1-3 sentence response that references real products/brands/ingredients relevant to their concern translated into patient-friendly language (not clinical jargon).
2. Match your response to THEIR specific context above if available.
3. Gently guide them toward uploading a facial scan OR finding a certified provider.
4. Never make medical claims. Be empathetic, specific, and genuinely helpful.

Example: If they ask about "looking tired under my eyes" → mention that tear trough fillers (like Restylane Lyft or Juvederm Voluma) or PRP can help restore volume and brightness, and a certified provider can assess which fits them best.`,
    });

    addMsg({ role: "ai", type: "text", content: reply });
    await delay(400);
    addMsg({ role: "ai", type: "choices", content: "", choices: [
      { label: "Upload a scan for analysis", value: "new_scan" },
      { label: "Find a provider near me", value: "find_provider" },
    ]});
  }

  if (isLoading || phase === "loading") {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }


  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 112px)" }}>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Success banner */}
      {subscriptionSuccess && (
        <div className="mb-3 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium flex-shrink-0"
          style={{ background: "rgba(200,230,60,0.15)", border: "1px solid rgba(200,230,60,0.4)", color: "#C8E63C" }}>
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          Welcome to Novi Premium! Your full analysis is now unlocked.
        </div>
      )}

      <div className="flex items-center gap-3 pb-4 border-b border-white/20 flex-shrink-0">
        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7B8EC8, #2D6B7F)" }}>
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: 16, color: "#fff", fontWeight: 400 }}>Novi</p>
          <p className="text-xs text-white/60">Your personal aesthetic guide</p>
        </div>
        {journey?.scans?.length > 0 && (
          <button onClick={() => setShowScanHistory(v => !v)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold transition-all hover:opacity-80 ml-auto"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <History className="w-3 h-3" /> {journey.scans.length} Scan{journey.scans.length > 1 ? "s" : ""}
          </button>
        )}
        {isPremium ? (
          <button onClick={() => setShowManage(true)} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-bold transition-opacity hover:opacity-80 ${journey?.scans?.length > 0 ? "" : "ml-auto"}`}
            style={{ background: "rgba(200,230,60,0.2)", color: "#C8E63C" }}>
            <Crown className="w-3 h-3" /> Premium
          </button>
        ) : (
          <button onClick={handleUpgrade} disabled={upgradingLoading}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold transition-all hover:opacity-90 disabled:opacity-50 ${journey?.scans?.length > 0 ? "" : "ml-auto"}`}
            style={{ background: "rgba(200,230,60,0.15)", color: "#C8E63C", border: "1px solid rgba(200,230,60,0.3)" }}>
            <Sparkles className="w-3 h-3" />
            {upgradingLoading ? "Loading…" : "Upgrade $19/mo"}
          </button>
        )}
      </div>

      {/* Manage subscription modal */}
      {showManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: "#1e2535" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-300" />
                <p className="font-bold text-white">Novi Premium</p>
              </div>
              <button onClick={() => setShowManage(false)} className="text-white/40 hover:text-white/70">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-white/70 text-sm">Your Premium subscription is active at <strong className="text-white">$19/month</strong>.</p>
            <div className="space-y-2 text-sm text-white/60">
              {["Full wrinkle depth mapping", "Volume loss analysis", "Symmetry scoring", "Personalized treatment roadmap", "Priority provider matching"].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />{f}
                </div>
              ))}
            </div>
            <button onClick={handleCancel} disabled={cancellingLoading}
              className="w-full text-center text-xs text-white/30 hover:text-white/50 transition-colors disabled:opacity-50 pt-2">
              {cancellingLoading ? "Cancelling…" : "Cancel subscription (stays active until end of billing period)"}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-5 space-y-5 pr-1">
          {/* Full Journey Dashboard once patient has had a treatment */}
        {showJourneyDashboard && journey && (
          <PatientJourneyDashboard
            journey={journey}
            appointments={myAppointments}
            isPremium={isPremium}
            onUpgrade={handleUpgrade}
            onNewScan={() => {
              setShowScanHistory(false);
              addMsg({ role: "ai", type: "scan_request", content: "Upload your new photo for a fresh AI analysis:" });
            }}
          />
        )}
        {/* Chat flow for new patients not yet in treatment */}
        {!showJourneyDashboard && messages.map((msg, i) => (
          <Bubble key={i} msg={msg} onChoice={handleChoice} onScanUpload={handleScanUpload} isPremium={isPremium} onUpgrade={handleUpgrade} journey={journey} latestScan={journey?.scans?.[journey.scans.length - 1]} navigate={navigate} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Only show chat input for new patients, not post-treatment dashboard */}
      {!showJourneyDashboard && (
        <div className="flex-shrink-0 pt-3 border-t border-white/10">
          <div className="flex gap-2 items-center rounded-2xl px-4 py-2.5" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Ask Novi anything about your skin…"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/40"
            />
            <button onClick={handleSend} disabled={!input.trim()}
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30"
              style={{ background: input.trim() ? "#C8E63C" : "transparent" }}>
              <Send className="w-3.5 h-3.5" style={{ color: input.trim() ? "#1e2535" : "rgba(255,255,255,0.4)" }} />
            </button>
          </div>
          <p className="text-center text-xs text-white/25 mt-2">Novi is not a medical provider. Always consult a professional.</p>
        </div>
      )}
    </div>
  );
}