import { isBbpCert } from "@/lib/complianceCerts";

/**
 * Foundation Growth Studio playbooks — content + status/completion rules.
 * Per-provider state: launch_checklist (see foundationStepProgress.js).
 */
export const FOUNDATION_STEP_PLAYBOOKS = {
  license_verified: {
    stepId: "license_verified",
    statusSource: "license",
    futureStatusSource: null,
    outcome:
      "Prerequisite for activating MD coverage and seeing patients on the platform.",
    vendorLabel: "Verification",
    vendorName: "NOVI Credentials & Coverage",
    providerSteps: [
      { title: "Upload license", body: "Submit your RN, NP, PA, or MD license and required documents." },
      { title: "Submit state credentials", body: "Include issuing state, license number, and expiration where applicable." },
      { title: "Admin review", body: "NOVI reviews submissions — typically 1–2 business days." },
    ],
    requiredDocuments: ["License", "State credentials"],
    whatHappensNext:
      "Once verified, you can enroll in courses, apply for MD coverage, and continue Foundation steps.",
    statusOptions: [
      { key: "pending_submission", label: "Pending Submission" },
      { key: "under_review", label: "Under Review" },
      { key: "verified", label: "Verified" },
      { key: "rejected", label: "Rejected" },
    ],
    primaryCta: {
      type: "internal",
      label: "Upload & Manage Licenses",
      navigate_to: "ProviderCredentialsCoverage",
      navigate_params: "?tab=licenses",
    },
    allowMarkDone: false,
  },

  bloodborne: {
    stepId: "bloodborne",
    statusSource: "cert",
    certMatcher: isBbpCert,
    autoCheck: "bloodborne",
    outcome:
      "Protects providers, patients, and staff by ensuring safe handling of blood and bodily fluids while maintaining OSHA compliance. Required before patient treatments through NOVI.",
    vendorLabel: "Training resource",
    vendorName: "Red Cross (recommended)",
    externalUrl:
      "https://www.redcross.org/take-a-class/program-aed/online-only/bloodborne-pathogens-training",
    ctaLabel: "Take Bloodborne Pathogens Training",
    providerSteps: [
      { title: "Complete training", body: "Finish an OSHA-aligned bloodborne pathogens course." },
      { title: "Upload certificate", body: "Add your certificate under Practice profile or Credentials." },
      { title: "Keep current", body: "Annual renewal may be required per OSHA." },
    ],
    whatHappensNext:
      "Once uploaded and approved (or marked complete), you satisfy this compliance requirement for NOVI treatments.",
    statusOptions: [
      { key: "not_started", label: "Not Started" },
      { key: "in_progress", label: "In Progress" },
      { key: "under_review", label: "Under Review" },
      { key: "verified", label: "Verified" },
    ],
    completeStatuses: ["verified"],
    primaryCta: {
      type: "internal",
      label: "Upload Certificate",
      navigate_to: "ProviderPractice",
      navigate_params: "?tab=profile&step=bloodborne",
    },
    secondaryCta: {
      type: "external",
      label: "Take Red Cross Training",
      url: "https://www.redcross.org/take-a-class/program-aed/online-only/bloodborne-pathogens-training",
    },
    allowMarkDone: true,
  },

  llc: {
    stepId: "llc",
    statusSource: "self",
    futureStatusSource: "admin_document",
    outcome:
      "Protects personal assets, creates legal separation between you and your business, and establishes the foundation required to operate a professional aesthetic practice.",
    vendorLabel: "Business formation partner",
    vendorName: "LegalZoom",
    externalUrl: "https://www.legalzoom.com/marketing/business-formation/llc",
    ctaLabel: "Form My LLC",
    providerSteps: [
      { title: "Step 1", body: "Choose your business name and verify availability within your state." },
      { title: "Step 2", body: "Complete the LLC formation application through LegalZoom and select your state." },
      { title: "Step 3", body: "Submit Articles of Organization and required state filing fees." },
      { title: "Step 4", body: "Receive approved LLC documents from your state." },
      { title: "Step 5", body: "Upload LLC formation documents into NOVI when document upload is available." },
      { title: "Step 6", body: "NOVI Admin reviews and verifies your business formation documents." },
    ],
    whatHappensNext:
      "Once approved: legal separation for liabilities, EIN and business banking next, and progress on Business Foundation onboarding.",
    whyItMatters:
      "Operating without an LLC may expose personal assets to business liabilities. An LLC provides credibility with patients, vendors, and banks.",
    resources: [
      { label: "LegalZoom LLC Formation", url: "https://www.legalzoom.com/marketing/business-formation/llc" },
    ],
    recommendedDocuments: [
      "Articles of Organization",
      "Certificate of Formation",
      "Operating Agreement (if applicable)",
      "State Filing Confirmation",
    ],
    noviNote:
      "Most providers complete this before EIN, banking, malpractice insurance, and vendor accounts.",
    statusOptions: [
      { key: "not_started", label: "Not Started" },
      { key: "in_progress", label: "In Progress" },
      { key: "filed", label: "Filed" },
      { key: "under_review", label: "Under Review" },
      { key: "verified", label: "Verified" },
      { key: "completed", label: "Completed" },
    ],
    completeStatuses: ["completed", "verified"],
    allowMarkDone: true,
  },

  ein: {
    stepId: "ein",
    statusSource: "self",
    futureStatusSource: "admin_document",
    outcome:
      "Required to open a business bank account, process payroll, establish vendor accounts, apply for business credit, and file federal business taxes.",
    vendorLabel: "Government resource",
    vendorName: "Internal Revenue Service (IRS)",
    externalUrl:
      "https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online",
    ctaLabel: "Apply for EIN",
    providerSteps: [
      {
        title: "Option 1 — IRS (recommended)",
        body: "Form LLC → apply online at IRS → receive EIN immediately → save CP 575 → upload to NOVI when available.",
      },
      {
        title: "Option 2 — LegalZoom",
        body: "Select EIN assistance during LLC formation; LegalZoom submits on your behalf; upload confirmation to NOVI.",
      },
    ],
    whatHappensNext:
      "After verification: business bank account, vendor accounts, payroll, tax filings, and continued Business Foundation progress.",
    importantNotes: [
      "NOVI does not issue EINs — obtain through the IRS (no fee for direct online application).",
      "Save your EIN Confirmation Letter (CP 575) for banking and compliance.",
    ],
    resources: [
      {
        label: "IRS EIN Application",
        url: "https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online",
      },
      {
        label: "LegalZoom EIN Assistance",
        url: "https://www.legalzoom.com/business/business-licenses-and-permits/ein-overview.html",
      },
    ],
    noviNote:
      "Your EIN is your business tax ID — banks, vendors, and malpractice carriers typically require it.",
    statusOptions: [
      { key: "not_started", label: "Not Started" },
      { key: "in_progress", label: "In Progress" },
      { key: "submitted", label: "Submitted" },
      { key: "under_review", label: "Under Review" },
      { key: "verified", label: "Verified" },
      { key: "completed", label: "Completed" },
    ],
    completeStatuses: ["completed", "verified"],
    allowMarkDone: true,
  },

  banking: {
    stepId: "banking",
    statusSource: "self",
    futureStatusSource: "webhook",
    outcome: "Clean financials — lower taxes and easier growth tracking.",
    vendorLabel: "Banking partners",
    vendorName: "Mercury or Relay (recommended)",
    providerSteps: [
      { title: "Step 1", body: "Confirm LLC formation and EIN are complete." },
      { title: "Step 2", body: "Open a dedicated business checking account (do not mix personal funds)." },
      { title: "Step 3", body: "Save account details for taxes, payroll, and vendor payments." },
    ],
    requiredDocuments: ["EIN", "LLC documents", "Government-issued ID"],
    whatHappensNext:
      "Business banking unlocks vendor payments, payroll, and cleaner tax reporting.",
    resources: [
      { label: "Mercury — business banking", url: "https://mercury.com" },
      { label: "Relay — business banking", url: "https://relayfi.com" },
    ],
    statusOptions: [
      { key: "not_started", label: "Not Started" },
      { key: "in_progress", label: "In Progress" },
      { key: "opened", label: "Opened" },
    ],
    completeStatuses: ["opened"],
    allowMarkDone: true,
  },

  insurance: {
    stepId: "insurance",
    statusSource: "self",
    futureStatusSource: "webhook",
    webhookProvider: "cmf",
    outcome:
      "One malpractice claim without proper coverage could cost tens or hundreds of thousands of dollars. Professional liability insurance protects your license, finances, and career.",
    vendorLabel: "Insurance vendor",
    vendorName: "CM&F Group Professional Liability Insurance",
    externalUrl:
      "https://access.cmfgroup.com/s/formrouter?producer=003Vn00000qiu75",
    ctaLabel: "Get Covered with CM&F",
    providerSteps: [
      {
        title: "Step 1",
        body: "Select designation: RN (Cosmetic), LVN/LPN, CNS, Esthetician, or Nurse Practitioner.",
      },
      { title: "Step 2", body: "Complete the application (Self-Employed, actual hours, Medical Director Coverage Yes, General Liability if needed)." },
      { title: "Step 3", body: "Review quotes and choose a coverage plan." },
      { title: "Step 4", body: "Complete profile setup, review details, and submit payment." },
    ],
    npInstructions: [
      "Select Class N4 – Cosmetic / Aesthetics",
      "Select Yes to Medical Director Coverage",
      "Select Yes to General Liability if not covered elsewhere",
    ],
    whatHappensNext:
      "CM&F reviews and issues policy documents. Coverage can satisfy NOVI onboarding where malpractice is required. Additional Insured for your entity may be available at no extra charge.",
    resources: [
      { label: "CM&F application", url: "https://access.cmfgroup.com/s/formrouter?producer=003Vn00000qiu75" },
      { label: "Coverage questions — Clifford Robertson", url: "mailto:crobertson@cmfgroup.com" },
    ],
    contacts: [
      { name: "Clifford Robertson", email: "crobertson@cmfgroup.com", phone: "(646) 871-8643" },
    ],
    statusOptions: [
      { key: "not_started", label: "Not Started" },
      { key: "application_started", label: "Application Started" },
      { key: "quote_requested", label: "Quote Requested" },
      { key: "coverage_selected", label: "Coverage Selected" },
      { key: "active", label: "Active" },
    ],
    completeStatuses: ["active", "coverage_selected"],
    allowMarkDone: true,
  },

  md_insurance: {
    stepId: "md_insurance",
    statusSource: "self",
    outcome:
      "Required by most supervising MDs. Add your medical director to your malpractice policy.",
    providerSteps: [
      { title: "Contact your carrier", body: "Request to add your supervising MD to your malpractice policy." },
      { title: "Confirm coverage", body: "Keep proof of updated policy for compliance." },
    ],
    whatHappensNext: "Completes insurance alignment with your MD supervision requirements.",
    statusOptions: [
      { key: "not_started", label: "Not Started" },
      { key: "in_progress", label: "In Progress" },
      { key: "completed", label: "Completed" },
    ],
    completeStatuses: ["completed"],
    allowMarkDone: true,
  },
};

export function getFoundationPlaybook(playbookId) {
  return FOUNDATION_STEP_PLAYBOOKS[playbookId] || null;
}
