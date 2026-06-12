/**
 * Central registry of every transactional email template the platform sends.
 *
 * Each entry is the in-code source of truth and acts as the fallback when:
 *   - No row exists in public.email_templates for the same template_key, or
 *   - The DB row is_active=false (so flows never silently break).
 *
 * Admins edit subject/body/CTA via the AdminEmailTemplates page. The canonical
 * design shell (buildCourseStyleEmailHtml) is fixed in code and wraps every
 * email — only text + placeholders are configurable.
 *
 * Body authoring model (non-technical friendly):
 *   - Bodies are written as PLAIN TEXT, not HTML. The renderer
 *     (renderTemplate.js -> renderRichTextBody) wraps each paragraph in the
 *     shared styling automatically. Admins never edit tags or CSS.
 *   - Blank line = new paragraph. Markdown-lite is supported:
 *       **bold**, *italic*, and [label](url) links.
 *   - Simple vars (e.g. {{first_name}}) are substituted from `vars` passed to
 *     renderEmailTemplate(). Missing values default to empty string.
 *   - Block placeholders on their own line (e.g. {{cta_button}}, {{order_table}})
 *     are rendered by dedicated block helpers in courseStyleEmail.js and
 *     injected wherever the placeholder appears. Admins position them anywhere.
 *
 * Categories (used by the admin UI grouping):
 *   onboarding | credentials | admin_alert | supplier | appointments | model
 */

export const EMAIL_CATEGORIES = [
  { key: "onboarding", label: "Accounts & Onboarding" },
  { key: "credentials", label: "Licenses & Certifications" },
  { key: "admin_alert", label: "Admin Alerts" },
  { key: "supplier", label: "Supplier / Manufacturer" },
  { key: "appointments", label: "Patient Appointments" },
  { key: "model", label: "Model Training" },
];

export const COMMON_PLACEHOLDERS = [
  { tag: "{{first_name}}", desc: "Recipient's first name" },
  { tag: "{{full_name}}", desc: "Recipient's full name" },
  { tag: "{{email}}", desc: "Recipient's email" },
  { tag: "{{app_url}}", desc: "App base URL" },
];

