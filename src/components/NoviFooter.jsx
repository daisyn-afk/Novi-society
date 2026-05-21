import { Link } from "react-router-dom";

export default function NoviFooter() {
  return (
    <footer style={{ background: "#1e2535", borderTop: "1px solid rgba(255,255,255,0.07)", padding: "40px 24px 32px" }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/" style={{ display: "flex", alignItems: "baseline", gap: 5, textDecoration: "none" }}>
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "rgba(255,255,255,0.7)", fontStyle: "italic", fontWeight: 400 }}>novi</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Society</span>
          </Link>

          {/* Center copy */}
          <p className="text-xs text-center order-last sm:order-none" style={{ color: "rgba(255,255,255,0.28)", lineHeight: 1.6 }}>
            © {new Date().getFullYear()} NOVI Society LLC · 8109 Meadow Valley Dr, McKinney, TX 75071<br className="hidden sm:block" />
            <span className="sm:hidden"> · </span>
            <a href="mailto:support@novisociety.com" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>support@novisociety.com</a>
            {" · "}
            <a href="tel:+18178936317" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>(817) 893-6317</a>
          </p>

          {/* Links */}
          <div className="flex items-center gap-4">
            <Link
              to="/PrivacyPolicy"
              className="text-xs font-medium"
              style={{ color: "rgba(200,230,60,0.65)", textDecoration: "none" }}
              onMouseEnter={e => e.target.style.color = "#C8E63C"}
              onMouseLeave={e => e.target.style.color = "rgba(200,230,60,0.65)"}
            >
              Privacy Policy
            </Link>
            <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
            <Link
              to="/TermsAndConditions"
              className="text-xs font-medium"
              style={{ color: "rgba(200,230,60,0.65)", textDecoration: "none" }}
              onMouseEnter={e => e.target.style.color = "#C8E63C"}
              onMouseLeave={e => e.target.style.color = "rgba(200,230,60,0.65)"}
            >
              Terms &amp; Conditions
            </Link>
            <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
            <Link
              to="/RefundPolicy"
              className="text-xs font-medium"
              style={{ color: "rgba(200,230,60,0.65)", textDecoration: "none" }}
              onMouseEnter={e => e.target.style.color = "#C8E63C"}
              onMouseLeave={e => e.target.style.color = "rgba(200,230,60,0.65)"}
            >
              Refund Policy
            </Link>
            <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
            <Link
              to="/SMSTerms"
              className="text-xs font-medium"
              style={{ color: "rgba(200,230,60,0.65)", textDecoration: "none" }}
              onMouseEnter={e => e.target.style.color = "#C8E63C"}
              onMouseLeave={e => e.target.style.color = "rgba(200,230,60,0.65)"}
            >
              SMS Terms
            </Link>
            <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
            <Link
              to="/ContactUs"
              className="text-xs font-medium"
              style={{ color: "rgba(200,230,60,0.65)", textDecoration: "none" }}
              onMouseEnter={e => e.target.style.color = "#C8E63C"}
              onMouseLeave={e => e.target.style.color = "rgba(200,230,60,0.65)"}
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}