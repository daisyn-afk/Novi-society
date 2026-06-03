/**
 * ProviderDashboardLocked
 *
 * Canonical LOCKED provider dashboard experience. Rendered by
 * `pages/ProviderDashboard.jsx` whenever `useProviderDashboardState`
 * reports `isLocked: true` (i.e. the provider has not yet activated MD
 * coverage).
 *
 * Design: Base44 "Provider Portal — Onboarding Preview" reference.
 *
 * State source:
 *   The active sub-state is derived from `useProviderDashboardState().lockedSubState`
 *   (one of: none / pending / course_purchased / courses_only / cert_bypass /
 *   md_eligible). The displayed state always reflects the provider's real data.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Lock, Clock, BookOpen, Zap, ArrowRight, CheckCircle2,
  Shield, Upload, Timer, GraduationCap, Stethoscope,
  ShoppingBag, TrendingUp, Heart, AlertTriangle, RefreshCcw,
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { PROVIDER_LOCKED_SUBSTATES } from "@/lib/providerDashboardState";

const LIME = "#C8E63C";
const PERIWINKLE = "#7B8EC8";
const CORAL = "#DA6A63";
const ORANGE = "#FA6F30";
const TEAL = "#2D6B7F";
const DARK = "#1e2535";

const GLASS = {
  background: "rgba(255,255,255,0.6)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.85)",
  borderRadius: 20,
};

// ─── Journey stage pills (read-only progress indicator) ─────────────────────
const JOURNEY_STAGES = [
  { id: PROVIDER_LOCKED_SUBSTATES.NONE,             label: "New Provider",       color: CORAL },
  { id: PROVIDER_LOCKED_SUBSTATES.PENDING,          label: "License Submitted",  color: ORANGE },
  { id: PROVIDER_LOCKED_SUBSTATES.COURSE_PURCHASED, label: "Course Purchased",   color: PERIWINKLE },
  { id: PROVIDER_LOCKED_SUBSTATES.COURSES_ONLY,     label: "License Verified",   color: TEAL },
  { id: PROVIDER_LOCKED_SUBSTATES.CERT_BYPASS,      label: "Cert Upload",        color: "#9B8EC4" },
  { id: PROVIDER_LOCKED_SUBSTATES.MD_ELIGIBLE,      label: "Cert Approved",      color: LIME },
];

// ─── Activation path steps ───────────────────────────────────────────────────
const PATH_STEPS = [
  { id: "license",  label: "Upload License" },
  { id: "verify",   label: "License Verified" },
  { id: "train",    label: "Train or Upload Cert" },
  { id: "certify",  label: "Get Certified" },
  { id: "coverage", label: "Activate MD Coverage" },
  { id: "active",   label: "Full Access" },
];

const DONE_MAP = {
  [PROVIDER_LOCKED_SUBSTATES.NONE]:             [],
  [PROVIDER_LOCKED_SUBSTATES.PENDING]:          ["license"],
  [PROVIDER_LOCKED_SUBSTATES.COURSE_PURCHASED]: ["license", "verify"],
  [PROVIDER_LOCKED_SUBSTATES.COURSES_ONLY]:     ["license", "verify"],
  [PROVIDER_LOCKED_SUBSTATES.CERT_BYPASS]:      ["license", "verify", "train"],
  [PROVIDER_LOCKED_SUBSTATES.MD_ELIGIBLE]:      ["license", "verify", "train", "certify"],
  rejected:                                     [],
};

const ACTIVE_STEP_MAP = {
  [PROVIDER_LOCKED_SUBSTATES.NONE]:             "license",
  [PROVIDER_LOCKED_SUBSTATES.PENDING]:          "verify",
  [PROVIDER_LOCKED_SUBSTATES.COURSE_PURCHASED]: "train",
  [PROVIDER_LOCKED_SUBSTATES.COURSES_ONLY]:     "train",
  [PROVIDER_LOCKED_SUBSTATES.CERT_BYPASS]:      "certify",
  [PROVIDER_LOCKED_SUBSTATES.MD_ELIGIBLE]:      "coverage",
  rejected:                                     "license",
};

// ─── Per-state config ────────────────────────────────────────────────────────
const STATE_CONFIG = {
  [PROVIDER_LOCKED_SUBSTATES.NONE]: ({ hasCompletedBasic }) => ({
    icon: Lock, color: CORAL,
    headline: "Start Your NOVI Journey",
    sub: "Training, MD coverage, practice management, and growth tools — all in one platform.",
    cta: hasCompletedBasic ? "Upload Your License" : "Apply Now — Takes 2 Minutes",
    ctaTo: hasCompletedBasic
      ? createPageUrl("ProviderCredentialsCoverage")
      : createPageUrl("ProviderBasicOnboarding"),
    ctaBg: `linear-gradient(135deg, ${ORANGE}, ${CORAL})`,
    ctaColor: "#fff",
  }),
  [PROVIDER_LOCKED_SUBSTATES.PENDING]: () => ({
    icon: Clock, color: ORANGE,
    headline: "Application Under Review",
    sub: "Our team is verifying your license. Expect a decision within 1–2 business days — we'll email you.",
    cta: "Awaiting Approval — We'll Notify You",
    ctaTo: null,
    ctaBg: `rgba(250,111,48,0.12)`,
    ctaColor: ORANGE,
    ctaBorder: `1px solid ${ORANGE}40`,
    ctaDisabled: true,
  }),
  [PROVIDER_LOCKED_SUBSTATES.COURSE_PURCHASED]: () => ({
    icon: GraduationCap, color: PERIWINKLE,
    headline: "Course Locked In — Class Day Approaching",
    sub: "Study materials are open now. Complete them before class day. You can also fast-track a different service by uploading an existing cert.",
    cta: "Open Study Materials",
    ctaTo: createPageUrl("ProviderEnrollments"),
    ctaBg: `linear-gradient(135deg, ${TEAL}, ${PERIWINKLE})`,
    ctaColor: "#fff",
    secondaryCta: "Upload Cert for Another Service",
    secondaryIcon: Upload,
    secondaryTo: createPageUrl("ProviderCredentialsCoverage"),
  }),
  [PROVIDER_LOCKED_SUBSTATES.COURSES_ONLY]: () => ({
    icon: CheckCircle2, color: TEAL,
    headline: "License Verified — Choose Your Path",
    sub: "Enroll in a NOVI course for hands-on training, or upload an existing cert to skip training and activate faster.",
    cta: "Browse NOVI Courses",
    ctaTo: createPageUrl("ProviderEnrollments"),
    ctaBg: `linear-gradient(135deg, ${ORANGE}, ${CORAL})`,
    ctaColor: "#fff",
    secondaryCta: "Upload External Certification",
    secondaryIcon: Upload,
    secondaryTo: createPageUrl("ProviderCredentialsCoverage"),
  }),
  [PROVIDER_LOCKED_SUBSTATES.CERT_BYPASS]: () => ({
    icon: Clock, color: "#9B8EC4",
    headline: "Cert Under Review — Fast Track Active",
    sub: "Your external certification is being reviewed. Approval typically takes 1–2 business days, then MD coverage activates immediately.",
    cta: "Also Enroll in a NOVI Course",
    ctaTo: createPageUrl("ProviderEnrollments"),
    ctaBg: `linear-gradient(135deg, ${TEAL}, ${PERIWINKLE})`,
    ctaColor: "#fff",
  }),
  [PROVIDER_LOCKED_SUBSTATES.MD_ELIGIBLE]: () => ({
    icon: Zap, color: LIME,
    headline: "Certified — One Step to Full Access",
    sub: "Your cert is approved. Subscribe to MD Board coverage to unlock appointments, treatment records, and patient management.",
    cta: "Activate MD Coverage Now",
    ctaTo: createPageUrl("ProviderCredentialsCoverage"),
    ctaBg: `linear-gradient(135deg, ${LIME}, #a8c420)`,
    ctaColor: "#1a2a00",
  }),
  rejected: () => ({
    icon: AlertTriangle, color: CORAL,
    headline: "License Rejected — Action Required",
    sub: "Your license submission was not approved. Review the rejection reason in Credentials and upload corrected documents to continue your journey.",
    cta: "Review & Resubmit License",
    ctaTo: createPageUrl("ProviderCredentialsCoverage"),
    ctaBg: `linear-gradient(135deg, ${CORAL}, #b95046)`,
    ctaColor: "#fff",
    secondaryCta: "Contact Support",
    secondaryIcon: RefreshCcw,
    secondaryTo: createPageUrl("ProviderMessaging"),
  }),
};

// ─── Course card with countdown (renders only when course_purchased) ─────────
function CourseCountdownCard({ enrollment }) {
  const courseTitle = enrollment?.course_title || "Your enrolled course";
  const sessionDate = enrollment?.session_date ? new Date(enrollment.session_date) : null;
  const daysUntil = sessionDate
    ? Math.max(0, Math.ceil((sessionDate - new Date()) / (1000 * 60 * 60 * 24)))
    : null;
  const sessionLabel = sessionDate
    ? sessionDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "TBD";
  const location = enrollment?.location || enrollment?.course_location || "Location TBD";

  return (
    <div className="rounded-2xl overflow-hidden" style={GLASS}>
      <div className="px-5 py-4 flex items-center justify-between gap-4" style={{ background: `linear-gradient(135deg, ${TEAL}, ${PERIWINKLE})` }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.55)" }}>Your Enrolled Course</p>
          <p className="font-bold text-white" style={{ fontFamily: "'DM Serif Display', serif" }}>{courseTitle}</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>{location} · {sessionLabel}</p>
        </div>
        {daysUntil != null && (
          <div className="text-center px-4 py-2 rounded-xl flex-shrink-0" style={{ background: "rgba(255,255,255,0.15)" }}>
            <p className="text-3xl font-black text-white leading-none">{daysUntil}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>days away</p>
          </div>
        )}
      </div>
      <div className="px-5 py-4 space-y-2">
        <div className="flex items-center gap-2 pt-2 mt-1">
          <Timer className="w-3.5 h-3.5" style={{ color: PERIWINKLE }} />
          <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>Quiz required on arrival — complete materials beforehand</p>
        </div>
        <Link to={createPageUrl("ProviderEnrollments")} className="block">
          <button className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90" style={{ background: `rgba(123,142,200,0.12)`, color: TEAL }}>
            Open Pre-Course Materials <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </Link>
      </div>
    </div>
  );
}

// ─── What NOVI includes ──────────────────────────────────────────────────────
const PILLARS = [
  { icon: Shield,      color: LIME,       label: "MD-Supervised Coverage",  note: "Legal backing for every service" },
  { icon: BookOpen,    color: PERIWINKLE, label: "Hands-On Training",       note: "In-person courses & certifications" },
  { icon: Stethoscope, color: TEAL,       label: "Practice Management",     note: "Appointments, charts, records" },
  { icon: ShoppingBag, color: ORANGE,     label: "Supplier Marketplace",    note: "Exclusive pricing on products" },
  { icon: TrendingUp,  color: CORAL,      label: "Growth Studio",           note: "Brand, referrals, business tools" },
  { icon: Heart,       color: "#9B8EC4",  label: "Patient Platform",        note: "GFE, consent forms, aftercare" },
];

/**
 * Props:
 *   - dashboardState   : object from useProviderDashboardState()
 *   - enrollments      : optional Enrollment[] (for course_purchased card)
 */
