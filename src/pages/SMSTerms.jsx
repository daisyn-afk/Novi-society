import { Link } from "react-router-dom";
import NoviFooter from "@/components/NoviFooter";

export default function SMSTerms() {
  return (
    <div className="min-h-screen" style={{ background: "#f5f3ef", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #2D6B7F 0%, #7B8EC8 55%, #C8E63C 100%)", padding: "48px 24px 40px" }}>
        <div className="max-w-3xl mx-auto text-center">
          <Link to="/">
            <img
              src="https://media.base44.com/images/public/699c9815c81b2b13b2643a48/632f46e8b_NOVI-WHITEGREEN.png"
              alt="NOVI Society"
              style={{ width: 160, display: "block", margin: "0 auto 24px" }}
            />
          </Link>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.8rem, 5vw, 2.75rem)", color: "#fff", fontStyle: "italic", fontWeight: 400, lineHeight: 1.15 }}>
            SMS / Mobile Terms of Service
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-14">
        <div className="rounded-2xl p-8 md:p-12" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)" }}>

          <p className="text-sm mb-8" style={{ color: "rgba(30,37,53,0.5)" }}>
            <strong style={{ color: "#1e2535" }}>Effective Date:</strong> April 16, 2026
          </p>

          <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(30,37,53,0.7)", lineHeight: 1.8 }}>
            These SMS / Mobile Terms of Service ("Mobile Terms") govern your use of text messaging services provided by <strong style={{ color: "#1e2535" }}>NOVI Society LLC</strong> ("NOVI Society," "we," "us," or "our"). By opting in to receive SMS text messages from NOVI Society, you agree to these Mobile Terms.
          </p>

          <div className="rounded-xl px-6 py-4 mb-8" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.3)" }}>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.75)", lineHeight: 1.8 }}>
              By submitting a form on this website and opting in to SMS, you agree to receive text messages from NOVI Society LLC regarding class information, scheduling, enrollment, and related updates.
            </p>
          </div>

          {[
            {
              title: "Program Name",
              content: <p className="text-sm" style={{ color: "rgba(30,37,53,0.7)" }}><strong style={{ color: "#1e2535" }}>NOVI Society SMS Alerts</strong></p>
            },
            {
              title: "Business Information",
              content: (
                <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.7)", lineHeight: 2 }}>
                  <strong style={{ color: "#1e2535" }}>NOVI Society LLC</strong><br />
                  8109 Meadow Valley Dr<br />
                  McKinney, TX 75071<br />
                  Phone: <a href="tel:+18178936317" className="font-semibold hover:underline" style={{ color: "#2D6B7F" }}>+1 (817) 893-6317</a><br />
                  Email: <a href="mailto:support@novisociety.com" className="font-semibold hover:underline" style={{ color: "#2D6B7F" }}>support@novisociety.com</a>
                </p>
              )
            },
            {
              title: "Program Description",
              content: <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.7)", lineHeight: 1.8 }}>NOVI Society provides aesthetics certification, hands-on training, compliance-focused education, and related support resources. If you opt in, you may receive text messages related to your inquiry, training opportunities, upcoming classes, announcements, event updates, customer care, and, where separately consented to, promotional messages and special offers.</p>
            },
            {
              title: "Consent to Receive Text Messages",
              content: <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.7)", lineHeight: 1.8 }}>By providing your mobile phone number and expressly opting in, you agree to receive SMS text messages from NOVI Society LLC at the number provided. Consent must be expressly given and is not implied simply because you provided a phone number. Consent to receive text messages is <strong style={{ color: "#1e2535" }}>not a condition of purchase</strong>. Distinct consent may be collected for non-promotional messages and for marketing messages, where applicable.</p>
            },
            {
              title: "Message Types",
              content: (
                <div>
                  <p className="text-sm mb-3" style={{ color: "rgba(30,37,53,0.7)" }}>Depending on the consent you provide, messages may include:</p>
                  <ul className="space-y-2 text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>
                    {[
                      "Follow-up messages regarding your inquiry",
                      "Scheduling updates and appointment reminders",
                      "Customer care and service-related communications",
                      "Class announcements and certification opportunities",
                      "Event updates",
                      "Promotional messages and special offers",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#C8E63C" }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            },
            {
              title: "Message Frequency",
              content: <p className="text-sm" style={{ color: "rgba(30,37,53,0.7)" }}><strong style={{ color: "#1e2535" }}>Message frequency may vary.</strong></p>
            },
            {
              title: "Message and Data Rates",
              content: <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.7)", lineHeight: 1.8 }}><strong style={{ color: "#1e2535" }}>Message and data rates may apply.</strong> Your mobile carrier may charge fees for sending or receiving text messages.</p>
            },
            {
              title: "Opt-Out Instructions",
              content: <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.7)", lineHeight: 1.8 }}>You may opt out of receiving text messages from NOVI Society at any time by replying <strong style={{ color: "#1e2535" }}>STOP</strong> to any message. After you send STOP, you may receive one final confirmation message confirming that you have been unsubscribed.</p>
            },
            {
              title: "Help Instructions",
              content: <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.7)", lineHeight: 1.8 }}>For help, reply <strong style={{ color: "#1e2535" }}>HELP</strong> to any message, call us at <a href="tel:+18178936317" className="font-semibold hover:underline" style={{ color: "#2D6B7F" }}>+1 (817) 893-6317</a>, or email <a href="mailto:support@novisociety.com" className="font-semibold hover:underline" style={{ color: "#2D6B7F" }}>support@novisociety.com</a>.</p>
            },
            {
              title: "Eligibility",
              content: <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.7)", lineHeight: 1.8 }}>By opting in, you represent that you are the authorized user of the mobile number provided and that you are authorized to consent to receive messages at that number.</p>
            },
            {
              title: "Privacy",
              content: (
                <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.7)", lineHeight: 1.8 }}>
                  <p>Your use of our SMS services is also governed by our Privacy Policy. Please review our Privacy Policy here: <a href="https://novisociety.com/PrivacyPolicy" className="font-semibold hover:underline" style={{ color: "#2D6B7F" }}>https://novisociety.com/PrivacyPolicy</a>.</p>
                  <p><strong style={{ color: "#1e2535" }}>No mobile information will be sold or shared with third parties or affiliates for marketing or promotional purposes.</strong> Text messaging originator opt-in data and consent will not be shared with any third parties, except with vendors, platform providers, and messaging service providers necessary to deliver the messages you have requested.</p>
                </div>
              )
            },
            {
              title: "Supported Carriers / Delivery",
              content: <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.7)", lineHeight: 1.8 }}>Message delivery is subject to effective transmission by your mobile carrier and is not guaranteed. Mobile carriers are not liable for delayed or undelivered messages.</p>
            },
            {
              title: "Changes to Mobile Terms",
              content: <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.7)", lineHeight: 1.8 }}>We may update these Mobile Terms from time to time. Any changes will be effective when posted to this page, unless otherwise stated. Your continued consent to receive messages after changes become effective constitutes your acceptance of the revised Mobile Terms.</p>
            },
            {
              title: "Contact Us",
              content: (
                <div className="text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>
                  <p className="mb-3">If you have questions about these Mobile Terms, contact us at:</p>
                  <p className="leading-relaxed" style={{ lineHeight: 2 }}>
                    <strong style={{ color: "#1e2535" }}>NOVI Society LLC</strong><br />
                    8109 Meadow Valley Dr<br />
                    McKinney, TX 75071<br />
                    Phone: <a href="tel:+18178936317" className="font-semibold hover:underline" style={{ color: "#2D6B7F" }}>+1 (817) 893-6317</a><br />
                    Email: <a href="mailto:support@novisociety.com" className="font-semibold hover:underline" style={{ color: "#2D6B7F" }}>support@novisociety.com</a>
                  </p>
                </div>
              )
            },
          ].map(({ title, content }) => (
            <div key={title} className="mb-8 pb-8" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.2rem", color: "#1e2535", fontStyle: "italic", fontWeight: 400, marginBottom: 12 }}>{title}</h2>
              {content}
            </div>
          ))}

          {/* Back links */}
          <div className="flex flex-wrap gap-4 pt-2">
            <Link to="/ContactUs" className="text-sm font-semibold hover:underline" style={{ color: "#2D6B7F" }}>← Back to Contact</Link>
            <Link to="/PrivacyPolicy" className="text-sm font-semibold hover:underline" style={{ color: "#2D6B7F" }}>Privacy Policy</Link>
            <Link to="/TermsAndConditions" className="text-sm font-semibold hover:underline" style={{ color: "#2D6B7F" }}>Terms & Conditions</Link>
            <Link to="/RefundPolicy" className="text-sm font-semibold hover:underline" style={{ color: "#2D6B7F" }}>Refund Policy</Link>
          </div>
        </div>
      </div>

      <NoviFooter />
    </div>
  );
}