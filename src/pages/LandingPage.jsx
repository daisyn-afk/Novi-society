import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowRight, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Brand palette from the Novi moodboard
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

const PILLARS = [
  { number: "01", label: "Certify", desc: "Train with Novi's industry-exclusive courses and earn credentials that actually move the needle." },
  { number: "02", label: "Comply", desc: "Medical director oversight, license tracking, and compliance — handled intelligently." },
  { number: "03", label: "Connect", desc: "Join a society of elite aesthetic providers. Be discovered by patients who expect the best." },
  { number: "04", label: "Command", desc: "Run your practice from one obsessively crafted dashboard — bookings, records, reviews." },
];

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

        .novi-logo-text {
          font-family: 'DM Serif Display', serif;
          font-style: italic;
          font-weight: 400;
          color: #C8E63C;
          letter-spacing: -0.02em;
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

        @media (max-width: 768px) {
          .grid-2 { grid-template-columns: 1fr; }
          .hide-mobile { display: none !important; }
          .hero-flex { flex-direction: column !important; }
          .stats-row { flex-wrap: wrap !important; gap: 24px !important; }
          .cta-buttons { flex-direction: column !important; align-items: stretch !important; }
          .pillars-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .pillars-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(245,243,239,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(30,37,53,0.07)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", height: 62, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span className="novi-serif" style={{ fontSize: 28, color: BRAND.dark, letterSpacing: "-0.01em" }}>
              novi
            </span>
            <span className="novi-sans" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: BRAND.teal, paddingBottom: 2 }}>Society</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                if (isAuthenticated) {
                  base44.auth.logout(`${window.location.origin}/`);
                } else {
                  window.location.href = createPageUrl("Onboarding");
                }
              }}
              className="btn-outline"
              style={{ padding: "8px 22px", fontSize: 12 }}
            >
              {isAuthenticated ? "Sign Out" : "Sign In"}
            </button>
            <Link to={createPageUrl("Onboarding")} className="btn-dark" style={{ padding: "8px 22px", fontSize: 12 }}>Get Started</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ paddingTop: 62, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

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

          {/* Big logo mark */}
          <h1 className="novi-serif" style={{ fontSize: "clamp(72px, 15vw, 160px)", lineHeight: 1, fontStyle: "italic", color: "#C8E63C", margin: 0, position: "relative", zIndex: 2, textShadow: "0 4px 40px rgba(200,230,60,0.25)" }}>
            novi
          </h1>

          {/* Society vertical label — top right, like moodboard */}
          <div style={{ position: "absolute", top: 32, right: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, zIndex: 3 }}>
            {"SOCIETY".split("").map((c, i) => (
              <span key={i} className="novi-sans" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.6)" }}>{c}</span>
            ))}
          </div>
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
              <Link to={createPageUrl("Onboarding")} className="btn-dark">
                Join the Society <ArrowRight style={{ width: 14, height: 14 }} />
              </Link>
              <Link to={createPageUrl("Onboarding")} className="btn-outline">
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
            <div key={label} style={{ flex: 1, paddingRight: 32, borderRight: i < 3 ? "1px solid rgba(30,37,53,0.1)" : "none", paddingLeft: i > 0 ? 32 : 0 }}>
              <p className="novi-serif" style={{ fontSize: 44, color: BRAND.dark, fontWeight: 400, lineHeight: 1, fontStyle: "italic" }}>{n}</p>
              <p className="novi-sans" style={{ fontSize: 11, color: "rgba(30,37,53,0.4)", textTransform: "uppercase", letterSpacing: "0.14em", marginTop: 8, fontWeight: 600 }}>{label}</p>
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
            <Link to={createPageUrl("Onboarding")} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", background: "#C8E63C", color: BRAND.dark, fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 100, textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}>
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
            <Link to={createPageUrl("Onboarding")} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", background: BRAND.dark, color: "white", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 100, textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}>
              Find a Provider <ArrowRight style={{ width: 13, height: 13 }} />
            </Link>
          </div>
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
            <Link to={createPageUrl("Onboarding")} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 36px", background: "white", color: BRAND.dark, fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 100, textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}>
              Join as Provider <ArrowRight style={{ width: 14, height: 14 }} />
            </Link>
            <Link to={createPageUrl("Onboarding")} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 36px", background: "transparent", color: "white", fontWeight: 600, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 100, border: "1.5px solid rgba(255,255,255,0.4)", textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}>
              Find a Provider
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: BRAND.dark, borderTop: "none", padding: "44px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span className="novi-serif" style={{ fontSize: 22, color: "white", fontStyle: "italic" }}>novi</span>
            <span className="novi-sans" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(200,230,60,0.55)" }}>Society</span>
          </div>
          <p className="novi-sans" style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", letterSpacing: "0.04em" }}>© 2026 Novi. All rights reserved.</p>
          <div style={{ display: "flex", gap: 28 }}>
            {["Privacy", "Terms", "Contact"].map(l => (
              <a key={l} href="#" className="novi-sans" style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase" }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}