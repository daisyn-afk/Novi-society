/**
 * ProviderSalesLock
 *
 * Page-level wrapper that gates provider pages by access tier. Renders the
 * real page content with a `LockedOverlay` on top whenever the provider's
 * current tier is below the page's `requiredTier`. The route stays mounted
 * so the sidebar/routing experience is preserved — only the page content
 * is visually locked.
 *
 * Access tiers (ascending):
 *   "none"         → no license submitted
 *   "pending"      → license submitted, awaiting admin approval
 *   "courses_only" → license verified; can browse/buy/attend courses + upload external certs
 *   "md_eligible"  → has an active cert; can apply for MD subscription
 *   "full"         → has active MD subscription; full portal access
 *
 * Each page declares which minimum tier it requires via the `requiredTier`
 * prop. If the provider is below that tier, the LockedOverlay renders.
 */
import LockedOverlay from "@/components/LockedOverlay";
import { meetsTier } from "@/lib/providerLockedSections";
import { createPageUrl } from "@/utils";
import {
  Activity,
  Award,
  BookOpen,
  Clock,
  Lock,
  Rocket,
  ShoppingBag,
  Stethoscope,
  Users,
  Zap,
} from "lucide-react";

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
    tagline:
      "Connect directly with top aesthetic product manufacturers and get exclusive provider pricing.",
    bullets: [
      "Browse verified suppliers for injectables, fillers, devices & skincare",
      "Pre-filled applications using your NOVI credentials — apply in seconds",
      "Unlock exclusive provider-only pricing and rep access",
      "Manage all your manufacturer accounts in one place",
      "Personalized product recommendations based on your services",
    ],
    icon: ShoppingBag,
    color: "#C8E63C",
  },
  growth_studio: {
    title: "Growth Studio",
    tagline:
      "Your business workspace — pricing tools, content studio, and your AI mentor.",
    bullets: [
      "ROI calculator with real provider benchmarks",
      "AI-assisted Creative Studio for posts, captions and offers",
      "Brainstorm with your built-in business mentor",
      "Step-by-step launch & growth checklists",
    ],
    icon: Rocket,
    color: "#7B8EC8",
  },
};

function statusBadgeFor(status) {
  if (status === "none") {
    return (
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
        style={{
          background: "rgba(218,106,99,0.12)",
          border: "1px solid rgba(218,106,99,0.3)",
        }}
      >
        <Lock className="w-4 h-4 flex-shrink-0" style={{ color: "#DA6A63" }} />
        <p className="text-xs font-semibold" style={{ color: "#7A2A24" }}>
          Apply to NOVI to start unlocking the Provider Portal.
        </p>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
        style={{
          background: "rgba(250,111,48,0.12)",
          border: "1px solid rgba(250,111,48,0.3)",
        }}
      >
        <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "#FA6F30" }} />
        <p className="text-xs font-semibold" style={{ color: "#7A2E11" }}>
          License under review — usually 1–2 business days.
        </p>
      </div>
    );
  }
  if (status === "courses_only") {
    return (
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
        style={{
          background: "rgba(123,142,200,0.12)",
          border: "1px solid rgba(123,142,200,0.3)",
        }}
      >
        <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: "#7B8EC8" }} />
        <p className="text-xs font-semibold" style={{ color: "#24395D" }}>
          Complete a NOVI course or upload an external cert to unlock this section.
        </p>
      </div>
    );
  }
  if (status === "md_eligible") {
    return (
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
        style={{
          background: "rgba(200,230,60,0.16)",
          border: "1px solid rgba(200,230,60,0.4)",
        }}
      >
        <Zap className="w-4 h-4 flex-shrink-0" style={{ color: "#7a9e10" }} />
        <p className="text-xs font-semibold" style={{ color: "#3D5600" }}>
          Activate MD Board coverage to unlock full practice features.
        </p>
      </div>
    );
  }
  return null;
}

function ctasFor(status) {
  if (status === "none") {
    return {
      primary: {
        label: "Apply Now — Takes 2 Minutes",
        to: createPageUrl("ProviderBasicOnboarding"),
      },
      secondary: {
        label: "Browse Courses",
        to: createPageUrl("ProviderEnrollments"),
      },
    };
  }
  if (status === "pending") {
    return {
      primary: {
        label: "Awaiting Approval — We'll Email You",
      },
      secondary: {
        label: "Browse Courses While You Wait",
        to: createPageUrl("ProviderEnrollments"),
      },
    };
  }
  if (status === "courses_only") {
    return {
      primary: {
        label: "Browse & Enroll in NOVI Courses",
        to: createPageUrl("ProviderEnrollments"),
      },
      secondary: {
        label: "Upload External Certification Instead",
        to: `${createPageUrl("ProviderCredentialsCoverage")}?tab=certifications`,
      },
    };
  }
  if (status === "md_eligible") {
    return {
      primary: {
        label: "Apply for MD Board Coverage",
        to: `${createPageUrl("ProviderCredentialsCoverage")}?tab=coverage`,
      },
    };
  }
  return {};
}

export default function ProviderSalesLock({
  feature,
  applicationStatus,
  requiredTier = "full",
  children,
}) {
  const meta = FEATURE_META[feature] || FEATURE_META.dashboard;

  if (applicationStatus === "loading") {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.9)" }}
        >
          <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
          <p className="text-sm font-semibold" style={{ color: "rgba(30,37,53,0.75)" }}>
            Checking your provider access…
          </p>
        </div>
      </div>
    );
  }

  if (meetsTier(applicationStatus, requiredTier)) {
    return children;
  }

  const { primary, secondary } = ctasFor(applicationStatus);

  return (
    <LockedOverlay
      title={meta.title}
      description={meta.tagline}
      benefits={meta.bullets}
      icon={meta.icon}
      accentColor={meta.color}
      statusBadge={statusBadgeFor(applicationStatus)}
      primaryCta={primary}
      secondaryCta={secondary}
      footnote="NOVI reviews all applications within 1–2 business days."
    >
      {children}
    </LockedOverlay>
  );
}
