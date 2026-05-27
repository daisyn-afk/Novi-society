import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { readSkipExploreFlag, clearSkipExploreFlag } from "@/lib/providerSignupIntent";
import { getPostAuthRedirectPath } from "@/lib/providerOnboardingState";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuthenticatedSession } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const getNextPath = () => {
    const params = new URLSearchParams(location.search);
    const next = String(params.get("next") || "").trim();
    if (next.startsWith("/")) return next;
    return null;
  };

  const signupHref = (() => {
    const next = getNextPath();
    const params = new URLSearchParams();
    if (next) {
      params.set("next", next);
      if (next.includes("ProviderDashboard")) params.set("intent", "provider");
    }
    const qs = params.toString();
    return qs ? `/signup?${qs}` : "/signup";
  })();

  useEffect(() => {
    const redirectAuthenticatedUser = async () => {
      try {
        const hasSession = typeof base44.auth?.hasSession === "function"
          ? base44.auth.hasSession()
          : true;
        if (!hasSession) return;
        const currentUser = await base44.auth.me();
        const next = getNextPath();
        const redirectPath = await getPostAuthRedirectPath({ user: currentUser, nextPath: next });
        navigate(redirectPath, { replace: true });
      } catch {
        // No active user session; stay on login page.
      }
    };
    redirectAuthenticatedUser();
  }, [navigate, location.search]);

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }
    if (!form.password) nextErrors.password = "Password is required.";
    setFieldErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    try {
      await base44.auth.login({
        email: form.email,
        password: form.password
      });
      let currentUser = await base44.auth.me();
      if (readSkipExploreFlag()) {
        try {
          await base44.auth.updateMe({ role: "provider" });
          currentUser = await base44.auth.me();
        } catch {
          /* ignore */
        }
        clearSkipExploreFlag();
      }
      setAuthenticatedSession(currentUser);
      const next = getNextPath();
      const redirectPath = await getPostAuthRedirectPath({ user: currentUser, nextPath: next });
      navigate(redirectPath, { replace: true });
    } catch (e) {
      setFormError(e?.message || "Unable to login. Please check your credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "linear-gradient(135deg,#2D6B7F 0%,#4a8fa8 38%,#7B8EC8 68%,#DA6A63 100%)", fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", top: "-20%", left: "-8%", width: "55%", height: "130%", borderRadius: "60% 40% 70% 30%/50% 60% 40% 50%", background: "rgba(218,106,99,0.35)", filter: "blur(50px)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "-10%", right: "-5%", width: "45%", height: "110%", borderRadius: "40% 60% 30% 70%/60% 40% 60% 40%", background: "rgba(200,230,60,0.2)", filter: "blur(55px)", pointerEvents: "none", zIndex: 0 }} />
      <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 24px 64px rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.65)", position: "relative", zIndex: 1 }}>
        <div style={{ background: "linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%)", padding: "32px 24px 24px", textAlign: "center" }}>
          <img
            src="/novi-logo-neon-green.png"
            alt="NOVI Society"
            style={{ height: 52, width: "auto", display: "block", margin: "0 auto 14px", filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.25))" }}
          />
          <p style={{ margin: 0, color: "rgba(255,255,255,0.82)", fontSize: 13, letterSpacing: "0.04em" }}>Welcome back — sign in to continue</p>
        </div>

        <form onSubmit={onSubmit} noValidate style={{ padding: 24 }}>
          <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "#475569", fontWeight: 600 }}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, email: e.target.value }));
              setFieldErrors((prev) => ({ ...prev, email: "" }));
            }}
            style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid rgba(15,23,42,0.14)", padding: "0 12px", marginBottom: 16, outline: "none" }}
            placeholder="you@example.com"
          />
          {fieldErrors.email ? (
            <p style={{ margin: "-10px 0 12px", color: "#dc2626", fontSize: 12 }}>{fieldErrors.email}</p>
          ) : null}

          <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "#475569", fontWeight: 600 }}>Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, password: e.target.value }));
              setFieldErrors((prev) => ({ ...prev, password: "" }));
            }}
            style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid rgba(15,23,42,0.14)", padding: "0 12px", marginBottom: 12, outline: "none" }}
            placeholder="••••••••"
          />
          {fieldErrors.password ? (
            <p style={{ margin: "-8px 0 12px", color: "#dc2626", fontSize: 12 }}>{fieldErrors.password}</p>
          ) : null}

          {formError ? (
            <p style={{ margin: "4px 0 12px", color: "#dc2626", fontSize: 13 }}>{formError}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              height: 46,
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg,#2D6B7F,#7B8EC8)",
              color: "#fff",
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1
            }}
          >
            {submitting ? "Logging in..." : "Login"}
          </button>

          <p style={{ margin: "18px 0 0", fontSize: 14, color: "#64748b", textAlign: "center" }}>
            Don&apos;t have an account?{" "}
            <Link to={signupHref} style={{ color: "#2D6B7F", fontWeight: 700, textDecoration: "none" }}>
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
