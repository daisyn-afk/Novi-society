import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  X, Sparkles, Calendar, FileText, AlertTriangle, Send, Bell,
  Heart, Activity, ChevronRight, Zap,
  TrendingUp, CheckCircle, Loader2, ShieldAlert, Droplets,
  Moon, Apple, Dumbbell, Brain, Package, Clock
} from "lucide-react";
import { format } from "date-fns";
import TreatmentDocumentDialog from "@/components/practice/TreatmentDocumentDialog.jsx";
import PatientAIInsightsTab from "@/components/provider/PatientAIInsightsTab";

const STATUS_COLOR = {
  requested: { bg: "rgba(251,191,36,0.15)", text: "#a07800" },
  confirmed: { bg: "rgba(96,165,250,0.15)", text: "#2563eb" },
  completed: { bg: "rgba(34,197,94,0.12)", text: "#16a34a" },
  cancelled: { bg: "rgba(248,113,113,0.12)", text: "#dc2626" },
  no_show: { bg: "rgba(30,37,53,0.06)", text: "rgba(30,37,53,0.4)" },
};

const RECORD_STATUS = {
  draft: { label: "Draft", bg: "rgba(30,37,53,0.06)", text: "rgba(30,37,53,0.45)" },
  submitted: { label: "Pending Review", bg: "rgba(251,191,36,0.15)", text: "#a07800" },
  approved: { label: "Approved", bg: "rgba(34,197,94,0.12)", text: "#16a34a" },
  flagged: { label: "Flagged", bg: "rgba(248,113,113,0.12)", text: "#dc2626" },
  changes_requested: { label: "Changes Requested", bg: "rgba(250,111,48,0.12)", text: "#c2440a" },
};

function SectionTitle({ children, color = "rgba(30,37,53,0.4)" }) {
  return <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color }}>{children}</p>;
}

function GlassInner({ children, className = "", style = {} }) {
  return (
    <div className={`rounded-2xl p-4 ${className}`} style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.85)", ...style }}>
      {children}
    </div>
  );
}

const URGENCY_STYLE = {
  essential: { bg: "rgba(218,106,99,0.12)", color: "#DA6A63", label: "Essential" },
  recommended: { bg: "rgba(250,111,48,0.12)", color: "#FA6F30", label: "Recommended" },
  optional: { bg: "rgba(123,142,200,0.1)", color: "#7B8EC8", label: "Optional" },
};

const PRICE_COLOR = { "$": "#16a34a", "$$": "#FA6F30", "$$$": "#DA6A63" };

const TIMELINE_COLORS = ["#7B8EC8", "#FA6F30", "#C8E63C", "#DA6A63", "#2D6B7F"];

