import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

const ROLE_OPTIONS = [
  { value: "provider", label: "Provider" },
  { value: "patient", label: "Patient" },
  { value: "medical_director", label: "Medical Director" }
];

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
    role: "provider"
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const getPostSignupPath = (role) => {
    if (role === "provider") return createPageUrl("ProviderBasicOnboarding");
    if (role === "patient") return createPageUrl("PatientOnboarding");
    return createPageUrl("NoviLanding");
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
      navigate(getPostSignupPath(form.role), { replace: true });
    } catch (e) {
      setFormError(e?.message || "Unable to create account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#f5f3ef", fontFamily: "'DM Sans', sans-serif" }}>
      <div className="w-full max-w-lg rounded-3xl overflow-hidden" style={{ background: "#fff", boxShadow: "0 14px 40px rgba(30,37,53,0.12)", border: "1px solid rgba(30,37,53,0.08)" }}>
        <div style={{ background: "linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%)", padding: "28px 24px", textAlign: "center" }}>
          <h1 style={{ margin: 0, color: "#fff", fontSize: 26, fontWeight: 700 }}>Create Account</h1>
          <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.88)", fontSize: 14 }}>Join NOVI Society and get started</p>
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
            {submitting ? "Creating account..." : "Create account"}
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
