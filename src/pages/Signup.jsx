import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { readSkipExploreFlag, clearSkipExploreFlag } from "@/lib/providerSignupIntent";

const ROLE_OPTIONS = [
  { value: "provider", label: "Provider" },
  { value: "patient", label: "Patient" },
  { value: "medical_director", label: "Medical Director" }
];

function readSafeNextParam(searchParams) {
  const raw = String(searchParams.get("next") || "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { setAuthenticatedSession } = useAuth();
  const intentProvider = searchParams.get("intent") === "provider";

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
    role: "provider"
  });

  useEffect(() => {
    if (intentProvider) {
      setForm((prev) => ({ ...prev, role: "provider" }));
    }
  }, [intentProvider]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const getPostSignupPath = (role) => {
    if (role === "provider") return createPageUrl("ProviderBasicOnboarding");
    if (role === "patient") return createPageUrl("PatientOnboarding");
    return createPageUrl("LandingPage");
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.first_name.trim()) nextErrors.first_name = "First Name is required.";
    if (!form.last_name.trim()) nextErrors.last_name = "Last Name is required.";
    if (!form.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }
    if (!form.password) {
      nextErrors.password = "Password is required.";
    } else if (form.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }
    if (!form.confirm_password) nextErrors.confirm_password = "Confirm Password is required.";
    if (form.password && form.confirm_password && form.password !== form.confirm_password) {
      nextErrors.confirm_password = "Password and Confirm Password must be the same.";
    }
    setFieldErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) return;
    if (form.password !== form.confirm_password) {
      setFieldErrors((prev) => ({
        ...prev,
        confirm_password: "Password and Confirm Password must be the same."
      }));
      return;
    }
    setSubmitting(true);
    try {
      await base44.auth.signup(form);
      const createdUser = await base44.auth.me();
      if (!createdUser?.id) {
        throw new Error("Account was not created. Please try again.");
      }
      setAuthenticatedSession(createdUser);
      qc.invalidateQueries({ queryKey: ["me"] });
      const safeNext = readSafeNextParam(searchParams);
      if (readSkipExploreFlag()) {
        clearSkipExploreFlag();
        navigate(createPageUrl("ProviderDashboard"), { replace: true });
        return;
      }
      if (safeNext) {
        navigate(safeNext, { replace: true });
        return;
      }
      navigate(getPostSignupPath(form.role), { replace: true });
    } catch (e) {
      setFormError(e?.message || "Unable to create account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "linear-gradient(135deg,#2D6B7F 0%,#4a8fa8 38%,#7B8EC8 68%,#DA6A63 100%)", fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", top: "-20%", left: "-8%", width: "55%", height: "130%", borderRadius: "60% 40% 70% 30%/50% 60% 40% 50%", background: "rgba(218,106,99,0.35)", filter: "blur(50px)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "-10%", right: "-5%", width: "45%", height: "110%", borderRadius: "40% 60% 30% 70%/60% 40% 60% 40%", background: "rgba(200,230,60,0.2)", filter: "blur(55px)", pointerEvents: "none", zIndex: 0 }} />
      <div className="w-full max-w-lg rounded-3xl overflow-hidden" style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 24px 64px rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.65)", position: "relative", zIndex: 1 }}>
        <div style={{ background: "linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%)", padding: "32px 24px 24px", textAlign: "center" }}>
          <img
            src="/novi-logo-neon-green.png"
            alt="NOVI Society"
            style={{ height: 52, width: "auto", display: "block", margin: "0 auto 14px", filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.25))" }}
          />
          <p style={{ margin: 0, color: "rgba(255,255,255,0.82)", fontSize: 13, letterSpacing: "0.04em" }}>Create your account and get started</p>
        </div>

        <form onSubmit={onSubmit} noValidate style={{ padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "#475569", fontWeight: 600 }}>First Name</label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, first_name: e.target.value }));
                  setFieldErrors((prev) => ({ ...prev, first_name: "" }));
                }}
                style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid rgba(15,23,42,0.14)", padding: "0 12px", outline: "none" }}
                placeholder="First name"
              />
              {fieldErrors.first_name ? (
                <p style={{ margin: "6px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.first_name}</p>
              ) : null}
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "#475569", fontWeight: 600 }}>Last Name</label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, last_name: e.target.value }));
                  setFieldErrors((prev) => ({ ...prev, last_name: "" }));
                }}
                style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid rgba(15,23,42,0.14)", padding: "0 12px", outline: "none" }}
                placeholder="Last name"
              />
              {fieldErrors.last_name ? (
                <p style={{ margin: "6px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.last_name}</p>
              ) : null}
            </div>
          </div>

          <label style={{ display: "block", marginTop: 14, marginBottom: 8, fontSize: 13, color: "#475569", fontWeight: 600 }}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, email: e.target.value }));
              setFieldErrors((prev) => ({ ...prev, email: "" }));
            }}
            style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid rgba(15,23,42,0.14)", padding: "0 12px", outline: "none" }}
            placeholder="you@example.com"
          />
          {fieldErrors.email ? (
            <p style={{ margin: "6px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.email}</p>
          ) : null}

          <label style={{ display: "block", marginTop: 14, marginBottom: 8, fontSize: 13, color: "#475569", fontWeight: 600 }}>Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, password: e.target.value }));
              setFieldErrors((prev) => ({ ...prev, password: "" }));
            }}
            style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid rgba(15,23,42,0.14)", padding: "0 12px", outline: "none" }}
            placeholder="Minimum 8 characters"
          />
          {fieldErrors.password ? (
            <p style={{ margin: "6px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.password}</p>
          ) : null}

          <label style={{ display: "block", marginTop: 14, marginBottom: 8, fontSize: 13, color: "#475569", fontWeight: 600 }}>Confirm Password</label>
          <input
            type="password"
            value={form.confirm_password}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, confirm_password: e.target.value }));
              setFieldErrors((prev) => ({ ...prev, confirm_password: "" }));
            }}
            style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid rgba(15,23,42,0.14)", padding: "0 12px", outline: "none" }}
            placeholder="Re-enter password"
          />
          {fieldErrors.confirm_password ? (
            <p style={{ margin: "6px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.confirm_password}</p>
          ) : null}

          {!intentProvider && (
            <>
              <label style={{ display: "block", marginTop: 14, marginBottom: 8, fontSize: 13, color: "#475569", fontWeight: 600 }}>Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid rgba(15,23,42,0.14)", padding: "0 12px", outline: "none", background: "#fff" }}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </>
          )}
          {intentProvider && (
            <p style={{ marginTop: 14, fontSize: 13, color: "#475569" }}>
              You&apos;re creating a <strong>provider</strong> account. After signup you can explore the app; complete your profile and license before purchasing a course.
            </p>
          )}

          {formError ? (
            <p style={{ margin: "10px 0 0", color: "#dc2626", fontSize: 13 }}>{formError}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              height: 46,
              borderRadius: 12,
              border: "none",
              marginTop: 16,
              background: "linear-gradient(135deg,#2D6B7F,#7B8EC8)",
              color: "#fff",
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1
            }}
          >
            {submitting ? "Creating account..." : "Create Free Preview Account"}
          </button>

          <p style={{ margin: "16px 0 0", fontSize: 14, color: "#64748b", textAlign: "center" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "#2D6B7F", fontWeight: 700, textDecoration: "none" }}>Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
