import { isBbpCert, isCprBlsCert } from "@/lib/complianceCerts";

/**
 * Growth Studio step playbooks — content + status/completion rules.
 * Spans Foundation, Activation, and Growth phases. Lookup is by step id,
 * so any step whose id matches a key here renders the rich playbook UI.
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

  md_mpi: {
    stepId: "md_mpi",
    statusSource: "auto",
    outcome:
      "Adds your supervising medical director to your Medical Practice Information (MPI) so you're legally cleared to treat patients in most states.",
    vendorLabel: "Internal system",
    vendorName: "NOVI Practice Profile",
    providerSteps: [
      { title: "Step 1", body: "Identify your supervising medical director (or use a NOVI-provided MD where available)." },
      { title: "Step 2", body: "Add the MD's details to your practice profile (MPI)." },
      { title: "Step 3", body: "Confirm the medical director relationship is active." },
    ],
    whatHappensNext:
      "Once your MD is added and active, you satisfy the medical director requirement and can continue toward treating patients on the platform.",
    noviNote:
      "This is one of two paths to MD coverage — add a Medical Director to your MPI OR carry Malpractice Insurance that includes Medical Director coverage (see the Malpractice Insurance step).",
    primaryCta: {
      type: "internal",
      label: "Add MD to Practice Profile",
      navigate_to: "ProviderPractice",
      navigate_params: "?tab=profile",
    },
    allowMarkDone: false,
  },

  cpr_bls: {
    stepId: "cpr_bls",
    statusSource: "cert",
    certMatcher: isCprBlsCert,
    autoCheck: "cpr_bls",
    outcome:
      "Satisfies NOVI compliance requirements for all active providers and verifies that you maintain current life-saving certification standards required for patient care.",
    vendorLabel: "Certification providers",
    vendorName: "National CPR Foundation / American Red Cross",
    externalUrl: "https://nationalcprfoundation.com",
    ctaLabel: "Get CPR/BLS Certified",
    providerSteps: [
      { title: "Already certified", body: "Upload your current CPR/BLS certification — the NOVI Compliance Team reviews it and adds it to your provider profile." },
      { title: "Need certification", body: "Complete CPR or BLS through an approved provider, download your certificate, then upload it into NOVI for review and approval." },
    ],
    whatHappensNext:
      "Once approved, your certification status updates automatically, compliance moves to complete, and the certificate stays on your provider profile for future verification. NOVI may request updated documentation when it expires.",
    infoLists: [
      {
        title: "Accepted certifications",
        items: [
          "BLS (Basic Life Support)",
          "CPR/AED",
          "American Red Cross",
          "American Heart Association",
          "National CPR Foundation",
          "Other nationally recognized CPR/BLS providers (subject to NOVI approval)",
        ],
      },
    ],
    resources: [
      { label: "National CPR Foundation — online CPR & BLS", url: "https://nationalcprfoundation.com" },
      { label: "American Red Cross — BLS certification", url: "https://www.redcross.org/take-a-class/bls-training/bls-online" },
    ],
    noviNote:
      "Providers are responsible for maintaining an active CPR/BLS certification at all times. Expired certifications may temporarily restrict access to certain NOVI features and compliance-dependent services.",
    statusOptions: [
      { key: "missing", label: "Missing" },
      { key: "in_progress", label: "Certification In Progress" },
      { key: "uploaded", label: "Uploaded" },
      { key: "under_review", label: "Under Review" },
      { key: "approved", label: "Approved" },
    ],
    completeStatuses: ["approved"],
    primaryCta: {
      type: "internal",
      label: "Upload CPR/BLS Certificate",
      navigate_to: "ProviderPractice",
      navigate_params: "?tab=profile&step=cpr_bls",
    },
    secondaryCta: {
      type: "external",
      label: "Get certified — National CPR Foundation",
      url: "https://nationalcprfoundation.com",
    },
    allowMarkDone: true,
  },

  bloodborne: {
    stepId: "bloodborne",
    statusSource: "cert",
    certMatcher: isBbpCert,
    autoCheck: "bloodborne",
    outcome:
      "Meets OSHA Bloodborne Pathogens training requirements. Protects providers, patients, and staff by ensuring safe handling of blood and bodily fluids — required before treating patients through NOVI.",
    vendorLabel: "Training resource",
    vendorName: "American Red Cross (recommended)",
    externalUrl:
      "https://www.redcross.org/take-a-class/classes/bloodborne-pathogens-training-online/a6RVx000000bZtF.html",
    ctaLabel: "Complete Bloodborne Pathogens Training",
    providerSteps: [
      { title: "Step 1", body: "Enroll in and complete the Bloodborne Pathogens course through the American Red Cross or another NOVI-approved provider." },
      { title: "Step 2", body: "Download your certificate of completion immediately after finishing." },
      { title: "Step 3", body: "Upload your certificate into NOVI under Compliance Requirements." },
      { title: "Step 4", body: "NOVI Compliance Team reviews the documentation." },
      { title: "Step 5", body: "Training is approved and marked complete on your provider profile." },
    ],
    whatHappensNext:
      "Once approved, your OSHA Bloodborne Pathogens requirement is marked complete, your compliance profile updates, and documentation stays stored for future verification.",
    infoLists: [
      {
        title: "Training topics covered",
        items: [
          "Bloodborne pathogen awareness",
          "Exposure prevention techniques",
          "Personal protective equipment (PPE)",
          "Workplace safety protocols",
          "Exposure response procedures",
          "OSHA compliance standards",
          "Infection control best practices",
        ],
      },
    ],
    statusOptions: [
      { key: "not_started", label: "Not Started" },
      { key: "in_progress", label: "In Progress" },
      { key: "certificate_uploaded", label: "Certificate Uploaded" },
      { key: "under_review", label: "Under Review" },
      { key: "completed", label: "Completed" },
    ],
    completeStatuses: ["completed"],
    primaryCta: {
      type: "internal",
      label: "Upload Certificate",
      navigate_to: "ProviderPractice",
      navigate_params: "?tab=profile&step=bloodborne",
    },
    secondaryCta: {
      type: "external",
      label: "Take Red Cross Training",
      url: "https://www.redcross.org/take-a-class/classes/bloodborne-pathogens-training-online/a6RVx000000bZtF.html",
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

  // ── Activation ──────────────────────────────────────────────
  profile: {
    stepId: "profile",
    statusSource: "auto",
    outcome:
      "Complete profiles dramatically improve booking conversion — patients decide in seconds.",
    vendorLabel: "Internal system",
    vendorName: "NOVI Profile Setup",
    infoLists: [
      {
        title: "Required inputs",
        defaultOpen: true,
        items: ["Headshot", "Bio", "Credentials", "Services", "Availability", "Social links"],
      },
    ],
    primaryCta: {
      type: "internal",
      label: "Complete Profile",
      navigate_to: "ProviderPractice",
      navigate_params: "?tab=profile",
    },
    allowMarkDone: false,
  },

  treatments: {
    stepId: "treatments",
    statusSource: "auto",
    outcome: "Patients cannot book without active services.",
    vendorLabel: "Internal system",
    vendorName: "NOVI Service Builder",
    infoLists: [
      {
        title: "Required inputs",
        defaultOpen: true,
        items: ["Service name", "Pricing", "Duration", "Description", "Treatment category"],
      },
    ],
    primaryCta: {
      type: "internal",
      label: "Add Services",
      navigate_to: "ProviderPractice",
      navigate_params: "?tab=treatments",
    },
    allowMarkDone: false,
  },

  book_link: {
    stepId: "book_link",
    statusSource: "auto",
    outcome: "Turns followers and referrals into booked appointments.",
    vendorLabel: "Internal system",
    vendorName: "NOVI Booking System",
    infoLists: [
      {
        title: "Suggested placements",
        defaultOpen: true,
        items: ["Instagram bio", "TikTok", "Website", "Email signature"],
      },
    ],
    primaryCta: {
      type: "internal",
      label: "Copy Booking Link",
      navigate_to: "ProviderProfile",
    },
    allowMarkDone: true,
  },

  cherry_financing: {
    stepId: "cherry_financing",
    statusSource: "self",
    futureStatusSource: "webhook",
    outcome:
      "Providers offering financing close 30–40% more high-ticket treatments by offering monthly payment plans at checkout.",
    vendorLabel: "Vendor",
    vendorName: "Cherry Financing",
    externalUrl: "https://withcherry.com/partnerships/novi-society",
    ctaLabel: "Begin Cherry Setup",
    providerSteps: [
      { title: "Step 1", body: "Open the Cherry onboarding page." },
      { title: "Step 2", body: "Submit your practice application." },
      { title: "Step 3", body: "Await approval — Cherry reviews eligibility directly." },
      { title: "Step 4", body: "Activate financing for your patients." },
    ],
    whatHappensNext:
      "Cherry reviews the provider application and onboarding eligibility directly.",
    infoLists: [
      {
        title: "Resources",
        items: ["Cherry social assets", "One-pager", "Financing education", "Provider onboarding materials"],
      },
    ],
    resources: [
      { label: "Cherry × NOVI onboarding", url: "https://withcherry.com/partnerships/novi-society" },
      {
        label: "Cherry setup guide (doc)",
        url: "https://docs.google.com/document/d/1JS7xrf8LYJAs_MXGoZG_SSJf_LHhmGfBdu3qtyM_1xc/edit?usp=sharing",
      },
    ],
    statusOptions: [
      { key: "not_started", label: "Not Started" },
      { key: "applied", label: "Applied" },
      { key: "awaiting_approval", label: "Awaiting Approval" },
      { key: "active", label: "Active" },
    ],
    completeStatuses: ["active"],
    allowMarkDone: true,
  },

  supplier_marketplace: {
    stepId: "supplier_marketplace",
    statusSource: "self",
    outcome:
      "Unlock direct access to NOVI's preferred supplier network — exclusive member pricing, manufacturer promotions, product education, and dedicated account support.",
    vendorLabel: "Supplier network",
    vendorName: "NOVI Marketplace",
    ctaLabel: "Explore Marketplace",
    providerSteps: [
      { title: "Step 1", body: "Complete your NOVI onboarding and activate your provider account." },
      { title: "Step 2", body: "Browse the Marketplace and explore available supplier categories." },
      { title: "Step 3", body: "Select the supplier(s) you would like to activate." },
      { title: "Step 4", body: "Complete any manufacturer-specific account setup requirements." },
      { title: "Step 5", body: "Receive approval and access preferred member pricing, promotions, and ordering." },
    ],
    whatHappensNext:
      "Once activated, direct supplier accounts are established in your business name with access to preferred pricing, rep support, and rebates/promotions. Ordering is completed directly through the supplier and tracked in your Marketplace dashboard.",
    categories: [
      { group: "Injectables", items: ["Neurotoxins", "Fillers", "Biostimulators"] },
      { group: "Skincare", items: ["Professional skincare", "Regenerative skincare", "Retail skincare products"] },
      { group: "Pharmacies & Wellness", items: ["Compounding pharmacies", "Weight management", "Peptides", "IV therapy", "Longevity products"] },
      { group: "Equipment & Supplies", items: ["Medical supplies", "Treatment devices", "Practice essentials"] },
      { group: "Business Growth", items: ["Financing", "Insurance", "Marketing", "Payment processing", "Business services"] },
    ],
    statusOptions: [
      { key: "not_started", label: "Not Started" },
      { key: "browsing", label: "Browsing Marketplace" },
      { key: "supplier_selected", label: "Supplier Selected" },
      { key: "application_submitted", label: "Application Submitted" },
      { key: "under_review", label: "Under Review" },
      { key: "approved", label: "Approved" },
      { key: "active", label: "Active" },
    ],
    completeStatuses: ["approved", "active"],
    primaryCta: {
      type: "internal",
      label: "Explore Marketplace",
      navigate_to: "ProviderMarketplace",
    },
    allowMarkDone: true,
  },

  deposit_policy: {
    stepId: "deposit_policy",
    statusSource: "auto",
    outcome: "A deposit policy dramatically reduces no-shows.",
    vendorLabel: "Internal system",
    vendorName: "NOVI Booking Policies",
    infoLists: [
      {
        title: "Recommended settings",
        defaultOpen: true,
        items: ["20–30% deposit", "24–48 hour cancellation policy"],
      },
    ],
    primaryCta: {
      type: "internal",
      label: "Configure Policies",
      navigate_to: "ProviderPractice",
      navigate_params: "?tab=profile",
    },
    allowMarkDone: true,
  },

  // ── Growth ──────────────────────────────────────────────────
  instagram: {
    stepId: "instagram",
    statusSource: "self",
    outcome: "Primary free patient acquisition channel — post before/afters, tips, and your face 3x a week.",
    vendorLabel: "Content tools",
    vendorName: "Instagram Business + Canva",
    externalUrl: "https://business.instagram.com",
    ctaLabel: "Switch to Instagram Business",
    infoLists: [
      {
        title: "What's included",
        defaultOpen: true,
        items: ["Content templates", "Caption ideas", "Posting strategy", "Reels guidance"],
      },
    ],
    resources: [
      { label: "Switch to Instagram Business", url: "https://business.instagram.com" },
      { label: "Create posts with Canva", url: "https://www.canva.com" },
    ],
    statusOptions: [
      { key: "not_started", label: "Not Started" },
      { key: "in_progress", label: "In Progress" },
      { key: "active", label: "Active" },
    ],
    completeStatuses: ["active"],
    allowMarkDone: true,
  },

  google_biz: {
    stepId: "google_biz",
    statusSource: "self",
    outcome: "Shows up when patients search locally for treatments (e.g. 'Botox near me').",
    vendorLabel: "Vendor",
    vendorName: "Google Business",
    externalUrl: "https://business.google.com",
    ctaLabel: "Claim Google Profile",
    providerSteps: [
      { title: "Step 1", body: "Create or claim your Google Business Profile." },
      { title: "Step 2", body: "Verify your business and complete your profile details." },
      { title: "Step 3", body: "Add photos, services, hours, and your booking link." },
    ],
    resources: [
      { label: "Claim your free Google Business Profile", url: "https://business.google.com" },
    ],
    statusOptions: [
      { key: "not_started", label: "Not Started" },
      { key: "in_progress", label: "In Progress" },
      { key: "claimed", label: "Claimed" },
    ],
    completeStatuses: ["claimed"],
    allowMarkDone: true,
  },

  bundle_loyalty: {
    stepId: "bundle_loyalty",
    statusSource: "self",
    outcome: "Improves retention and increases average patient spend — add packages in your Treatments tab.",
    vendorLabel: "Internal system",
    vendorName: "NOVI Treatments",
    ctaLabel: "Build Loyalty Offer",
    providerSteps: [
      { title: "Step 1", body: "Open your Treatments tab." },
      { title: "Step 2", body: "Create a bundle or package, or a loyalty/membership reward." },
      { title: "Step 3", body: "Set pricing and publish it to your booking page." },
    ],
    statusOptions: [
      { key: "not_started", label: "Not Started" },
      { key: "in_progress", label: "In Progress" },
      { key: "active", label: "Active" },
    ],
    completeStatuses: ["active"],
    primaryCta: {
      type: "internal",
      label: "Build Loyalty Offer",
      navigate_to: "ProviderPractice",
      navigate_params: "?tab=treatments",
    },
    allowMarkDone: true,
  },
};

export function getFoundationPlaybook(playbookId) {
  return FOUNDATION_STEP_PLAYBOOKS[playbookId] || null;
}
