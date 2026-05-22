import { createPageUrl } from "@/utils";

export const ROLE_ALIASES: Record<string, string> = {
  md: "medical_director",
};

export const DASHBOARD_BY_ROLE: Record<string, string> = {
  admin: "AdminDashboard",
  provider: "ProviderDashboard",
  patient: "PatientJourney",
  medical_director: "MDDashboard",
  staff: "StaffDashboard",
};

export const ALLOWED_PAGES_BY_ROLE: Record<string, Set<string>> = {
  admin: new Set([
    "AdminDashboard",
    "AdminUsers",
    "AdminPreOrders",
    "admincourses",
    "AdminEnrollments",
    "AdminProviders",
    "AdminLicenses",
    "AdminServiceTypes",
    "AdminPromoCodes",
    "AdminManufacturers",
    "AdminEmailTemplates",
    "AdminLaunchPad",
    "AdminWizardConfig",
    "AdminCompliance",
    "AdminCourseStyling",
    "AdminClassDaySimulator",
    "AdminCoursesAdminRoute",
    "AdminModelSignups",
  ]),
  provider: new Set([
    "ProviderDashboard",
    "ProviderEnrollments",
    "ProviderCredentialsCoverage",
    "ProviderMarketplace",
    "ProviderLaunchPad",
    "ProviderPractice",
    "ProviderProfile",
    "ProviderBasicOnboarding",
    "ProviderGettingStarted",
    "CourseCatalog",
    "CourseCheckout",
    "ProviderAppointments",
    "ProviderReviews",
    "ProviderLicenses",
    "ProviderCertifications",
    "ProviderApplication",
    "ProviderMDCoverage",
    "ProviderMDRelationships",
    "ProviderScopeRules",
    "ProviderSubscription",
    "ProviderCodeRedemption",
    "ProviderDashboardLockedPreview",
    "ProviderMessaging",
  ]),
  medical_director: new Set([
    "MDDashboard",
    "MDProviderRelationships",
    "MDTreatmentRecords",
    "MDCompliance",
    "MDCertifications",
    "MDProfile",
    "MDProviders",
    "MDServiceOfferings",
    "MDMessaging",
  ]),
  patient: new Set([
    "PatientJourney",
    "PatientMarketplace",
    "PatientAppointments",
    "PatientReviews",
    "PatientProfile",
    "PatientOnboarding",
  ]),
  staff: new Set([
    "StaffDashboard",
    "StaffEnrollments",
    "StaffProviders",
    "StaffModelSignups",
    "StaffPreOrders",
    "StaffCompliance",
  ]),
};

// Canonical list of modules that can be individually granted to staff users.
// StaffDashboard is always granted and is excluded from the toggle UI.
export const STAFF_MODULE_CATALOG: Array<{ key: string; label: string; group: string }> = [
  { key: "StaffEnrollments",  label: "Enrollments",            group: "Operations" },
  { key: "StaffProviders",    label: "Provider Lookup",        group: "Operations" },
  { key: "StaffModelSignups", label: "Model Sign-ups",         group: "Operations" },
  { key: "StaffPreOrders",    label: "Pre-Order Applications", group: "Operations" },
  { key: "StaffCompliance",   label: "Compliance Logs",        group: "Management" },
];

export const SHARED_AUTH_PAGES = new Set([
  "Onboarding",
  "LandingPage",
  "NoviLanding",
  "ModelSignup",
  "ModelBookingLookup",
  "PrivacyPolicy",
  "TermsAndConditions",
  "RefundPolicy",
  "SMSTerms",
  "ContactUs",
]);

export function normalizeRole(role?: string | null) {
  if (!role) return null;
  return ROLE_ALIASES[role] || role;
}

export function getDashboardPageForRole(role?: string | null) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return "LandingPage";
  return DASHBOARD_BY_ROLE[normalizedRole] || "LandingPage";
}

export function getDashboardPathForRole(role?: string | null) {
  return createPageUrl(getDashboardPageForRole(role));
}

export function isPageAllowedForRole(
  pageName: string,
  role?: string | null,
  permissions?: Record<string, boolean> | null
) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) {
    return SHARED_AUTH_PAGES.has(pageName);
  }
  if (SHARED_AUTH_PAGES.has(pageName)) return true;

  if (normalizedRole === "staff") {
    if (pageName === "StaffDashboard") return true;
    return permissions?.[pageName] === true;
  }

  const allowedPages = ALLOWED_PAGES_BY_ROLE[normalizedRole];
  return allowedPages ? allowedPages.has(pageName) : false;
}
