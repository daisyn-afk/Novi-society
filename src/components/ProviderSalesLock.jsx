/**
 * ProviderSalesLock
 * Wraps provider pages with an overlay when the provider hasn't reached the
 * required access tier yet.
 *
 * Access tiers (ascending):
 *   "none"         → no license submitted
 *   "pending"      → license submitted, awaiting admin approval
 *   "courses_only" → license verified; can browse/buy/attend courses + upload external certs
 *   "md_eligible"  → has an active cert; can apply for MD subscription
 *   "full"         → has active MD subscription; full portal access
 *
 * Each page declares which minimum tier it requires via the `requiredTier` prop.
 * If the provider is below that tier, the lock overlay renders.
 */
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Lock, Clock, CheckCircle2, ArrowRight, BookOpen, Award, Shield,
  Stethoscope, Users, Activity, FileText, Zap
} from "lucide-react";

const TIER_ORDER = ["none", "pending", "courses_only", "md_eligible", "full"];

function tierRank(tier) {
  return TIER_ORDER.indexOf(tier);
}

const FEATURE_META = {
  dashboard: {
    title: "Provider Dashboard",
    tagline: "Your command center — metrics, progress paths, and quick actions.",
    bullets: [
      "Track your NOVI & external cert journey step-by-step",
      "See pending alerts (expiring licenses, pending certs)",
      "Quick-access to all provider tools",
      "MD coverage status & upcoming appointments",
    ],
    icon: Activity,
    color: "#7B8EC8",
  },
  enrollments: {
    title: "Courses & Enrollments",
    tagline: "Browse and enroll in NOVI aesthetic training courses.",
    bullets: [
      "Filter courses by category, level, and location",
      "View session dates, instructor info, and what you'll earn",
      "Pre-course study materials included",
      "Earn NOVI certifications upon completion",
    ],
    icon: BookOpen,
    color: "#FA6F30",
  },
  credentials: {
    title: "My Credentials & Coverage",
    tagline: "Manage licenses, certifications, and MD Board coverage.",
    bullets: [
      "Upload and track your professional licenses",
      "Submit external certifications for approval",
      "Apply for NOVI MD Board coverage per service",
      "View your assigned Medical Director",
    ],
    icon: Award,
    color: "#C8E63C",
  },
  practice: {
    title: "My Practice",
    tagline: "Manage appointments, patients, and treatment records.",
    bullets: [
      "View and manage all patient appointments",
      "Document treatment records with clinical notes",
      "Track adverse reactions and compliance",
      "Build your reputation with verified reviews",
    ],
    icon: Stethoscope,
    color: "#DA6A63",
  },
  profile: {
    title: "Provider Profile",
    tagline: "Your public-facing profile patients see when booking.",
    bullets: [
      "Upload a professional photo and bio",
      "Showcase your certifications and specialties",
      "Set your service offerings and availability",
      "Get discovered by patients searching for providers",
    ],
    icon: Users,
    color: "#7B8EC8",
  },
  marketplace: {
    title: "Supplier Marketplace",
    tagline: "Connect directly with top aesthetic product manufacturers and get exclusive provider pricing.",
    bullets: [
      "Browse verified suppliers for injectables, fillers, devices & skincare",
      "Pre-filled applications using your NOVI credentials — apply in seconds",
      "Unlock exclusive provider-only pricing and rep access",
      "Manage all your manufacturer accounts in one place",
      "Receive personalized product recommendations based on your services",
    ],
    icon: Zap,
    color: "#C8E63C",
  },
};

// What CTA / messaging to show based on the provider's current tier
function LockMessage({ currentStatus, feature }) {
  if (currentStatus === "none") {
    return (
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl mb-6" style={{ background: "rgba(218,106,99,0.18)", border: "1px solid rgba(218,106,99,0.35)" }}>
        <Lock className="w-5 h-5 flex-shrink-0" style={{ color: "#DA6A63" }} />
        <div>
          <p className="font-bold text-white text-sm">Apply to Unlock the Provider Portal</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>Submit your license and choose your certification path to get started.</p>
        </div>
      </div>
    );
  }
  if (currentStatus === "pending") {
    return (
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl mb-6" style={{ background: "rgba(250,111,48,0.18)", border: "1px solid rgba(250,111,48,0.4)" }}>
        <Clock className="w-5 h-5 flex-shrink-0" style={{ color: "#FA6F30" }} />
        <div>
          <p className="font-bold text-white text-sm">Application Under Review</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
            Our team is verifying your credentials. You'll be notified once approved — usually within 1–2 business days.
          </p>
        </div>
      </div>
    );
  }
  if (currentStatus === "courses_only") {
    // They're verified but haven't earned a cert yet — need to take a course or upload external cert
    return (
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl mb-6" style={{ background: "rgba(123,142,200,0.18)", border: "1px solid rgba(123,142,200,0.4)" }}>
        <BookOpen className="w-5 h-5 flex-shrink-0" style={{ color: "#7B8EC8" }} />
        <div>
          <p className="font-bold text-white text-sm">Complete Training to Unlock This</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
            Purchase and attend a NOVI course, or upload an external certification for admin approval to unlock MD coverage and full portal access.
          </p>
        </div>
      </div>
    );
  }
  if (currentStatus === "md_eligible") {
    // They have a cert but haven't activated an MD subscription yet
    return (
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl mb-6" style={{ background: "rgba(200,230,60,0.15)", border: "1px solid rgba(200,230,60,0.4)" }}>
        <Zap className="w-5 h-5 flex-shrink-0" style={{ color: "#C8E63C" }} />
        <div>
          <p className="font-bold text-white text-sm">One Step Away — Activate MD Coverage</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
            Your certification is approved! Sign up for an MD Board subscription to unlock full practice features.
          </p>
        </div>
      </div>
    );
  }
  return null;
}

