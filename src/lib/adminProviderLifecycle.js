import { providerLookupKeys } from "@/lib/providerMembershipSummary";

export const ADMIN_PROVIDER_LIFECYCLE_FILTERS = [
  {
    id: "no_license",
    label: "Exploring",
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.1)",
    description: "Provider has signed up but hasn't uploaded a license, enrolled in courses, or submitted any documents yet. They are still exploring the platform.",
  },
  {
    id: "license_pending_review",
    label: "License Pending Review",
    color: "#FA6F30",
    bg: "rgba(250,111,48,0.1)",
    description: "Provider has uploaded their state license and it's awaiting admin verification.",
  },
  {
    id: "license_verified_no_course",
    label: "License Verified, No Course",
    color: "#7B8EC8",
    bg: "rgba(123,142,200,0.12)",
    description: "Provider's license has been verified by admin. They can now browse and purchase training courses.",
  },
  {
    id: "cert_pending_review",
    label: "Certification Pending Review",
    color: "#9B8EC4",
    bg: "rgba(155,142,196,0.12)",
    description: "Provider has completed a course or uploaded an external certification that's awaiting admin approval.",
  },
  {
    id: "applied_md_coverage",
    label: "Applied for MD Coverage",
    color: "#2D6B7F",
    bg: "rgba(45,107,127,0.12)",
    description: "Provider has an approved certification and has applied for Medical Director coverage. Pending MD approval or payment.",
  },
  {
    id: "enrolled_no_subscription",
    label: "Enrolled, No Subscription",
    color: "#6b8f1a",
    bg: "rgba(200,230,60,0.12)",
    description: "Provider has paid for a course enrollment but hasn't yet activated their MD coverage subscription.",
  },
  {
    id: "fully_active",
    label: "Fully Active",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.1)",
    description: "Provider has at least one active, fully paid MD coverage subscription. They have full platform access.",
  },
];

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

export function rowsForProvider(provider, rows = [], { idField = "provider_id", emailField = "provider_email" } = {}) {
  const keys = providerLookupKeys(provider);
  const email = norm(provider?.email);
  return (rows || []).filter((row) => {
    const pid = norm(row?.[idField]);
    if (pid && keys.has(pid)) return true;
    const rowEmail = norm(row?.[emailField]);
    return email && rowEmail && rowEmail === email;
  });
}

function hasVerifiedLicense(licenses) {
  return licenses.some((l) => norm(l.status) === "verified");
}

function hasPendingLicense(licenses) {
  return licenses.some((l) => norm(l.status) === "pending_review");
}

function hasActiveCert(certs) {
  return certs.some((c) => norm(c.status) === "active" || norm(c.status) === "verified");
}

function hasPendingCert(certs) {
  return certs.some((c) => norm(c.status) === "pending");
}

function hasActiveMdSub(subs) {
  return subs.some((s) => norm(s.status) === "active");
}

function hasPendingMdCoverage(subs) {
  return subs.some((s) => {
    const status = norm(s.status);
    if (!status || status === "active" || status === "cancelled") return false;
    return true;
  });
}

function hasPaidEnrollment(enrollments, preOrders, provider) {
  const paidStatuses = new Set(["paid", "confirmed", "attended", "completed"]);
  const providerEnrollments = rowsForProvider(provider, enrollments);
  if (providerEnrollments.some((e) => paidStatuses.has(norm(e.status)))) return true;

  const email = norm(provider?.email);
  return (preOrders || []).some((p) => {
    if (norm(p.order_type) !== "course") return false;
    if (!paidStatuses.has(norm(p.status))) return false;
    return email && norm(p.customer_email) === email;
  });
}

/**
 * Assign each provider to exactly one lifecycle bucket (current funnel stage).
 */
export function classifyAdminProviderLifecycle(provider, { licenses = [], certs = [], enrollments = [], preOrders = [], mdSubs = [] } = {}) {
  const providerLicenses = rowsForProvider(provider, licenses);
  const providerCerts = rowsForProvider(provider, certs);
  const providerSubs = rowsForProvider(provider, mdSubs);

  const signals = {
    hasAnyLicense: providerLicenses.length > 0,
    hasVerifiedLicense: hasVerifiedLicense(providerLicenses),
    hasPendingLicense: hasPendingLicense(providerLicenses),
    hasPendingCert: hasPendingCert(providerCerts),
    hasActiveCert: hasActiveCert(providerCerts),
    hasPaidEnrollment: hasPaidEnrollment(enrollments, preOrders, provider),
    hasActiveMdSub: hasActiveMdSub(providerSubs),
    hasPendingMdCoverage: hasPendingMdCoverage(providerSubs),
  };

  let stage = "no_license";

  if (signals.hasActiveMdSub) {
    stage = "fully_active";
  } else if (signals.hasPendingMdCoverage || (signals.hasActiveCert && providerSubs.length > 0)) {
    stage = "applied_md_coverage";
  } else if (signals.hasPaidEnrollment) {
    stage = "enrolled_no_subscription";
  } else if (signals.hasPendingCert) {
    stage = "cert_pending_review";
  } else if (signals.hasVerifiedLicense) {
    stage = "license_verified_no_course";
  } else if (signals.hasPendingLicense) {
    stage = "license_pending_review";
  } else if (!signals.hasAnyLicense) {
    stage = "no_license";
  }

  return { stage, signals };
}

export function buildAdminProviderLifecycleIndex(providers, datasets) {
  const counts = Object.fromEntries(ADMIN_PROVIDER_LIFECYCLE_FILTERS.map((f) => [f.id, 0]));
  const byProviderId = new Map();

  for (const provider of providers || []) {
    const result = classifyAdminProviderLifecycle(provider, datasets);
    counts[result.stage] = (counts[result.stage] || 0) + 1;
    byProviderId.set(provider.id, result);
    if (provider.auth_user_id) {
      byProviderId.set(provider.auth_user_id, result);
    }
  }

  return { counts, byProviderId, classify: (provider) => classifyAdminProviderLifecycle(provider, datasets) };
}
