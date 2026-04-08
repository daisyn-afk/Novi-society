import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { AlertTriangle, Camera, Sparkles, CheckCircle, ChevronRight, ChevronLeft, Package, ArrowRight, Calendar, Flame, TrendingUp, Clock } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

const DEFAULT_SYMPTOMS = ["Swelling", "Bruising", "Redness", "Tenderness", "Tightness", "Itching", "None"];

function getSymptomsForService(serviceName = "") {
  const s = serviceName.toLowerCase();
  if (s.includes("iv") || s.includes("vitamin") || s.includes("infusion")) return ["Nausea", "Headache", "Fatigue", "Bruising at site", "Dizziness", "Chills", "None"];
  if (s.includes("acne") || s.includes("facial") || s.includes("peel") || s.includes("microneedling")) return ["Redness", "Peeling", "Dryness", "Purging breakout", "Tightness", "Sensitivity", "None"];
  if (s.includes("prp") || s.includes("platelet")) return ["Swelling", "Bruising", "Redness", "Tenderness", "Tingling", "Tightness", "None"];
  if (s.includes("laser") || s.includes("ipl")) return ["Redness", "Peeling", "Blistering", "Darkening", "Itching", "Sensitivity", "None"];
  if (s.includes("kybella")) return ["Swelling", "Numbness", "Bruising", "Hardness", "Tenderness", "Difficulty swallowing", "None"];
  if (s.includes("lip") || s.includes("filler")) return ["Swelling", "Bruising", "Asymmetry", "Lumps/bumps", "Tenderness", "Tightness", "None"];
  return DEFAULT_SYMPTOMS;
}

function getPhotoInstructions(serviceName = "") {
  const s = serviceName.toLowerCase();
  if (s.includes("botox") || s.includes("dysport") || s.includes("xeomin")) return ["Relaxed face — neutral expression", "Raise eyebrows as high as possible", "Frown (furrow your brow)"];
  if (s.includes("filler") || s.includes("juvederm") || s.includes("restylane") || s.includes("sculptra")) return ["Front view — neutral, well-lit", "45° left side", "45° right side"];
  if (s.includes("lip")) return ["Lips relaxed — front view", "Smiling", "Profile view"];
  return ["Front view — clear, well-lit selfie"];
}

// Comfort scale with big emoji cards
const COMFORT_OPTIONS = [
  { val: 1, emoji: "😣", label: "Ouch" },
  { val: 2, emoji: "😕", label: "Sore" },
  { val: 3, emoji: "😐", label: "Ok" },
  { val: 4, emoji: "🙂", label: "Good" },
  { val: 5, emoji: "😄", label: "Great" },
];

const SWELLING_OPTIONS = [
  { val: 0, emoji: "✨", label: "None" },
  { val: 1, emoji: "🌱", label: "Barely" },
  { val: 2, emoji: "💧", label: "A little" },
  { val: 3, emoji: "💦", label: "Moderate" },
  { val: 4, emoji: "🌊", label: "Noticeable" },
  { val: 5, emoji: "🫧", label: "A lot" },
];

const BRUISING_OPTIONS = [
  { val: 0, emoji: "✨", label: "None" },
  { val: 1, emoji: "🟣", label: "Tiny spot" },
  { val: 2, emoji: "💜", label: "Small" },
  { val: 3, emoji: "🫐", label: "Moderate" },
  { val: 4, emoji: "🍇", label: "Visible" },
  { val: 5, emoji: "🟤", label: "Significant" },
];

