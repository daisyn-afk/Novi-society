import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import NoviFooter from "@/components/NoviFooter";

const EFFECTIVE_DATE = "March 30, 2026";

const sections = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    content: (
      <div className="space-y-3">
        <p>
          Welcome to NOVI Society LLC ("NOVI Society," "we," "us," or "our"). By accessing or using our website at{" "}
          <a href="https://www.novisociety.com" target="_blank" rel="noopener noreferrer" style={{ color: "#2D6B7F" }}>www.novisociety.com</a>{" "}
          (the "Site"), submitting any form, inquiry, or application, or engaging with our services, communications, or marketing in any manner, you ("user," "you," or "your") agree to be bound by these Terms & Conditions (the "Terms").
        </p>
        <p>
          If you do not agree to these Terms, please do not use our Site or submit any information through our forms or channels. Your continued use of the Site following any changes to these Terms constitutes your acceptance of those changes.
        </p>
        <p>
          These Terms apply to all visitors, users, and others who access or use the Site, including those who submit inquiries, course applications, or opt into communications through our website, landing pages, or third-party lead forms.
        </p>
      </div>
    ),
  },
  {
    id: "about",
    title: "2. About NOVI Society LLC",
    content: (
      <div className="space-y-3">
        <p>
          NOVI Society LLC is a training centre and healthcare-related education and business services company based in McKinney, Texas. We operate the NOVI Society platform, which provides aesthetic training, certification pathways, medical director compliance infrastructure, and professional development resources for licensed healthcare providers.
        </p>
        <p>
          NOVI Society LLC is the sole owner and operator of this website. All content, materials, branding, services, and communications originate from or are authorized by NOVI Society LLC.
        </p>
        <div className="p-5 rounded-xl text-sm space-y-1" style={{ background: "rgba(45,107,127,0.06)", border: "1px solid rgba(45,107,127,0.15)" }}>
          <p className="font-bold" style={{ color: "#1e2535" }}>NOVI Society LLC</p>
          <p>Authorized Representative: Ashlan Greenfield</p>
          <p>8109 Meadow Valley Dr, McKinney, Texas 75071, United States</p>
          <p>Email: <a href="mailto:support@novisociety.com" style={{ color: "#2D6B7F" }}>support@novisociety.com</a></p>
          <p>Phone: <a href="tel:+18178936317" style={{ color: "#2D6B7F" }}>+1 817-893-6317</a></p>
        </div>
      </div>
    ),
  },
  {
    id: "website-use",
    title: "3. General Website Use & Acceptable Use",
    content: (
      <div className="space-y-3">
        <p>
          You may use this Site for lawful purposes only. By using this Site, you agree that you will not:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Use the Site in any way that violates applicable local, state, national, or international law or regulation.</li>
          <li>Engage in any conduct that is unlawful, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable.</li>
          <li>Attempt to gain unauthorized access to any portion of the Site, its servers, or any systems connected to it.</li>
          <li>Transmit any unsolicited or unauthorized advertising or promotional material.</li>
          <li>Use automated means, bots, scrapers, or similar tools to access or collect data from the Site without our express written consent.</li>
          <li>Reproduce, duplicate, copy, sell, resell, or exploit any portion of the Site without our express written permission.</li>
          <li>Submit false, misleading, or fraudulent information through any form or communication channel on the Site.</li>
          <li>Interfere with or disrupt the integrity, performance, or security of the Site.</li>
        </ul>
        <p>
          We reserve the right to terminate or restrict access to the Site for any user who violates these acceptable use provisions.
        </p>
      </div>
    ),
  },
  {
    id: "intellectual-property",
    title: "4. Intellectual Property",
    content: (
      <div className="space-y-3">
        <p>
          All content on this Site — including but not limited to text, graphics, logos, images, icons, audio clips, video, data compilations, and software — is the property of NOVI Society LLC or its content suppliers and is protected by applicable United States and international intellectual property laws.
        </p>
        <p>
          The NOVI Society name, logo, and all related marks, branding, and trade dress are trademarks of NOVI Society LLC. You may not use any of our trademarks or branding without our prior written consent.
        </p>
        <p>
          You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the Site solely for your personal, informational, and non-commercial purposes. This license does not include any right to resell or make commercial use of the Site or its contents, or to download or copy content for the benefit of any third party.
        </p>
        <p>
          Any unauthorized use of the Site's content or materials may violate copyright, trademark, and other applicable laws and could result in legal action.
        </p>
      </div>
    ),
  },
  {
    id: "informational-content",
    title: "5. Informational Purposes & No Guarantee of Accuracy",
    content: (
      <div className="space-y-3">
        <p>
          The information provided on this Site is for general informational purposes only. While we make reasonable efforts to ensure that the content is accurate and current, NOVI Society LLC makes no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, suitability, or availability of the information on the Site.
        </p>
        <p>
          Content on the Site, including course descriptions, pricing, availability, schedules, and services, is subject to change at any time without notice. We are not obligated to update any information on the Site and are not responsible for any decisions made based on information found here.
        </p>
        <p>
          Nothing on this Site constitutes professional medical, legal, or financial advice. Information about aesthetic medicine, training, or compliance is provided for educational and informational purposes only and does not create a professional or clinical relationship.
        </p>
      </div>
    ),
  },
  {
    id: "user-submissions",
    title: "6. User Submissions & Form Information",
    content: (
      <div className="space-y-3">
        <p>
          When you submit information through any form on our Site — including course inquiry forms, pre-order reservation forms, contact forms, or any other data collection mechanism — you represent and warrant that:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>All information you provide is accurate, current, and complete to the best of your knowledge.</li>
          <li>You are authorized to submit the information provided, including any professional license details.</li>
          <li>You consent to NOVI Society LLC contacting you using the information provided, including by phone, email, or text message where applicable.</li>
        </ul>
        <p>
          NOVI Society LLC will use submitted information in accordance with our{" "}
          <Link to="/PrivacyPolicy" style={{ color: "#2D6B7F" }}>Privacy Policy</Link>.
          We reserve the right to verify any submitted credentials or information before confirming any enrollment, reservation, or service agreement.
        </p>
        <p>
          By submitting a form, you acknowledge that you do not have a contractual right to enrollment or service solely by virtue of form submission. All applications and reservations are subject to review and acceptance by NOVI Society LLC.
        </p>
      </div>
    ),
  },
  {
    id: "sms-terms",
    title: "7. SMS / Text Messaging Terms",
    content: (
      <div className="space-y-4">
        <p>
          By providing your mobile phone number and checking the applicable opt-in box on any of our forms — including website forms, landing page forms, or Meta lead forms — you expressly consent to receive text messages (SMS) from NOVI Society LLC.
        </p>
        <div className="p-4 rounded-xl" style={{ background: "rgba(200,230,60,0.07)", border: "1px solid rgba(200,230,60,0.25)" }}>
          <p className="font-semibold mb-2" style={{ color: "#3d5a0a" }}>Your consent to receive text messages is not a condition of any purchase or enrollment.</p>
        </div>
        <div>
          <p className="font-semibold mb-2" style={{ color: "#1e2535" }}>Message Types</p>
          <p>Depending on the consent you provide, text messages from NOVI Society LLC may include:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Promotional and marketing messages about courses, services, and special offers</li>
            <li>Follow-up messages related to your inquiry or application</li>
            <li>Scheduling-related communications and appointment reminders</li>
            <li>Enrollment confirmations and status updates</li>
            <li>Customer care and support messages</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold mb-2" style={{ color: "#1e2535" }}>Message Frequency & Rates</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Message frequency varies</strong> based on your inquiry status, enrollment activity, and marketing preferences.</li>
            <li><strong>Message and data rates may apply</strong> depending on your mobile carrier and plan.</li>
                  <li>Carriers are not liable for delayed or undelivered messages.</li>
                  <li>You must be 18 years of age or older to use this SMS service.</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold mb-2" style={{ color: "#1e2535" }}>How to Opt Out or Get Help</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Reply <strong>STOP</strong> at any time to unsubscribe from all text messages from NOVI Society LLC. After opting out, you will no longer receive SMS communications, except where required for transactional or legal purposes.</li>
            <li>Reply <strong>HELP</strong> for assistance, or contact us at <a href="mailto:support@novisociety.com" style={{ color: "#2D6B7F" }}>support@novisociety.com</a> or <a href="tel:+18178936317" style={{ color: "#2D6B7F" }}>+1 817-893-6317</a>.</li>
          </ul>
        </div>
        <div className="p-4 rounded-xl" style={{ background: "rgba(45,107,127,0.06)", border: "1px solid rgba(45,107,127,0.15)" }}>
          <p className="font-semibold mb-1.5" style={{ color: "#1e2535" }}>SMS Data & Privacy</p>
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.72)" }}>
            SMS consent data and mobile information collected through our opt-in channels will not be sold, rented, or shared with third parties or affiliates for their own marketing or promotional purposes. SMS opt-in data may be shared with aggregators and carriers solely as necessary to transmit messages on our behalf. For full details, see our{" "}
            <Link to="/PrivacyPolicy" style={{ color: "#2D6B7F" }}>Privacy Policy</Link>.
          </p>
        </div>
        <p>
          NOVI Society LLC may collect SMS opt-in consent through website forms, landing page forms, and Meta lead forms where applicable. By submitting such forms with a phone number provided, you acknowledge that you have read and agreed to these SMS Terms.
        </p>
      </div>
    ),
  },
  {
    id: "third-party",
    title: "8. Third-Party Links & Services",
    content: (
      <div className="space-y-3">
        <p>
          Our Site may contain links to third-party websites, platforms, or services that are not owned or controlled by NOVI Society LLC. These may include payment processors, social media platforms, scheduling tools, CRM systems, analytics providers, and other service partners.
        </p>
        <p>
          NOVI Society LLC has no control over and assumes no responsibility for the content, privacy policies, practices, or terms of any third-party websites or services. We do not endorse or make any representations about third-party websites, and your use of any such sites is entirely at your own risk.
        </p>
        <p>
          We encourage you to review the terms and privacy policies of any third-party platform you visit through links on our Site.
        </p>
      </div>
    ),
  },
  {
    id: "disclaimers",
    title: "9. Disclaimers & Limitation of Liability",
    content: (
      <div className="space-y-3">
        <p>
          <strong>Disclaimer of Warranties.</strong> This Site and its content are provided on an "as is" and "as available" basis without any warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, non-infringement, or course of performance.
        </p>
        <p>
          NOVI Society LLC does not warrant that the Site will be uninterrupted, error-free, secure, or free of viruses or other harmful components. We do not warrant the accuracy, completeness, or usefulness of any information on the Site.
        </p>
        <p>
          <strong>Limitation of Liability.</strong> To the maximum extent permitted by applicable law, in no event shall NOVI Society LLC, its officers, directors, employees, agents, representatives, or successors be liable for any indirect, incidental, special, consequential, punitive, or exemplary damages — including but not limited to loss of profits, data, goodwill, or business opportunities — arising out of or in connection with your use of or inability to use the Site or its content, even if we have been advised of the possibility of such damages.
        </p>
        <p>
          Our total liability to you for any claims arising from your use of the Site shall not exceed the greater of (a) the amount you paid to NOVI Society LLC in the twelve (12) months preceding the claim, or (b) one hundred U.S. dollars ($100.00).
        </p>
        <p>
          Some jurisdictions do not allow the exclusion of certain warranties or the limitation or exclusion of liability for certain types of damages. Accordingly, some of the above limitations may not apply to you.
        </p>
      </div>
    ),
  },
  {
    id: "indemnification",
    title: "10. Indemnification",
    content: (
      <div className="space-y-3">
        <p>
          You agree to defend, indemnify, and hold harmless NOVI Society LLC and its officers, directors, employees, agents, licensors, and service providers from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Your violation of these Terms;</li>
          <li>Your use of the Site or any of its content;</li>
          <li>Your submission of false, inaccurate, or unauthorized information;</li>
          <li>Your violation of any applicable law, regulation, or third-party rights;</li>
          <li>Any content you submit, post, or transmit through the Site.</li>
        </ul>
        <p>
          NOVI Society LLC reserves the right to assume the exclusive defense and control of any matter subject to indemnification by you, in which case you agree to cooperate fully with our defense of such claims.
        </p>
      </div>
    ),
  },
  {
    id: "governing-law",
    title: "11. Governing Law & Dispute Resolution",
    content: (
      <div className="space-y-3">
        <p>
          These Terms and any dispute or claim arising out of or relating to them, their subject matter, or their formation — whether contractual, tortious, or otherwise — shall be governed by and construed in accordance with the laws of the State of Texas, United States, without regard to its conflict of law provisions.
        </p>
        <p>
          Any legal action or proceeding arising under or related to these Terms shall be brought exclusively in the state or federal courts located in Collin County, Texas. By using this Site, you consent to the personal jurisdiction and venue of such courts and waive any objection to the laying of venue in such courts.
        </p>
        <p>
          Before initiating any formal legal proceedings, we encourage you to contact us at <a href="mailto:support@novisociety.com" style={{ color: "#2D6B7F" }}>support@novisociety.com</a> to attempt to resolve any dispute informally. We will make a good-faith effort to resolve concerns raised directly with us within a reasonable period.
        </p>
      </div>
    ),
  },
  {
    id: "updates",
    title: "12. Updates to These Terms",
    content: (
      <div className="space-y-3">
        <p>
          NOVI Society LLC reserves the right to modify, update, or replace these Terms at any time at our sole discretion. When we make changes, we will update the "Effective Date" at the top of this page. In some cases, we may also provide additional notice, such as an announcement on our website or a notification by email.
        </p>
        <p>
          It is your responsibility to review these Terms periodically. Your continued use of the Site after the posting of revised Terms constitutes your acceptance of the updated Terms. If you do not agree to the revised Terms, you must discontinue use of the Site.
        </p>
      </div>
    ),
  },
  {
    id: "contact",
    title: "13. Contact Information",
    content: (
      <div className="space-y-3">
        <p>
          If you have any questions, concerns, or inquiries regarding these Terms & Conditions, please contact us:
        </p>
        <div className="p-5 rounded-xl space-y-1.5 text-sm" style={{ background: "rgba(45,107,127,0.06)", border: "1px solid rgba(45,107,127,0.15)" }}>
          <p className="font-bold" style={{ color: "#1e2535" }}>NOVI Society LLC</p>
          <p>Authorized Representative: Ashlan Greenfield</p>
          <p>8109 Meadow Valley Dr, McKinney, Texas 75071, United States</p>
          <p>Email: <a href="mailto:support@novisociety.com" style={{ color: "#2D6B7F" }}>support@novisociety.com</a></p>
          <p>Phone: <a href="tel:+18178936317" style={{ color: "#2D6B7F" }}>+1 817-893-6317</a></p>
          <p>Website: <a href="https://www.novisociety.com" target="_blank" rel="noopener noreferrer" style={{ color: "#2D6B7F" }}>www.novisociety.com</a></p>
        </div>
      </div>
    ),
  },
];

export default function TermsAndConditions() {
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
            Terms &amp; Conditions
          </h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.95rem" }}>
            Effective Date: <strong style={{ color: "rgba(255,255,255,0.75)" }}>{EFFECTIVE_DATE}</strong>
          </p>
          <p className="mt-4 max-w-2xl" style={{ color: "rgba(255,255,255,0.62)", lineHeight: 1.8, fontSize: "0.95rem" }}>
            Please read these Terms &amp; Conditions carefully before using the NOVI Society website or submitting any information through our forms or channels. These Terms govern your access to and use of{" "}
            <a href="https://www.novisociety.com" target="_blank" rel="noopener noreferrer" style={{ color: "#C8E63C" }}>www.novisociety.com</a>{" "}
            and constitute a legally binding agreement between you and NOVI Society LLC.
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
                className="text-sm font-medium"
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
            Questions about these Terms? Contact us at{" "}
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