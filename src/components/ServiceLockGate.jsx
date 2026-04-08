import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  Shield, Lock, ArrowRight, Zap, BookOpen, Award, Clock, CheckCircle,
  Stethoscope, Calendar, FileText, ClipboardList, ShieldCheck, Star, Users, TrendingUp, Sparkles
} from "lucide-react";
import { useServiceAccess } from "@/components/useServiceAccess";

const B = {
  navy: "#2d3d66",
  periwinkle: "#3d4f7c",
  orange: "#FA6F30",
  coral: "#DA6A63",
  lime: "#C8E63C",
  cream: "#F0EDE8",
  creamDark: "#C6BEA8",
};

const FEATURE_COPY = {
  enrollments: {
    Icon: ClipboardList,
    eyebrow: "The NOVI Training Record",
    headline: "Your Path to Mastery, Beautifully Documented.",
    sub: "The most elite aesthetic providers in the country track their growth through NOVI. Every enrollment, every certification, every milestone — in one protected record that follows you for life.",
    bullets: [
      "Every paid course & upcoming class in one view",
      "Attendance verified, certifications auto-issued",
      "Your MD activation journey, step by step",
    ],
    stats: [
      { value: "100%", label: "Digital record" },
      { value: "MD-Backed", label: "Verification" },
      { value: "Lifetime", label: "Access" },
    ],
    ctaLabel: "Start Your First Enrollment",
  },
  attendance: {
    Icon: CheckCircle,
    eyebrow: "Verified. Protected. Remembered.",
    headline: "One Code. A Lifetime of Legal Coverage.",
    sub: "Attendance verification is the gateway to MD-backed practice rights. NOVI is the only platform that ties your in-class presence directly to your clinical protection — instantly.",
    bullets: [
      "Confirm attendance in under 60 seconds",
      "Instantly unlocks MD coverage eligibility",
      "Builds your verified, tamper-proof NOVI record",
    ],
    stats: [
      { value: "<60s", label: "Verification" },
      { value: "Instant", label: "MD Eligibility" },
      { value: "0 Paperwork", label: "Required" },
    ],
    ctaLabel: "Enroll in a Course",
  },
  certifications: {
    Icon: Award,
    eyebrow: "Credentials That Command Respect",
    headline: "NOVI Certification is the Gold Standard.",
    sub: "Patients search for it. Medical directors trust it. Other platforms don't offer it. A NOVI certification is not just a badge — it's your signal to the market that you operate at the highest level.",
    bullets: [
      "Recognized by MDs across the NOVI network",
      "Tied directly to your active service coverage",
      "Displayed on your public patient-facing profile",
    ],
    stats: [
      { value: "Elite", label: "Verification" },
      { value: "MD-Signed", label: "Recognition" },
      { value: "Public", label: "Visibility" },
    ],
    ctaLabel: "Get Certified",
  },
  scope: {
    Icon: ShieldCheck,
    eyebrow: "Clinical Clarity. Legal Confidence.",
    headline: "Know Exactly What You're Cleared to Do.",
    sub: "No guesswork. No gray areas. NOVI gives you personalized, MD-approved protocols per service — the only platform that defines your exact clinical boundaries so you can practice boldly and without risk.",
    bullets: [
      "Per-service protocol rules, unit limits & treatment areas",
      "Updated in real-time by your supervising MD",
      "Protects you legally in every patient interaction",
    ],
    stats: [
      { value: "Real-Time", label: "MD Updates" },
      { value: "Per-Service", label: "Protocols" },
      { value: "Legal", label: "Protection" },
    ],
    ctaLabel: "Activate MD Coverage",
  },
  licenses: {
    Icon: FileText,
    eyebrow: "Your Credentials. Verified. Visible. Valued.",
    headline: "The Professionals Who Matter Track Licenses Here.",
    sub: "NOVI is the only aesthetics platform with built-in admin-verified license management. Upload once — stay compliant forever. Providers who track their credentials here never practice blind.",
    bullets: [
      "All professional licenses in one verified hub",
      "Admin-reviewed and status-tracked",
      "Renewal alerts so you never lapse",
    ],
    stats: [
      { value: "Admin", label: "Verified" },
      { value: "Auto", label: "Alerts" },
      { value: "Always", label: "Compliant" },
    ],
    ctaLabel: "Get Started",
  },
  appointments: {
    Icon: Calendar,
    eyebrow: "Your Practice. On Your Terms.",
    headline: "A Patient Experience as Elite as Your Training.",
    sub: "NOVI-connected providers don't just take appointments — they build patient relationships. Manage confirmations, completions, and your full clinical schedule through a system designed for the top 1% of aesthetic professionals.",
    bullets: [
      "Confirm, decline & manage patient requests",
      "Tied directly to your active service coverage",
      "Every appointment documented on your record",
    ],
    stats: [
      { value: "Full", label: "Scheduling" },
      { value: "MD-Linked", label: "Coverage" },
      { value: "On-Record", label: "Always" },
    ],
    ctaLabel: "Unlock Your Dashboard",
  },
  practice: {
    Icon: Stethoscope,
    eyebrow: "Build Something Exceptional",
    headline: "The Practice You've Envisioned. Finally, a Platform to Match.",
    sub: "NOVI isn't a booking tool — it's a brand builder. Define your treatment menu, set your signature pricing, and present your practice to patients the way elite providers do. This is your stage.",
    bullets: [
      "List treatments with custom pricing & descriptions",
      "Set your availability and consultation fees",
      "Appear in the NOVI patient marketplace",
    ],
    stats: [
      { value: "Custom", label: "Branding" },
      { value: "Marketplace", label: "Visibility" },
      { value: "Patient", label: "Ready" },
    ],
    ctaLabel: "Activate & Start Building",
  },
  md_coverage: {
    Icon: Shield,
    eyebrow: "Clinical Oversight. Zero Compromise.",
    headline: "Practice Under the Shield of a Medical Director.",
    sub: "NOVI's MD coverage program is the only one of its kind in aesthetics. Legal protection, signed protocols, and continuous clinical oversight — so you can offer services with absolute confidence and zero liability gaps.",
    bullets: [
      "Per-service medical director supervision",
      "Signed legal agreements, digitally sealed",
      "Instant activation after completing NOVI training",
    ],
    stats: [
      { value: "1-of-1", label: "In Aesthetics" },
      { value: "Instant", label: "Activation" },
      { value: "Full", label: "Legal Cover" },
    ],
    ctaLabel: "View Coverage Plans",
  },
  default: {
    Icon: Lock,
    eyebrow: "The NOVI Society",
    headline: "This Feature is Reserved for NOVI Members.",
    sub: "The NOVI Society is not a platform — it's an invitation to practice at the highest level. Elite training, MD oversight, and a community that is actively redefining the aesthetics industry.",
    bullets: ["MD-backed clinical coverage", "NOVI-certified, recognized training", "A new standard of patient care"],
    stats: [
      { value: "Elite", label: "Network" },
      { value: "MD-Backed", label: "Coverage" },
      { value: "1-of-1", label: "Platform" },
    ],
    ctaLabel: "Join the NOVI Society",
  },
};

