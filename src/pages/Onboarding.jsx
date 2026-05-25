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
      title: "Already Certified, Need MD Coverage",
      subtitle: "I'm licensed or certified and need medical director oversight through NOVI.",
      icon: Shield,
      perks: ["MD supervision workflows", "Compliance built in", "Practice-ready structure"],
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${BRAND.teal} 0%, #4a8fa8 38%, ${BRAND.periwinkle} 68%, ${BRAND.coral} 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden" }}>
      {/* Organic blobs */}
      <div style={{ position: "fixed", top: "-15%", left: "-8%", width: "55%", height: "130%", borderRadius: "60% 40% 70% 30% / 50% 60% 40% 50%", background: "rgba(218,106,99,0.35)", filter: "blur(50px)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "-10%", right: "-5%", width: "45%", height: "110%", borderRadius: "40% 60% 30% 70% / 60% 40% 60% 40%", background: "rgba(200,230,60,0.22)", filter: "blur(55px)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", top: "25%", right: "18%", width: "28%", height: "55%", borderRadius: "50%", background: "rgba(45,107,127,0.3)", filter: "blur(65px)", pointerEvents: "none", zIndex: 0 }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .onboard-card {
          background: rgba(255,255,255,0.82);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: 24px;
          padding: 32px;
          border: 1.5px solid rgba(255,255,255,0.6);
          cursor: pointer;
          transition: all 0.22s ease;
          text-align: left;
          box-shadow: 0 8px 32px rgba(30,37,53,0.12);
          display: flex;
          flex-direction: column;
        }
        .onboard-card:hover {
          background: rgba(255,255,255,0.92);
          border-color: rgba(123,142,200,0.5);
          box-shadow: 0 16px 48px rgba(30,37,53,0.16);
          transform: translateY(-3px);
        }
        .onboard-card.selected {
          background: rgba(255,255,255,0.96);
          border-color: ${BRAND.periwinkle};
          box-shadow: 0 16px 48px rgba(123,142,200,0.28);
        }
        .continue-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 40px;
          border-radius: 100px;
          font-size: 14px;
          font-weight: 700;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.04em;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .continue-btn:not(:disabled) {
          background: #C8E63C;
          color: ${BRAND.dark};
          box-shadow: 0 4px 20px rgba(200,230,60,0.4);
        }
        .continue-btn:not(:disabled):hover {
          background: #d4ef4a;
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(200,230,60,0.5);
        }
        .continue-btn:disabled {
          background: rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.4);
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
          border: 1.5px solid rgba(255,255,255,0.4);
          background: rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.8);
          cursor: pointer;
          transition: all 0.2s;
        }
        .ghost-btn:hover:not(:disabled) {
          border-color: rgba(255,255,255,0.7);
          background: rgba(255,255,255,0.2);
          color: white;
        }
        .ghost-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>

      <div style={{ marginBottom: 40, position: "relative", zIndex: 1 }}>
        <div style={{ background: BRAND.dark, padding: "10px 20px", borderRadius: 14, display: "inline-flex", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
          <img src="/novi-logo-neon-green.png" alt="NOVI Society" style={{ height: 36, width: "auto", display: "block" }} />
        </div>
      </div>

      {fromProviderHome ? (
        <>
          <div style={{ textAlign: "center", marginBottom: 40, position: "relative", zIndex: 1 }}>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: "clamp(26px, 5vw, 40px)", fontWeight: 400, color: "white", marginBottom: 12, lineHeight: 1.15, textShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
              Welcome{me?.full_name ? `, ${me.full_name.split(" ")[0]}` : ""} — let&apos;s find your path
            </h1>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.72)", fontWeight: 300, lineHeight: 1.6, maxWidth: 480, margin: "0 auto" }}>
              You&apos;re joining as a <strong style={{ color: "#C8E63C" }}>provider</strong>. Tell us what you need first — you can explore the app before committing to every step.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, width: "100%", maxWidth: 720, position: "relative", zIndex: 1, alignItems: "stretch" }}>
            {providerPathOptions.map(({ id, title, subtitle, icon: Icon, perks }, idx) => {
              const iconGradients = ["linear-gradient(135deg,#2D6B7F,#7B8EC8)", "linear-gradient(135deg,#DA6A63,#c8527a)"];
              const iconColors = [BRAND.teal, BRAND.coral];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setProviderPath(id)}
                  className={`onboard-card${providerPath === id ? " selected" : ""}`}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: providerPath === id ? iconGradients[idx % 2] : `linear-gradient(135deg, ${iconColors[idx % 2]}22, ${iconColors[idx % 2]}44)`,
                      transition: "all 0.2s",
                      boxShadow: providerPath === id ? `0 4px 16px ${iconColors[idx % 2]}55` : "none",
                    }}>
                      <Icon style={{ width: 22, height: 22, color: providerPath === id ? "white" : iconColors[idx % 2] }} />
                    </div>
                    <div>
                      <h3 style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: 20, color: BRAND.dark, margin: 0, lineHeight: 1.2 }}>{title}</h3>
                      <p style={{ fontSize: 13, color: "rgba(30,37,53,0.5)", marginTop: 6, lineHeight: 1.6, fontWeight: 300 }}>{subtitle}</p>
                    </div>
                  </div>
                  <div style={{ height: 1, background: "rgba(30,37,53,0.07)", marginBottom: 16 }} />
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 0 0", marginTop: "auto", display: "flex", flexDirection: "column", gap: 9 }}>
                    {perks.map((p) => (
                      <li key={p} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "rgba(30,37,53,0.65)", fontWeight: 400 }}>
                        <CheckCircle2 style={{ width: 15, height: 15, flexShrink: 0, color: "#C8E63C", filter: "drop-shadow(0 1px 3px rgba(200,230,60,0.4))" }} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, position: "relative", zIndex: 1 }}>
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

          <p style={{ marginTop: 28, fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center", maxWidth: 420, position: "relative", zIndex: 1 }}>
            You&apos;ll still need your profile and license on file <strong style={{ color: "rgba(255,255,255,0.65)" }}>before you purchase a course</strong>. If you skip, your account shows as{" "}
            <strong style={{ color: "rgba(255,255,255,0.65)" }}>onboarding pending</strong> until that&apos;s done.
          </p>
          <p style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.4)", position: "relative", zIndex: 1 }}>
            Looking for patient access instead?{" "}
            <Link to={createPageUrl("Onboarding")} style={{ color: "#C8E63C", fontWeight: 600 }}>
              Switch to patient signup
            </Link>
          </p>
        </>
      ) : (
        <>
          <div style={{ textAlign: "center", marginBottom: 48, position: "relative", zIndex: 1 }}>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 400, color: "white", marginBottom: 12, lineHeight: 1.15, textShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
              Welcome{me?.full_name ? `, ${me.full_name.split(" ")[0]}` : ""}!
            </h1>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.72)", fontWeight: 300, lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
              Tell us how you&apos;ll be using Novi so we can personalize your experience.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, width: "100%", maxWidth: 700, position: "relative", zIndex: 1, alignItems: "stretch" }}>
            {roleOptions.map(({ id, title, subtitle, icon: Icon, perks }, idx) => {
              const iconGradients = ["linear-gradient(135deg,#2D6B7F,#7B8EC8)", "linear-gradient(135deg,#DA6A63,#e8956d)"];
              const iconColors = [BRAND.teal, BRAND.coral];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelected(id)}
                  className={`onboard-card${selected === id ? " selected" : ""}`}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: selected === id ? iconGradients[idx % 2] : `linear-gradient(135deg, ${iconColors[idx % 2]}22, ${iconColors[idx % 2]}44)`,
                      transition: "all 0.2s",
                      boxShadow: selected === id ? `0 4px 16px ${iconColors[idx % 2]}55` : "none",
                    }}>
                      <Icon style={{ width: 22, height: 22, color: selected === id ? "white" : iconColors[idx % 2] }} />
                    </div>
                    <div>
                      <h3 style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: 20, color: BRAND.dark, margin: 0, lineHeight: 1.2 }}>{title}</h3>
                      <p style={{ fontSize: 13, color: "rgba(30,37,53,0.5)", marginTop: 6, lineHeight: 1.6, fontWeight: 300 }}>{subtitle}</p>
                    </div>
                  </div>
                  <div style={{ height: 1, background: "rgba(30,37,53,0.07)", marginBottom: 16 }} />
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, marginTop: "auto", display: "flex", flexDirection: "column", gap: 9 }}>
                    {perks.map((p) => (
                      <li key={p} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "rgba(30,37,53,0.65)", fontWeight: 400 }}>
                        <CheckCircle2 style={{ width: 15, height: 15, flexShrink: 0, color: "#C8E63C", filter: "drop-shadow(0 1px 3px rgba(200,230,60,0.4))" }} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 40, position: "relative", zIndex: 1 }}>
            <button type="button" className="continue-btn" disabled={!selected || saving} onClick={handleRoleContinue}>
              {saving ? "Setting up..." : "Continue"}
              {!saving && <ArrowRight style={{ width: 16, height: 16 }} />}
            </button>
          </div>

          <p style={{ marginTop: 28, fontSize: 12, color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em", position: "relative", zIndex: 1 }}>
            You can change this anytime from your profile.
          </p>
        </>
      )}
    </div>
  );
}