function EmojiScale({ options, value, onChange, question, subtitle }) {
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="text-center px-4">
        <p className="text-xl font-bold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>{question}</p>
        {subtitle && <p className="text-sm mt-1.5" style={{ color: "rgba(30,37,53,0.5)" }}>{subtitle}</p>}
      </div>
      <div className="flex gap-3 flex-wrap justify-center">
        {options.map(opt => (
          <button key={opt.val} onClick={() => onChange(opt.val)}
            className="flex flex-col items-center gap-1.5 p-4 rounded-2xl transition-all"
            style={{
              background: value === opt.val ? "linear-gradient(135deg, rgba(123,142,200,0.15), rgba(45,107,127,0.1))" : "rgba(30,37,53,0.04)",
              border: value === opt.val ? "2px solid rgba(123,142,200,0.5)" : "2px solid transparent",
              transform: value === opt.val ? "scale(1.08)" : "scale(1)",
              minWidth: 72,
            }}>
            <span style={{ fontSize: 32 }}>{opt.emoji}</span>
            <span className="text-xs font-semibold" style={{ color: value === opt.val ? "#4a5fa8" : "rgba(30,37,53,0.45)" }}>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SymptomPicker({ symptoms, selected, onToggle }) {
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="text-center px-4">
        <p className="text-xl font-bold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>How does it feel today?</p>
        <p className="text-sm mt-1.5" style={{ color: "rgba(30,37,53,0.5)" }}>Tap everything that applies — or tap "None"</p>
      </div>
      <div className="flex flex-wrap gap-2.5 justify-center px-2">
        {symptoms.map(s => (
          <button key={s} onClick={() => onToggle(s)}
            className="px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all"
            style={{
              background: selected.includes(s) ? "rgba(123,142,200,0.18)" : "rgba(30,37,53,0.05)",
              border: selected.includes(s) ? "2px solid rgba(123,142,200,0.5)" : "2px solid transparent",
              color: selected.includes(s) ? "#4a5fa8" : "rgba(30,37,53,0.6)",
              transform: selected.includes(s) ? "scale(1.04)" : "scale(1)",
            }}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function PhotoStep({ photoUrl, uploading, onUpload, photoInstructions }) {
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="text-center px-4">
        <p className="text-xl font-bold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>Snap today's photo 📸</p>
        <p className="text-sm mt-1.5" style={{ color: "rgba(30,37,53,0.5)" }}>NOVI uses this to track your visual recovery over time</p>
      </div>
      {photoInstructions.length > 1 && (
        <div className="w-full px-2 space-y-1.5">
          {photoInstructions.map((inst, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(123,142,200,0.07)" }}>
              <span className="text-sm">📍</span>
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.65)" }}>{inst}</p>
            </div>
          ))}
        </div>
      )}
      <label className="cursor-pointer w-full px-2">
        <div className="relative rounded-3xl overflow-hidden flex items-center justify-center"
          style={{ minHeight: 180, background: photoUrl ? "transparent" : "rgba(123,142,200,0.07)", border: photoUrl ? "none" : "2.5px dashed rgba(123,142,200,0.3)" }}>
          {photoUrl ? (
            <img src={photoUrl} alt="check-in" className="w-full max-h-64 object-cover rounded-3xl" />
          ) : (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(123,142,200,0.12)" }}>
                <Camera className="w-8 h-8" style={{ color: "#7B8EC8" }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: "rgba(30,37,53,0.5)" }}>{uploading ? "Uploading…" : "Tap to add photo"}</p>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-3xl" style={{ background: "rgba(255,255,255,0.85)" }}>
              <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
            </div>
          )}
          {photoUrl && (
            <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: "rgba(30,37,53,0.7)", color: "white" }}>
              ✓ Uploaded
            </div>
          )}
        </div>
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onUpload} />
      </label>
      <p className="text-xs text-center px-6" style={{ color: "rgba(30,37,53,0.35)" }}>
        Photos stay private and are only visible to you and your provider
      </p>
    </div>
  );
}

function NotesStep({ value, onChange }) {
  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="text-center px-4">
        <p className="text-xl font-bold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>Anything else on your mind?</p>
        <p className="text-sm mt-1.5" style={{ color: "rgba(30,37,53,0.5)" }}>Optional — NOVI reads every word 💛</p>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="e.g. 'The swelling went down a lot today' or 'Feeling nervous about asymmetry'…"
        rows={5}
        autoFocus
        className="w-full rounded-2xl px-4 py-4 text-sm resize-none outline-none leading-relaxed"
        style={{ background: "rgba(30,37,53,0.04)", border: "1.5px solid rgba(123,142,200,0.2)", color: "#1e2535", fontFamily: "'DM Sans', sans-serif" }}
      />
    </div>
  );
}

function AnalyzingScreen() {
  const [phase, setPhase] = useState(0);
  const messages = [
    "Reading your check-in…",
    "Comparing to your recovery history…",
    "Reviewing your NOVI scan data…",
    "Personalizing your insights…",
  ];
  useEffect(() => {
    const t = setInterval(() => setPhase(p => (p + 1) % messages.length), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(123,142,200,0.2)" }} />
        <div className="relative w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(123,142,200,0.2), rgba(45,107,127,0.15))", border: "1.5px solid rgba(123,142,200,0.3)" }}>
          <Sparkles className="w-8 h-8" style={{ color: "#7B8EC8" }} />
        </div>
      </div>
      <div className="text-center">
        <p className="font-bold text-lg" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>NOVI is reviewing your data</p>
        <p className="text-sm mt-2 transition-all" style={{ color: "rgba(30,37,53,0.5)" }}>{messages[phase]}</p>
      </div>
    </div>
  );
}

function ResultCard({ checkin, aiRecommendations, aftercarePlan, latestAppt, escalated, onViewHistory, navigate }) {
  const stageEmoji = { "Fully Recovered": "🏆", "Near Complete": "🌟", "Settling In": "✨", "Active Recovery": "💪", "Peak Swelling": "🧊", "Early Healing": "🌱" }[checkin.ai_recovery_stage] || "✨";

  return (
    <div className="space-y-4 py-2">
      {/* Hero celebrate */}
      <div className="rounded-3xl overflow-hidden" style={{ background: "linear-gradient(135deg, #3d4a6b, #4a5878)" }}>
        <div className="p-6 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <p className="text-white font-bold text-xl" style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>Day {checkin.day_number} complete!</p>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>{format(new Date(), "EEEE, MMMM d")} · check-in submitted</p>
        </div>

        {/* Recovery score */}
        {checkin.ai_texture_score != null && (
          <div className="mx-4 mb-4 p-4 rounded-2xl flex items-center justify-between" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em" }}>Recovery Score</p>
              <div className="flex items-baseline gap-1 mt-1">
                <p className="text-4xl font-black text-white" style={{ fontFamily: "'DM Serif Display', serif" }}>{Math.round(checkin.ai_texture_score)}%</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-3xl">{stageEmoji}</span>
              <p className="text-xs mt-1 font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>{checkin.ai_recovery_stage}</p>
            </div>
          </div>
        )}
      </div>

      {/* NOVI's message */}
      {checkin.ai_feedback && (
        <div className="p-5 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(123,142,200,0.15)" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(123,142,200,0.2), rgba(45,107,127,0.15))" }}>
              <span className="text-xs">✦</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7B8EC8", letterSpacing: "0.12em" }}>From NOVI</p>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.8)" }}>{checkin.ai_feedback}</p>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Comfort", val: checkin.comfort_level, max: 5, color: "#4a6b10", bg: "rgba(180,210,100,0.1)" },
          { label: "Swelling", val: checkin.swelling_level, max: 5, color: "#FA6F30", bg: "rgba(250,111,48,0.07)" },
          { label: "Bruising", val: checkin.bruising_level, max: 5, color: "#DA6A63", bg: "rgba(218,106,99,0.07)" },
        ].map(m => (
          <div key={m.label} className="p-3.5 rounded-2xl text-center" style={{ background: m.bg }}>
            <p className="text-2xl font-black" style={{ color: m.color, fontFamily: "'DM Serif Display', serif", lineHeight: 1 }}>{m.val}</p>
            <p className="text-xs opacity-50 mb-0.5">/5</p>
            <p className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.5)" }}>{m.label}</p>
          </div>
        ))}
      </div>

      {/* Escalation alert */}
      {escalated && (
        <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: "rgba(218,106,99,0.07)", border: "1px solid rgba(218,106,99,0.25)" }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#DA6A63" }} />
          <div>
            <p className="text-sm font-bold" style={{ color: "#1e2535" }}>Your provider has been notified</p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>Some symptoms today are outside the typical recovery range. Your medical director has been alerted and will follow up.</p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {aiRecommendations?.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest px-1" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.12em" }}>Recommended for you right now</p>
          {aiRecommendations.map((rec, i) => (
            <div key={i} className="p-4 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(123,142,200,0.12)" }}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: rec.type === "product" ? "rgba(180,210,100,0.12)" : "rgba(123,142,200,0.1)" }}>
                  {rec.type === "product" ? <Package className="w-4 h-4" style={{ color: "#5a7a20" }} /> : <Calendar className="w-4 h-4" style={{ color: "#4a5fa8" }} />}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm" style={{ color: "#1e2535" }}>{rec.item_name}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(30,37,53,0.55)" }}>{rec.reasoning}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {rec.type === "treatment" && (
                  <button onClick={() => navigate(createPageUrl("PatientMarketplace"))}
                    className="flex-1 text-sm px-3 py-2 rounded-xl font-bold flex items-center justify-center gap-1.5"
                    style={{ background: "linear-gradient(135deg, #5a6a9a, #3d5070)", color: "#fff" }}>
                    <ArrowRight className="w-3.5 h-3.5" /> Book Now
                  </button>
                )}
                <button onClick={() => navigate(createPageUrl("PatientAppointments"))}
                  className="px-3 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(123,142,200,0.08)", color: "#4a5fa8", border: "1px solid rgba(123,142,200,0.15)" }}>
                  💬 Ask Provider
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View history */}
      <button onClick={onViewHistory}
        className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
        style={{ background: "rgba(30,37,53,0.05)", color: "rgba(30,37,53,0.5)" }}>
        <Clock className="w-4 h-4" /> View check-in history
      </button>
    </div>
  );
}

