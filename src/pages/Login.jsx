import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { getDashboardPathForRole } from "@/lib/routeAccessPolicy";
import { useAuth } from "@/lib/AuthContext";

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

  useEffect(() => {
    const redirectAuthenticatedUser = async () => {
      try {
        const hasSession = typeof base44.auth?.hasSession === "function"
          ? base44.auth.hasSession()
          : true;
        if (!hasSession) return;
        const currentUser = await base44.auth.me();
        const next = getNextPath();
        navigate(next || getDashboardPathForRole(currentUser?.role), { replace: true });
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
      const currentUser = await base44.auth.me();
      setAuthenticatedSession(currentUser);
      const next = getNextPath();
      navigate(next || getDashboardPathForRole(currentUser?.role), { replace: true });
    } catch (e) {
      setFormError(e?.message || "Unable to login. Please check your credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#f5f3ef", fontFamily: "'DM Sans', sans-serif" }}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: "#fff", boxShadow: "0 14px 40px rgba(30,37,53,0.12)", border: "1px solid rgba(30,37,53,0.08)" }}>
        <div style={{ background: "linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%)", padding: "28px 24px", textAlign: "center" }}>
          <h1 style={{ margin: 0, color: "#fff", fontSize: 26, fontWeight: 700 }}>Welcome Back</h1>
          <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.88)", fontSize: 14 }}>Login to continue with NOVI Society</p>
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

          <p style={{ margin: "16px 0 0", fontSize: 14, color: "#64748b", textAlign: "center" }}>
            Don&apos;t have an account?{" "}
            <Link to="/signup" style={{ color: "#2D6B7F", fontWeight: 700, textDecoration: "none" }}>Sign up</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
