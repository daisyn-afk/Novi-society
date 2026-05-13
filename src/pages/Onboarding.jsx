import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Stethoscope, Users, ArrowRight, CheckCircle2, BookOpen, Shield } from "lucide-react";
import { getDashboardPathForRole } from "@/lib/routeAccessPolicy";
import {
  GOAL_NEED_MD_COVERAGE,
  GOAL_NEED_TRAINING,
  clearSkipExploreFlag,
  writeProviderSignupGoal,
  writeSkipExploreFlag,
} from "@/lib/providerSignupIntent";

const BRAND = {
  dark: "#1e2535",
  periwinkle: "#7B8EC8",
  lime: "#C8E63C",
  coral: "#DA6A63",
  teal: "#2D6B7F",
  cream: "#f5f3ef",
};

export default function Onboarding() {
  const [searchParams] = useSearchParams();
  const fromProviderHome = searchParams.get("from") === "provider";

  const [selected, setSelected] = useState(null);
  const [providerPath, setProviderPath] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  useEffect(() => {
    if (!me?.role) return;
    if (fromProviderHome) {
      if (me.role === "provider") {
        window.location.href = getDashboardPathForRole("provider");
        return;
      }
      if (me.role !== "patient") {
        window.location.href = getDashboardPathForRole(me.role);
        return;
      }
      return;
    }
    window.location.href = getDashboardPathForRole(me.role);
  }, [me, fromProviderHome]);

  const persistGoalAndGoBasic = (goal) => {
    writeProviderSignupGoal(goal);
    clearSkipExploreFlag();
  };

  const handleProviderPathContinue = async () => {
    if (!providerPath) return;
    setSaving(true);
    persistGoalAndGoBasic(providerPath);
    try {
      await base44.auth.updateMe({ role: "provider" });
      window.location.href = createPageUrl("ProviderBasicOnboarding");
    } catch {
      window.location.href = `/signup?intent=provider`;
    } finally {
      setSaving(false);
    }
  };

  const handleSkipExplore = async () => {
    setSaving(true);
    writeSkipExploreFlag();
    try {
      if (me?.id) {
        try {
          await base44.auth.updateMe({ role: "provider" });
        } catch {
          /* fall through to login */
        }
        clearSkipExploreFlag();
        window.location.href = createPageUrl("ProviderDashboard");
        return;
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
    const next = encodeURIComponent(createPageUrl("ProviderDashboard"));
    window.location.href = `/login?next=${next}`;
  };

  const handleRoleContinue = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await base44.auth.updateMe({ role: selected });
    } catch (error) {
      const nextPage = selected === "provider" ? "ProviderBasicOnboarding" : "PatientOnboarding";
      window.location.href = `/login?next=${encodeURIComponent(createPageUrl(nextPage))}`;
      return;
    } finally {
      setSaving(false);
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

  const roleOptions = [
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

  const providerPathOptions = [
    {
      id: GOAL_NEED_TRAINING,
      title: "I need certification / training",
      subtitle: "I'm building my credentials and want to enroll in NOVI courses first.",
      icon: BookOpen,
      perks: ["Course catalog & reservations", "Class-day onboarding", "Pathway into the Society"],
    },
    {
      id: GOAL_NEED_MD_COVERAGE,
      title: "I already have certification — I need MD coverage",
      subtitle: "I'm licensed or certified and need medical director oversight through NOVI.",
      icon: Shield,
      perks: ["MD supervision workflows", "Compliance built in", "Practice-ready structure"],
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
        .ghost-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.03em;
          border: 1.5px solid rgba(30,37,53,0.2);
          background: transparent;
          color: rgba(30,37,53,0.65);
          cursor: pointer;
          transition: all 0.2s;
        }
        .ghost-btn:hover:not(:disabled) {
          border-color: rgba(30,37,53,0.35);
          color: ${BRAND.dark};
        }
        .ghost-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 48 }}>
        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 36, fontStyle: "italic", color: BRAND.dark, lineHeight: 1 }}>novi</span>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: BRAND.teal, paddingBottom: 2 }}>Society</span>
      </div>

      {fromProviderHome ? (
        <>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: "clamp(26px, 5vw, 40px)", fontWeight: 400, color: BRAND.dark, marginBottom: 12, lineHeight: 1.15 }}>
              Welcome{me?.full_name ? `, ${me.full_name.split(" ")[0]}` : ""} — let&apos;s find your path
            </h1>
            <p style={{ fontSize: 15, color: "rgba(30,37,53,0.5)", fontWeight: 300, lineHeight: 1.6, maxWidth: 480, margin: "0 auto" }}>
              You&apos;re joining as a <strong>provider</strong>. Tell us what you need first — you can explore the app before committing to every step.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, width: "100%", maxWidth: 720 }}>
            {providerPathOptions.map(({ id, title, subtitle, icon: Icon, perks }) => (
              <button
                key={id}
                type="button"
                onClick={() => setProviderPath(id)}
                className={`onboard-card${providerPath === id ? " selected" : ""}`}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: providerPath === id ? BRAND.periwinkle : "rgba(30,37,53,0.06)",
                    transition: "background 0.2s",
                  }}>
                    <Icon style={{ width: 20, height: 20, color: providerPath === id ? "white" : "rgba(30,37,53,0.45)" }} />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: 20, color: BRAND.dark, margin: 0, lineHeight: 1.2 }}>{title}</h3>
                    <p style={{ fontSize: 13, color: "rgba(30,37,53,0.5)", marginTop: 6, lineHeight: 1.6, fontWeight: 300 }}>{subtitle}</p>
                  </div>
                </div>
                <div style={{ height: 1, background: "rgba(30,37,53,0.07)", marginBottom: 16 }} />
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                  {perks.map((p) => (
                    <li key={p} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "rgba(30,37,53,0.6)", fontWeight: 400 }}>
                      <CheckCircle2 style={{ width: 15, height: 15, flexShrink: 0, color: providerPath === id ? BRAND.periwinkle : "rgba(30,37,53,0.2)", transition: "color 0.2s" }} />
                      {p}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <button
              type="button"
              className="continue-btn"
              disabled={!providerPath || saving}
              onClick={handleProviderPathContinue}
            >
              {saving ? "Working…" : "Continue"}
              {!saving && <ArrowRight style={{ width: 16, height: 16 }} />}
            </button>
            <button type="button" className="ghost-btn" disabled={saving} onClick={handleSkipExplore}>
              Skip for now — explore the app
            </button>
          </div>

          <p style={{ marginTop: 28, fontSize: 12, color: "rgba(30,37,53,0.35)", textAlign: "center", maxWidth: 420 }}>
            You&apos;ll still need your profile and license on file <strong>before you purchase a course</strong>. If you skip, your account shows as{" "}
            <strong>onboarding pending</strong> until that&apos;s done.
          </p>
          <p style={{ marginTop: 12, fontSize: 12, color: "rgba(30,37,53,0.3)" }}>
            Looking for patient access instead?{" "}
            <Link to={createPageUrl("Onboarding")} style={{ color: BRAND.teal, fontWeight: 600 }}>
              Switch to patient signup
            </Link>
          </p>
        </>
      ) : (
        <>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 400, color: BRAND.dark, marginBottom: 12, lineHeight: 1.15 }}>
              Welcome{me?.full_name ? `, ${me.full_name.split(" ")[0]}` : ""}!
            </h1>
            <p style={{ fontSize: 15, color: "rgba(30,37,53,0.5)", fontWeight: 300, lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
              Tell us how you&apos;ll be using Novi so we can personalize your experience.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, width: "100%", maxWidth: 700 }}>
            {roleOptions.map(({ id, title, subtitle, icon: Icon, perks }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelected(id)}
                className={`onboard-card${selected === id ? " selected" : ""}`}
              >
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
                <div style={{ height: 1, background: "rgba(30,37,53,0.07)", marginBottom: 16 }} />
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                  {perks.map((p) => (
                    <li key={p} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "rgba(30,37,53,0.6)", fontWeight: 400 }}>
                      <CheckCircle2 style={{ width: 15, height: 15, flexShrink: 0, color: selected === id ? BRAND.periwinkle : "rgba(30,37,53,0.2)", transition: "color 0.2s" }} />
                      {p}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 40 }}>
            <button type="button" className="continue-btn" disabled={!selected || saving} onClick={handleRoleContinue}>
              {saving ? "Setting up..." : "Continue"}
              {!saving && <ArrowRight style={{ width: 16, height: 16 }} />}
            </button>
          </div>

          <p style={{ marginTop: 28, fontSize: 12, color: "rgba(30,37,53,0.3)", letterSpacing: "0.04em" }}>
            You can change this anytime from your profile.
          </p>
        </>
      )}
    </div>
  );
}
