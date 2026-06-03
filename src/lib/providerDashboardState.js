/**
 * providerDashboardState.js
 *
 * SINGLE SOURCE OF TRUTH for the provider dashboard locked → active lifecycle.
 *
 * Used by:
 *   - useProviderDashboardState (hook)         → resolves the current state from live data
 *   - pages/ProviderDashboard.jsx              → renders Locked vs Active dashboard
 *   - Layout.jsx                               → gates sidebar items
 *   - components/provider/ProviderFeatureLockOverlay → wraps locked sidebar pages
 *   - App.jsx → RequireRoleRoute               → post-login routing (no longer force-redirects to onboarding form)
 *
 * Canonical unlock condition:
 *   state === 'active'  ⇔  the provider has at least one active MDSubscription
 *
 * Everything below "active" is a sub-state of "locked" that maps 1:1 to the
 * six pills in the Base44 onboarding-preview design:
 *
 *     locked / none              → New Provider (no license, no enrollment)
 *     locked / pending           → License Submitted (license pending review)
 *     locked / course_purchased  → Course Purchased (paid enrollment, license still pending)
 *     locked / courses_only      → License Verified (verified license, no cert yet)
 *     locked / cert_bypass       → Cert Upload (external cert under review)
 *     locked / md_eligible       → Cert Approved (active cert, no MD coverage yet)
 *     rejected                   → All licenses rejected, no pending submissions
 *     active                     → has at least one active MDSubscription
 *     non_provider               → not a provider (admin/MD/patient/staff)
 *
 * Each sub-state has a deterministic `nextAction` that the UI uses for CTAs.
 *
 * Legacy safety:
 *   Providers without a provider_onboarding row but WITH verified license /
 *   active cert / active MD sub still resolve to a meaningful state (no
 *   regressions for existing active providers).
 */

import { normalizeRole } from "@/lib/routeAccessPolicy";

export const PROVIDER_DASHBOARD_STATES = Object.freeze({
  NON_PROVIDER: "non_provider",
  LOCKED: "locked",
  REJECTED: "rejected",
  ACTIVE: "active",
});

export const PROVIDER_LOCKED_SUBSTATES = Object.freeze({
  NONE: "none",
  PENDING: "pending",
  COURSE_PURCHASED: "course_purchased",
  COURSES_ONLY: "courses_only",
  CERT_BYPASS: "cert_bypass",
  MD_ELIGIBLE: "md_eligible",
});

/**
 * Pages a locked provider can still REACH AND USE.
 * Everything else either shows the locked-feature overlay or is hidden.
 *
 * NOTE: ProviderDashboard itself is intentionally NOT in this list — when
 * locked, ProviderDashboard renders the LockedDashboard component instead,
 * but the URL is the same.
 */
export const PROVIDER_LOCKED_ACCESSIBLE_PAGES = Object.freeze(new Set([
  "ProviderDashboard",
  "ProviderEnrollments",         // Courses & Enrollments
  "ProviderCredentialsCoverage", // Apply for Coverage / upload license / upload cert
  "ProviderCodeRedemption",      // Class attendance (needed during class day)
  "CourseCatalog",
  "CourseCheckout",
  "ProviderProfile",
  "ProviderBasicOnboarding",
  "ProviderMessaging",           // Talk to support / MD
  "ProviderGettingStarted",
]));

/**
 * Pages that exist for providers but are PROMOTIONALLY locked until active.
 * Clicking them is allowed, but the page content renders the locked overlay.
 */
export const PROVIDER_LOCKED_PROMOTIONAL_PAGES = Object.freeze(new Set([
  "ProviderMarketplace",   // Supplier Marketplace
  "ProviderLaunchPad",     // Growth Studio
  "ProviderPractice",      // My Practice
  "ProviderAppointments",
  "ProviderReviews",
  "ProviderMDRelationships",
  "ProviderScopeRules",
  "ProviderSubscription",
]));

// ─── pure predicates ───────────────────────────────────────────────────────

