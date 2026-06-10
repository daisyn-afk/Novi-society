import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowRight, Star, BookOpen, Shield, MapPin, ChevronRight, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import NoviOfferingsPortal from "@/components/landing/NoviOfferingsPortal";
import { DEFAULT_COURSE_IMAGE_URL } from "@/lib/courseDisplay";
import { LEGAL_FOOTER_LINKS } from "@/lib/legalFooterLinks";

// Brand palette from the Novi moodboard
const NOVI_LOGO_SRC = "/novi-logo-neon-green.png";

const BRAND = {
  periwinkle: "#DBE4D8",   // soft blue-grey
  periwinkleDeep: "#7B8EC8", // richer periwinkle
  cream: "#C6BEA8",
  lime: "#A7BC8C",          // the electric lime from logo
  limeVibrant: "#C8E63C",
  coral: "#DA6A63",
  teal: "#2D6B7F",
  dark: "#1e2535",
};

const MEMBERS = [
  { initial: "J", name: "Jessica M.", role: "RN · Aesthetics", quote: "Novi gave me the structure to build a real practice — not just a side hustle." },
  { initial: "S", name: "Dr. Sarah L.", role: "Medical Director", quote: "Supervising my providers has never been this seamless. Novi is in a category of its own." },
  { initial: "A", name: "Amanda T.", role: "Patient", quote: "I knew the moment I found Novi this was different. Every provider felt curated." },
];

function formatCoursePrice(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "";
  return `$${num.toLocaleString()}`;
}

const PILLARS = [
  { number: "01", label: "Certify", desc: "Train with Novi's industry-exclusive courses and earn credentials that actually move the needle." },
  { number: "02", label: "Comply", desc: "Medical director oversight, license tracking, and compliance — handled intelligently." },
  { number: "03", label: "Connect", desc: "Join a society of elite aesthetic providers. Be discovered by patients who expect the best." },
  { number: "04", label: "Command", desc: "Run your practice from one obsessively crafted dashboard — bookings, records, reviews." },
];

const CALL_NOW_LINK = "tel:8178936317";
const SIGN_IN_PATH = "/login";
const PROVIDER_JOIN_PATH = `${createPageUrl("Onboarding")}?from=provider`;
const PATIENT_JOIN_PATH = createPageUrl("Onboarding");