export default function ServiceLockGate({ serviceTypeId, serviceTypeName, feature, children, bypass }) {
  const { isLoading, hasActiveMD, canAccessService, hasPendingActivity, enrollments } = useServiceAccess();

  if (bypass) return <>{children}</>;
  if (isLoading) return null;

  const copy = FEATURE_COPY[feature] || FEATURE_COPY.default;

  if (!hasActiveMD && !hasPendingActivity) return <NoActivityScreen copy={copy} feature={feature} />;
  if (!hasActiveMD && hasPendingActivity) {
    const hasPaidEnrollment = enrollments.some(e => ["paid", "confirmed", "attended", "completed"].includes(e.status));
    return <PendingActivationScreen copy={copy} hasPaidEnrollment={hasPaidEnrollment} />;
  }
  if (serviceTypeId && !canAccessService(serviceTypeId)) return <ServiceNotCoveredScreen copy={copy} serviceTypeName={serviceTypeName} />;

  return <>{children}</>;
}

function BrandCard({ children }) {
  return (
    <div className="flex items-center justify-center min-h-[65vh] py-8">
      <div className="max-w-xl w-full mx-4 rounded-2xl overflow-hidden" style={{ boxShadow: "0 12px 60px rgba(45,61,102,0.22)", border: "1px solid rgba(107,125,179,0.18)" }}>
        {children}
      </div>
    </div>
  );
}

