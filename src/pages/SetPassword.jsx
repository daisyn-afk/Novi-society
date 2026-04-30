import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getDashboardPathForRole } from "@/lib/routeAccessPolicy";

function parseRecoveryHash(rawHash) {
  const hash = String(rawHash || "").startsWith("#")
    ? String(rawHash || "").slice(1)
    : String(rawHash || "");
  const params = new URLSearchParams(hash);
  const type = String(params.get("type") || "").toLowerCase();
  const isPasswordSetupFlow = type === "recovery" || type === "invite";
  if (!isPasswordSetupFlow) return null;
  const accessToken = params.get("access_token") || "";
  const refreshToken = params.get("refresh_token") || "";
  if (!accessToken) return null;
  return { accessToken, refreshToken };
}

export default function SetPassword() {
  const navigate = useNavigate();
  const { setAuthenticatedSession } = useAuth();
  const [form, setForm] = useState({ password: "", confirm_password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const recovery = useMemo(() => {
    const fromCurrentHash = parseRecoveryHash(window.location.hash);
    if (fromCurrentHash) return fromCurrentHash;
    const storedHash = base44.auth.getStoredRecoveryHash();
    return parseRecoveryHash(storedHash);
  }, []);

  useEffect(() => {
    if (!recovery?.accessToken) return;
    base44.auth.storeSession({
      access_token: recovery.accessToken,
      refresh_token: recovery.refreshToken
    });
  }, [recovery]);

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.password) {
      nextErrors.password = "Password is required.";
    } else if (form.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }
    if (!form.confirm_password) {
      nextErrors.confirm_password = "Confirm Password is required.";
    } else if (form.password !== form.confirm_password) {
      nextErrors.confirm_password = "Passwords do not match.";
    }
    setFieldErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) return;

    if (!recovery?.accessToken) {
      setFormError("Recovery link is missing or expired. Please request a new link.");
      return;
    }

    setSubmitting(true);
    try {
      await base44.auth.setPassword({
        access_token: recovery.accessToken,
        refresh_token: recovery.refreshToken,
        password: form.password,
        confirm_password: form.confirm_password
      });
      base44.auth.clearStoredRecoveryHash();
      const currentUser = await base44.auth.me();
      setAuthenticatedSession(currentUser);
      navigate(getDashboardPathForRole(currentUser?.role), { replace: true });
    } catch (error) {
      setFormError(error?.message || "Unable to set password. Please request a new link.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#f5f3ef", fontFamily: "'DM Sans', sans-serif" }}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: "#fff", boxShadow: "0 14px 40px rgba(30,37,53,0.12)", border: "1px solid rgba(30,37,53,0.08)" }}>
        <div style={{ background: "linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%)", padding: "28px 24px", textAlign: "center" }}>
          <h1 style={{ margin: 0, color: "#fff", fontSize: 26, fontWeight: 700 }}>Set Your Password</h1>
          <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.88)", fontSize: 14 }}>Create your password to access your NOVI provider account</p>
        </div>

        <form onSubmit={onSubmit} noValidate style={{ padding: 24 }}>
          <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "#475569", fontWeight: 600 }}>New Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, password: e.target.value }));
              setFieldErrors((prev) => ({ ...prev, password: "" }));
            }}
            style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid rgba(15,23,42,0.14)", padding: "0 12px", marginBottom: 12, outline: "none" }}
            placeholder="Minimum 8 characters"
          />
          {fieldErrors.password ? (
            <p style={{ margin: "-8px 0 12px", color: "#dc2626", fontSize: 12 }}>{fieldErrors.password}</p>
          ) : null}

          <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "#475569", fontWeight: 600 }}>Confirm Password</label>
          <input
            type="password"
            value={form.confirm_password}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, confirm_password: e.target.value }));
              setFieldErrors((prev) => ({ ...prev, confirm_password: "" }));
            }}
            style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid rgba(15,23,42,0.14)", padding: "0 12px", marginBottom: 12, outline: "none" }}
            placeholder="Re-enter password"
          />
          {fieldErrors.confirm_password ? (
            <p style={{ margin: "-8px 0 12px", color: "#dc2626", fontSize: 12 }}>{fieldErrors.confirm_password}</p>
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
            {submitting ? "Saving..." : "Set Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