function hasVerifiedLicense(licenses) {
  return Array.isArray(licenses) && licenses.some((l) => l?.status === "verified");
}
function hasPendingLicense(licenses) {
  return Array.isArray(licenses) && licenses.some((l) => l?.status === "pending_review");
}
function allLicensesRejected(licenses) {
  if (!Array.isArray(licenses) || licenses.length === 0) return false;
  return (
    licenses.every((l) => l?.status === "rejected") &&
    !licenses.some((l) => l?.status === "pending_review" || l?.status === "verified")
  );
}
function hasAnyLicense(licenses) {
  return Array.isArray(licenses) && licenses.length > 0;
}
function hasActiveCert(certs) {
  return Array.isArray(certs) && certs.some((c) => c?.status === "active");
}
function hasPendingCert(certs) {
  return Array.isArray(certs) && certs.some((c) => c?.status === "pending");
}
function hasActiveMdSub(subs) {
  return Array.isArray(subs) && subs.some((s) => s?.status === "active");
}
function hasPaidEnrollment(enrollments) {
  return (
    Array.isArray(enrollments) &&
    enrollments.some((e) =>
      ["paid", "confirmed", "attended", "completed"].includes(String(e?.status || "").toLowerCase())
    )
  );
}

/**
 * Whether the provider has satisfied basic onboarding — either via the
 * provider_basic_onboarding form or legacy activation (verified license,
 * active certification, or active MD subscription).
 */
export function resolveHasCompletedBasic({
  onboarding,
  licenses = [],
  certs = [],
  mdSubs = [],
} = {}) {
  if (onboarding?.has_completed_basic === true) return true;
  if (hasVerifiedLicense(licenses)) return true;
  if (hasActiveCert(certs)) return true;
  if (hasActiveMdSub(mdSubs)) return true;
  return false;
}

// ─── core resolver ─────────────────────────────────────────────────────────

/**
 * @param {object} input
 * @param {object|null} input.user         - result of base44.auth.me()
 * @param {object|null} input.onboarding   - result of providerOnboardingApi.getMe() (or null on failure)
 * @param {Array}       input.licenses     - License[]
 * @param {Array}       input.certs        - Certification[]
 * @param {Array}       input.mdSubs       - MDSubscription[]
 * @param {Array}       input.enrollments  - Enrollment[]
 * @returns {object}    state descriptor (see file header)
 */