function BrandHeader({ Icon, eyebrow, headline, sub }) {
  return (
    <div
      className="px-8 pt-10 pb-8 text-center relative overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 5% 15%, rgba(218,106,99,0.42) 0%, transparent 48%),
          radial-gradient(ellipse at 92% 85%, rgba(250,111,48,0.32) 0%, transparent 45%),
          radial-gradient(ellipse at 60% 0%, rgba(255,255,255,0.06) 0%, transparent 40%),
          linear-gradient(160deg, #3d4f7c 0%, #2d3d66 55%, #1e2d52 100%)
        `,
      }}
    >
      <div style={{ position: "absolute", top: -25, right: -25, width: 150, height: 150, borderRadius: "60% 40% 70% 30% / 50% 60% 40% 50%", background: "rgba(250,111,48,0.14)", filter: "blur(3px)" }} />
      <div style={{ position: "absolute", bottom: -20, left: "15%", width: 100, height: 100, borderRadius: "40% 60% 30% 70% / 60% 40% 60% 40%", background: "rgba(200,230,60,0.10)", filter: "blur(2px)" }} />
      <div style={{ position: "absolute", top: "40%", left: -10, width: 70, height: 70, borderRadius: "50%", background: "rgba(218,106,99,0.12)", filter: "blur(2px)" }} />

      <div className="relative z-10">
        {/* NOVI badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4" style={{ background: "rgba(250,111,48,0.18)", border: "1px solid rgba(250,111,48,0.35)" }}>
          <Sparkles className="w-3 h-3" style={{ color: "#FA6F30" }} />
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#FA6F30" }}>NOVI Society</span>
        </div>

        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(250,111,48,0.18)", border: "1.5px solid rgba(250,111,48,0.4)" }}>
          <Icon className="w-7 h-7" style={{ color: "#FA6F30" }} />
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.22em] mb-3" style={{ color: "rgba(250,111,48,0.85)" }}>{eyebrow}</p>
        <h2 className="text-2xl font-bold text-white mb-3 leading-tight" style={{ fontFamily: "'DM Serif Display', serif" }}>{headline}</h2>
        <p className="text-white/60 text-sm leading-relaxed max-w-sm mx-auto">{sub}</p>

        {/* Tagline */}
        <p className="mt-5 text-xs italic font-medium" style={{ color: "rgba(250,111,48,0.65)" }}>"A new way to be seen."</p>
      </div>
    </div>
  );
}

function BrandStats({ stats }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-3 divide-x" style={{ background: "#1e2d52", divideColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.08)", borderTopWidth: 1, borderTopStyle: "solid" }}>
      {stats.map(({ value, label }, i) => (
        <div key={i} className="py-3 text-center" style={{ borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
          <p className="text-base font-bold tracking-tight" style={{ color: "#FA6F30", fontFamily: "'DM Sans', sans-serif" }}>{value}</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>{label}</p>
        </div>
      ))}
    </div>
  );
}

function BrandBullets({ bullets }) {
  return (
    <div className="px-8 py-5" style={{ borderBottom: "1px solid rgba(198,190,168,0.25)", background: "rgba(240,237,232,0.55)" }}>
      <div className="space-y-2.5">
        {bullets.map((b, i) => (
          <div key={i} className="flex items-center gap-3 text-sm font-medium" style={{ color: B.navy }}>
            <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: B.orange }} />
            {b}
          </div>
        ))}
      </div>
    </div>
  );
}

function NoActivityScreen({ copy, feature }) {
  // Show custom dashboard unlock screen for dashboard feature
  if (feature === "dashboard") {
    const ProviderDashboardUnlock = require("@/components/ProviderDashboardUnlock").default;
    return <ProviderDashboardUnlock />;
  }

  const { Icon, eyebrow, headline, sub, bullets, stats, ctaLabel } = copy;
  return (
    <BrandCard>
      <BrandHeader Icon={Icon} eyebrow={eyebrow} headline={headline} sub={sub} />
      <BrandStats stats={stats} />
      <BrandBullets bullets={bullets} />
      <div className="px-8 py-6 grid grid-cols-2 gap-3" style={{ background: "white" }}>
        <Link to={createPageUrl("ProviderGettingStarted")} className="h-full">
          <div
            className="border-2 border-dashed rounded-xl p-4 cursor-pointer text-center h-full flex flex-col items-center justify-center transition-all hover:bg-orange-50 hover:border-orange-300"
            style={{ borderColor: "rgba(250,111,48,0.3)" }}
          >
            <Award className="w-6 h-6 mb-2" style={{ color: B.orange }} />
            <p className="font-semibold text-sm" style={{ color: B.navy }}>Already Certified?</p>
            <p className="text-xs mt-0.5" style={{ color: B.creamDark }}>Submit your credentials</p>
          </div>
        </Link>
        <Link to={createPageUrl("CourseCatalog")} className="h-full">
          <div
            className="rounded-xl p-4 cursor-pointer text-center h-full flex flex-col items-center justify-center transition-all hover:opacity-90"
            style={{ background: `linear-gradient(160deg, #3d4f7c 0%, #2d3d66 100%)` }}
          >
            <BookOpen className="w-6 h-6 mb-2" style={{ color: "#FA6F30" }} />
            <p className="font-semibold text-white text-sm">{ctaLabel}</p>
            <p className="text-xs text-white/45 mt-0.5">Train. Certify. Practice.</p>
          </div>
        </Link>
      </div>
      <div className="px-8 pb-5 pt-0 text-center" style={{ background: "white" }}>
        <p className="text-xs italic" style={{ color: B.creamDark }}>"A new way to be seen." — <span className="font-semibold not-italic" style={{ color: B.navy }}>The NOVI Society</span></p>
      </div>
    </BrandCard>
  );
}

function PendingActivationScreen({ copy, hasPaidEnrollment }) {
  const { Icon, eyebrow, headline, sub, bullets, stats } = copy;
  return (
    <BrandCard>
      <BrandHeader Icon={Clock} eyebrow="You're Almost In" headline="One Step Separates You From the Elite." sub="Your training is confirmed. All that's left is activating your MD coverage — the final step that separates NOVI members from everyone else in aesthetics." />
      <BrandStats stats={stats} />
      <div className="px-8 py-6 space-y-3" style={{ background: "white" }}>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(200,230,60,0.13)", border: "1px solid rgba(90,138,60,0.28)" }}>
          <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#5a8a3c" }} />
          <div>
            <p className="text-sm font-bold" style={{ color: "#3a6a1c" }}>
              {hasPaidEnrollment ? "Course enrollment confirmed ✓" : "Certification submitted ✓"}
            </p>
            <p className="text-xs" style={{ color: "#5a8a3c" }}>Step 1 of 2 complete</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(250,111,48,0.07)", border: "2px solid rgba(250,111,48,0.38)" }}>
          <Zap className="w-5 h-5 flex-shrink-0" style={{ color: B.orange }} />
          <div>
            <p className="text-sm font-bold" style={{ color: B.navy }}>Activate your MD coverage</p>
            <p className="text-xs mt-0.5" style={{ color: B.periwinkle }}>Sign your agreement — your NOVI membership activates instantly</p>
          </div>
        </div>
        <Link to={createPageUrl("ProviderCredentialsCoverage")}>
          <Button className="w-full mt-1 text-white font-semibold gap-2" style={{ background: `linear-gradient(135deg, ${B.orange}, ${B.coral})` }}>
            Activate My NOVI Membership <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
        <p className="text-xs text-center italic pt-1" style={{ color: B.creamDark }}>"A new way to be seen." — <span className="font-semibold not-italic" style={{ color: B.navy }}>The NOVI Society</span></p>
      </div>
    </BrandCard>
  );
}

function ServiceNotCoveredScreen({ copy, serviceTypeName }) {
  return (
    <BrandCard>
      <BrandHeader
        Icon={Shield}
        eyebrow="Unlock This Service"
        headline={serviceTypeName ? `Activate Coverage for ${serviceTypeName}.` : "This Service Isn't Covered Yet."}
        sub="NOVI is the only aesthetics platform that ties your training directly to MD-backed coverage per service. Complete the steps below and you'll be protected — and practicing — in days, not months."
      />
      <BrandStats stats={[{ value: "Days", label: "Not Months" }, { value: "MD-Signed", label: "Agreement" }, { value: "Instant", label: "Activation" }]} />
      <div className="px-8 py-5" style={{ borderBottom: "1px solid rgba(198,190,168,0.25)", background: "rgba(240,237,232,0.55)" }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: B.creamDark }}>Your activation path:</p>
        <ol className="space-y-2.5">
          {[
            "Complete a NOVI course for this service",
            "Redeem your in-class attendance code",
            "Sign the MD coverage agreement",
            "Coverage activates instantly — start practicing",
          ].map((step, i) => (
            <li key={i} className="flex items-center gap-3 text-sm font-medium" style={{ color: B.navy }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white" style={{ background: B.orange }}>{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      <div className="px-8 py-6 space-y-3" style={{ background: "white" }}>
        <Link to={createPageUrl("ProviderCredentialsCoverage")}>
          <Button className="w-full text-white font-semibold gap-2" style={{ background: `linear-gradient(135deg, ${B.orange}, ${B.coral})` }}>
            View MD Coverage Plans <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
        <Link to={createPageUrl("CourseCatalog")}>
          <Button variant="outline" className="w-full font-medium" style={{ borderColor: "rgba(61,79,124,0.3)", color: B.navy }}>
            Browse Courses for This Service
          </Button>
        </Link>
        <p className="text-xs text-center italic pt-1" style={{ color: B.creamDark }}>"A new way to be seen." — <span className="font-semibold not-italic" style={{ color: B.navy }}>The NOVI Society</span></p>
      </div>
    </BrandCard>
  );
}