export default function LandingPage() {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    retry: false,
  });
  const isAuthenticated = Boolean(me);

  return (
    <div style={{ fontFamily: "'TT Interphases', 'DM Sans', sans-serif", background: "#f5f3ef", minHeight: "100vh", color: BRAND.dark }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');

        .novi-serif { font-family: 'DM Serif Display', Georgia, serif; }
        .novi-sans { font-family: 'DM Sans', sans-serif; }

        .marquee-track {
          display: flex;
          gap: 48px;
          animation: marquee 26s linear infinite;
          white-space: nowrap;
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        .card-lift {
          transition: transform 0.35s ease, box-shadow 0.35s ease;
        }
        .card-lift:hover {
          transform: translateY(-6px);
        }

        .btn-dark {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 32px;
          background: ${BRAND.dark};
          color: white;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-radius: 100px;
          text-decoration: none;
          transition: all 0.22s;
          font-family: 'DM Sans', sans-serif;
        }
        .btn-dark:hover { background: #2d3d66; transform: translateY(-1px); }

        .btn-outline {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 32px;
          background: transparent;
          color: ${BRAND.dark};
          font-weight: 600;
          font-size: 13px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-radius: 100px;
          border: 1.5px solid rgba(30,37,53,0.25);
          text-decoration: none;
          transition: all 0.22s;
          font-family: 'DM Sans', sans-serif;
        }
        .btn-outline:hover { border-color: ${BRAND.dark}; }

        .pill-tag {
          display: inline-flex; align-items: center;
          padding: 6px 16px;
          border-radius: 100px;
          border: 1px solid rgba(30,37,53,0.15);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(30,37,53,0.5);
          background: rgba(255,255,255,0.6);
          font-family: 'DM Sans', sans-serif;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
        }

        .landing-nav-inner {
          gap: 16px;
        }
        @media (max-width: 768px) {
          .grid-2 { grid-template-columns: 1fr; }
          .hide-mobile { display: none !important; }
          .hero-flex { flex-direction: column !important; }
          .landing-nav-inner { padding: 0 20px !important; gap: 20px; }
          .stats-row {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 28px 16px;
            align-items: start;
          }
          .stats-row .stat-item {
            border-right: none !important;
            padding: 0 !important;
            text-align: center;
          }
          .stats-row .stat-number { justify-content: center; }
          .stats-row .stat-label {
            justify-content: center;
            text-align: center;
            min-height: 2.75em;
          }
          .cta-buttons { flex-direction: column !important; align-items: stretch !important; }
          .pillars-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .pillars-grid { grid-template-columns: 1fr !important; }
          .landing-nav-inner { padding: 0 16px !important; gap: 16px; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(245,243,239,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(30,37,53,0.07)" }}>
        <div className="landing-nav-inner" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", minHeight: 70, height: 70, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link
            to={createPageUrl("LandingPage")}
            style={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
              background: BRAND.dark,
              padding: "10px 18px",
              borderRadius: 14,
              boxShadow: "0 2px 14px rgba(30,37,53,0.18)",
              flexShrink: 0,
            }}
            aria-label="NOVI Society home"
          >
            <img src={NOVI_LOGO_SRC} alt="" width={180} height={52} style={{ height: 40, width: "auto", display: "block" }} />
          </Link>
          <div className="landing-nav-actions" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => { window.location.href = CALL_NOW_LINK; }}
              className="btn-outline"
              style={{ padding: "8px 22px", fontSize: 12 }}
            >
              <Phone style={{ width: 14, height: 14 }} />
              Call Now
            </button>
            <button
              type="button"
              onClick={() => {
                if (isAuthenticated) {
                  base44.auth.logout(`${window.location.origin}/`);
                } else {
                  window.location.href = SIGN_IN_PATH;
                }
              }}
              className="btn-outline"
              style={{ padding: "8px 22px", fontSize: 12 }}
            >
              {isAuthenticated ? "Sign Out" : "Sign In"}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ paddingTop: 70, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* Top hero band — full bleed image-like with color wash */}
        <div style={{
          flex: 1,
          background: `linear-gradient(135deg, ${BRAND.teal} 0%, #4a8fa8 40%, #7B8EC8 70%, #DA6A63 100%)`,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 32px 60px",
          minHeight: 380,
        }}>
          {/* Organic blobs like the moodboard */}
          <div style={{ position: "absolute", top: "-20%", left: "-5%", width: "50%", height: "130%", borderRadius: "60% 40% 70% 30% / 50% 60% 40% 50%", background: "rgba(218,106,99,0.45)", filter: "blur(40px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-10%", right: "-5%", width: "40%", height: "100%", borderRadius: "40% 60% 30% 70% / 60% 40% 60% 40%", background: "rgba(168,192,60,0.3)", filter: "blur(50px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: "20%", right: "20%", width: "25%", height: "60%", borderRadius: "50%", background: "rgba(45,107,127,0.4)", filter: "blur(60px)", pointerEvents: "none" }} />

          {/* Tagline above logo */}
          <p className="novi-sans" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)", marginBottom: 20, position: "relative", zIndex: 2 }}>
            A new way to be seen
          </p>

          <h1 style={{ margin: 0, position: "relative", zIndex: 2, maxWidth: "min(92vw, 440px)", width: "100%" }} aria-label="NOVI Society">
            <img
              src={NOVI_LOGO_SRC}
              alt=""
              width={440}
              height={120}
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.2))",
              }}
            />
          </h1>
        </div>


      </section>

      {/* ── MARQUEE ── */}
      <div style={{ background: BRAND.dark, padding: "16px 0", overflow: "hidden", borderTop: "none" }}>
        <div className="marquee-track">
          {[...Array(2)].map((_, rep) =>
            ["Botox Certification", "✦", "Filler Protocols", "✦", "PRP Therapy", "✦", "Laser Training", "✦", "MD Oversight", "✦", "Patient Booking", "✦", "Novi Society", "✦"].map((item, i) => (
              <span key={`${rep}-${i}`} className="novi-sans" style={{ fontSize: 11, fontWeight: item === "✦" ? 400 : 600, letterSpacing: "0.16em", textTransform: "uppercase", color: item === "✦" ? "#C8E63C" : "rgba(255,255,255,0.3)" }}>
                {item}
              </span>
            ))
          )}
        </div>
      </div>

      {/* ── INTRO ── */}
      <section style={{ padding: "100px 32px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 80, alignItems: "flex-start", flexWrap: "wrap" }} className="hero-flex">
          <div style={{ flex: "0 0 auto" }}>
            <span className="pill-tag">The Platform</span>
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <h2 className="novi-serif" style={{ fontSize: "clamp(36px, 5vw, 62px)", fontWeight: 400, lineHeight: 1.1, marginBottom: 24, fontStyle: "italic" }}>
              The aesthetic<br />medicine industry<br />just changed.
            </h2>
            <p className="novi-sans" style={{ fontSize: 16, color: "rgba(30,37,53,0.55)", lineHeight: 1.8, fontWeight: 300, maxWidth: 460, marginBottom: 36 }}>
              Novi Society is the members-only platform for elite aesthetic providers — combining certification, compliance, and patient connection in one beautifully crafted system.
            </p>
            <div className="cta-buttons" style={{ display: "flex", gap: 12 }}>
              <Link to={PROVIDER_JOIN_PATH} className="btn-dark">
                Join the Society <ArrowRight style={{ width: 14, height: 14 }} />
              </Link>
              <Link to={PATIENT_JOIN_PATH} className="btn-outline">
                For Patients
              </Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row" style={{ display: "flex", gap: 0, marginTop: 80, borderTop: "1px solid rgba(30,37,53,0.1)", paddingTop: 48 }}>
          {[
            { n: "500+", label: "Society Members" },
            { n: "10k+", label: "Patients Treated" },
            { n: "98%", label: "Satisfaction Rate" },
            { n: "12+", label: "Certifications" },
          ].map(({ n, label }, i) => (
            <div key={label} className="stat-item" style={{ flex: 1, paddingRight: 32, borderRight: i < 3 ? "1px solid rgba(30,37,53,0.1)" : "none", paddingLeft: i > 0 ? 32 : 0 }}>
              <p className="novi-serif stat-number" style={{ fontSize: 44, color: BRAND.dark, fontWeight: 400, lineHeight: 1, fontStyle: "italic", margin: 0, display: "flex" }}>{n}</p>
              <p className="novi-sans stat-label" style={{ fontSize: 11, color: "rgba(30,37,53,0.4)", textTransform: "uppercase", letterSpacing: "0.14em", marginTop: 8, fontWeight: 600, marginBottom: 0, display: "flex", flexWrap: "wrap", lineHeight: 1.35 }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PILLARS ── */}
      <section style={{ background: BRAND.dark, padding: "100px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 64, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20 }}>
            <h2 className="novi-serif" style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 400, color: "white", fontStyle: "italic", lineHeight: 1.1 }}>
              Four pillars.<br />One society.
            </h2>
            <span className="pill-tag" style={{ border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)" }}>How it works</span>
          </div>

          <div className="pillars-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
            {PILLARS.map(({ number, label, desc }, idx) => (
              <div key={number} className="card-lift" style={{
                background: idx % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                padding: "40px 28px",
                cursor: "default",
              }}>
                <p className="novi-serif" style={{ fontSize: 11, fontStyle: "italic", color: "#C8E63C", letterSpacing: "0.1em", marginBottom: 20 }}>{number}</p>
                <h3 className="novi-serif" style={{ fontSize: 30, color: "white", marginBottom: 14, fontWeight: 400, fontStyle: "italic" }}>{label}</h3>
                <p className="novi-sans" style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.7, fontWeight: 300 }}>{desc}</p>
                <div style={{ width: 32, height: 2, background: "#C8E63C", marginTop: 32, opacity: 0.6 }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIETY SPLIT ── */}
      <section>
        <div className="grid-2">
          {/* Left — periwinkle */}
          <div style={{ background: BRAND.periwinkleDeep, padding: "80px 60px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "60%", height: "80%", borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
            <span className="pill-tag" style={{ border: "1px solid rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.1)", marginBottom: 28, display: "inline-flex" }}>For Providers</span>
            <h3 className="novi-serif" style={{ fontSize: "clamp(30px, 4vw, 48px)", color: "white", fontWeight: 400, fontStyle: "italic", lineHeight: 1.1, marginBottom: 20 }}>
              A new way<br />to be seen.
            </h3>
            <p className="novi-sans" style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.75, fontWeight: 300, marginBottom: 32 }}>
              Certify. Comply. Connect with patients who are actively looking for someone exactly like you.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 40px", display: "flex", flexDirection: "column", gap: 10 }}>
              {["Certification courses", "MD oversight built-in", "Compliance tracking", "Verified provider badge"].map(item => (
                <li key={item} className="novi-sans" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#C8E63C", flexShrink: 0 }} />
                  {item}
                </li>
              ))}
            </ul>
              <Link to={PROVIDER_JOIN_PATH} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", background: "#C8E63C", color: BRAND.dark, fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 100, textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}>
                Join as Provider <ArrowRight style={{ width: 13, height: 13 }} />
              </Link>
          </div>

          {/* Right — cream */}
          <div style={{ background: "#ede9e2", padding: "80px 60px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "60%", height: "80%", borderRadius: "50%", background: "rgba(218,106,99,0.08)", pointerEvents: "none" }} />
            <span className="pill-tag" style={{ marginBottom: 28, display: "inline-flex" }}>For Patients</span>
            <h3 className="novi-serif" style={{ fontSize: "clamp(30px, 4vw, 48px)", color: BRAND.dark, fontWeight: 400, fontStyle: "italic", lineHeight: 1.1, marginBottom: 20 }}>
              Find care<br />you can trust.
            </h3>
            <p className="novi-sans" style={{ fontSize: 14, color: "rgba(30,37,53,0.55)", lineHeight: 1.75, fontWeight: 300, marginBottom: 32 }}>
              Browse a curated network of Novi-certified providers. Every single one trained, verified, and overseen.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 40px", display: "flex", flexDirection: "column", gap: 10 }}>
              {["Verified provider profiles", "Transparent credentials", "Simple online booking", "Real patient reviews"].map(item => (
                <li key={item} className="novi-sans" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(30,37,53,0.6)" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: BRAND.coral, flexShrink: 0 }} />
                  {item}
                </li>
              ))}
            </ul>
            <Link to={PATIENT_JOIN_PATH} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", background: BRAND.dark, color: "white", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 100, textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}>
              Find a Provider <ArrowRight style={{ width: 13, height: 13 }} />
            </Link>
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid rgba(30,37,53,0.12)" }}>
              <h4 className="novi-serif" style={{ fontSize: "clamp(22px, 3.2vw, 36px)", color: BRAND.dark, fontWeight: 400, fontStyle: "italic", lineHeight: 1.1, marginBottom: 20, marginTop: 0 }}>
                Training course model
              </h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <Link to={createPageUrl("ModelSignup")} className="btn-dark" style={{ padding: "10px 22px", fontSize: 11 }}>
                  Sign up
                </Link>
                <Link to={createPageUrl("ModelBookingLookup")} className="btn-outline" style={{ padding: "10px 22px", fontSize: 11 }}>
                  Look up booking
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CERTIFICATION COURSES & MD SERVICES (same flows as NoviLanding) ── */}
      <section style={{ background: "#f5f3ef", padding: "100px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20, marginBottom: 64 }}>
            <div>
              <span className="pill-tag" style={{ marginBottom: 16, display: "inline-flex" }}>Become a Provider</span>
              <h2 className="novi-serif" style={{ fontSize: "clamp(30px, 4vw, 52px)", fontWeight: 400, fontStyle: "italic", color: BRAND.dark, lineHeight: 1.1, margin: 0 }}>
                Start your Novi journey.
              </h2>
            </div>
            <p className="novi-sans" style={{ fontSize: 14, color: "rgba(30,37,53,0.5)", lineHeight: 1.7, maxWidth: 380, fontWeight: 300 }}>
              Pick a certification course or choose a service to offer — we&apos;ll get you credentialed, covered, and connected.
            </p>
          </div>

          <NoviOfferingsPortal>
            {({ courses, serviceTypes, isLoadingCourses, openCourseModal, openServiceModal, isCourseFullySoldOut }) => (
              <>
                <div style={{ marginBottom: 64 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                    <BookOpen style={{ width: 16, height: 16, color: BRAND.periwinkleDeep }} />
                    <h3 className="novi-sans" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(30,37,53,0.45)", margin: 0 }}>Certification Courses</h3>
                  </div>
                  {isLoadingCourses && (
                    <div className="novi-sans" style={{ textAlign: "center", padding: 56, borderRadius: 20, background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)", color: "rgba(30,37,53,0.45)", fontSize: 14 }}>
                      Loading courses…
                    </div>
                  )}
                  {!isLoadingCourses && courses.length === 0 && (
                    <div className="novi-sans" style={{ textAlign: "center", padding: 56, borderRadius: 20, background: "rgba(0,0,0,0.02)", border: "1px dashed rgba(0,0,0,0.1)", color: "rgba(30,37,53,0.45)", fontSize: 14 }}>
                      Courses coming soon.
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
                    {courses.map((course) => {
                      const soldOut = isCourseFullySoldOut(course);
                      const img = course.cover_image_url || DEFAULT_COURSE_IMAGE_URL;
                      const level = (course.category || "beginner").replace(/_/g, " ");
                      return (
                        <div
                          key={course.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => !soldOut && openCourseModal(course)}
                          onKeyDown={(e) => {
                            if (!soldOut && (e.key === "Enter" || e.key === " ")) {
                              e.preventDefault();
                              openCourseModal(course);
                            }
                          }}
                          className="card-lift"
                          style={{
                            background: "white",
                            borderRadius: 20,
                            overflow: "hidden",
                            boxShadow: "0 4px 24px rgba(30,37,53,0.06)",
                            cursor: soldOut ? "not-allowed" : "pointer",
                            opacity: soldOut ? 0.72 : 1,
                            border: "1px solid rgba(0,0,0,0.06)",
                          }}
                        >
                          <div style={{ height: 180, overflow: "hidden", background: "#f0f0f0", position: "relative" }}>
                            <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            {soldOut && (
                              <span style={{ position: "absolute", top: 12, right: 12, background: "#DA6A63", color: "white", fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "6px 10px", borderRadius: 8 }}>
                                Sold out
                              </span>
                            )}
                          </div>
                          <div style={{ padding: "24px 24px 20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                              <span className="novi-sans" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: BRAND.periwinkleDeep, background: "rgba(123,142,200,0.1)", padding: "4px 10px", borderRadius: 100 }}>
                                {level}
                              </span>
                              {course.price != null && course.price !== "" && (
                                <span className="novi-serif" style={{ fontSize: 20, color: BRAND.dark, fontStyle: "italic" }}>{formatCoursePrice(course.price)}</span>
                              )}
                            </div>
                            <h4 className="novi-serif" style={{ fontSize: 20, color: BRAND.dark, margin: "8px 0 8px", fontWeight: 400, fontStyle: "italic", lineHeight: 1.2 }}>{course.title}</h4>
                            {course.description && (
                              <p className="novi-sans" style={{ fontSize: 13, color: "rgba(30,37,53,0.5)", lineHeight: 1.65, fontWeight: 300, marginBottom: 16, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                {course.description}
                              </p>
                            )}
                            {course.location && (
                              <p className="novi-sans" style={{ fontSize: 11, color: "rgba(30,37,53,0.35)", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                                <MapPin style={{ width: 14, height: 14, flexShrink: 0 }} />
                                {course.location}
                              </p>
                            )}
                            <span className="novi-sans" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", background: BRAND.dark, color: "white", borderRadius: 100, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                              {soldOut ? "Unavailable" : "Enroll now"} <ChevronRight style={{ width: 13, height: 13 }} />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                    <Shield style={{ width: 16, height: 16, color: BRAND.limeVibrant }} />
                    <h3 className="novi-sans" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(30,37,53,0.45)", margin: 0 }}>MD Services</h3>
                  </div>
                  {serviceTypes.length === 0 && (
                    <div className="novi-sans" style={{ textAlign: "center", padding: 56, borderRadius: 20, background: "rgba(0,0,0,0.02)", border: "1px dashed rgba(0,0,0,0.1)", color: "rgba(30,37,53,0.45)", fontSize: 14 }}>
                      MD services coming soon.
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                    {serviceTypes.map((service) => (
                      <div
                        key={service.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openServiceModal(service)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openServiceModal(service);
                          }
                        }}
                        className="card-lift"
                        style={{
                          background: BRAND.dark,
                          borderRadius: 20,
                          padding: 28,
                          cursor: "pointer",
                          position: "relative",
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: "60%", height: "80%", borderRadius: "50%", background: "rgba(200,230,60,0.05)", pointerEvents: "none" }} />
                        <span className="novi-sans" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(200,230,60,0.7)", background: "rgba(200,230,60,0.1)", padding: "4px 10px", borderRadius: 100, display: "inline-block", marginBottom: 14, position: "relative" }}>
                          {(service.category || "service").replace(/_/g, " ")}
                        </span>
                        <h4 className="novi-serif" style={{ fontSize: 20, color: "white", fontWeight: 400, fontStyle: "italic", lineHeight: 1.2, marginBottom: 8, position: "relative" }}>{service.name}</h4>
                        {service.description && (
                          <p className="novi-sans" style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, fontWeight: 300, marginBottom: 20, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", position: "relative" }}>
                            {service.description}
                          </p>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, position: "relative" }}>
                          {service.monthly_fee != null && service.monthly_fee !== "" && (
                            <span className="novi-sans" style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
                              {formatCoursePrice(service.monthly_fee)}<span style={{ fontWeight: 300, fontSize: 11 }}>/mo</span>
                            </span>
                          )}
                          <span className="novi-sans" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", background: BRAND.limeVibrant, color: BRAND.dark, borderRadius: 100, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            Apply <ChevronRight style={{ width: 12, height: 12 }} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </NoviOfferingsPortal>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding: "100px 32px", background: "#f5f3ef" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <span className="pill-tag" style={{ marginBottom: 20, display: "inline-flex" }}>Society Members</span>
            <h2 className="novi-serif" style={{ fontSize: "clamp(30px, 4vw, 50px)", fontWeight: 400, fontStyle: "italic", color: BRAND.dark }}>
              Loved by providers &amp; patients alike.
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {MEMBERS.map(({ initial, name, role, quote }, idx) => (
              <div key={name} className="card-lift" style={{
                background: idx === 1 ? BRAND.dark : "white",
                borderRadius: 20,
                padding: "36px 32px",
                boxShadow: "0 4px 24px rgba(30,37,53,0.06)",
              }}>
                <div style={{ display: "flex", gap: 1, marginBottom: 20 }}>
                  {[1,2,3,4,5].map(i => <Star key={i} style={{ width: 12, height: 12, fill: "#C8E63C", color: "#C8E63C" }} />)}
                </div>
                <p className="novi-sans" style={{ fontSize: 14, color: idx === 1 ? "rgba(255,255,255,0.65)" : "rgba(30,37,53,0.6)", lineHeight: 1.7, marginBottom: 24, fontStyle: "italic", fontWeight: 300 }}>
                  "{quote}"
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: BRAND.periwinkleDeep, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span className="novi-serif" style={{ fontSize: 16, color: "white", fontStyle: "italic" }}>{initial}</span>
                  </div>
                  <div>
                    <p className="novi-sans" style={{ fontSize: 13, fontWeight: 600, color: idx === 1 ? "white" : BRAND.dark }}>{name}</p>
                    <p className="novi-sans" style={{ fontSize: 11, color: idx === 1 ? "rgba(255,255,255,0.35)" : "rgba(30,37,53,0.4)", marginTop: 2 }}>{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FULL CTA ── */}
      <section style={{ background: BRAND.coral, padding: "100px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-30%", left: "-10%", width: "50%", height: "160%", borderRadius: "50%", background: "rgba(255,255,255,0.07)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-5%", width: "40%", height: "120%", borderRadius: "50%", background: "rgba(0,0,0,0.08)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <p className="novi-sans" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 20 }}>✦ Novi Society · 2026</p>
          <h2 className="novi-serif" style={{ fontSize: "clamp(44px, 7vw, 88px)", color: "white", fontWeight: 400, lineHeight: 1.0, marginBottom: 24, fontStyle: "italic" }}>
            A new way<br />to be seen.
          </h2>
          <p className="novi-sans" style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", marginBottom: 44, fontWeight: 300, maxWidth: 440, margin: "0 auto 44px", lineHeight: 1.7 }}>
            The aesthetic medicine industry has never seen anything like this. You're early. That's the point.
          </p>
          <div className="cta-buttons" style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link to={PROVIDER_JOIN_PATH} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 36px", background: "white", color: BRAND.dark, fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 100, textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}>
              Join as Provider <ArrowRight style={{ width: 14, height: 14 }} />
            </Link>
            <Link to={PATIENT_JOIN_PATH} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 36px", background: "transparent", color: "white", fontWeight: 600, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 100, border: "1.5px solid rgba(255,255,255,0.4)", textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}>
              Find a Provider
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: BRAND.dark, borderTop: "none", padding: "44px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <Link to={createPageUrl("LandingPage")} style={{ display: "flex", alignItems: "center", textDecoration: "none" }} aria-label="NOVI Society home">
            <img src={NOVI_LOGO_SRC} alt="" width={200} height={58} style={{ height: 44, width: "auto", display: "block" }} />
          </Link>
          <p className="novi-sans" style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", letterSpacing: "0.04em" }}>© 2026 Novi. All rights reserved.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 28 }}>
            {LEGAL_FOOTER_LINKS.map(({ shortLabel, page }) => (
              <Link key={page} to={createPageUrl(page)} className="novi-sans" style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase" }}>{shortLabel}</Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}