function LockCTA({ currentStatus }) {
  if (currentStatus === "none") {
    return (
      <Link to={createPageUrl("ProviderBasicOnboarding")}>
        <button className="w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #FA6F30, #DA6A63)" }}>
          Apply Now — It Takes 2 Minutes <ArrowRight className="w-4 h-4" />
        </button>
      </Link>
    );
  }
  if (currentStatus === "pending") {
    return (
      <div className="w-full py-3.5 rounded-2xl text-center font-bold text-sm" style={{ background: "rgba(250,111,48,0.2)", color: "#FA6F30", border: "1px solid rgba(250,111,48,0.35)" }}>
        <Clock className="inline w-4 h-4 mr-2 mb-0.5" />
        Awaiting Approval — we'll notify you by email
      </div>
    );
  }
  if (currentStatus === "courses_only") {
    return (
      <div className="space-y-2">
        <Link to={createPageUrl("ProviderEnrollments")}>
          <button className="w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #FA6F30, #DA6A63)" }}>
            <BookOpen className="w-4 h-4" /> Browse & Enroll in NOVI Courses
          </button>
        </Link>
        <Link to={createPageUrl("ProviderCredentialsCoverage") + "?tab=certifications"}>
          <button className="w-full py-2.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-80" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.2)" }}>
            <Award className="w-4 h-4" /> Upload External Certification Instead
          </button>
        </Link>
      </div>
    );
  }
  if (currentStatus === "md_eligible") {
    return (
      <Link to={createPageUrl("ProviderCredentialsCoverage") + "?tab=coverage"}>
        <button className="w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #C8E63C, #a8c420)", color: "#1a2a00" }}>
          <Zap className="w-4 h-4" /> Apply for MD Board Coverage Now
        </button>
      </Link>
    );
  }
  return null;
}

export default function ProviderSalesLock({ feature, applicationStatus, requiredTier = "full", children }) {
  const meta = FEATURE_META[feature] || FEATURE_META.dashboard;
  const Icon = meta.icon;

  if (applicationStatus === "loading") {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.9)" }}>
          <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
          <p className="text-sm font-semibold" style={{ color: "rgba(30,37,53,0.75)" }}>Checking your provider access…</p>
        </div>
      </div>
    );
  }

  // If provider meets or exceeds the required tier, show real content
  if (tierRank(applicationStatus) >= tierRank(requiredTier)) {
    return children;
  }

  return (
    <div className="relative min-h-screen">
      {/* Blurred real content in background */}
      <div className="pointer-events-none select-none" style={{ filter: "blur(6px)", opacity: 0.18, userSelect: "none" }}>
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-start pt-12 px-4" style={{ background: "linear-gradient(to bottom, rgba(30,37,53,0.7) 0%, rgba(30,37,53,0.55) 100%)" }}>
        <div className="w-full max-w-lg">

          <LockMessage currentStatus={applicationStatus} feature={feature} />

          {/* Feature card */}
          <div className="rounded-3xl overflow-hidden" style={{ background: "rgba(255,255,255,0.14)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.22)" }}>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-center gap-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${meta.color}22` }}>
                <Icon className="w-6 h-6" style={{ color: meta.color }} />
              </div>
              <div>
                <p className="font-bold text-white text-base">{meta.title}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>{meta.tagline}</p>
              </div>
            </div>

            {/* What you unlock */}
            <div className="px-6 py-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>What you'll get</p>
              {meta.bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: meta.color }} />
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>{b}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="px-6 pb-6">
              <LockCTA currentStatus={applicationStatus} />
            </div>
          </div>

          {/* Footer trust note */}
          <p className="text-center text-xs mt-5" style={{ color: "rgba(255,255,255,0.3)" }}>
            NOVI reviews all applications within 1–2 business days
          </p>
        </div>
      </div>
    </div>
  );
}