export function resolveProviderDashboardState({
  user,
  onboarding,
  licenses = [],
  certs = [],
  mdSubs = [],
  enrollments = [],
} = {}) {
  const role = normalizeRole(user?.role);
  if (role !== "provider") {
    return {
      state: PROVIDER_DASHBOARD_STATES.NON_PROVIDER,
      lockedSubState: null,
      isUnlocked: true,
      isLocked: false,
      isRejected: false,
      hasCompletedBasic: true,
      signals: {},
      nextAction: null,
    };
  }

  const hasCompletedBasic = resolveHasCompletedBasic({
    onboarding,
    licenses,
    certs,
    mdSubs,
  });

  const signals = {
    hasCompletedBasic,
    hasAnyLicense: hasAnyLicense(licenses),
    hasVerifiedLicense: hasVerifiedLicense(licenses),
    hasPendingLicense: hasPendingLicense(licenses),
    allLicensesRejected: allLicensesRejected(licenses),
    hasActiveCert: hasActiveCert(certs),
    hasPendingCert: hasPendingCert(certs),
    hasActiveMdSub: hasActiveMdSub(mdSubs),
    hasPaidEnrollment: hasPaidEnrollment(enrollments),
  };

  // ── ACTIVE ──────────────────────────────────────────────────────────────
  // Canonical unlock: at least one active MDSubscription. This is the only
  // state that renders the FULL provider dashboard. Everything else is locked.
  if (signals.hasActiveMdSub) {
    return {
      state: PROVIDER_DASHBOARD_STATES.ACTIVE,
      lockedSubState: null,
      isUnlocked: true,
      isLocked: false,
      isRejected: false,
      hasCompletedBasic: signals.hasCompletedBasic,
      signals,
      nextAction: null,
    };
  }

  // ── REJECTED ────────────────────────────────────────────────────────────
  // All licenses rejected with nothing pending — surface a dedicated state
  // so the UI can offer a resubmit CTA rather than a generic "apply now".
  if (signals.allLicensesRejected) {
    return {
      state: PROVIDER_DASHBOARD_STATES.REJECTED,
      lockedSubState: PROVIDER_LOCKED_SUBSTATES.NONE,
      isUnlocked: false,
      isLocked: true,
      isRejected: true,
      hasCompletedBasic: signals.hasCompletedBasic,
      signals,
      nextAction: { id: "resubmit_license", page: "ProviderCredentialsCoverage" },
    };
  }

  // ── LOCKED / md_eligible ────────────────────────────────────────────────
  // Active certification but no MD coverage yet — one click from full access.
  if (signals.hasActiveCert) {
    return {
      state: PROVIDER_DASHBOARD_STATES.LOCKED,
      lockedSubState: PROVIDER_LOCKED_SUBSTATES.MD_ELIGIBLE,
      isUnlocked: false,
      isLocked: true,
      isRejected: false,
      hasCompletedBasic: signals.hasCompletedBasic,
      signals,
      nextAction: { id: "activate_md_coverage", page: "ProviderCredentialsCoverage" },
    };
  }

  // ── LOCKED / cert_bypass ────────────────────────────────────────────────
  // External cert pending review (fast-track path).
  if (signals.hasPendingCert) {
    return {
      state: PROVIDER_DASHBOARD_STATES.LOCKED,
      lockedSubState: PROVIDER_LOCKED_SUBSTATES.CERT_BYPASS,
      isUnlocked: false,
      isLocked: true,
      isRejected: false,
      hasCompletedBasic: signals.hasCompletedBasic,
      signals,
      nextAction: { id: "browse_courses", page: "ProviderEnrollments" },
    };
  }

  // ── LOCKED / courses_only ───────────────────────────────────────────────
  // License verified, no cert path yet — choose NOVI course or upload cert.
  if (signals.hasVerifiedLicense) {
    return {
      state: PROVIDER_DASHBOARD_STATES.LOCKED,
      lockedSubState: PROVIDER_LOCKED_SUBSTATES.COURSES_ONLY,
      isUnlocked: false,
      isLocked: true,
      isRejected: false,
      hasCompletedBasic: signals.hasCompletedBasic,
      signals,
      nextAction: { id: "browse_courses", page: "ProviderEnrollments" },
    };
  }

  // ── LOCKED / course_purchased ───────────────────────────────────────────
  // Paid course enrollment while license is still pending verification.
  if (signals.hasPaidEnrollment) {
    return {
      state: PROVIDER_DASHBOARD_STATES.LOCKED,
      lockedSubState: PROVIDER_LOCKED_SUBSTATES.COURSE_PURCHASED,
      isUnlocked: false,
      isLocked: true,
      isRejected: false,
      hasCompletedBasic: signals.hasCompletedBasic,
      signals,
      nextAction: { id: "open_course_materials", page: "ProviderEnrollments" },
    };
  }

  // ── LOCKED / pending ────────────────────────────────────────────────────
  // License uploaded but admin hasn't verified it yet.
  if (signals.hasPendingLicense) {
    return {
      state: PROVIDER_DASHBOARD_STATES.LOCKED,
      lockedSubState: PROVIDER_LOCKED_SUBSTATES.PENDING,
      isUnlocked: false,
      isLocked: true,
      isRejected: false,
      hasCompletedBasic: signals.hasCompletedBasic,
      signals,
      nextAction: { id: "awaiting_review", page: null },
    };
  }

  // ── LOCKED / none ───────────────────────────────────────────────────────
  // Brand-new provider — no license, no cert, no enrollment, nothing yet.
  return {
    state: PROVIDER_DASHBOARD_STATES.LOCKED,
    lockedSubState: PROVIDER_LOCKED_SUBSTATES.NONE,
    isUnlocked: false,
    isLocked: true,
    isRejected: false,
    hasCompletedBasic: signals.hasCompletedBasic,
    signals,
    nextAction: signals.hasCompletedBasic
      ? { id: "upload_license", page: "ProviderCredentialsCoverage" }
      : { id: "complete_basic_onboarding", page: "ProviderBasicOnboarding" },
  };
}

// ─── nav gating helpers ────────────────────────────────────────────────────

/**
 * Decide how a sidebar item should behave for a given dashboard state.
 *   - "accessible"    : functional, no overlay
 *   - "promotional"   : page renders the locked overlay (still clickable)
 *   - "hidden"        : do not render (use sparingly)
 *
 * Always-accessible-for-locked pages are listed in PROVIDER_LOCKED_ACCESSIBLE_PAGES;
 * promotional pages are listed in PROVIDER_LOCKED_PROMOTIONAL_PAGES. Active
 * providers see everything as "accessible".
 */
export function getProviderNavAccess(pageKey, dashboardState) {
  if (!dashboardState || dashboardState.isUnlocked) return "accessible";
  if (PROVIDER_LOCKED_ACCESSIBLE_PAGES.has(pageKey)) return "accessible";
  if (PROVIDER_LOCKED_PROMOTIONAL_PAGES.has(pageKey)) return "promotional";
  return "promotional";
}

export function isPageFunctionallyLockedForProvider(pageKey, dashboardState) {
  return getProviderNavAccess(pageKey, dashboardState) === "promotional";
}