function HistoryItem({ checkin }) {
  const [open, setOpen] = useState(false);
  const stageEmoji = { "Fully Recovered": "🏆", "Near Complete": "🌟", "Settling In": "✨", "Active Recovery": "💪", "Peak Swelling": "🧊", "Early Healing": "🌱" }[checkin.ai_recovery_stage] || "✦";
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(30,37,53,0.08)" }}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: "linear-gradient(135deg, rgba(123,142,200,0.15), rgba(45,107,127,0.1))" }}>
            D{checkin.day_number}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{format(parseISO(checkin.date), "MMM d, yyyy")}</p>
            <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>{checkin.ai_recovery_stage || "Check-in"} {stageEmoji}</p>
          </div>
        </div>
        {checkin.ai_texture_score != null && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: "#4a6b10" }}>{Math.round(checkin.ai_texture_score)}%</span>
            <ChevronRight className="w-4 h-4" style={{ color: "rgba(30,37,53,0.25)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
          </div>
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "rgba(30,37,53,0.06)" }}>
          {checkin.photo_url && (
            <img src={checkin.photo_url} alt="check-in" className="w-full max-h-44 object-cover rounded-2xl mt-3" />
          )}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Comfort", val: checkin.comfort_level, color: "#4a6b10", bg: "rgba(180,210,100,0.1)" },
              { label: "Swelling", val: checkin.swelling_level, color: "#FA6F30", bg: "rgba(250,111,48,0.07)" },
              { label: "Bruising", val: checkin.bruising_level, color: "#DA6A63", bg: "rgba(218,106,99,0.07)" },
            ].map(m => (
              <div key={m.label} className="text-center rounded-xl p-2.5" style={{ background: m.bg }}>
                <p className="text-lg font-bold" style={{ color: m.color }}>{m.val ?? "—"}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>{m.label}</p>
              </div>
            ))}
          </div>
          {checkin.ai_feedback && (
            <div className="rounded-xl p-3 text-sm leading-relaxed" style={{ background: "rgba(123,142,200,0.07)", border: "1px solid rgba(123,142,200,0.12)", color: "rgba(30,37,53,0.75)" }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#7B8EC8" }}>NOVI's Notes</p>
              {checkin.ai_feedback}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DailyCheckIn({ journey, appointments }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // view states: "summary" | "wizard" | "analyzing" | "result" | "history"
  const [view, setView] = useState("summary");
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [resultCheckin, setResultCheckin] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    treatment_id: "",
    comfort_level: 3,
    swelling_level: 1,
    bruising_level: 0,
    symptoms: [],
    notes: "",
    photo_url: "",
    custom_answers: {},
  });

  const checkins = journey?.daily_checkins || [];
  const completedAppts = (appointments || []).filter(a => a.status === "completed");
  const latestAppt = completedAppts[0];
  const today = new Date().toISOString().split("T")[0];
  const checkedInToday = checkins.some(c => c.date === today);
  const selectedAppt = completedAppts.find(a => a.id === form.treatment_id) || completedAppts[0];
  const streak = checkins.length;
  const latest = checkins[checkins.length - 1];
  const prev = checkins[checkins.length - 2];
  const recoveryDelta = latest?.ai_texture_score != null && prev?.ai_texture_score != null
    ? Math.round(latest.ai_texture_score - prev.ai_texture_score) : null;

  const { data: aftercarePlan } = useQuery({
    queryKey: ["aftercare-plan-patient", latestAppt?.treatment_record_id],
    queryFn: async () => {
      if (!latestAppt?.treatment_record_id) return null;
      const plans = await base44.entities.AftercarePlan.filter({ treatment_record_id: latestAppt.treatment_record_id });
      if (plans[0]?.status === "sent" && !plans[0]?.viewed_at) {
        await base44.entities.AftercarePlan.update(plans[0].id, { viewed_at: new Date().toISOString(), status: "viewed" });
      }
      return plans[0];
    },
    enabled: !!latestAppt?.treatment_record_id,
  });

  const getDayNumber = (appt) => {
    if (!appt?.completed_at && !appt?.appointment_date) return 1;
    const d = appt.completed_at ? parseISO(appt.completed_at) : parseISO(appt.appointment_date);
    return Math.max(1, differenceInDays(new Date(), d) + 1);
  };

  const toggleSymptom = (s) => {
    setForm(f => ({
      ...f,
      symptoms: s === "None" ? ["None"] : f.symptoms.filter(x => x !== "None").includes(s)
        ? f.symptoms.filter(x => x !== s)
        : [...f.symptoms.filter(x => x !== "None"), s]
    }));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, photo_url: file_url }));
    setUploading(false);
  };

  // Build wizard steps dynamically
  const buildSteps = () => {
    const steps = [
      { id: "comfort", type: "emoji_scale" },
      { id: "swelling", type: "emoji_scale" },
      { id: "bruising", type: "emoji_scale" },
      { id: "symptoms", type: "symptoms" },
    ];
    // Custom provider questions
    if (aftercarePlan?.checkin_questions?.length > 0) {
      aftercarePlan.checkin_questions.forEach(q => steps.push({ id: q.id, type: "custom_question", question: q }));
    }
    steps.push({ id: "photo", type: "photo" });
    steps.push({ id: "notes", type: "notes" });
    return steps;
  };

  const wizardSteps = buildSteps();
  const currentWizardStep = wizardSteps[step];
  const progress = ((step) / wizardSteps.length) * 100;

  const canAdvance = () => {
    if (!currentWizardStep) return false;
    if (currentWizardStep.type === "photo") return !!form.photo_url && !uploading;
    return true;
  };

  const handleSubmit = async () => {
    setView("analyzing");
    const appt = completedAppts.find(a => a.id === form.treatment_id) || completedAppts[0];
    const dayNum = getDayNumber(appt);
    const latestScan = journey?.scans?.[journey.scans.length - 1];
    let aiFeedback = "";
    let aiTextureScore = null;
    let aiRecoveryStage = "";
    let newCheckin_visualFindings = null;
    let providerProductRecs = [];

    const customQASummary = aftercarePlan?.checkin_questions?.length > 0
      ? aftercarePlan.checkin_questions.map(q => {
          const answer = form.custom_answers[q.id];
          return `- ${q.question}: ${Array.isArray(answer) ? answer.join(", ") : (answer ?? "not answered")}`;
        }).join("\n") : "";

    const hasPhoto = !!form.photo_url;
    const prompt = `You are Novi, a warm and knowledgeable aesthetic recovery guide. A premium patient just checked in on Day ${dayNum} post-treatment for "${appt?.service || "aesthetic treatment"}".

Recovery day: ${dayNum}
Comfort level: ${form.comfort_level}/5
Swelling: ${form.swelling_level}/5
Bruising: ${form.bruising_level}/5
Symptoms: ${form.symptoms.join(", ") || "none reported"}
Notes: "${form.notes || "none"}"
${customQASummary}
${latestScan?.ai_analysis ? `Baseline skin concerns: ${JSON.stringify(latestScan.ai_analysis.detected_concerns)}` : ""}
${hasPhoto ? "Patient submitted a photo for visual assessment." : ""}

${hasPhoto ? `Examine the photo for: swelling location/severity, bruising color and stage, skin texture changes, asymmetry. Be specific about what you see.` : ""}

Return:
- ai_feedback: 2-3 warm, personal, encouraging sentences. Address them like a supportive friend who knows their treatment. Reference the treatment by name. ${hasPhoto ? "Reference what you observed in their photo." : ""}
- ai_texture_score: 0-100 recovery score for Day ${dayNum} of "${appt?.service}"
- ai_recovery_stage: one of "Early Healing", "Peak Swelling", "Active Recovery", "Settling In", "Near Complete", "Fully Recovered"
${hasPhoto ? `- visual_findings: {swelling_visible, bruising_color, texture_notes, overall_visual_stage, photo_matches_reported}` : ""}`;

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: form.photo_url ? [form.photo_url] : undefined,
        response_json_schema: {
          type: "object",
          properties: {
            ai_feedback: { type: "string" },
            ai_texture_score: { type: "number" },
            ai_recovery_stage: { type: "string" },
            visual_findings: { type: "object", properties: { swelling_visible: { type: "boolean" }, bruising_color: { type: "string" }, texture_notes: { type: "string" }, overall_visual_stage: { type: "string" }, photo_matches_reported: { type: "boolean" } } }
          }
        }
      });
      aiFeedback = res.ai_feedback || "";
      aiTextureScore = res.ai_texture_score ?? null;
      aiRecoveryStage = res.ai_recovery_stage || "";
      if (res.visual_findings) newCheckin_visualFindings = res.visual_findings;
    } catch {
      aiFeedback = "You're doing great — keep showing up for yourself. Recovery is a journey, and NOVI is with you every step of the way.";
      aiRecoveryStage = "Active Recovery";
    }

    // Provider recommendations
    try {
      const allPriorCheckins = checkins.slice(-5);
      const provRec = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a clinical aesthetic advisor. Provider-facing recommendations for patient on Day ${dayNum} post "${appt?.service}". Comfort: ${form.comfort_level}/5, Swelling: ${form.swelling_level}/5, Bruising: ${form.bruising_level}/5. Stage: ${aiRecoveryStage}. ${allPriorCheckins.length > 1 ? `Trend: ${allPriorCheckins.map(c => `D${c.day_number}: comfort ${c.comfort_level}, swelling ${c.swelling_level}`).join(", ")}` : ""}. Generate 2-3 specific product/treatment recommendations for the provider.`,
        response_json_schema: { type: "object", properties: { provider_recommendations: { type: "array", items: { type: "object", properties: { category: { type: "string" }, item: { type: "string" }, rationale: { type: "string" } } } } } }
      });
      providerProductRecs = provRec.provider_recommendations || [];
    } catch { /* non-fatal */ }

    const newCheckin = {
      date: today,
      day_number: dayNum,
      treatment_id: appt?.id || "",
      treatment_name: appt?.service || "Treatment",
      provider_name: appt?.provider_name || "",
      photo_url: form.photo_url,
      symptoms: form.symptoms,
      comfort_level: form.comfort_level,
      swelling_level: form.swelling_level,
      bruising_level: form.bruising_level,
      notes: form.notes,
      custom_answers: form.custom_answers,
      ai_feedback: aiFeedback,
      ai_texture_score: aiTextureScore,
      ai_recovery_stage: aiRecoveryStage,
      visual_findings: newCheckin_visualFindings,
    };

    const updatedCheckins = [...checkins, newCheckin];
    await base44.entities.PatientJourney.update(journey.id, { daily_checkins: updatedCheckins });

    if (appt?.treatment_record_id) {
      try {
        const tr = await base44.entities.TreatmentRecord.get(appt.treatment_record_id);
        await base44.entities.TreatmentRecord.update(appt.treatment_record_id, {
          patient_checkins: [...(tr.patient_checkins || []), { ...newCheckin, patient_id: journey.patient_id, patient_name: appt.patient_name, submitted_at: new Date().toISOString(), provider_recommendations: providerProductRecs }],
          last_checkin_date: today,
          last_checkin_stage: aiRecoveryStage
        });
      } catch { /* non-fatal */ }
    }

    qc.invalidateQueries(["patient-journey"]);

    // Patient-facing recommendations
    try {
      const recRes = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Novi. Patient on Day ${dayNum} post "${appt?.service}". Comfort: ${form.comfort_level}/5, Swelling: ${form.swelling_level}/5. Recovery stage: ${aiRecoveryStage}. ${aftercarePlan?.recommended_products?.length > 0 ? `Provider's products: ${aftercarePlan.recommended_products.map(p => p.product_name).join(", ")}` : ""}. Recommend 2-3 specific products or treatments by real brand name, in patient-friendly language.`,
        response_json_schema: { type: "object", properties: { recommendations: { type: "array", items: { type: "object", properties: { type: { type: "string", enum: ["product", "treatment"] }, item_name: { type: "string" }, reasoning: { type: "string" } } } } } }
      });
      setAiRecommendations(recRes.recommendations || []);
    } catch { /* non-fatal */ }

    try {
      const escRes = await base44.functions.invoke("patientCheckinEscalation", { journey_id: journey.id, checkin: newCheckin });
      if (escRes.data?.escalated) setEscalated(true);
    } catch { /* non-fatal */ }

    setResultCheckin(newCheckin);
    setView("result");
  };

  // ── SUMMARY VIEW (before starting) ──
  if (view === "summary") {
    if (checkedInToday && !resultCheckin) {
      // Already checked in today — show today's result
      const todayCheckin = checkins.find(c => c.date === today);
      return (
        <div className="space-y-4">
          <ResultCard
            checkin={todayCheckin}
            aiRecommendations={aiRecommendations}
            aftercarePlan={aftercarePlan}
            latestAppt={latestAppt}
            escalated={escalated}
            onViewHistory={() => setView("history")}
            navigate={navigate}
          />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Streak + progress card */}
        {checkins.length > 0 && latest && (
          <div className="rounded-3xl overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(180,210,100,0.12), rgba(123,142,200,0.08))", border: "1.5px solid rgba(180,210,100,0.3)" }}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                    style={{ background: "rgba(180,210,100,0.18)" }}>
                    {streak >= 3 ? "🔥" : "🌱"}
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: "#1e2535" }}>{streak}-day streak</p>
                    <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>Day {latest.day_number} post-treatment</p>
                  </div>
                </div>
                {latest.ai_recovery_stage && (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "rgba(180,210,100,0.2)", color: "#4a6020", border: "1px solid rgba(180,210,100,0.35)" }}>
                    {latest.ai_recovery_stage}
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {latest.ai_texture_score != null && (
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>Recovery progress</p>
                    <div className="flex items-baseline gap-1.5">
                      {recoveryDelta != null && (
                        <span className="text-xs font-bold" style={{ color: recoveryDelta >= 0 ? "#4a6b10" : "#DA6A63" }}>
                          {recoveryDelta >= 0 ? "▲" : "▼"}{Math.abs(recoveryDelta)}% today
                        </span>
                      )}
                      <span className="text-2xl font-black" style={{ color: "#4a6b10", fontFamily: "'DM Serif Display', serif" }}>{Math.round(latest.ai_texture_score)}%</span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(30,37,53,0.08)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${latest.ai_texture_score}%`, background: "linear-gradient(90deg, #7B8EC8, #b8d060)" }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Check In CTA */}
        {completedAppts.length > 0 && (
          <button onClick={() => { setView("wizard"); setStep(0); }}
            className="w-full py-5 rounded-3xl font-bold text-base flex items-center justify-center gap-3 transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #4a5878, #3d4a6b)", color: "white", boxShadow: "0 8px 24px rgba(61,74,107,0.3)" }}>
            <Sparkles className="w-5 h-5" />
            Check In for Today
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* History button */}
        {checkins.length > 0 && (
          <button onClick={() => setView("history")}
            className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: "rgba(30,37,53,0.05)", color: "rgba(30,37,53,0.5)" }}>
            <Clock className="w-4 h-4" /> View {checkins.length} past check-in{checkins.length !== 1 ? "s" : ""}
          </button>
        )}
      </div>
    );
  }

  // ── WIZARD VIEW ──
  if (view === "wizard") {
    return (
      <div>
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => step === 0 ? setView("summary") : setStep(s => s - 1)}
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(30,37,53,0.06)" }}>
              <ChevronLeft className="w-4 h-4" style={{ color: "rgba(30,37,53,0.5)" }} />
            </button>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(30,37,53,0.08)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #7B8EC8, #b8d060)" }} />
            </div>
            <span className="text-xs font-semibold flex-shrink-0" style={{ color: "rgba(30,37,53,0.35)" }}>{step + 1}/{wizardSteps.length}</span>
          </div>
        </div>

        {/* Step content */}
        <div className="min-h-72">
          {currentWizardStep?.type === "emoji_scale" && currentWizardStep.id === "comfort" && (
            <EmojiScale
              options={COMFORT_OPTIONS}
              value={form.comfort_level}
              onChange={v => setForm(f => ({ ...f, comfort_level: v }))}
              question="How are you feeling today?"
              subtitle="Overall comfort since your treatment"
            />
          )}
          {currentWizardStep?.type === "emoji_scale" && currentWizardStep.id === "swelling" && (
            <EmojiScale
              options={SWELLING_OPTIONS}
              value={form.swelling_level}
              onChange={v => setForm(f => ({ ...f, swelling_level: v }))}
              question="Any swelling?"
              subtitle="Around the treated area"
            />
          )}
          {currentWizardStep?.type === "emoji_scale" && currentWizardStep.id === "bruising" && (
            <EmojiScale
              options={BRUISING_OPTIONS}
              value={form.bruising_level}
              onChange={v => setForm(f => ({ ...f, bruising_level: v }))}
              question="Any bruising?"
              subtitle="Visible discoloration or marks"
            />
          )}
          {currentWizardStep?.type === "symptoms" && (
            <SymptomPicker
              symptoms={getSymptomsForService(selectedAppt?.service)}
              selected={form.symptoms}
              onToggle={toggleSymptom}
            />
          )}
          {currentWizardStep?.type === "custom_question" && (() => {
            const q = currentWizardStep.question;
            return (
              <div className="flex flex-col gap-5 py-4">
                <div className="text-center px-4">
                  <p className="text-xl font-bold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>{q.question}</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.4)" }}>From your provider</p>
                </div>
                {q.type === "boolean" && (
                  <div className="flex gap-3 px-4">
                    {["Yes", "No"].map(opt => (
                      <button key={opt} onClick={() => setForm(f => ({ ...f, custom_answers: { ...f.custom_answers, [q.id]: opt } }))}
                        className="flex-1 py-4 rounded-2xl text-base font-bold transition-all"
                        style={{
                          background: form.custom_answers[q.id] === opt ? "rgba(123,142,200,0.15)" : "rgba(30,37,53,0.04)",
                          border: form.custom_answers[q.id] === opt ? "2px solid rgba(123,142,200,0.5)" : "2px solid transparent",
                          color: form.custom_answers[q.id] === opt ? "#4a5fa8" : "rgba(30,37,53,0.5)"
                        }}>
                        {opt === "Yes" ? "👍 Yes" : "👎 No"}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === "scale" && (
                  <div className="px-4">
                    <EmojiScale
                      options={Array.from({ length: 6 }, (_, i) => ({ val: i, emoji: ["😐","🙁","😕","😐","🙂","😊"][i], label: i === 0 ? (q.scale_low_label || "None") : i === 5 ? (q.scale_high_label || "Max") : String(i) }))}
                      value={form.custom_answers[q.id] ?? 0}
                      onChange={v => setForm(f => ({ ...f, custom_answers: { ...f.custom_answers, [q.id]: v } }))}
                      question=""
                    />
                  </div>
                )}
                {(q.type === "text" || q.type === "multi_select") && (
                  <div className="px-4">
                    {q.type === "multi_select" ? (
                      <div className="flex flex-wrap gap-2.5 justify-center">
                        {(q.options || []).map(opt => {
                          const selected = (form.custom_answers[q.id] || []).includes(opt);
                          return (
                            <button key={opt} onClick={() => {
                              const prev = form.custom_answers[q.id] || [];
                              setForm(f => ({ ...f, custom_answers: { ...f.custom_answers, [q.id]: selected ? prev.filter(x => x !== opt) : [...prev, opt] } }));
                            }}
                              className="px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all"
                              style={{ background: selected ? "rgba(123,142,200,0.18)" : "rgba(30,37,53,0.05)", border: selected ? "2px solid rgba(123,142,200,0.5)" : "2px solid transparent", color: selected ? "#4a5fa8" : "rgba(30,37,53,0.6)" }}>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <textarea value={form.custom_answers[q.id] || ""} onChange={e => setForm(f => ({ ...f, custom_answers: { ...f.custom_answers, [q.id]: e.target.value } }))}
                        rows={4} placeholder="Your answer…" autoFocus
                        className="w-full rounded-2xl px-4 py-3 text-sm resize-none outline-none"
                        style={{ background: "rgba(30,37,53,0.04)", border: "1.5px solid rgba(123,142,200,0.2)", color: "#1e2535" }} />
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          {currentWizardStep?.type === "photo" && (
            <PhotoStep
              photoUrl={form.photo_url}
              uploading={uploading}
              onUpload={handlePhotoUpload}
              photoInstructions={getPhotoInstructions(selectedAppt?.service)}
            />
          )}
          {currentWizardStep?.type === "notes" && (
            <NotesStep value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} />
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-4">
          {step < wizardSteps.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance()}
              className="flex-1 py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #4a5878, #3d4a6b)", color: "white" }}>
              Continue <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canAdvance()}
              className="flex-1 py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #4a5878, #3d4a6b)", color: "white" }}>
              <Sparkles className="w-5 h-5" /> Submit to NOVI
            </button>
          )}
        </div>

        {/* Skip for notes */}
        {currentWizardStep?.type === "notes" && (
          <button onClick={handleSubmit} className="w-full py-2 text-sm font-semibold mt-2" style={{ color: "rgba(30,37,53,0.35)" }}>
            Skip notes & submit
          </button>
        )}
      </div>
    );
  }

  // ── ANALYZING ──
  if (view === "analyzing") return <AnalyzingScreen />;

  // ── RESULT ──
  if (view === "result" && resultCheckin) {
    return (
      <ResultCard
        checkin={resultCheckin}
        aiRecommendations={aiRecommendations}
        aftercarePlan={aftercarePlan}
        latestAppt={latestAppt}
        escalated={escalated}
        onViewHistory={() => setView("history")}
        navigate={navigate}
      />
    );
  }

  // ── HISTORY ──
  if (view === "history") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <p className="font-bold" style={{ color: "#1e2535" }}>Check-in History</p>
          <button onClick={() => setView("summary")} className="text-sm font-semibold" style={{ color: "#7B8EC8" }}>← Back</button>
        </div>
        {[...checkins].reverse().map((c, i) => <HistoryItem key={i} checkin={c} />)}
      </div>
    );
  }

  return null;
}