export default function ProviderDashboardLocked({
  dashboardState,
  enrollments = [],
}) {
  const activeSubState = dashboardState?.isRejected
    ? "rejected"
    : (dashboardState?.lockedSubState || PROVIDER_LOCKED_SUBSTATES.NONE);

  const configFactory = STATE_CONFIG[activeSubState] || STATE_CONFIG[PROVIDER_LOCKED_SUBSTATES.NONE];
  const config = useMemo(
    () => configFactory({ hasCompletedBasic: !!dashboardState?.hasCompletedBasic }),
    [configFactory, dashboardState?.hasCompletedBasic]
  );

  const HeroIcon = config.icon;
  const heroColor = config.color;
  const done = DONE_MAP[activeSubState] || [];
  const activeStep = ACTIVE_STEP_MAP[activeSubState];

  const latestEnrollment = useMemo(() => {
    if (!Array.isArray(enrollments) || enrollments.length === 0) return null;
    return enrollments
      .filter((e) => ["paid", "confirmed"].includes(String(e?.status || "").toLowerCase()))
      .sort((a, b) => new Date(b?.session_date || 0) - new Date(a?.session_date || 0))[0] || null;
  }, [enrollments]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 w-full">

      {/* Next step banner */}
      {!config.ctaDisabled && config.ctaTo && (
        <div
          className="rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4"
          style={{ background: `${heroColor}12`, border: `1px solid ${heroColor}30` }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: `${heroColor}99` }}>Next Step</p>
            <p className="text-sm font-semibold" style={{ color: DARK }}>{config.cta}</p>
          </div>
          <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: heroColor }} />
        </div>
      )}

      {/* Header */}
      <div>
        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3" style={{ background: `${heroColor}1a`, color: heroColor, border: `1px solid ${heroColor}40` }}>
          Provider Onboarding
        </span>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(24px,4vw,36px)", color: DARK, fontStyle: "italic", fontWeight: 400, lineHeight: 1.1 }}>
          Welcome to NOVI Society
        </h1>
        <p className="mt-2 text-sm" style={{ color: "rgba(30,37,53,0.55)" }}>
          Your full dashboard unlocks the moment MD coverage activates. In the meantime, here&rsquo;s exactly where you stand.
        </p>

        {/* Read-only journey stage pills — auto-highlights the provider's real current stage */}
        <div className="flex flex-wrap gap-2 mt-4">
          {JOURNEY_STAGES.map((s) => {
            const isActive = activeSubState === s.id;
            return (
              <span
                key={s.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold select-none"
                style={{
                  background: isActive ? `${s.color}18` : "rgba(255,255,255,0.5)",
                  border: isActive ? `1.5px solid ${s.color}55` : "1px solid rgba(30,37,53,0.1)",
                  color: isActive ? s.color : "rgba(30,37,53,0.4)",
                }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: isActive ? s.color : "rgba(30,37,53,0.15)" }}
                />
                {s.label}
              </span>
            );
          })}
        </div>
      </div>


      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

        {/* Left — state-specific */}
        <div className="space-y-4">

          {/* Status card */}
          <div className="rounded-2xl p-5 space-y-4" style={GLASS}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${heroColor}15` }}>
                <HeroIcon className="w-5 h-5" style={{ color: heroColor }} />
              </div>
              <div className="flex-1">
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(18px,2.5vw,24px)", color: DARK, fontStyle: "italic", fontWeight: 400, lineHeight: 1.15 }}>
                  {config.headline}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.55)" }}>{config.sub}</p>
              </div>
            </div>

            {/* CTAs */}
            <div className="space-y-2">
              {config.ctaTo && !config.ctaDisabled ? (
                <Link to={config.ctaTo}>
                  <button
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
                    style={{ background: config.ctaBg, color: config.ctaColor, border: config.ctaBorder || "none" }}
                  >
                    <ArrowRight className="w-4 h-4" />
                    {config.cta}
                  </button>
                </Link>
              ) : (
                <button
                  disabled={!!config.ctaDisabled}
                  className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                  style={{ background: config.ctaBg, color: config.ctaColor, border: config.ctaBorder || "none", cursor: config.ctaDisabled ? "not-allowed" : "pointer" }}
                >
                  <ArrowRight className="w-4 h-4" />
                  {config.cta}
                </button>
              )}
              {config.secondaryCta && (
                <Link to={config.secondaryTo || createPageUrl("ProviderCredentialsCoverage")}>
                  <button className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:bg-white/80" style={{ background: "rgba(255,255,255,0.5)", color: "rgba(30,37,53,0.6)", border: "1px solid rgba(30,37,53,0.1)" }}>
                    <config.secondaryIcon className="w-4 h-4" />
                    {config.secondaryCta}
                  </button>
                </Link>
              )}
            </div>
          </div>

          {/* Course countdown — only for course_purchased */}
          {activeSubState === PROVIDER_LOCKED_SUBSTATES.COURSE_PURCHASED && (
            <CourseCountdownCard enrollment={latestEnrollment} />
          )}

          {/* Cert bypass note — for cert_bypass */}
          {activeSubState === PROVIDER_LOCKED_SUBSTATES.CERT_BYPASS && (
            <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "rgba(155,142,196,0.12)", border: "1px solid rgba(155,142,196,0.28)" }}>
              <Upload className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#9B8EC4" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: DARK }}>External Cert Submitted — Under Review</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(30,37,53,0.5)" }}>Once approved, MD coverage for this service activates immediately. No course required.</p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(155,142,196,0.2)", color: "#9B8EC4" }}>Pending</span>
            </div>
          )}

          {/* Rejection note — for rejected state */}
          {activeSubState === "rejected" && (
            <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "rgba(218,106,99,0.12)", border: "1px solid rgba(218,106,99,0.28)" }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: CORAL }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: DARK }}>Your license submission needs revision</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(30,37,53,0.5)" }}>Open Credentials & Coverage to read the reviewer's notes and submit corrected documents.</p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(218,106,99,0.2)", color: CORAL }}>Rejected</span>
            </div>
          )}

          {/* Activation path */}
          <div className="rounded-2xl p-5" style={GLASS}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(30,37,53,0.38)" }}>Your Activation Path</p>
            <div className="flex items-center gap-0 overflow-x-auto pb-1">
              {PATH_STEPS.map((step, i) => {
                const isDone = done.includes(step.id);
                const isActive = activeStep === step.id;
                return (
                  <div key={step.id} className="flex items-center flex-shrink-0">
                    <div className="flex flex-col items-center" style={{ minWidth: 72 }}>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          background: isDone ? LIME : isActive ? TEAL : "rgba(30,37,53,0.07)",
                          border: isActive ? `2px solid ${TEAL}` : "none",
                        }}
                      >
                        {isDone
                          ? <CheckCircle2 className="w-4 h-4" style={{ color: "#1a2a00" }} />
                          : <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? "#fff" : "rgba(30,37,53,0.3)" }}>{i + 1}</span>
                        }
                      </div>
                      <p className="text-center mt-1.5 leading-tight" style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, color: isDone ? DARK : isActive ? TEAL : "rgba(30,37,53,0.35)", maxWidth: 64 }}>
                        {step.label}
                      </p>
                    </div>
                    {i < PATH_STEPS.length - 1 && (
                      <div className="h-px flex-shrink-0 mb-4" style={{ width: 16, background: isDone ? `${LIME}80` : "rgba(30,37,53,0.1)" }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right — what's included (always visible) */}
        <div className="space-y-4">
          {/* NOVI brand block */}
          <div className="rounded-2xl p-5" style={{ background: `linear-gradient(160deg, ${DARK} 0%, #2a3550 100%)` }}>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: PERIWINKLE, fontStyle: "italic" }}>novi</span>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(123,142,200,0.45)" }}>Society</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>One membership. Everything a modern aesthetic provider needs.</p>
          </div>

          {/* Platform pillars */}
          <div className="rounded-2xl p-4 space-y-1" style={GLASS}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.38)" }}>What's Included</p>
            {PILLARS.map(({ icon: Icon, color, label, note }) => (
              <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/50 transition-colors">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <div>
                  <p className="text-xs font-semibold leading-tight" style={{ color: DARK }}>{label}</p>
                  <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)", fontSize: 11 }}>{note}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing note */}
          <div className="rounded-2xl p-4" style={{ background: `${LIME}12`, border: `1px solid ${LIME}35` }}>
            <p className="text-xs font-bold" style={{ color: "#3d5615" }}>Starting at $279/mo</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(30,37,53,0.55)" }}>Injectables base membership. Add laser, IV therapy, microneedling & more from $129/mo each.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