function AftercarePlanView({ plan, treatment, sentAftercare, isPending, onSend }) {
  if (plan?.error) return <p className="text-sm text-red-500 p-4">{plan.error}</p>;

  return (
    <div className="space-y-4">
      {/* Header + Send */}
      <div className="rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: "linear-gradient(135deg, rgba(200,230,60,0.12), rgba(123,142,200,0.1))", border: "1px solid rgba(200,230,60,0.4)" }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: "#4a6b10" }}>NOVI Aftercare Plan</p>
          <p className="font-bold text-sm" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>{treatment?.service}</p>
        </div>
        <Button size="sm" disabled={sentAftercare || isPending} onClick={onSend}
          style={{ background: sentAftercare ? "rgba(200,230,60,0.15)" : "#C8E63C", color: sentAftercare ? "#4a6b10" : "#1a2a00", border: "none" }}
          className="text-xs font-bold gap-1.5 h-8 flex-shrink-0">
          <Send className="w-3 h-3" />{sentAftercare ? "Sent to Patient ✓" : "Send to Patient"}
        </Button>
      </div>

      {/* Personal note */}
      {plan.personal_note && (
        <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.85)" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "rgba(30,37,53,0.4)" }}>Personal Note</p>
          <p className="text-sm leading-relaxed italic" style={{ color: "#1e2535" }}>{plan.personal_note}</p>
        </div>
      )}

      {/* Recovery Timeline */}
      {plan.results_timeline?.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.85)" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Recovery Timeline</p>
          <div className="space-y-3">
            {plan.results_timeline.map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: TIMELINE_COLORS[i % TIMELINE_COLORS.length] }}>
                    {i + 1}
                  </div>
                  {i < plan.results_timeline.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: "rgba(30,37,53,0.1)", minHeight: 16 }} />}
                </div>
                <div className="pb-3 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${TIMELINE_COLORS[i % TIMELINE_COLORS.length]}18`, color: TIMELINE_COLORS[i % TIMELINE_COLORS.length] }}>{step.day}</span>
                    <p className="text-sm font-bold" style={{ color: "#1e2535" }}>{step.title}</p>
                  </div>
                  <p className="text-xs leading-relaxed mb-1" style={{ color: "rgba(30,37,53,0.65)" }}>{step.description}</p>
                  {step.what_you_may_feel && (
                    <p className="text-xs mb-1" style={{ color: "rgba(30,37,53,0.5)" }}><strong style={{ color: "#7B8EC8" }}>Feel:</strong> {step.what_you_may_feel}</p>
                  )}
                  {step.action && (
                    <div className="flex items-start gap-1.5 mt-1">
                      <Zap className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "#FA6F30" }} />
                      <p className="text-xs font-semibold" style={{ color: "#FA6F30" }}>{step.action}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Do / Avoid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {plan.do_list?.length > 0 && (
          <div className="rounded-2xl p-4" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.3)" }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: "#4a6b10" }}>✓ Do This</p>
            <ul className="space-y-1.5">
              {plan.do_list.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#C8E63C" }} />
                  <span className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.7)" }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {plan.avoid_list?.length > 0 && (
          <div className="rounded-2xl p-4" style={{ background: "rgba(218,106,99,0.06)", border: "1px solid rgba(218,106,99,0.25)" }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: "#DA6A63" }}>✗ Avoid</p>
            <ul className="space-y-1.5">
              {plan.avoid_list.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#DA6A63" }} />
                  <span className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.7)" }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Sleep, wellness, lifestyle */}
      {plan.sleep_wellness && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#5a6f9f" }}>Sleep, Wellness & Lifestyle</p>
          <div className="space-y-2.5">
            {[
              { key: "sleep", icon: Moon, color: "#7B8EC8", label: "Sleep" },
              { key: "hydration", icon: Droplets, color: "#60a5fa", label: "Hydration" },
              { key: "nutrition", icon: Apple, color: "#C8E63C", label: "Nutrition" },
              { key: "stress", icon: Brain, color: "#DA6A63", label: "Stress" },
              { key: "exercise", icon: Dumbbell, color: "#FA6F30", label: "Exercise" },
            // eslint-disable-next-line no-unused-vars
            ].filter(row => plan.sleep_wellness[row.key]).map(({ key, icon: WellnessIcon, color, label }) => (
              <div key={key} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${color}18` }}>
                <WellnessIcon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <div>
                  <p className="text-xs font-bold mb-0.5" style={{ color: "#1e2535" }}>{label}</p>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>{plan.sleep_wellness[key]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product recommendations */}
      {plan.product_recommendations?.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.85)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4" style={{ color: "#FA6F30" }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>Recommended Products</p>
          </div>
          <div className="space-y-2.5">
            {plan.product_recommendations.map((prod, i) => {
              const urg = URGENCY_STYLE[prod.urgency] || URGENCY_STYLE.optional;
              return (
                <div key={i} className="rounded-xl p-3" style={{ background: "rgba(30,37,53,0.03)", border: "1px solid rgba(30,37,53,0.07)" }}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold" style={{ color: "#1e2535" }}>{prod.name}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-full capitalize" style={{ background: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.5)" }}>{prod.type}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {prod.price_range && <span className="text-xs font-bold" style={{ color: PRICE_COLOR[prod.price_range] || "#1e2535" }}>{prod.price_range}</span>}
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: urg.bg, color: urg.color }}>{urg.label}</span>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed mb-1" style={{ color: "rgba(30,37,53,0.6)" }}>{prod.why}</p>
                  {prod.when_to_use && (
                    <p className="text-xs flex items-center gap-1" style={{ color: "rgba(30,37,53,0.45)" }}>
                      <Clock className="w-3 h-3" />{prod.when_to_use}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Warning signs */}
      {plan.warning_signs?.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4" style={{ color: "#dc2626" }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#dc2626" }}>Contact Your Provider If…</p>
          </div>
          <ul className="space-y-1">
            {plan.warning_signs.map((s, i) => (
              <li key={i} className="text-xs flex items-start gap-2" style={{ color: "rgba(30,37,53,0.65)" }}>
                <span style={{ color: "#dc2626" }}>•</span>{s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Longevity tip + next appt */}
      {(plan.longevity_tip || plan.next_appointment) && (
        <div className="space-y-2">
          {plan.longevity_tip && (
            <div className="rounded-2xl px-4 py-3 flex items-start gap-3" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.35)" }}>
              <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#4a6b10" }} />
              <div>
                <p className="text-xs font-bold mb-0.5" style={{ color: "#4a6b10" }}>Longevity Tip</p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>{plan.longevity_tip}</p>
              </div>
            </div>
          )}
          {plan.next_appointment && (
            <div className="rounded-2xl px-4 py-3 flex items-start gap-3" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)" }}>
              <Calendar className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#7B8EC8" }} />
              <div>
                <p className="text-xs font-bold mb-0.5" style={{ color: "#7B8EC8" }}>Next Appointment</p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>{plan.next_appointment}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PatientDetailModal({ patient, journey, treatmentRecords, appointments, onClose }) {
  const [tab, setTab] = useState("overview");
  const [docDialog, setDocDialog] = useState({ open: false, appt: null, existing: null });
  const [aftercareTreatment, setAftercareTreatment] = useState(null);
  const [aftercarePlan, setAftercarePlan] = useState("");
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [sentAftercare, setSentAftercare] = useState(false);
  const [sentNudge, setSentNudge] = useState(false);
  const qc = useQueryClient();

  const isPremium = journey?.tier === "premium" && journey?.subscription_status === "active";
  const patientRecords = treatmentRecords.filter(r => r.patient_id === patient.id);
  const completedAppts = appointments.filter(a => a.status === "completed");
  const sortedAppts = [...appointments].sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date));
  const checkins = journey?.daily_checkins || [];

  const generateAftercarePlan = async (record) => {
    setAftercareTreatment(record);
    setGeneratingPlan(true);
    setAftercarePlan(null);
    try {
      const prompt = `You are a world-class clinical aesthetics expert and wellness coach. Generate a highly detailed, data-driven, fully personalized aftercare plan for this patient. Return a JSON object ONLY.

PATIENT DATA:
- Name: ${patient.name}
- Treatment: ${record.service}
- Areas treated: ${record.areas_treated?.join(", ") || "N/A"}
- Units used: ${record.units_used || "N/A"} ${record.units_label || ""}
- Products used: ${record.products_used?.map(p => p.product_name).join(", ") || "N/A"}
- Skin concerns: ${journey?.skin_concerns?.join(", ") || "general improvement"}
- Treatment goals: ${journey?.treatment_goals?.join(", ") || "refreshed appearance"}
- Budget comfort: ${journey?.budget_comfort || "N/A"}
- Skin score: ${journey?.ai_score || "N/A"}/100
- Clinical notes: ${record.clinical_notes || "Standard procedure, no complications."}
- Check-in data: ${JSON.stringify(journey?.daily_checkins?.slice(0,3) || [])}

Return this exact JSON structure:
{
  "personal_note": "A warm 2-3 sentence personal message to Jessica specifically referencing her goals and treatment",
  "results_timeline": [
    {"day": "Day 1–2", "title": "What's happening", "description": "Detailed biological explanation of what's happening in the tissue", "what_you_may_feel": "Specific sensations to expect", "action": "Specific thing to do today"},
    {"day": "Day 3–5", "title": "Early results", "description": "...", "what_you_may_feel": "...", "action": "..."},
    {"day": "Day 7", "title": "Results emerging", "description": "...", "what_you_may_feel": "...", "action": "..."},
    {"day": "Day 14", "title": "Full results", "description": "...", "what_you_may_feel": "...", "action": "..."},
    {"day": "Month 3", "title": "Maintenance window", "description": "...", "what_you_may_feel": "...", "action": "..."}
  ],
  "do_list": ["5-6 specific things to DO in the first 48 hours and beyond, very specific to this treatment"],
  "avoid_list": ["6-8 specific things to AVOID with exact timeframes, e.g. 'No exercise for 24 hours'"],
  "sleep_wellness": {
    "sleep": "Specific sleep position advice and why it matters for this treatment",
    "hydration": "Specific hydration advice with amounts",
    "nutrition": "Specific foods that boost results (e.g. collagen, zinc, vitamin C)",
    "stress": "How stress affects this treatment's results and what to do",
    "exercise": "Exact exercise timeline and which types to avoid/embrace"
  },
  "product_recommendations": [
    {"name": "Product name", "type": "cleanser/moisturizer/SPF/etc", "why": "Why this specific product helps this patient's skin concerns", "when_to_use": "Morning/Evening/frequency", "price_range": "$", "urgency": "essential/recommended/optional"},
    {"name": "...", "type": "...", "why": "...", "when_to_use": "...", "price_range": "$$", "urgency": "essential"},
    {"name": "...", "type": "...", "why": "...", "when_to_use": "...", "price_range": "$$$", "urgency": "recommended"},
    {"name": "...", "type": "...", "why": "...", "when_to_use": "...", "price_range": "$$", "urgency": "optional"}
  ],
  "warning_signs": ["Specific symptoms that require contacting provider immediately"],
  "next_appointment": "Specific recommendation for next treatment timing and what to discuss",
  "longevity_tip": "One powerful personalized tip to make results last longer based on their specific lifestyle factors"
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            personal_note: { type: "string" },
            results_timeline: { type: "array", items: { type: "object" } },
            do_list: { type: "array", items: { type: "string" } },
            avoid_list: { type: "array", items: { type: "string" } },
            sleep_wellness: { type: "object" },
            product_recommendations: { type: "array", items: { type: "object" } },
            warning_signs: { type: "array", items: { type: "string" } },
            next_appointment: { type: "string" },
            longevity_tip: { type: "string" }
          }
        }
      });
      setAftercarePlan(result);
    } catch (e) {
      setAftercarePlan({ error: "Failed to generate plan. Please try again." });
    }
    setGeneratingPlan(false);
  };

  const sendAftercareMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Notification.create({
        user_id: patient.id,
        user_email: patient.email,
        type: "general",
        message: `Your provider has sent you a personalized aftercare plan for your recent ${aftercareTreatment?.service || "treatment"}. Log in to NOVI to view your AI-powered recovery timeline. 💚`,
        link_page: "PatientJourney",
      });
      if (aftercareTreatment?.id) {
        await base44.entities.TreatmentRecord.update(aftercareTreatment.id, {
          aftercare_plan_sent: true,
          aftercare_plan_sent_at: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      setSentAftercare(true);
      qc.invalidateQueries(["treatment-records"]);
    },
  });

  const sendNudgeMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Notification.create({
        user_id: patient.id,
        user_email: patient.email,
        type: "general",
        message: `Your provider recommends upgrading to NOVI Premium for personalized AI aftercare plans, daily recovery check-ins, and deeper skin insights after every treatment. 🌿`,
        link_page: "PatientJourney",
      });
    },
    onSuccess: () => setSentNudge(true),
  });

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "insights", label: "Patient Insights", badge: isPremium },
    { id: "aftercare", label: "Aftercare Plans", badge: isPremium },
    { id: "checkins", label: `Check-ins (${checkins.length})`, badge: isPremium },
    { id: "history", label: "Treatment History" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" style={{ background: "rgba(30,37,53,0.45)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto flex flex-col"
        style={{ background: "linear-gradient(160deg, #f0eefb 0%, #f5f3ef 50%, #eaf5c8 100%)", boxShadow: "-8px 0 40px rgba(30,37,53,0.18)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 flex items-center gap-4" style={{ background: "rgba(245,243,239,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(30,37,53,0.08)" }}>
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white"
              style={{ background: isPremium ? "linear-gradient(135deg, #C8E63C, #7B8EC8)" : "rgba(123,142,200,0.5)" }}>
              {(patient.name || "?")[0].toUpperCase()}
            </div>
            {isPremium && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#C8E63C", border: "2px solid white" }}>
                <Sparkles className="w-2.5 h-2.5" style={{ color: "#1a2a00" }} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base truncate" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>{patient.name || "Unknown"}</h2>
              {isPremium && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0" style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10", border: "1px solid rgba(200,230,60,0.4)" }}>
                  <Sparkles className="w-2.5 h-2.5" />NOVI Premium
                </span>
              )}
            </div>
            <p className="text-xs truncate" style={{ color: "rgba(30,37,53,0.5)" }}>{patient.email}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors flex-shrink-0">
            <X className="w-4 h-4" style={{ color: "rgba(30,37,53,0.5)" }} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="px-6 pt-4 pb-0 flex gap-1 overflow-x-auto" style={{ borderBottom: "1px solid rgba(30,37,53,0.08)" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-3 pb-3 text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all relative"
              style={{ color: tab === t.id ? "#FA6F30" : "rgba(30,37,53,0.45)", borderBottom: tab === t.id ? "2px solid #FA6F30" : "2px solid transparent" }}>
              {t.label}
              {t.badge && <Sparkles className="w-3 h-3" style={{ color: "#4a6b10" }} />}
            </button>
          ))}
        </div>

        <div className="flex-1 p-6 space-y-4">

          {/* OVERVIEW TAB */}
          {tab === "overview" && (
            <>
              {/* NOVI Premium status / nudge */}
              {isPremium ? (
                <GlassInner style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.35)" }}>
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#4a6b10" }} />
                    <div className="flex-1">
                      <p className="font-bold text-sm" style={{ color: "#1e2535" }}>NOVI Premium Active</p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>
                        {patient.name?.split(" ")[0]} is on NOVI Premium — she receives personalized aftercare plans, submits daily check-ins, and her skin data grows with every visit. Use the <strong>Aftercare Plans</strong> tab to generate and send a plan after each treatment, and <strong>Patient Insights</strong> to see her full recovery data and what to recommend next.
                      </p>
                    </div>
                  </div>
                </GlassInner>
              ) : (
                <GlassInner style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)" }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3">
                      <Bell className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#7B8EC8" }} />
                      <div>
                        <p className="font-bold text-sm" style={{ color: "#1e2535" }}>Not on NOVI Premium</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.55)" }}>Upgrade keeps patients engaged between visits with personalized aftercare & daily check-ins</p>
                      </div>
                    </div>
                    <Button size="sm" disabled={sentNudge || sendNudgeMutation.isPending}
                      onClick={() => sendNudgeMutation.mutate()}
                      style={{ background: sentNudge ? "rgba(123,142,200,0.12)" : "rgba(123,142,200,0.18)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.35)" }}
                      className="text-xs font-semibold gap-1.5 h-8 flex-shrink-0">
                      <Bell className="w-3 h-3" />{sentNudge ? "Notified ✓" : "Nudge to Upgrade"}
                    </Button>
                  </div>
                </GlassInner>
              )}

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Treatments", value: completedAppts.length, icon: Calendar, color: "#7B8EC8" },
                  { label: "Documented", value: patientRecords.length, icon: FileText, color: "#FA6F30" },
                  { label: "Check-ins", value: checkins.length, icon: Activity, color: "#C8E63C" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <GlassInner key={label} className="text-center">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-1.5" style={{ background: `${color}18` }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <p className="text-2xl font-bold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>{value}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>{label}</p>
                  </GlassInner>
                ))}
              </div>

              {/* Skin concerns & goals */}
              {journey && (journey.skin_concerns?.length > 0 || journey.treatment_goals?.length > 0) && (
                <GlassInner>
                  <SectionTitle>Patient Profile (NOVI Data)</SectionTitle>
                  {journey.skin_concerns?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(30,37,53,0.55)" }}>Skin Concerns</p>
                      <div className="flex flex-wrap gap-1.5">
                        {journey.skin_concerns.map(c => (
                          <span key={c} className="text-xs px-2.5 py-1 rounded-full capitalize" style={{ background: "rgba(218,106,99,0.1)", color: "#DA6A63", border: "1px solid rgba(218,106,99,0.2)" }}>{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {journey.treatment_goals?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(30,37,53,0.55)" }}>Treatment Goals</p>
                      <div className="flex flex-wrap gap-1.5">
                        {journey.treatment_goals.map(g => (
                          <span key={g} className="text-xs px-2.5 py-1 rounded-full capitalize" style={{ background: "rgba(123,142,200,0.1)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.2)" }}>{g}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {journey.budget_comfort && (
                    <p className="text-xs mt-3" style={{ color: "rgba(30,37,53,0.45)" }}>
                      Budget comfort: <strong style={{ color: "#1e2535" }}>
                        {{"under_500":"Under $500","500_1000":"$500–$1,000","1000_2500":"$1,000–$2,500","2500_plus":"$2,500+"}[journey.budget_comfort]}
                      </strong>
                    </p>
                  )}
                  {journey.ai_score && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(30,37,53,0.08)" }}>
                        <div className="h-full rounded-full" style={{ width: `${journey.ai_score}%`, background: "linear-gradient(90deg, #C8E63C, #7B8EC8)" }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: "#1e2535" }}>Skin Score {journey.ai_score}/100</span>
                    </div>
                  )}
                </GlassInner>
              )}

              {/* Roadmap */}
              {journey?.roadmap && (
                <GlassInner style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.3)" }}>
                  <SectionTitle color="#4a6b10">NOVI Journey Roadmap</SectionTitle>
                  <div className="space-y-2">
                    {journey.roadmap.next_treatment && (
                      <div className="flex items-center gap-2">
                        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#C8E63C" }} />
                        <p className="text-xs" style={{ color: "#1e2535" }}><strong>Next:</strong> {journey.roadmap.next_treatment}</p>
                      </div>
                    )}
                    {journey.roadmap.recommended_add_on && (
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#FA6F30" }} />
                        <p className="text-xs" style={{ color: "#1e2535" }}><strong>Recommended add-on:</strong> {journey.roadmap.recommended_add_on}</p>
                      </div>
                    )}
                    {journey.roadmap.skin_health_trend && (
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#7B8EC8" }} />
                        <p className="text-xs capitalize" style={{ color: "#1e2535" }}><strong>Trend:</strong> {journey.roadmap.skin_health_trend}</p>
                      </div>
                    )}
                  </div>
                </GlassInner>
              )}
            </>
          )}

          {/* PATIENT INSIGHTS TAB */}
          {tab === "insights" && (
            <PatientAIInsightsTab
              patientId={patient.id}
              treatments={patientRecords}
              journey={journey}
            />
          )}

          {/* AFTERCARE PLANS TAB */}
          {tab === "aftercare" && (
            <>
              {!isPremium ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "rgba(200,230,60,0.15)" }}>
                    <Sparkles className="w-7 h-7" style={{ color: "#4a6b10" }} />
                  </div>
                  <p className="font-bold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontSize: 18 }}>Aftercare Plans — NOVI Premium</p>
                  <p className="text-sm mx-auto max-w-xs" style={{ color: "rgba(30,37,53,0.55)" }}>
                    When your patient upgrades to NOVI Premium, you can generate personalized AI aftercare plans for each treatment and send them with one click.
                  </p>
                  <Button disabled={sentNudge} onClick={() => sendNudgeMutation.mutate()}
                    style={{ background: "#FA6F30", color: "#fff" }} className="gap-2 font-bold">
                    <Bell className="w-4 h-4" />{sentNudge ? "Nudge Sent ✓" : "Nudge Patient to Upgrade"}
                  </Button>
                </div>
              ) : (
                <>
                  <GlassInner style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.3)" }}>
                    <p className="text-xs font-bold" style={{ color: "#4a6b10" }}>How it works</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>
                      Select a completed treatment below → NOVI generates a personalized day-by-day aftercare plan using {patient.name?.split(" ")[0]}'s skin profile, treatment details, and your clinical notes → review and send to her with one click.
                    </p>
                  </GlassInner>

                  <SectionTitle>Select Treatment to Generate Plan</SectionTitle>
                  <div className="space-y-2">
                    {patientRecords.map(record => (
                      <button key={record.id} onClick={() => generateAftercarePlan(record)}
                        className="w-full text-left rounded-2xl p-4 transition-all hover:scale-[1.01]"
                        style={{
                          background: aftercareTreatment?.id === record.id ? "rgba(200,230,60,0.15)" : "rgba(255,255,255,0.55)",
                          border: aftercareTreatment?.id === record.id ? "1px solid rgba(200,230,60,0.5)" : "1px solid rgba(255,255,255,0.85)"
                        }}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{record.service}</p>
                            <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>
                              {record.treatment_date ? format(new Date(record.treatment_date), "MMM d, yyyy") : ""}
                              {record.areas_treated?.length > 0 ? ` · ${record.areas_treated.join(", ")}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {record.aftercare_plan_sent && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "rgba(200,230,60,0.15)", color: "#4a6b10" }}>
                                <CheckCircle className="w-3 h-3" />Sent
                              </span>
                            )}
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(250,111,48,0.12)", color: "#FA6F30" }}>
                              {aftercareTreatment?.id === record.id ? "Selected" : "Generate Plan →"}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                    {patientRecords.length === 0 && (
                      <p className="text-sm text-center py-8" style={{ color: "rgba(30,37,53,0.4)" }}>No documented treatments yet. Document a completed treatment first.</p>
                    )}
                  </div>

                  {/* Generated plan */}
                  {generatingPlan && (
                    <GlassInner>
                      <div className="flex items-center gap-3 py-4 justify-center">
                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#FA6F30" }} />
                        <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Generating personalized aftercare plan…</p>
                      </div>
                    </GlassInner>
                  )}

                  {aftercarePlan && !generatingPlan && (
                    <AftercarePlanView
                      plan={aftercarePlan}
                      treatment={aftercareTreatment}
                      sentAftercare={sentAftercare}
                      isPending={sendAftercareMutation.isPending}
                      onSend={() => sendAftercareMutation.mutate()}
                    />
                  )}
                </>
              )}
            </>
          )}

          {/* CHECK-INS TAB */}
          {tab === "checkins" && (
            <>
              {checkins.length === 0 ? (
                <div className="text-center py-12" style={{ color: "rgba(30,37,53,0.4)" }}>
                  <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No check-ins submitted yet.</p>
                  {!isPremium && <p className="text-xs mt-1">Patient needs NOVI Premium to submit check-ins.</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  {[...checkins].sort((a, b) => b.day_number - a.day_number).map((c, i) => (
                    <GlassInner key={i}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "#C8E63C", color: "#1a2a00" }}>
                            {c.day_number}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Day {c.day_number}</p>
                            <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>{c.date ? format(new Date(c.date), "MMM d") : ""}</p>
                          </div>
                        </div>
                        {c.ai_recovery_stage && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: "rgba(123,142,200,0.12)", color: "#7B8EC8" }}>
                            {c.ai_recovery_stage.replace("_", " ")}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {[
                          { label: "Comfort", val: c.comfort_level, max: 5, color: "#C8E63C" },
                          { label: "Swelling", val: c.swelling_level, max: 5, color: "#FA6F30" },
                          { label: "Bruising", val: c.bruising_level, max: 5, color: "#DA6A63" },
                        ].map(({ label, val, max, color }) => (
                          <div key={label} className="text-center">
                            <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>{label}</p>
                            <p className="text-lg font-bold" style={{ color, fontFamily: "'DM Serif Display', serif" }}>{val}/{max}</p>
                          </div>
                        ))}
                      </div>

                      {c.symptoms?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {c.symptoms.map((s, j) => (
                            <span key={j} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(250,111,48,0.08)", color: "#c2440a" }}>{s}</span>
                          ))}
                        </div>
                      )}

                      {c.notes && <p className="text-xs italic mb-2" style={{ color: "rgba(30,37,53,0.55)" }}>"{c.notes}"</p>}

                      {c.ai_feedback && (
                        <div className="rounded-xl px-3 py-2" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)" }}>
                          <p className="text-xs font-semibold mb-0.5" style={{ color: "#7B8EC8" }}>NOVI Recovery Notes</p>
                          <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>{c.ai_feedback}</p>
                        </div>
                      )}
                    </GlassInner>
                  ))}
                </div>
              )}
            </>
          )}

          {/* TREATMENT HISTORY TAB */}
          {tab === "history" && (
            <div className="space-y-2">
              {sortedAppts.map(a => {
                const sc = STATUS_COLOR[a.status] || STATUS_COLOR.confirmed;
                const record = treatmentRecords.find(r => r.appointment_id === a.id);
                const rs = record ? (RECORD_STATUS[record.status] || RECORD_STATUS.draft) : null;
                return (
                  <GlassInner key={a.id} className="!p-0 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(30,37,53,0.02)" }}>
                      <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.35)" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "#1e2535" }}>{a.service}</p>
                        <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
                          {a.appointment_date ? format(new Date(a.appointment_date), "MMM d, yyyy") : ""}
                          {a.appointment_time ? ` · ${a.appointment_time}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: sc.bg, color: sc.text }}>{a.status}</span>
                        {a.status === "completed" && (
                          <Button size="sm" className="h-7 px-2 text-xs gap-1"
                            style={{ background: record ? "rgba(123,142,200,0.15)" : "rgba(250,111,48,0.12)", color: record ? "#7B8EC8" : "#FA6F30", border: "none" }}
                            onClick={() => setDocDialog({ open: true, appt: a, existing: record || null })}>
                            <FileText className="w-3 h-3" />{record ? "View" : "Document"}
                          </Button>
                        )}
                      </div>
                    </div>
                    {record && (
                      <div className="px-4 py-2.5 space-y-1.5" style={{ borderTop: "1px solid rgba(30,37,53,0.06)" }}>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: rs.bg, color: rs.text }}>{rs.label}</span>
                          {record.adverse_reaction && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "rgba(248,113,113,0.12)", color: "#dc2626" }}>
                              <AlertTriangle className="w-3 h-3" />Adverse Reaction
                            </span>
                          )}
                          {record.aftercare_plan_sent && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "rgba(200,230,60,0.15)", color: "#4a6b10" }}>
                              <Send className="w-3 h-3" />Aftercare Sent
                            </span>
                          )}
                          {record.areas_treated?.length > 0 && (
                            <span className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>{record.areas_treated.join(", ")}</span>
                          )}
                        </div>
                        {record.clinical_notes && (
                          <p className="text-xs italic line-clamp-2" style={{ color: "rgba(30,37,53,0.5)" }}>"{record.clinical_notes}"</p>
                        )}
                      </div>
                    )}
                  </GlassInner>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <TreatmentDocumentDialog
        open={docDialog.open}
        onClose={() => { setDocDialog({ open: false, appt: null, existing: null }); qc.invalidateQueries(["treatment-records"]); }}
        appointment={docDialog.appt}
        existingRecord={docDialog.existing}
      />
    </div>
  );
}