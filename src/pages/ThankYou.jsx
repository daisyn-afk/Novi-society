import NoviFooter from "@/components/NoviFooter";
import { Phone, CheckCircle } from "lucide-react";

export default function ThankYou() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(150deg, #ede9fb 0%, #f5f2ff 40%, #eaf5c8 75%, #C8E63C 100%)", backgroundAttachment: "fixed", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
      `}</style>

      {/* Main content */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px" }}>
        <div style={{ maxWidth: 560, width: "100%", textAlign: "center" }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 5, marginBottom: 40 }}>
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: "#1e2535", fontStyle: "italic", fontWeight: 400 }}>novi</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(30,37,53,0.45)" }}>Society</span>
          </div>

          {/* Check icon */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(200,230,60,0.18)", border: "2px solid rgba(200,230,60,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle style={{ width: 36, height: 36, color: "#5a7a20" }} />
            </div>
          </div>

          {/* Headline */}
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(26px, 5vw, 38px)", color: "#1e2535", fontWeight: 400, fontStyle: "italic", lineHeight: 1.25, marginBottom: 20 }}>
            Thank You — We Received Your Request
          </h1>

          {/* Body */}
          <p style={{ fontSize: 15, lineHeight: 1.75, color: "rgba(30,37,53,0.7)", marginBottom: 40, maxWidth: 480, margin: "0 auto 40px" }}>
            Thank you for reaching out to NOVI Society. A NOVI consultant will follow up with you soon regarding aesthetics certification training, upcoming class options, enrollment support, and Medical Director coverage.
          </p>

          {/* Callout card */}
          <div style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)", borderRadius: 20, border: "1px solid rgba(200,230,60,0.35)", padding: "32px 28px", marginBottom: 28, boxShadow: "0 4px 24px rgba(30,37,53,0.08)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(30,37,53,0.45)", marginBottom: 8 }}>Need help sooner?</p>
            <p style={{ fontSize: 16, color: "#1e2535", fontWeight: 500, marginBottom: 24, lineHeight: 1.5 }}>
              You can call or text Jenna directly at <strong style={{ color: "#2D6B7F" }}>(817) 893-6317</strong>.
            </p>
            <a
              href="tel:+18178936317"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#C8E63C", color: "#1e2535", fontWeight: 700,
                fontSize: 14, padding: "13px 28px", borderRadius: 100,
                textDecoration: "none", letterSpacing: "0.02em",
                boxShadow: "0 4px 16px rgba(200,230,60,0.4)",
                transition: "opacity 0.15s"
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              <Phone style={{ width: 16, height: 16 }} />
              Call Jenna Now
            </a>
          </div>

          {/* Secondary text */}
          <p style={{ fontSize: 12, color: "rgba(30,37,53,0.45)", lineHeight: 1.7, maxWidth: 400, margin: "0 auto" }}>
            You may also receive follow-up messages from NOVI Society based on the communication preferences you selected on the form.
          </p>

        </div>
      </main>

      <NoviFooter />
    </div>
  );
}