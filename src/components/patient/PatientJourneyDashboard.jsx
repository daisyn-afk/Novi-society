import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  Sparkles, Calendar, Crown, ChevronRight,
  Users, Camera, Clock, Star, ArrowRight, Lock, Flame, Zap
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import DailyCheckIn from "./DailyCheckIn";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "recovery", label: "Recovery" },
  { id: "scan", label: "NOVI Scan" },
  { id: "history", label: "History" },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function RecoveryRing({ score }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(123,142,200,0.15)" strokeWidth="8" />
      <circle cx="55" cy="55" r={r} fill="none"
        stroke="#7B8EC8" strokeWidth="7"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform="rotate(-90 55 55)"
      />
      <text x="55" y="51" textAnchor="middle" fill="#2a3050" fontSize="20" fontWeight="700" fontFamily="'DM Serif Display', serif">{score}%</text>
      <text x="55" y="65" textAnchor="middle" fill="rgba(42,48,80,0.45)" fontSize="9" fontFamily="'DM Sans', sans-serif">Recovery</text>
    </svg>
  );
}

export default function PatientJourneyDashboard({ journey, appointments, isPremium, onUpgrade, onNewScan }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const completedAppts = (appointments || []).filter(a => a.status === "completed");
  const upcomingAppts = (appointments || []).filter(a =>
    ["confirmed", "requested", "awaiting_payment", "awaiting_consent"].includes(a.status)
  );
  const checkins = journey?.daily_checkins || [];
  const latestCheckin = checkins[checkins.length - 1];
  const nextAppt = upcomingAppts[0];
  const latestAppt = completedAppts[0];
  const latestScan = journey?.scans?.[journey.scans.length - 1];
  const analysis = latestScan?.ai_analysis;
  const daysSince = latestAppt?.completed_at ? differenceInDays(new Date(), parseISO(latestAppt.completed_at)) : null;
  const recoveryScore = latestCheckin?.ai_texture_score ?? 85;

  // Calculate streak
  const streak = checkins.length > 0 ? checkins.length : 0;
  const checkedInToday = latestCheckin?.date === format(new Date(), "yyyy-MM-dd");

  const { data: aftercarePlan } = useQuery({
    queryKey: ["aftercare-plan-dashboard", latestAppt?.treatment_record_id],
    queryFn: async () => {
      if (!latestAppt?.treatment_record_id) return null;
      const plans = await base44.entities.AftercarePlan.filter({ treatment_record_id: latestAppt.treatment_record_id });
      return plans[0] || null;
    },
    enabled: !!latestAppt?.treatment_record_id,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["my-reviews-patient"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.Review.filter({ patient_id: u.id });
    },
  });

  const firstName = user?.full_name?.split(" ")[0] || "there";

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── HERO CARD ── */}
      <div className="rounded-3xl overflow-hidden mb-5 relative"
        style={{ background: "#ffffff", border: "1px solid rgba(123,142,200,0.18)", boxShadow: "0 2px 20px rgba(123,142,200,0.08)", minHeight: 160 }}>
        {/* Decorative glow */}
        <div style={{ position: "absolute", top: -20, right: -10, width: 130, height: 130, borderRadius: "50%", background: "rgba(123,142,200,0.09)", filter: "blur(40px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -10, left: 20, width: 100, height: 100, borderRadius: "50%", background: "rgba(180,210,100,0.08)", filter: "blur(35px)", pointerEvents: "none" }} />

        <div className="relative z-10 p-6 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold mb-1" style={{ color: "rgba(123,142,200,0.7)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {getGreeting()}, {firstName} ✶
            </p>
            <h2 className="text-xl leading-tight mb-1" style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", color: "#2a3050" }}>
              {latestAppt ? latestAppt.service : "Your NOVI Journey"}
            </h2>
            {daysSince !== null && (
              <p className="text-sm" style={{ color: "rgba(42,48,80,0.5)" }}>
                Day {daysSince + 1} post-treatment
                {latestAppt?.provider_name && <> · <span style={{ color: "#7B8EC8" }}>{latestAppt.provider_name}</span></>}
              </p>
            )}

            {/* Streak badge */}
            {streak > 0 && (
              <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full"
                style={{ background: streak >= 3 ? "rgba(123,142,200,0.1)" : "rgba(30,37,53,0.05)", border: `1px solid ${streak >= 3 ? "rgba(123,142,200,0.25)" : "rgba(30,37,53,0.1)"}` }}>
                <Flame className="w-3.5 h-3.5" style={{ color: streak >= 3 ? "#7B8EC8" : "rgba(30,37,53,0.4)" }} />
                <span className="text-xs font-bold" style={{ color: streak >= 3 ? "#7B8EC8" : "rgba(30,37,53,0.5)" }}>
                  {streak}-day streak
                </span>
              </div>
            )}

            {/* Premium pill */}
            {isPremium ? (
              <div className="inline-flex items-center gap-1.5 mt-2 ml-2 px-3 py-1.5 rounded-full"
                style={{ background: "rgba(123,142,200,0.1)", border: "1px solid rgba(123,142,200,0.22)" }}>
                <Crown className="w-3 h-3" style={{ color: "#7B8EC8" }} />
                <span className="text-xs font-semibold" style={{ color: "#7B8EC8" }}>Premium</span>
              </div>
            ) : (
              <button onClick={onUpgrade} className="inline-flex items-center gap-1.5 mt-2 ml-2 px-3 py-1.5 rounded-full"
                style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.18)" }}>
                <Sparkles className="w-3 h-3" style={{ color: "#7B8EC8" }} />
                <span className="text-xs font-semibold" style={{ color: "#7B8EC8" }}>Upgrade</span>
              </button>
            )}
          </div>

          {/* Recovery ring */}
          {recoveryScore != null && (
            <div className="flex-shrink-0 ml-3">
              <RecoveryRing score={Math.round(recoveryScore)} />
            </div>
          )}
        </div>

        {/* Stat strip inside hero */}
        <div className="relative z-10 flex gap-0 mx-6 mb-5 rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(123,142,200,0.15)", background: "rgba(245,244,241,0.8)" }}>
          {[
            { label: "Treatments", value: completedAppts.length },
            { label: "NOVI Scans", value: journey?.scans?.length || 0 },
            { label: "Check-ins", value: checkins.length },
          ].map((s, i) => (
            <div key={s.label} className="flex-1 py-3 text-center"
              style={{ borderLeft: i > 0 ? "1px solid rgba(123,142,200,0.12)" : "none" }}>
              <p className="text-lg font-bold" style={{ color: "#2a3050", lineHeight: 1, fontFamily: "'DM Serif Display', serif" }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(42,48,80,0.45)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Daily check-in CTA — only if premium + has treatment + not yet checked in today */}
        {isPremium && completedAppts.length > 0 && !checkedInToday && (
          <button onClick={() => setActiveTab("recovery")}
            className="relative z-10 w-full flex items-center justify-center gap-2 py-4 font-semibold text-sm"
            style={{ background: "rgba(123,142,200,0.08)", borderTop: "1px solid rgba(123,142,200,0.12)", color: "#7B8EC8" }}>
            <Zap className="w-4 h-4" /> Check in for today — keep your streak alive 🔥
          </button>
        )}
        {isPremium && checkedInToday && (
          <div className="relative z-10 w-full flex items-center justify-center gap-2 py-4 text-sm"
            style={{ background: "rgba(123,142,200,0.06)", borderTop: "1px solid rgba(123,142,200,0.1)", color: "rgba(123,142,200,0.7)" }}>
            ✓ You checked in today — NOVI is on it
          </div>
        )}
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: "rgba(123,142,200,0.08)" }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all"
            style={activeTab === tab.id
              ? { background: "#fff", color: "#2a3050", boxShadow: "0 1px 8px rgba(123,142,200,0.15)" }
              : { color: "rgba(42,48,80,0.4)", background: "transparent" }
            }>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <div className="space-y-3">

          {/* Upcoming appointment */}
          {nextAppt ? (
            <div className="p-5 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(30,37,53,0.07)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2.5" style={{ color: "rgba(30,37,53,0.3)", letterSpacing: "0.12em" }}>Coming Up ✨</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{nextAppt.service}</p>
                  <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                    <Calendar className="w-3 h-3" /> {nextAppt.appointment_date}
                    {nextAppt.provider_name && <> · {nextAppt.provider_name}</>}
                  </p>
                </div>
                <button onClick={() => navigate(createPageUrl("PatientAppointments"))}
                  className="text-xs font-semibold px-3.5 py-2 rounded-xl"
                  style={{ background: "rgba(123,142,200,0.1)", color: "#7B8EC8" }}>
                  View
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl flex items-center justify-between"
              style={{ background: "linear-gradient(135deg, rgba(123,142,200,0.12), rgba(45,107,127,0.08))", border: "1px solid rgba(123,142,200,0.18)" }}>
              <div>
                <p className="font-semibold text-sm" style={{ color: "#2a3050" }}>Ready for round two? 👋</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(42,48,80,0.5)" }}>Your provider is just a click away</p>
              </div>
              <button onClick={() => navigate(createPageUrl("PatientMarketplace"))}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm flex-shrink-0"
                style={{ background: "#7B8EC8", color: "white" }}>
                Book <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Today's check-in prompt */}
          {isPremium && completedAppts.length > 0 && !checkedInToday && (
            <button onClick={() => setActiveTab("recovery")}
              className="w-full p-5 rounded-2xl flex items-center gap-4 text-left"
              style={{ background: "rgba(123,142,200,0.07)", border: "1.5px solid rgba(123,142,200,0.2)" }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(123,142,200,0.12)" }}>
                <Flame className="w-5 h-5" style={{ color: "#7B8EC8" }} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: "#2a3050" }}>
                  {streak > 0 ? `${streak}-day streak — don't break it now! 🔥` : "Start your recovery streak 🌱"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(42,48,80,0.5)" }}>
                  Your daily check-in takes 60 seconds. NOVI remembers everything.
                </p>
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(123,142,200,0.4)" }} />
            </button>
          )}

          {/* Aftercare plan */}
          {aftercarePlan && (
            <div className="p-5 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(30,37,53,0.07)" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🧴</span>
                  <p className="font-semibold text-sm text-gray-900">Your Aftercare Guide</p>
                </div>
                {latestAppt?.provider_name && (
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(123,142,200,0.1)", color: "#7B8EC8" }}>
                    from {latestAppt.provider_name}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {(aftercarePlan.immediate_care || aftercarePlan.instructions || []).slice(0, 3).map((instr, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: "rgba(123,142,200,0.12)" }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#7B8EC8" }} />
                    </div>
                    <p className="text-sm leading-snug" style={{ color: "rgba(30,37,53,0.7)" }}>{instr}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NOVI scan teaser */}
          {analysis ? (
            <button onClick={() => setActiveTab("scan")}
              className="w-full p-5 rounded-2xl flex items-center gap-4 text-left"
              style={{ background: "#fff", border: "1px solid rgba(30,37,53,0.07)" }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, rgba(123,142,200,0.15), rgba(45,107,127,0.12))" }}>
                <Sparkles className="w-5 h-5" style={{ color: "#2D6B7F" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900">NOVI Skin Read ✦</p>
                {analysis.concern_summary && (
                  <p className="text-xs mt-0.5 leading-snug truncate" style={{ color: "rgba(30,37,53,0.5)" }}>{analysis.concern_summary}</p>
                )}
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0"
                style={{ background: "rgba(123,142,200,0.1)", color: "#7B8EC8" }}>
                {analysis.overall_skin_health}
              </span>
            </button>
          ) : (
            <button onClick={onNewScan}
              className="w-full p-5 rounded-2xl flex items-center gap-4 text-left"
              style={{ background: "#fff", border: "1.5px dashed rgba(123,142,200,0.25)" }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(123,142,200,0.07)" }}>
                <Camera className="w-5 h-5" style={{ color: "#7B8EC8" }} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>Let NOVI take a look 👀</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.4)" }}>Snap a selfie and get your personalized skin read</p>
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.2)" }} />
            </button>
          )}

          {/* Provider card */}
          <div className="p-5 rounded-2xl flex items-center gap-4"
            style={{ background: "#fff", border: "1px solid rgba(30,37,53,0.07)" }}>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(123,142,200,0.1)" }}>
              <Users className="w-5 h-5" style={{ color: "#7B8EC8" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900">
                {latestAppt?.provider_name || "Meet Your Provider"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                {latestAppt?.provider_name ? "They'd love to see how you're glowing 💫" : "Find a certified NOVI provider near you"}
              </p>
            </div>
            <button onClick={() => navigate(createPageUrl("PatientMarketplace"))}
              className="text-xs font-semibold px-3.5 py-2 rounded-xl flex-shrink-0"
              style={{ background: "rgba(123,142,200,0.1)", color: "#7B8EC8" }}>
              {latestAppt?.provider_name ? "Book Again" : "Browse"} →
            </button>
          </div>

          {/* Leave review */}
          {completedAppts.length > 0 && reviews.length < completedAppts.length && (
            <button onClick={() => navigate(createPageUrl("PatientReviews"))}
              className="w-full p-4 rounded-2xl flex items-center gap-3 text-left"
              style={{ background: "rgba(218,106,99,0.05)", border: "1px solid rgba(218,106,99,0.15)" }}>
              <Star className="w-4 h-4 flex-shrink-0" style={{ color: "#DA6A63" }} />
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: "#DA6A63" }}>How'd it go? ⭐</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.4)" }}>Your kind words help others find amazing providers</p>
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#DA6A63" }} />
            </button>
          )}
        </div>
      )}

      {/* ── RECOVERY TAB ── */}
      {activeTab === "recovery" && (
        <div className="space-y-4">
          {completedAppts.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(30,37,53,0.05)" }}>
                <Calendar className="w-6 h-6" style={{ color: "rgba(30,37,53,0.2)" }} />
              </div>
              <p className="font-semibold" style={{ color: "rgba(30,37,53,0.5)" }}>Nothing here yet!</p>
              <p className="text-xs mt-1 mb-4" style={{ color: "rgba(30,37,53,0.35)" }}>Book your first session and your recovery story starts here 🌱</p>
              <button onClick={() => navigate(createPageUrl("PatientMarketplace"))}
                className="text-sm font-semibold px-5 py-2.5 rounded-xl"
                style={{ background: "#3d4a6b", color: "white" }}>
                Find a Provider
              </button>
            </div>
          ) : isPremium ? (
            <DailyCheckIn journey={journey} appointments={appointments} />
          ) : (
            <div className="space-y-3">
              <div className="p-6 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(123,142,200,0.18)" }}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(123,142,200,0.1)" }}>
                    <Flame className="w-6 h-6" style={{ color: "#7B8EC8" }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold mb-1" style={{ color: "#2a3050", fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: 16 }}>Daily Recovery Check-ins 🌱</p>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(42,48,80,0.6)" }}>
                      Check in each day and NOVI tracks your healing, flags anything worth noting, and keeps your provider in the loop.
                    </p>
                    <button onClick={onUpgrade}
                      className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm"
                      style={{ background: "#7B8EC8", color: "white" }}>
                      <Lock className="w-3.5 h-3.5" /> Unlock Recovery Tracking ✨
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── NOVI SCAN TAB ── */}
      {activeTab === "scan" && (
        <div className="space-y-4">
          {!analysis ? (
            <div className="py-14 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(123,142,200,0.1)" }}>
                <Camera className="w-6 h-6" style={{ color: "#7B8EC8" }} />
              </div>
              <p className="font-semibold" style={{ color: "rgba(30,37,53,0.5)" }}>No scan yet</p>
              <p className="text-xs mt-1 mb-5" style={{ color: "rgba(30,37,53,0.35)" }}>Let NOVI take a look — snap a selfie and get your personalized skin read in seconds</p>
              <button onClick={onNewScan}
                className="text-sm font-semibold px-6 py-3 rounded-xl"
                style={{ background: "#3d4a6b", color: "white" }}>
                Add Your First Scan
              </button>
            </div>
          ) : (
            <>
              {/* Score hero */}
              <div className="p-6 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(123,142,200,0.18)" }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(123,142,200,0.7)",
                  letterSpacing: "0.12em" }}>NOVI's Read on Your Skin ✦</p>
                <p className="text-3xl mb-1" style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", color: "#2a3050" }}>
                  {analysis.overall_skin_health}
                </p>
                {analysis.concern_summary && (
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(42,48,80,0.55)" }}>{analysis.concern_summary}</p>
                )}
              </div>

              {/* Metrics grid */}
              {isPremium && (analysis.symmetry_score || analysis.hydration_score) && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Symmetry", value: analysis.symmetry_score, color: "#2D6B7F" },
                    { label: "Hydration", value: analysis.hydration_score, color: "#7B8EC8" },
                    { label: "Pigmentation", value: analysis.pigmentation_score, color: "#DA6A63" },
                    { label: "Confidence", value: analysis.confidence_score, color: "#5a7a20" },
                  ].filter(m => m.value != null).map(m => (
                    <div key={m.label} className="p-4 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(30,37,53,0.07)" }}>
                      <p className="text-xs mb-1.5" style={{ color: "rgba(30,37,53,0.4)" }}>{m.label}</p>
                      <p className="text-2xl font-bold" style={{ color: m.color, fontFamily: "'DM Serif Display', serif" }}>{Math.round(m.value)}</p>
                      <div className="w-full h-1.5 rounded-full mt-2" style={{ background: "rgba(30,37,53,0.05)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${m.value}%`, background: m.color, opacity: 0.6 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Concerns */}
              {analysis.detected_concerns?.length > 0 && (
                <div className="p-5 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(30,37,53,0.07)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.3)", letterSpacing: "0.12em" }}>What NOVI Noticed</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.detected_concerns.map((c, i) => (
                      <span key={i} className="text-xs px-3 py-1.5 rounded-full font-medium"
                        style={{ background: "rgba(250,111,48,0.07)", color: "#c45f30", border: "1px solid rgba(250,111,48,0.15)" }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended treatments */}
              {analysis.recommended_treatments?.length > 0 && (
                <div className="p-5 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(30,37,53,0.07)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.3)", letterSpacing: "0.12em" }}>NOVI Recommends for You 💌</p>
                  <div className="space-y-3">
                    {analysis.recommended_treatments.slice(0, 3).map((t, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2" style={{ background: "#7B8EC8" }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                          <p className="text-xs mt-0.5 leading-snug" style={{ color: "rgba(30,37,53,0.5)" }}>{t.reason}</p>
                        </div>
                        <button onClick={() => navigate(createPageUrl("PatientMarketplace"))}
                          className="text-xs px-2.5 py-1.5 rounded-lg font-semibold flex-shrink-0"
                          style={{ background: "rgba(123,142,200,0.1)", color: "#7B8EC8" }}>
                          Find →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isPremium && (
                <button onClick={onUpgrade}
                  className="w-full p-5 rounded-2xl flex items-center gap-4"
                  style={{ background: "rgba(123,142,200,0.07)", border: "1.5px solid rgba(123,142,200,0.2)" }}>
                  <Sparkles className="w-5 h-5 flex-shrink-0" style={{ color: "#7B8EC8" }} />
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-sm" style={{ color: "#2a3050" }}>Unlock Your Full NOVI Read ✨</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(42,48,80,0.5)" }}>Wrinkle depth, symmetry, skin age estimate & more</p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0" style={{ background: "#7B8EC8", color: "white" }}>$19/mo</span>
                </button>
              )}

              <button onClick={onNewScan}
                className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ border: "1.5px dashed rgba(123,142,200,0.25)", color: "rgba(30,37,53,0.4)" }}>
                <Camera className="w-4 h-4" /> New NOVI Scan
              </button>
            </>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {completedAppts.length === 0 ? (
            <div className="py-14 text-center">
              <Clock className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.12)" }} />
              <p className="text-sm" style={{ color: "rgba(30,37,53,0.4)" }}>No treatment history yet</p>
            </div>
          ) : (
            <>
              {completedAppts.map((a, idx) => (
                <div key={a.id} className="p-4 rounded-2xl flex items-center gap-4"
                  style={{ background: "#fff", border: "1px solid rgba(30,37,53,0.07)" }}>
                  <div className="flex flex-col items-center self-stretch">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                      style={{ background: idx === 0 ? "#b8d060" : "rgba(30,37,53,0.12)" }} />
                    {idx < completedAppts.length - 1 && (
                      <div className="w-px flex-1 mt-1" style={{ background: "rgba(30,37,53,0.07)", minHeight: 20 }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{a.service}</p>
                      {idx === 0 && <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-semibold"
                        style={{ background: "rgba(180,210,100,0.12)", color: "#5a7a20" }}>Latest</span>}
                    </div>
                    <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: "rgba(30,37,53,0.4)" }}>
                      <Calendar className="w-3 h-3" />
                      {a.completed_at ? format(parseISO(a.completed_at), "MMM d, yyyy") : a.appointment_date}
                      {a.provider_name && <> · {a.provider_name}</>}
                    </p>
                  </div>
                </div>
              ))}
              {completedAppts.length >= 5 && (
                <button onClick={() => navigate(createPageUrl("PatientAppointments"))}
                  className="w-full py-3 text-xs font-semibold text-center"
                  style={{ color: "rgba(30,37,53,0.35)" }}>
                  View all in Appointments →
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}