export const EMAIL_TEMPLATES = [
  // -------------------------------------------------------------------------
  // Onboarding & Accounts
  // -------------------------------------------------------------------------
  {
    template_key: "account_password_setup",
    name: "Account password setup",
    category: "onboarding",
    recipient_type: "provider",
    subject: "Set your NOVI Society {{role_label}}",
    body_html: `Your NOVI Society account is ready. Use the secure link below to create your password and sign in.

{{cta_button}}

This link can be used only once. After you set your password, sign in at the NOVI login page with your email and the password you chose.`,
    cta_label: "Reset your password",
    cta_url_path: "{{reset_link}}",
    placeholders: [
      { tag: "{{first_name}}", desc: "User's first name" },
      { tag: "{{role_label}}", desc: "Role label (e.g. provider password, staff account password)" },
      { tag: "{{reset_link}}", desc: "One-time password setup link" },
      { tag: "{{cta_button}}", desc: "Primary call-to-action button" },
    ],
    include_signoff: false,
    sample_vars: {
      first_name: "Sam",
      role_label: "provider password",
      reset_link: "https://app.novisociety.com/set-password?token=demo",
    },
  },
  {
    template_key: "checkout_account_invite",
    name: "Checkout account invite",
    category: "onboarding",
    recipient_type: "provider",
    subject: "Set up your NOVI Society account",
    body_html: `You are almost ready to start. Use the button below to set up your NOVI Society account.

{{cta_button}}`,
    cta_label: "Set your account",
    cta_url_path: "{{signup_link}}",
    placeholders: [
      { tag: "{{first_name}}", desc: "User's first name" },
      { tag: "{{signup_link}}", desc: "Sign-up / set-password link" },
      { tag: "{{cta_button}}", desc: "Primary call-to-action button" },
    ],
    include_signoff: false,
    sample_vars: {
      first_name: "Sam",
      signup_link: "https://app.novisociety.com/set-password?token=demo",
    },
  },
  {
    template_key: "patient_signup_welcome",
    name: "Patient signup welcome",
    category: "onboarding",
    recipient_type: "patient",
    subject: "Welcome to NOVI Society",
    body_html: `Hi {{first_name}},

Welcome to NOVI Society — we're glad you're here.

Your patient account is ready. Complete your profile and explore providers matched to your goals.

{{cta_button}}

Questions? Reply to this email or contact us at hello@novisociety.com.`,
    cta_label: "Complete your profile",
    cta_url_path: "/PatientOnboarding",
    placeholders: [
      { tag: "{{first_name}}", desc: "Patient first name" },
      { tag: "{{cta_button}}", desc: "Primary CTA button" },
    ],
    sample_vars: {
      first_name: "Pat",
    },
  },
  {
    template_key: "course_enrollment_confirmed",
    name: "Course enrollment confirmed",
    category: "onboarding",
    recipient_type: "provider",
    subject: "Your NOVI course enrollment is confirmed",
    body_html: `You're officially enrolled in **{{course_title}}** on the NOVI Society platform.

{{details_block}}

**Your next steps**

{{summary_list}}

{{cta_button}}

Questions? Reply directly to this email or reach out through the NOVI platform.`,
    cta_label: "View My Enrollments",
    cta_url_path: "/ProviderEnrollments",
    placeholders: [
      { tag: "{{first_name}}", desc: "Provider first name" },
      { tag: "{{course_title}}", desc: "Course title" },
      { tag: "{{course_date_label}}", desc: "Formatted course date" },
      { tag: "{{details_block}}", desc: "Course detail rows" },
      { tag: "{{summary_list}}", desc: "Next-steps bullet list" },
      { tag: "{{cta_button}}", desc: "Primary CTA button" },
    ],
    sample_vars: {
      first_name: "Sam",
      course_title: "Botox + Filler Foundations",
      course_date_label: "June 15, 2026",
      details: [
        { label: "Course", value: "Botox + Filler Foundations" },
        { label: "Date", value: "June 15, 2026" },
      ],
      summary_lines: [
        "Complete payment to secure your spot",
        "Review pre-course materials in your dashboard",
        "Show up ready on class day",
      ],
    },
  },
  {
    template_key: "md_service_welcome",
    name: "MD service pre-launch welcome",
    category: "onboarding",
    recipient_type: "provider",
    subject: "You're In — Welcome to NOVI MD Services",
    body_html: `We're so excited to welcome you to NOVI MD Services.

You've officially secured your place in our pre-launch group for **{{service_name}}** — an early circle of providers stepping into something entirely new for this industry.

**What happens next**

{{summary_list}}

At this stage, no payment is required. We'll coordinate billing once the platform is fully live so your experience starts seamlessly and at the right time.

If you have any questions in the meantime, just reply directly to this email — we're here for you.`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Provider first name" },
      { tag: "{{service_name}}", desc: "Service name" },
      { tag: "{{summary_list}}", desc: "Onboarding milestone list" },
    ],
    sample_vars: {
      first_name: "Sam",
      service_name: "NOVI MD Services",
      summary_lines: [
        "Your onboarding spot is confirmed",
        "You'll receive early access updates as we approach launch",
        "Our team will personally reach out to begin your setup",
      ],
    },
  },
  {
    template_key: "pre_order_application_approved",
    name: "Pre-order application approved",
    category: "onboarding",
    recipient_type: "provider",
    subject: "Registration is open — complete your NOVI Society account",
    body_html: `Thank you for pre-registering for Medical Director Coverage through NOVI Society.

We're excited to let you know that registration is now officially open.

NOVI Society is more than Medical Director coverage. It's a complete provider ecosystem designed to help you operate compliantly, simplify your business, access education and mentorship, connect with industry vendors, and grow your practice—all from one platform.

To activate your account and complete your registration, please use the link below:

{{cta_button}}

After registering, you'll be able to complete your provider profile, upload any required documents, select the services you plan to offer, and begin the onboarding process. Once submitted, our team will verify your information, review your compliance requirements, and help you activate your NOVI Society membership and Medical Director coverage.

If you have any questions, simply reply to this email and our team will be happy to help.

We look forward to welcoming you to NOVI Society.`,
    cta_label: "Register Here",
    cta_url_path: "{{signup_link}}",
    placeholders: [
      { tag: "{{first_name}}", desc: "Provider first name" },
      { tag: "{{service_name}}", desc: "Service or course name from the application" },
      { tag: "{{signup_link}}", desc: "One-time account registration link" },
      { tag: "{{cta_button}}", desc: "Primary call-to-action button" },
    ],
    include_signoff: true,
    sample_vars: {
      first_name: "Sam",
      service_name: "Medical Director Coverage",
      signup_link: "https://app.novisociety.com/set-password?token=demo",
    },
  },
  {
    template_key: "pre_order_application_rejected",
    name: "Pre-order application rejected",
    category: "onboarding",
    recipient_type: "provider",
    subject: "Update on your NOVI Society pre-registration",
    body_html: `Thank you for your interest in Medical Director Coverage through NOVI Society.

After reviewing your application, we are unable to approve your pre-registration at this time.

{{rejection_block}}

If you believe this decision was made in error or would like to discuss next steps, please reply to this email and our team will be happy to help.

We appreciate your interest in NOVI Society.`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Provider first name" },
      { tag: "{{service_name}}", desc: "Service or course name from the application" },
      { tag: "{{rejection_reason}}", desc: "Admin rejection reason" },
      { tag: "{{rejection_block}}", desc: "Highlighted rejection-reason block" },
    ],
    include_signoff: true,
    sample_vars: {
      first_name: "Sam",
      service_name: "Medical Director Coverage",
      rejection_reason: "We could not verify the license number provided against the state board records.",
    },
  },

  // -------------------------------------------------------------------------
  // Licenses & Certifications
  // -------------------------------------------------------------------------
  {
    template_key: "license_approved",
    name: "License approved",
    category: "credentials",
    recipient_type: "provider",
    subject: "Your license has been verified — unlock MD coverage now",
    body_html: `Your professional license has been verified by the NOVI admin team.

You're now eligible to apply for MD Board Coverage, which lets you legally offer aesthetic services under NOVI's Board of Medical Directors.

**Your next steps**

{{summary_list}}

{{cta_button}}`,
    cta_label: "Apply for Coverage",
    cta_url_path: "/login?next=/ProviderCredentialsCoverage",
    placeholders: [
      { tag: "{{first_name}}", desc: "Provider first name" },
      { tag: "{{summary_list}}", desc: "Bullet list of next steps" },
      { tag: "{{cta_button}}", desc: "Primary CTA button" },
    ],
    sample_vars: {
      first_name: "Sam",
      summary_lines: [
        "Enroll in a NOVI course or submit an external certification",
        "Apply for MD Coverage for each service you want to offer",
        "Get matched with a Board MD — NOVI handles the assignment",
      ],
    },
  },
  {
    template_key: "license_rejected",
    name: "License rejected",
    category: "credentials",
    recipient_type: "provider",
    subject: "Your license submission was rejected",
    body_html: `Your professional license submission has been reviewed by the NOVI admin team.

**Status:** Rejected

{{rejection_block}}

Please update and resubmit your license details in your provider dashboard.`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Provider first name" },
      { tag: "{{rejection_reason}}", desc: "Reason for rejection" },
      { tag: "{{rejection_block}}", desc: "Highlighted rejection-reason block" },
    ],
    sample_vars: {
      first_name: "Sam",
      rejection_reason: "License number could not be verified against the state board.",
    },
  },
  {
    template_key: "certification_approved",
    name: "Certification approved",
    category: "credentials",
    recipient_type: "provider",
    subject: "Your NOVI certification has been approved",
    body_html: `Welcome to NOVI Society — we're excited to have you with us.

Your external certification for **{{certification_name}}** has been successfully approved.

{{details_block}}

{{cta_button}}`,
    cta_label: "View My Coverage",
    cta_url_path: "/login?next=/ProviderCredentialsCoverage",
    placeholders: [
      { tag: "{{first_name}}", desc: "Provider first name" },
      { tag: "{{certification_name}}", desc: "Certification name" },
      { tag: "{{service_name}}", desc: "Service type name" },
      { tag: "{{certificate_number}}", desc: "Certificate number" },
      { tag: "{{details_block}}", desc: "Detail rows" },
      { tag: "{{cta_button}}", desc: "Primary CTA button" },
    ],
    sample_vars: {
      first_name: "Sam",
      certification_name: "Advanced Botox",
      service_name: "Botox",
      certificate_number: "NV-12345",
      details: [
        { label: "Certification", value: "Advanced Botox" },
        { label: "Service", value: "Botox" },
        { label: "Certificate #", value: "NV-12345" },
      ],
    },
  },
  {
    template_key: "certification_rejected",
    name: "Certification rejected",
    category: "credentials",
    recipient_type: "provider",
    subject: "Your NOVI Society certification has been rejected",
    body_html: `Your external certification submission has been reviewed by the NOVI admin team.

**Status:** Rejected

{{details_block}}

{{rejection_block}}

{{cta_button}}`,
    cta_label: "Review Credentials",
    cta_url_path: "/login?next=/ProviderCredentialsCoverage",
    placeholders: [
      { tag: "{{first_name}}", desc: "Provider first name" },
      { tag: "{{certification_name}}", desc: "Certification name" },
      { tag: "{{service_name}}", desc: "Service type name" },
      { tag: "{{rejection_reason}}", desc: "Rejection reason text" },
      { tag: "{{details_block}}", desc: "Detail rows" },
      { tag: "{{rejection_block}}", desc: "Rejection reason highlight" },
      { tag: "{{cta_button}}", desc: "Primary CTA button" },
    ],
    sample_vars: {
      first_name: "Sam",
      certification_name: "Advanced Botox",
      service_name: "Botox",
      rejection_reason: "Uploaded certificate is illegible.",
      details: [
        { label: "Certification", value: "Advanced Botox" },
        { label: "Service", value: "Botox" },
      ],
    },
  },
  {
    template_key: "course_certificate_issued",
    name: "Course certificate issued",
    category: "credentials",
    recipient_type: "provider",
    subject: "Your NOVI Society certificate for {{certification_name}} is ready",
    body_html: `Welcome to NOVI Society — we're excited to have you with us.

Your certificate for **{{certification_name}}** has been successfully issued.

{{details_block}}

Your certificate is ready to download. Use the button below to open your PDF.

{{cta_button}}`,
    cta_label: "View Certificate",
    cta_url_path: "{{certificate_url}}",
    placeholders: [
      { tag: "{{first_name}}", desc: "Provider first name" },
      { tag: "{{certification_name}}", desc: "Course / certification name" },
      { tag: "{{certificate_number}}", desc: "Certificate number" },
      { tag: "{{certificate_url}}", desc: "Direct PDF link" },
      { tag: "{{details_block}}", desc: "Detail rows" },
      { tag: "{{cta_button}}", desc: "Primary CTA button" },
    ],
    sample_vars: {
      first_name: "Sam",
      certification_name: "Botox Foundations",
      certificate_number: "NV-99876",
      certificate_url: "https://app.novisociety.com/certificates/NV-99876.pdf",
      details: [
        { label: "Course", value: "Botox Foundations" },
        { label: "Certificate #", value: "NV-99876" },
      ],
    },
  },
  {
    template_key: "md_auto_assignment",
    name: "Medical director auto-assignment",
    category: "credentials",
    recipient_type: "medical_director",
    subject: "NOVI: New supervised provider — {{service_name}}",
    body_html: `A NOVI provider has just been added to your supervision pool.

{{details_block}}

Open the MD Dashboard to view their credentials, sign protocols, and begin oversight.

{{cta_button}}`,
    cta_label: "Open MD Dashboard",
    cta_url_path: "/MDDashboard",
    placeholders: [
      { tag: "{{first_name}}", desc: "MD first name" },
      { tag: "{{provider_label}}", desc: "Provider display name" },
      { tag: "{{service_name}}", desc: "Service name" },
      { tag: "{{details_block}}", desc: "Detail rows" },
      { tag: "{{cta_button}}", desc: "Primary CTA button" },
    ],
    sample_vars: {
      first_name: "Dr. Smith",
      provider_label: "Sam Provider",
      service_name: "Botox",
      details: [
        { label: "Provider", value: "Sam Provider" },
        { label: "Service", value: "Botox" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Admin alerts
  // -------------------------------------------------------------------------
  {
    template_key: "admin_license_submission",
    name: "Admin: new license submission",
    category: "admin_alert",
    recipient_type: "admin",
    subject: "New license submission pending review",
    body_html: `**New license submission pending review**

{{summary_list}}

Please review it in the admin portal.`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Admin first name" },
      { tag: "{{summary_list}}", desc: "Submission summary bullets" },
    ],
    sample_vars: {
      first_name: "Admin",
      summary_lines: [
        "Provider: Sam Provider",
        "Email: sam@example.com",
        "License: RN (LIC-12345)",
      ],
    },
  },
  {
    template_key: "admin_certification_submission",
    name: "Admin: new certification submission",
    category: "admin_alert",
    recipient_type: "admin",
    subject: "New certification submission pending review",
    body_html: `**New certification submission pending review**

{{summary_list}}

Please review it in the admin portal.`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Admin first name" },
      { tag: "{{summary_list}}", desc: "Submission summary bullets" },
    ],
    sample_vars: {
      first_name: "Admin",
      summary_lines: [
        "Provider: Sam Provider",
        "Email: sam@example.com",
        "Certification: Advanced Botox",
        "Service: Botox",
      ],
    },
  },
  {
    template_key: "admin_md_coverage_cancellation",
    name: "Admin: provider MD coverage cancellation",
    category: "admin_alert",
    recipient_type: "admin",
    subject: "MD coverage cancellation — deactivate in Stripe",
    body_html: `**Provider requested MD coverage cancellation**

{{summary_list}}

Please deactivate billing in the Stripe dashboard if it should stop.`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Admin first name" },
      { tag: "{{summary_list}}", desc: "Cancellation summary bullets" },
    ],
    sample_vars: {
      first_name: "Admin",
      summary_lines: [
        "Provider: Sam Provider",
        "Email: sam@example.com",
        "Service: Laser & Energy Treatments",
        "Stripe subscription id: sub_123",
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Supplier / Manufacturer
  // -------------------------------------------------------------------------
  {
    template_key: "manufacturer_application_admin_alert",
    name: "Admin: new supplier application",
    category: "supplier",
    recipient_type: "admin",
    subject: "New supplier application: {{manufacturer_name}}",
    body_html: `**New supplier application: {{manufacturer_name}}**

A NOVI provider just applied to one of your suppliers. Full details are below — open the admin portal to manage the application.

{{summary_list}}

{{custom_fields_block}}

{{cta_button}}`,
    cta_label: "Open admin portal",
    cta_url_path: "/AdminManufacturers",
    placeholders: [
      { tag: "{{first_name}}", desc: "Admin first name" },
      { tag: "{{manufacturer_name}}", desc: "Manufacturer / supplier name" },
      { tag: "{{summary_list}}", desc: "Application summary bullets" },
      { tag: "{{custom_fields_block}}", desc: "Boxed Q&A list of custom form responses" },
      { tag: "{{cta_button}}", desc: "Primary CTA button" },
    ],
    sample_vars: {
      first_name: "Admin",
      manufacturer_name: "Allergan",
      summary_lines: [
        "Provider: Sam Provider",
        "Email: sam@example.com",
        "Practice: Glow Med Spa",
      ],
      custom_field_items: [
        { question: "Best deal", answer: "Option 2" },
        { question: "What is your name?", answer: "Sam Provider" },
      ],
    },
  },
  {
    template_key: "manufacturer_application_rep",
    name: "Rep: new provider application",
    category: "supplier",
    recipient_type: "manufacturer_rep",
    subject: "New NOVI provider application for {{manufacturer_name}}",
    body_html: `**New NOVI provider application**

A verified NOVI provider has applied to open an account with {{manufacturer_name}}. Their credentials, license, and practice details are below — reply directly to follow up.

{{summary_list}}

{{custom_fields_block}}`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Rep first name" },
      { tag: "{{manufacturer_name}}", desc: "Manufacturer name" },
      { tag: "{{summary_list}}", desc: "Application summary bullets" },
      { tag: "{{custom_fields_block}}", desc: "Boxed Q&A list of custom form responses" },
    ],
    sample_vars: {
      first_name: "Alex",
      manufacturer_name: "Allergan",
      summary_lines: [
        "Provider: Sam Provider",
        "Email: sam@example.com",
      ],
      custom_field_items: [
        { question: "Best deal", answer: "Option 2" },
        { question: "What is your name?", answer: "Sam Provider" },
      ],
    },
  },
  {
    template_key: "manufacturer_contact_rep",
    name: "Rep: order request or message",
    category: "supplier",
    recipient_type: "manufacturer_rep",
    subject: "{{contact_subject}}",
    body_html: `**{{contact_subject}}**

{{intro}}

{{summary_list}}

{{order_table}}

{{message_block}}`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Rep first name" },
      { tag: "{{contact_subject}}", desc: "Subject line text" },
      { tag: "{{intro}}", desc: "Lead paragraph" },
      { tag: "{{summary_list}}", desc: "Provider summary bullets" },
      { tag: "{{order_table}}", desc: "Order line items table" },
      { tag: "{{message_block}}", desc: "Provider message" },
    ],
    sample_vars: {
      first_name: "Alex",
      contact_subject: "Order Request — Sam Provider (Allergan)",
      intro: "Sam Provider submitted a product order request through NOVI.",
      summary_lines: ["Supplier: Allergan", "Provider: Sam Provider"],
      order_items: [
        { product: "Botox 100u", quantity: 2, unit_price: "$525" },
      ],
      message: "Please confirm pricing and ETA.",
    },
  },
  {
    template_key: "manufacturer_contact_provider_copy",
    name: "Provider copy of supplier contact",
    category: "supplier",
    recipient_type: "provider",
    subject: "[Copy] {{contact_subject}}",
    body_html: `**Your request was sent**

{{intro}}

{{summary_list}}

{{order_table}}

{{message_block}}`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Provider first name" },
      { tag: "{{contact_subject}}", desc: "Subject line text" },
      { tag: "{{intro}}", desc: "Copy intro line" },
      { tag: "{{summary_list}}", desc: "Provider summary bullets" },
      { tag: "{{order_table}}", desc: "Order line items table" },
      { tag: "{{message_block}}", desc: "Provider message" },
    ],
    sample_vars: {
      first_name: "Sam",
      contact_subject: "Order Request — Sam Provider (Allergan)",
      intro: "A copy of your order request to Allergan is below.",
      summary_lines: ["Supplier: Allergan"],
      order_items: [{ product: "Botox 100u", quantity: 2, unit_price: "$525" }],
      message: "Please confirm pricing and ETA.",
    },
  },
  {
    template_key: "manufacturer_provider_cancellation_rep",
    name: "Rep: provider membership cancellation",
    category: "supplier",
    recipient_type: "manufacturer_rep",
    subject: "NOVI provider membership termination — {{provider_full_name}}",
    body_html: `We hope you are doing well.

As a courtesy notification, NOVI Society would like to inform your team that the provider listed below is no longer an active NOVI member and has terminated their membership and associated medical oversight services.

**Provider Information**

{{details_block}}

**NOVI Membership Information**

Membership Type: {{membership_type}}
Approved Service Categories: {{approved_service_categories}}
Medical Director: {{medical_director_name}}
Membership Effective Date: {{membership_effective_date}}
Termination Date: {{termination_date}}

Effective on the termination date listed above, the provider's NOVI membership, medical oversight coverage, compliance support, platform access, and associated NOVI benefits have ended.

As a result, the provider should no longer be considered an active NOVI-affiliated provider. Any manufacturer pricing programs, preferred partner benefits, account privileges, credential-based access, purchasing opportunities, or NOVI-related programs extended through active membership should be reviewed and updated in accordance with your organization's policies.

This notice is being provided to ensure accurate records, maintain compliance, and prevent any confusion regarding the provider's current oversight and membership status.

Should the provider reactivate their membership in the future, NOVI Society will issue a new activation notice confirming reinstatement of membership, oversight eligibility, and provider status.

If you have any questions regarding this provider's status, please do not hesitate to contact our team.

Thank you for your partnership and continued support of NOVI Society providers.

Warm regards,

**NOVI Society Provider Success Team**
[support@novisociety.com](mailto:support@novisociety.com)
[www.novisociety.com](https://www.novisociety.com)`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Manufacturer rep first name" },
      { tag: "{{provider_full_name}}", desc: "Provider full name" },
      { tag: "{{details_block}}", desc: "Provider information detail rows" },
      { tag: "{{membership_type}}", desc: "Membership type" },
      { tag: "{{approved_service_categories}}", desc: "Approved service categories" },
      { tag: "{{medical_director_name}}", desc: "Medical director name" },
      { tag: "{{membership_effective_date}}", desc: "Original membership start date" },
      { tag: "{{termination_date}}", desc: "Membership termination date" },
    ],
    include_signoff: false,
    sample_vars: {
      first_name: "Alex",
      provider_full_name: "Sam Provider",
      membership_type: "MD Board Coverage",
      approved_service_categories: "Injectables, IV Therapy, Microneedling, Regenerative Aesthetics",
      medical_director_name: "Dr. Jane Smith",
      membership_effective_date: "January 15, 2025",
      termination_date: "June 10, 2026",
      details: [
        { label: "Provider Name", value: "Sam Provider" },
        { label: "License Type", value: "RN" },
        { label: "License Number", value: "LIC-12345" },
        { label: "Practice Name", value: "Glow Med Spa" },
        { label: "Practice Address", value: "123 Main St, Austin, TX 78701" },
        { label: "Provider Email", value: "sam@example.com" },
        { label: "Provider Phone", value: "(555) 555-0100" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Patient appointments
  // -------------------------------------------------------------------------
  {
    template_key: "appointment_gfe_invite",
    name: "Appointment GFE invite",
    category: "appointments",
    recipient_type: "patient",
    subject: "Complete Your Good Faith Exam — {{service_label}}",
    body_html: `Your provider has requested a **Good Faith Exam (GFE)** before your visit — a quick virtual screening with a licensed medical provider.

{{details_block}}

{{cta_button}}

**What to expect**

{{summary_list}}

**Please complete your GFE before your appointment date.**

Questions? Email us at [hello@novisociety.com](mailto:hello@novisociety.com)`,
    cta_label: "Complete My GFE",
    cta_url_path: "{{gfe_url}}",
    placeholders: [
      { tag: "{{first_name}}", desc: "Patient first name" },
      { tag: "{{service_label}}", desc: "Service name" },
      { tag: "{{gfe_url}}", desc: "GFE meeting URL" },
      { tag: "{{details_block}}", desc: "Appointment detail rows" },
      { tag: "{{summary_list}}", desc: "Bullet list of expectations" },
      { tag: "{{cta_button}}", desc: "Primary CTA button" },
    ],
    sample_vars: {
      first_name: "Pat",
      service_label: "Botox",
      gfe_url: "https://qualiphy.example/meeting",
      details: [
        { label: "Service", value: "Botox" },
        { label: "Provider", value: "Sam Provider" },
        { label: "Date", value: "June 15, 2026" },
      ],
      summary_lines: [
        "Brief video visit with a licensed provider",
        "Review of your health history",
        "Medical clearance for your treatment",
        "Usually about 5–10 minutes",
      ],
    },
  },
  {
    template_key: "appointment_confirmed",
    name: "Appointment confirmed",
    category: "appointments",
    recipient_type: "patient",
    subject: "Your appointment is confirmed — {{appointment_date_label}}",
    body_html: `Your appointment has been confirmed. Here's a summary:

{{details_block}}

**Next steps**

{{summary_list}}`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Patient first name" },
      { tag: "{{appointment_date_label}}", desc: "Formatted appointment date" },
      { tag: "{{details_block}}", desc: "Appointment detail rows" },
      { tag: "{{summary_list}}", desc: "Next steps bullets" },
    ],
    sample_vars: {
      first_name: "Pat",
      appointment_date_label: "June 15, 2026",
      details: [
        { label: "Service", value: "Botox" },
        { label: "Provider", value: "Sam Provider" },
        { label: "Date", value: "June 15, 2026" },
        { label: "Time", value: "10:00 AM" },
      ],
      summary_lines: [
        "Add this visit to your calendar",
        "If your service requires a GFE, complete it before your appointment",
        "Contact your provider if you need to reschedule",
      ],
    },
  },
  {
    template_key: "appointment_cancelled",
    name: "Appointment cancelled",
    category: "appointments",
    recipient_type: "patient",
    subject: "Your appointment was cancelled",
    body_html: `Your appointment has been cancelled.

{{details_block}}

{{rejection_block}}

You can book another visit anytime from your NOVI patient account.`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Patient first name" },
      { tag: "{{details_block}}", desc: "Appointment detail rows" },
      { tag: "{{rejection_reason}}", desc: "Reason text from practice" },
      { tag: "{{rejection_block}}", desc: "Highlighted reason block (omit if no reason)" },
    ],
    include_signoff: false,
    sample_vars: {
      first_name: "Pat",
      details: [
        { label: "Service", value: "Botox" },
        { label: "Provider", value: "Sam Provider" },
        { label: "Date", value: "June 15, 2026" },
      ],
      rejection_reason: "Provider unavailable that day.",
    },
  },
  {
    template_key: "appointment_request_declined",
    name: "Appointment request declined",
    category: "appointments",
    recipient_type: "patient",
    subject: "Your appointment request was declined",
    body_html: `Your appointment request was not confirmed at this time.

{{details_block}}

{{rejection_block}}

You can book another visit anytime from your NOVI patient account.`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Patient first name" },
      { tag: "{{details_block}}", desc: "Appointment detail rows" },
      { tag: "{{rejection_reason}}", desc: "Reason text" },
      { tag: "{{rejection_block}}", desc: "Highlighted reason block" },
    ],
    include_signoff: false,
    sample_vars: {
      first_name: "Pat",
      details: [
        { label: "Service", value: "Botox" },
        { label: "Provider", value: "Sam Provider" },
      ],
      rejection_reason: "Please call to discuss alternative dates.",
    },
  },
  {
    template_key: "appointment_no_show",
    name: "Appointment no-show",
    category: "appointments",
    recipient_type: "patient",
    subject: "We missed you at your appointment{{date_suffix}}",
    body_html: `We missed you at your scheduled visit. Our records show you **did not attend** this appointment.

{{details_block}}

**What to do next**

{{summary_list}}

{{cta_button}}

Questions? Email us at [hello@novisociety.com](mailto:hello@novisociety.com)`,
    cta_label: "Book Another Appointment",
    cta_url_path: "/PatientMarketplace",
    placeholders: [
      { tag: "{{first_name}}", desc: "Patient first name" },
      { tag: "{{date_suffix}}", desc: " — formatted date or empty" },
      { tag: "{{details_block}}", desc: "Appointment detail rows" },
      { tag: "{{summary_list}}", desc: "What to do next bullets" },
      { tag: "{{cta_button}}", desc: "Primary CTA button" },
    ],
    sample_vars: {
      first_name: "Pat",
      date_suffix: " — June 15, 2026",
      details: [
        { label: "Service", value: "Botox" },
        { label: "Provider", value: "Sam Provider" },
      ],
      summary_lines: [
        "Book a new appointment at a time that works for you",
        "If your service requires a GFE, complete it before your new visit",
        "Contact your provider if you had an emergency or need help rescheduling",
      ],
    },
  },
  {
    template_key: "appointment_gfe_approved",
    name: "Appointment GFE approved",
    category: "appointments",
    recipient_type: "patient",
    subject: "Your Good Faith Exam is approved — {{service_label}}",
    body_html: `Good news — your **Good Faith Exam** for this visit is **approved**. You're cleared to proceed with your provider.

{{details_block}}

{{cta_button}}`,
    cta_label: "View exam summary",
    cta_url_path: "{{exam_url}}",
    placeholders: [
      { tag: "{{first_name}}", desc: "Patient first name" },
      { tag: "{{service_label}}", desc: "Service label" },
      { tag: "{{exam_url}}", desc: "Exam result URL (optional)" },
      { tag: "{{details_block}}", desc: "Appointment + reviewer rows" },
      { tag: "{{cta_button}}", desc: "Primary CTA button" },
    ],
    sample_vars: {
      first_name: "Pat",
      service_label: "Botox",
      exam_url: "https://qualiphy.example/exam/123",
      details: [
        { label: "Service", value: "Botox" },
        { label: "Provider", value: "Sam Provider" },
        { label: "Reviewed by", value: "Dr. Smith" },
      ],
    },
  },
  {
    template_key: "appointment_deposit_received",
    name: "Appointment deposit received",
    category: "appointments",
    recipient_type: "patient",
    subject: "Deposit received — your appointment is confirmed",
    body_html: `Your deposit of **{{deposit_amount}}** for **{{service_label}}** with {{provider_name}} has been received.

Your appointment is now confirmed. View details in My Appointments.`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Patient first name" },
      { tag: "{{deposit_amount}}", desc: "Formatted deposit amount" },
      { tag: "{{service_label}}", desc: "Service label" },
      { tag: "{{provider_name}}", desc: "Provider name" },
    ],
    sample_vars: {
      first_name: "Pat",
      deposit_amount: "$50.00",
      service_label: "Botox",
      provider_name: "Sam Provider",
    },
  },

  // -------------------------------------------------------------------------
  // Model training
  // -------------------------------------------------------------------------
  {
    template_key: "model_booking_confirmed",
    name: "Model booking confirmed",
    category: "model",
    recipient_type: "patient",
    subject: "Your Model Training Booking is Confirmed - {{course_date_label}}",
    body_html: `Your model training booking has been confirmed. Here's a summary of your session:

{{details_block}}

**What's included**

{{summary_list}}

**Important:** You'll receive your Good Faith Exam (GFE) link via a separate email. Please complete it before your session date.

Questions? Email us at [hello@novisociety.com](mailto:hello@novisociety.com)`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Customer first name" },
      { tag: "{{course_title}}", desc: "Course title" },
      { tag: "{{course_date_label}}", desc: "Course date formatted" },
      { tag: "{{time_label}}", desc: "Session time" },
      { tag: "{{treatment_label}}", desc: "Treatment label" },
      { tag: "{{details_block}}", desc: "Detail rows" },
      { tag: "{{summary_list}}", desc: "What's-included bullets" },
    ],
    sample_vars: {
      first_name: "Sam",
      course_title: "Botox + Filler Foundations",
      course_date_label: "June 15, 2026",
      time_label: "10:00 AM",
      treatment_label: "Botox + Filler",
      details: [
        { label: "Course", value: "Botox + Filler Foundations" },
        { label: "Date", value: "June 15, 2026" },
        { label: "Time", value: "10:00 AM" },
        { label: "Treatment", value: "Botox + Filler" },
      ],
      summary_lines: [
        "Good Faith Exam (link sent separately)",
        "20 units of Botox or 1 syringe of Filler",
        "Supervised by a licensed Medical Director",
      ],
    },
  },
  {
    template_key: "model_gfe_invite",
    name: "Model GFE invite",
    category: "model",
    recipient_type: "patient",
    subject: "Complete Your Good Faith Exam - NOVI Society",
    body_html: `You're almost set! Before your training session, you need to complete a **Good Faith Exam (GFE)** — a quick virtual screening with a licensed medical provider. It takes about 5-10 minutes.

{{cta_button}}

**What to expect**

{{summary_list}}

**Please complete this before your session date.** If you have questions, reply to this email or contact [hello@novisociety.com](mailto:hello@novisociety.com).`,
    cta_label: "Complete My GFE",
    cta_url_path: "{{gfe_url}}",
    placeholders: [
      { tag: "{{first_name}}", desc: "Customer first name" },
      { tag: "{{gfe_url}}", desc: "GFE meeting URL" },
      { tag: "{{summary_list}}", desc: "Expectation bullets" },
      { tag: "{{cta_button}}", desc: "Primary CTA button" },
    ],
    sample_vars: {
      first_name: "Sam",
      gfe_url: "https://qualiphy.example/meeting",
      summary_lines: [
        "Brief video call with a licensed provider",
        "Review of your health history",
        "Medical clearance for your treatment",
        "Takes approximately 5-10 minutes",
      ],
    },
  },
  {
    template_key: "model_session_reminder",
    name: "Model session reminder",
    category: "model",
    recipient_type: "patient",
    subject: "Reminder: Your Model Training Session is Tomorrow at {{time_label}}",
    body_html: `Just a friendly reminder that your model training session is tomorrow.

{{details_block}}

**Pre-training instructions**

{{summary_list}}

Questions or need to reschedule? Contact [hello@novisociety.com](mailto:hello@novisociety.com).`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Customer first name" },
      { tag: "{{course_date_label}}", desc: "Date formatted" },
      { tag: "{{time_label}}", desc: "Time formatted" },
      { tag: "{{treatment_label}}", desc: "Treatment label" },
      { tag: "{{details_block}}", desc: "Detail rows" },
      { tag: "{{summary_list}}", desc: "Pre-training instructions" },
    ],
    sample_vars: {
      first_name: "Sam",
      course_date_label: "June 15, 2026",
      time_label: "10:00 AM",
      treatment_label: "Botox + Filler",
      details: [
        { label: "Date", value: "June 15, 2026" },
        { label: "Time", value: "10:00 AM" },
        { label: "Treatment", value: "Botox + Filler" },
      ],
      summary_lines: [
        "Arrive 15 minutes early",
        "Wear comfortable clothing for treatment areas",
        "Avoid alcohol and blood thinners 24 hours before session",
        "Bring a valid photo ID",
      ],
    },
  },
  {
    template_key: "model_gfe_reminder",
    name: "Model GFE reminder",
    category: "model",
    recipient_type: "patient",
    subject: "Reminder: Complete Your Good Faith Exam - NOVI Society",
    body_html: `Friendly reminder to complete your Good Faith Exam before class.

{{cta_button}}`,
    cta_label: "Complete GFE",
    cta_url_path: "{{gfe_url}}",
    placeholders: [
      { tag: "{{first_name}}", desc: "Customer first name" },
      { tag: "{{gfe_url}}", desc: "GFE meeting URL" },
      { tag: "{{cta_button}}", desc: "Primary CTA button" },
    ],
    sample_vars: {
      first_name: "Sam",
      gfe_url: "https://qualiphy.example/meeting",
    },
  },
  {
    template_key: "model_post_training",
    name: "Model post-training follow-up",
    category: "model",
    recipient_type: "patient",
    subject: "Become a Real Patient: Continue Your Journey with NOVI Society",
    body_html: `Thank you for being part of the {{course_title}}! We hope you had an amazing experience.

Now it's your turn to experience professional aesthetic treatments as a patient.

**Next steps**

{{summary_list}}

Have questions? Reply to this email or contact [hello@novisociety.com](mailto:hello@novisociety.com).`,
    placeholders: [
      { tag: "{{first_name}}", desc: "Customer first name" },
      { tag: "{{course_title}}", desc: "Course title" },
      { tag: "{{treatment_label}}", desc: "Treatment label" },
      { tag: "{{summary_list}}", desc: "Next-steps bullets" },
    ],
    sample_vars: {
      first_name: "Sam",
      course_title: "NOVI Training Course",
      treatment_label: "Botox",
      summary_lines: [
        "Sign up at novisociety.com/patient-signup",
        "Build your aesthetic profile",
        "Book your first treatment",
      ],
    },
  },
];

const REGISTRY_BY_KEY = new Map(EMAIL_TEMPLATES.map((t) => [t.template_key, t]));

export function getTemplateDefinition(templateKey) {
  return REGISTRY_BY_KEY.get(String(templateKey || "").trim()) || null;
}

export function listTemplateDefinitions() {
  return EMAIL_TEMPLATES.slice();
}
