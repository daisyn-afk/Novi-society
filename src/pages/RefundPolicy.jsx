import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import NoviFooter from "@/components/NoviFooter";

const EFFECTIVE_DATE = "April 2, 2026";

export default function RefundPolicy() {
  const sections = [
    {
      id: "enrollment-rescheduling",
      title: "1. Enrollment & Rescheduling Policy",
      content: (
        <div className="space-y-4">
          <p>
            We are committed to delivering a high-quality, hands-on training experience. Due to the limited seating and advance planning required for each training, all enrollments are considered final.
          </p>
          <p className="font-semibold" style={{ color: "#1e2535" }}>All payments are non-refundable.</p>
          <p>
            To provide flexibility, we offer the following options:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Students may request a one-time transfer to a future training date with at least 7 days' notice prior to their scheduled course.</li>
            <li>Transfers must be used within 6 months of the original training date.</li>
            <li>Requests made within 3–7 days of the scheduled training may be subject to a rescheduling fee.</li>
            <li>Requests made within 72 hours of the training or failure to attend the course will result in forfeiture of enrollment.</li>
          </ul>
        </div>
      ),
    },
    {
      id: "attendance",
      title: "2. Attendance",
      content: (
        <div className="space-y-3">
          <p>
            Students are expected to arrive on time and prepared to participate. Late arrivals may be denied participation in order to preserve the quality and flow of the training experience.
          </p>
        </div>
      ),
    },
    {
      id: "course-changes",
      title: "3. Course Changes or Cancellation",
      content: (
        <div className="space-y-3">
          <p>
            In the rare event that a training must be rescheduled by our team, students will be offered a transfer to a future date. If a suitable date is not available, a full credit will be issued.
          </p>
        </div>
      ),
    },
    {
      id: "travel-accommodations",
      title: "4. Travel & Accommodations",
      content: (
        <div className="space-y-3">
          <p>
            Students are responsible for any travel or lodging arrangements. We recommend booking flexible travel when possible, as we are not responsible for any related expenses.
          </p>
        </div>
      ),
    },
    {
      id: "medical-emergency",
      title: "5. Medical or Emergency Situations",
      content: (
        <div className="space-y-3">
          <p>
            We understand that unforeseen circumstances can arise. In documented emergency situations, rescheduling requests may be reviewed on a case-by-case basis.
          </p>
        </div>
      ),
    },
    {
      id: "financing",
      title: "6. Financing",
      content: (
        <div className="space-y-3">
          <p>
            For students using third-party financing options, all payment obligations remain with the financing provider. This policy applies regardless of payment method.
          </p>
        </div>
      ),
    },
  ];

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
            Refund Policy
          </h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.95rem" }}>
            Effective Date: <strong style={{ color: "rgba(255,255,255,0.75)" }}>{EFFECTIVE_DATE}</strong>
          </p>
          <p className="mt-4 max-w-2xl" style={{ color: "rgba(255,255,255,0.62)", lineHeight: 1.8, fontSize: "0.95rem" }}>
            NOVI Society LLC is committed to transparent enrollment and rescheduling practices. This Refund Policy outlines our guidelines for course enrollment, payment terms, and rescheduling options.
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

        {/* Acknowledgment */}
        <div className="mt-10 p-6 rounded-2xl text-center" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.25)" }}>
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.72)" }}>
            By completing enrollment, you acknowledge and agree to these terms
          </p>
        </div>
      </div>

      <NoviFooter />
    </div>
  );
}