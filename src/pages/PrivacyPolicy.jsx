import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import NoviFooter from "@/components/NoviFooter";

const EFFECTIVE_DATE = "March 30, 2026";

const sections = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
    content: (
      <div className="space-y-4">
        <p>
          NOVI Society LLC ("NOVI Society," "we," "us," or "our") may collect the following categories of personal information when you visit our website, submit a form, or interact with our services:
        </p>
        <div>
          <p className="font-semibold mb-2" style={{ color: "#1e2535" }}>Personal Identification Information</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Full name</li>
            <li>Email address</li>
            <li>Phone number (including mobile/SMS number)</li>
            <li>Mailing or business address</li>
            <li>Professional license type, number, and issuing state</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold mb-2" style={{ color: "#1e2535" }}>Inquiry & Course Information</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Course or training inquiry details</li>
            <li>Questions, notes, or special requests submitted through our forms</li>
            <li>Preferred session dates or scheduling information</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold mb-2" style={{ color: "#1e2535" }}>Technical & Usage Information</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>IP address</li>
            <li>Browser type and version</li>
            <li>Device type and operating system</li>
            <li>Pages visited, time spent on pages, and referring URLs</li>
            <li>Cookies and similar tracking technologies (see Section 4)</li>
          </ul>
        </div>
        <p>
          We collect this information directly from you when you complete forms on our website, interact with our communications, or engage with our advertising channels, including Meta lead forms and other third-party lead generation tools.
        </p>
      </div>
    ),
  },
  {
    id: "how-we-use",
    title: "2. How We Use Your Information",
    content: (
      <div className="space-y-3">
        <p>We use the personal information we collect for the following purposes:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Responding to inquiries</strong> — to reply to questions, requests, and form submissions in a timely manner.</li>
          <li><strong>Providing requested information</strong> — to send course details, pricing, availability, or other content you have asked about.</li>
          <li><strong>Scheduling and follow-up</strong> — to confirm course reservations, follow up on applications, and provide customer support.</li>
          <li><strong>License verification</strong> — to verify professional credentials submitted as part of the enrollment process.</li>
          <li><strong>Marketing and promotional communications</strong> — to send emails, text messages, or other communications about NOVI Society courses, services, and updates, where you have provided consent to receive such communications.</li>
          <li><strong>Internal analytics and service improvement</strong> — to understand how our website is used, improve functionality, and enhance the overall user experience.</li>
          <li><strong>Website performance monitoring</strong> — to track page load times, identify technical issues, and maintain site reliability.</li>
          <li><strong>Legal and compliance purposes</strong> — to comply with applicable laws, regulations, or legal obligations.</li>
        </ul>
        <p className="mt-2">
          We will not use your personal information for purposes that are materially different from those described in this Privacy Policy without providing you notice or obtaining your consent where required by applicable law.
        </p>
      </div>
    ),
  },
  {
    id: "sms-mobile",
    title: "3. SMS / Mobile Communications",
    content: (
      <div className="space-y-4">
        <p>
          If you provide your mobile phone number and consent to receive text messages from NOVI Society LLC, you may receive SMS communications related to your inquiry, course application, scheduling updates, or marketing promotions.
        </p>
        <div className="p-4 rounded-xl" style={{ background: "rgba(200,230,60,0.07)", border: "1px solid rgba(200,230,60,0.25)" }}>
          <p className="font-semibold mb-2" style={{ color: "#3d5a0a" }}>Important: Your Mobile Data is Not Sold</p>
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.75)" }}>
            Mobile information you provide to NOVI Society LLC, including your phone number and your consent to receive text messages, <strong>will not be sold, rented, or shared with third parties or affiliates for their own marketing or promotional purposes.</strong>
          </p>
        </div>
        <p>
          Text messaging originator opt-in data and consent will not be shared with any third parties, <strong>except</strong> with aggregators and carriers or messaging service providers whose involvement is strictly necessary to deliver the requested text messages on our behalf.
        </p>
        <p>
          <strong>Opting Out of SMS:</strong> You may opt out of text message communications at any time by replying <strong>STOP</strong> to any text message you receive from us. You may also opt out by contacting us directly at <a href="mailto:support@novisociety.com" style={{ color: "#2D6B7F" }}>support@novisociety.com</a> or by calling <a href="tel:+18178936317" style={{ color: "#2D6B7F" }}>+1 817-893-6317</a>. After opting out, you will no longer receive SMS messages from us, except where required for transactional or legal purposes.
        </p>
        <p>
          Message and data rates may apply. Message frequency may vary.
        </p>
      </div>
    ),
  },
  {
    id: "cookies",
    title: "4. Cookies, Analytics & Tracking Technologies",
    content: (
      <div className="space-y-3">
        <p>
          Our website uses cookies and similar tracking technologies to enhance your browsing experience and to understand how visitors use our site.
        </p>
        <p><strong>Cookies</strong> are small text files placed on your device when you visit a website. We may use:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Essential cookies</strong> — required for the website to function properly.</li>
          <li><strong>Analytics cookies</strong> — used to collect aggregated information about site usage (e.g., pages visited, session duration). These may include tools such as Google Analytics or similar platforms.</li>
          <li><strong>Marketing/tracking pixels</strong> — including Meta Pixel or similar tools that help us understand the effectiveness of our advertising campaigns and may track form submissions and page interactions.</li>
        </ul>
        <p>
          You may disable cookies through your browser settings. Please note that disabling certain cookies may affect the functionality of our website. Most browsers allow you to manage cookie preferences in their settings or privacy menus.
        </p>
        <p>
          For more information about how Google Analytics collects and processes data, visit: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#2D6B7F" }}>https://policies.google.com/privacy</a>.
        </p>
      </div>
    ),
  },
  {
    id: "third-parties",
    title: "5. Third-Party Tools & Service Providers",
    content: (
      <div className="space-y-3">
        <p>
          NOVI Society LLC may use trusted third-party vendors and platforms to operate our website, process inquiries, manage communications, and improve our services. These may include, but are not limited to:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Website hosting and infrastructure providers</li>
          <li>Customer relationship management (CRM) platforms</li>
          <li>Email marketing and automation tools</li>
          <li>SMS messaging aggregators and carriers</li>
          <li>Analytics and website performance platforms</li>
          <li>Payment processors (for course enrollment and service reservations)</li>
          <li>Form and landing page platforms</li>
          <li>Social media advertising platforms (e.g., Meta/Facebook)</li>
        </ul>
        <p>
          These third-party providers are granted access to your information only to the extent necessary to perform their services on our behalf. They are contractually obligated to keep your information confidential and to use it only for the purposes for which it was shared. We do not authorize these providers to sell or use your personal information for their own independent marketing purposes.
        </p>
        <p>
          We are not responsible for the privacy practices of third-party websites that may be linked from our site. We encourage you to review the privacy policies of any external platforms you visit.
        </p>
      </div>
    ),
  },
  {
    id: "marketing-optout",
    title: "6. Opting Out of Marketing Communications",
    content: (
      <div className="space-y-3">
        <p>
          You have the right to opt out of receiving marketing communications from NOVI Society LLC at any time.
        </p>
        <p><strong>Email:</strong> To unsubscribe from marketing emails, click the "Unsubscribe" link included at the bottom of any marketing email we send you. Alternatively, you may contact us directly at <a href="mailto:support@novisociety.com" style={{ color: "#2D6B7F" }}>support@novisociety.com</a> and request removal from our email marketing list.</p>
        <p><strong>SMS / Text Messages:</strong> Reply <strong>STOP</strong> to any text message from us, or contact us at <a href="mailto:support@novisociety.com" style={{ color: "#2D6B7F" }}>support@novisociety.com</a> to be removed from our SMS list.</p>
        <p>
          Please note that opting out of marketing communications will not affect transactional messages, such as confirmations, application status updates, or other communications directly related to services you have requested.
        </p>
      </div>
    ),
  },
  {
    id: "data-security",
    title: "7. Data Security",
    content: (
      <div className="space-y-3">
        <p>
          NOVI Society LLC takes reasonable and appropriate technical and organizational measures to help protect your personal information from unauthorized access, disclosure, alteration, or destruction. These measures include the use of encrypted communications, access controls, and secure third-party platforms.
        </p>
        <p>
          However, no method of transmission over the internet and no method of electronic storage is completely secure. While we work diligently to protect your personal information, we cannot guarantee absolute security. In the event of a data breach that affects your rights, we will notify you as required by applicable law.
        </p>
        <p>
          You are also responsible for maintaining the security of any credentials or access information associated with your interactions with our platform or services.
        </p>
      </div>
    ),
  },
  {
    id: "data-retention",
    title: "8. Data Retention",
    content: (
      <div className="space-y-3">
        <p>
          We retain personal information for as long as necessary to fulfill the purposes described in this Privacy Policy, or as required by applicable law, regulation, or legitimate business need.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Inquiry and application data is generally retained for the duration of any active enrollment or business relationship, and for a reasonable period thereafter for record-keeping and follow-up purposes.</li>
          <li>Marketing communication preferences and opt-out records are retained indefinitely to honor your preferences.</li>
          <li>Technical and analytics data may be retained in aggregated or anonymized form for extended periods for internal analytics and reporting purposes.</li>
        </ul>
        <p>
          When personal information is no longer needed, we take reasonable steps to securely delete or anonymize it.
        </p>
      </div>
    ),
  },
  {
    id: "childrens-privacy",
    title: "9. Children's Privacy",
    content: (
      <div className="space-y-3">
        <p>
          Our website and services are not directed to, and are not intended for use by, individuals under the age of 13. We do not knowingly collect personal information from children under 13 years of age.
        </p>
        <p>
          If you are a parent or guardian and you believe that your child has provided us with personal information without your consent, please contact us immediately at <a href="mailto:support@novisociety.com" style={{ color: "#2D6B7F" }}>support@novisociety.com</a>. We will take prompt steps to delete such information from our records.
        </p>
      </div>
    ),
  },
  {
    id: "your-rights",
    title: "10. Your Rights & Contact Information",
    content: (
      <div className="space-y-3">
        <p>
          Depending on your jurisdiction, you may have certain rights regarding your personal information, including the right to:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access the personal information we hold about you</li>
          <li>Request correction of inaccurate or incomplete information</li>
          <li>Request deletion of your personal information, subject to certain legal exceptions</li>
          <li>Withdraw consent for processing based on consent, where applicable</li>
          <li>Opt out of marketing communications (see Section 6)</li>
        </ul>
        <p>
          To exercise any of these rights, or if you have questions or concerns about this Privacy Policy, please contact us:
        </p>
        <div className="p-5 rounded-xl space-y-1.5 text-sm" style={{ background: "rgba(45,107,127,0.06)", border: "1px solid rgba(45,107,127,0.15)" }}>
          <p className="font-bold" style={{ color: "#1e2535" }}>NOVI Society LLC</p>
          <p>Authorized Representative: Ashlan Greenfield</p>
          <p>8109 Meadow Valley Dr, McKinney, Texas 75071, United States</p>
          <p>Email: <a href="mailto:support@novisociety.com" style={{ color: "#2D6B7F" }}>support@novisociety.com</a></p>
          <p>Phone: <a href="tel:+18178936317" style={{ color: "#2D6B7F" }}>+1 817-893-6317</a></p>
          <p>Website: <a href="https://www.novisociety.com" target="_blank" rel="noopener noreferrer" style={{ color: "#2D6B7F" }}>www.novisociety.com</a></p>
        </div>
        <p>
          We will respond to your request within a reasonable timeframe and in accordance with applicable law.
        </p>
      </div>
    ),
  },
  {
    id: "updates",
    title: "11. Updates to This Privacy Policy",
    content: (
      <div className="space-y-3">
        <p>
          NOVI Society LLC reserves the right to update or modify this Privacy Policy at any time. When we make material changes, we will update the "Effective Date" at the top of this page and, where appropriate, notify you by email or through a notice on our website.
        </p>
        <p>
          Your continued use of our website or services following the posting of any changes constitutes your acceptance of those changes. We encourage you to review this Privacy Policy periodically to stay informed about how we protect your information.
        </p>
      </div>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen" style={{ background: "#f5f3ef", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>

      {/* Header */}
      <header style={{ background: "#1e2535", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" style={{ display: "flex", alignItems: "baseline", gap: 5, textDecoration: "none" }}>
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: "#fff", fontStyle: "italic", fontWeight: 400 }}>novi</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>Society</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section style={{ background: "linear-gradient(135deg, #1e2535 0%, #2D4060 100%)", padding: "64px 24px 56px" }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#C8E63C", letterSpacing: "0.2em" }}>Legal</p>
          <h1 style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(2.5rem, 6vw, 3.75rem)",
            color: "#fff",
            fontStyle: "italic",
            fontWeight: 400,
            lineHeight: 1.1,
            marginBottom: "16px",
          }}>
            Privacy Policy
          </h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.95rem" }}>
            Effective Date: <strong style={{ color: "rgba(255,255,255,0.75)" }}>{EFFECTIVE_DATE}</strong>
          </p>
          <p className="mt-4 max-w-2xl" style={{ color: "rgba(255,255,255,0.62)", lineHeight: 1.8, fontSize: "0.95rem" }}>
            NOVI Society LLC is committed to protecting your privacy. This Privacy Policy explains how we collect, use, share, and safeguard your personal information when you visit our website at{" "}
            <a href="https://www.novisociety.com" target="_blank" rel="noopener noreferrer" style={{ color: "#C8E63C" }}>www.novisociety.com</a>{" "}
            or interact with our services, forms, and communications. By using our website, you acknowledge that you have read and understood this Privacy Policy.
          </p>
        </div>
      </section>

      {/* Table of Contents */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="p-6 rounded-2xl mb-10" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#2D6B7F", letterSpacing: "0.15em" }}>Table of Contents</p>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-sm font-medium hover:underline"
                style={{ color: "#2D6B7F", textDecoration: "none" }}
                onMouseEnter={e => e.target.style.textDecoration = "underline"}
                onMouseLeave={e => e.target.style.textDecoration = "none"}
              >
                {s.title}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-6">
              <div className="p-8 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)" }}>
                <h2 style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: "1.4rem",
                  color: "#1e2535",
                  fontStyle: "italic",
                  fontWeight: 400,
                  marginBottom: "20px",
                  paddingBottom: "12px",
                  borderBottom: "2px solid rgba(200,230,60,0.3)",
                }}>
                  {s.title}
                </h2>
                <div className="text-sm leading-relaxed space-y-3" style={{ color: "rgba(30,37,53,0.72)", lineHeight: 1.85 }}>
                  {s.content}
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-10 p-6 rounded-2xl text-center" style={{ background: "rgba(45,107,127,0.05)", border: "1px solid rgba(45,107,127,0.12)" }}>
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.55)" }}>
            Questions about this Privacy Policy? Contact us at{" "}
            <a href="mailto:support@novisociety.com" style={{ color: "#2D6B7F", fontWeight: 600 }}>support@novisociety.com</a>{" "}
            or call{" "}
            <a href="tel:+18178936317" style={{ color: "#2D6B7F", fontWeight: 600 }}>+1 817-893-6317</a>.
          </p>
        </div>
      </div>

      <NoviFooter />
    </div>
  );
}