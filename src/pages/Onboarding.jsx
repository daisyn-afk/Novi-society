import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Stethoscope, Users, ArrowRight, CheckCircle2 } from "lucide-react";
import { getDashboardPathForRole } from "@/lib/routeAccessPolicy";

const BRAND = {
  dark: "#1e2535",
  periwinkle: "#7B8EC8",
  lime: "#C8E63C",
  coral: "#DA6A63",
  teal: "#2D6B7F",
  cream: "#f5f3ef",
};

export default function Onboarding() {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: me } = useQuery({ 
    queryKey: ["me"], 
    queryFn: () => base44.auth.me()
  });

  useEffect(() => {
    if (me?.role) {
      window.location.href = getDashboardPathForRole(me.role);
    }
  }, [me]);

  const handleContinue = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await base44.auth.updateMe({ role: selected });
    } catch (error) {
      const nextPage = selected === "provider" ? "ProviderBasicOnboarding" : "PatientOnboarding";
      window.location.href = `/login?next=${encodeURIComponent(createPageUrl(nextPage))}`;
      return;
    }
    if (selected === "provider") {
      window.location.href = createPageUrl("ProviderBasicOnboarding");
      return;
    }
    if (selected === "patient") {
      window.location.href = createPageUrl("PatientJourney");
      return;
    }
    window.location.href = "/";
  };

  const options = [
    {
      id: "provider",
      title: "I'm a Provider",
      subtitle: "Aesthetic nurse, NP, PA, MD, or esthetician looking to get certified and grow my practice.",
      icon: Stethoscope,
      perks: ["Access Novi certification courses", "Manage your licenses", "Book & manage patient appointments", "Join a network of verified providers"],
    },
    {
      id: "patient",
      title: "I'm a Patient",
      subtitle: "Looking for certified aesthetic providers near me.",
      icon: Users,
      perks: ["Browse verified providers", "Book appointments easily", "Leave reviews", "Find the best care near you"],
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: BRAND.cream, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .onboard-card {
          background: white;
          border-radius: 20px;
          padding: 32px;
          border: 1.5px solid rgba(30,37,53,0.08);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          box-shadow: 0 4px 20px rgba(30,37,53,0.04);
        }
        .onboard-card:hover {
          border-color: rgba(123,142,200,0.4);
          box-shadow: 0 8px 32px rgba(30,37,53,0.08);
          transform: translateY(-2px);
        }
        .onboard-card.selected {
          border-color: ${BRAND.periwinkle};
          box-shadow: 0 8px 32px rgba(123,142,200,0.18);
          background: #f8f9fe;
        }
        .continue-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 40px;
          border-radius: 100px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.04em;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .continue-btn:not(:disabled) {
          background: ${BRAND.dark};
          color: white;
        }
        .continue-btn:not(:disabled):hover {
          background: #2d3d66;
          transform: translateY(-1px);
        }
        .continue-btn:disabled {
          background: rgba(30,37,53,0.1);
          color: rgba(30,37,53,0.35);
          cursor: not-allowed;
        }
      `}</style>

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 48 }}>
        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 36, fontStyle: "italic", color: BRAND.dark, lineHeight: 1 }}>novi</span>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: BRAND.teal, paddingBottom: 2 }}>Society</span>
      </div>

      {/* Headline */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 400, color: BRAND.dark, marginBottom: 12, lineHeight: 1.15 }}>
          Welcome{me?.full_name ? `, ${me.full_name.split(" ")[0]}` : ""}!
        </h1>
        <p style={{ fontSize: 15, color: "rgba(30,37,53,0.5)", fontWeight: 300, lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
          Tell us how you'll be using Novi so we can personalize your experience.
        </p>
      </div>

      {/* Role cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, width: "100%", maxWidth: 700 }}>
        {options.map(({ id, title, subtitle, icon: Icon, perks }) => (
          <button
            key={id}
            onClick={() => setSelected(id)}
            className={`onboard-card${selected === id ? " selected" : ""}`}
          >
            {/* Icon + title */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: selected === id ? BRAND.periwinkle : "rgba(30,37,53,0.06)",
                transition: "background 0.2s",
              }}>
                <Icon style={{ width: 20, height: 20, color: selected === id ? "white" : "rgba(30,37,53,0.45)" }} />
              </div>
              <div>
                <h3 style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: 20, color: BRAND.dark, margin: 0, lineHeight: 1.2 }}>{title}</h3>
                <p style={{ fontSize: 13, color: "rgba(30,37,53,0.5)", marginTop: 6, lineHeight: 1.6, fontWeight: 300 }}>{subtitle}</p>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(30,37,53,0.07)", marginBottom: 16 }} />

            {/* Perks */}
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
              {perks.map(p => (
                <li key={p} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "rgba(30,37,53,0.6)", fontWeight: 400 }}>
                  <CheckCircle2 style={{ width: 15, height: 15, flexShrink: 0, color: selected === id ? BRAND.periwinkle : "rgba(30,37,53,0.2)", transition: "color 0.2s" }} />
                  {p}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      {/* Continue */}
      <div style={{ marginTop: 40 }}>
        <button
          className="continue-btn"
          disabled={!selected || saving}
          onClick={handleContinue}
        >
          {saving ? "Setting up..." : "Continue"}
          {!saving && <ArrowRight style={{ width: 16, height: 16 }} />}
        </button>
      </div>

      {/* Bottom caption */}
      <p style={{ marginTop: 28, fontSize: 12, color: "rgba(30,37,53,0.3)", letterSpacing: "0.04em" }}>
        You can change this anytime from your profile.
      </p>
    </div>
  );
}