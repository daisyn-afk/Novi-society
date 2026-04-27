import { createPageUrl } from "@/utils";

export const ROLE_ALIASES: Record<string, string> = {
  md: "medical_director",
};

export const DASHBOARD_BY_ROLE: Record<string, string> = {
  admin: "AdminDashboard",
  provider: "ProviderDashboard",
  patient: "PatientJourney",
  medical_director: "MDDashboard",
  staff: "AdminDashboard",
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
  ]),
  medical_director: new Set([
    "MDDashboard",
    "MDProviderRelationships",
    "MDTreatmentRecords",
    "MDCompliance",
    "MDCertifications",
    "MDProviders",
  ]),
  patient: new Set([
    "PatientJourney",
    "PatientMarketplace",
    "PatientAppointments",
    "PatientReviews",
    "PatientProfile",
    "PatientOnboarding",
  ]),
  staff: new Set(["AdminDashboard", "AdminEnrollments", "AdminProviders"]),
};

export const SHARED_AUTH_PAGES = new Set([
  "Onboarding",
  "LandingPage",
  "NoviLanding",
]);

export function normalizeRole(role?: string | null) {
  if (!role) return null;
  return ROLE_ALIASES[role] || role;
}

export function getDashboardPageForRole(role?: string | null) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return "NoviLanding";
  return DASHBOARD_BY_ROLE[normalizedRole] || "NoviLanding";
}

export function getDashboardPathForRole(role?: string | null) {
  return createPageUrl(getDashboardPageForRole(role));
}

export function isPageAllowedForRole(pageName: string, role?: string | null) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) {
    return SHARED_AUTH_PAGES.has(pageName);
  }
  if (SHARED_AUTH_PAGES.has(pageName)) return true;
  const allowedPages = ALLOWED_PAGES_BY_ROLE[normalizedRole];
  return allowedPages ? allowedPages.has(pageName) : false;
}
