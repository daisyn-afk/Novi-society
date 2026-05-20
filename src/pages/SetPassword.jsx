import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getDashboardPathForRole } from "@/lib/routeAccessPolicy";
import {
  clearPasswordResetError,
  consumePasswordResetError,
  parseAuthHash,
  parseAuthSearchQuery
} from "@/lib/passwordResetHash";

function getRecoveryFromStorage() {
  const fromHash = parseAuthHash(window.location.hash);
  if (fromHash?.kind === "recovery") {
    return {
      accessToken: fromHash.accessToken,
      refreshToken: fromHash.refreshToken
    };
  }
  const storedHash = base44.auth.getStoredRecoveryHash();
  const fromStored = parseAuthHash(storedHash);
  if (fromStored?.kind === "recovery") {
    return {
      accessToken: fromStored.accessToken,
      refreshToken: fromStored.refreshToken
    };
  }
  return null;
}

export default function SetPassword() {
  const navigate = useNavigate();
  const { setAuthenticatedSession } = useAuth();
  const [form, setForm] = useState({ password: "", confirm_password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  const recovery = useMemo(() => getRecoveryFromStorage(), []);

  useEffect(() => {
    const fromQuery = parseAuthSearchQuery();
    if (fromQuery?.kind === "error") {
      setLinkError(fromQuery.message);
      window.history.replaceState(null, "", window.location.pathname);
      setReady(true);
      return;
    }

    const hash = window.location.hash || "";
    const fromHash = parseAuthHash(hash);

    if (fromHash?.kind === "recovery") {
      base44.auth.consumeRecoveryHash(hash);
      window.history.replaceState(null, "", window.location.pathname);
      setLinkError("");
      setReady(true);
      return;
    }

    if (fromHash?.kind === "error") {
      window.history.replaceState(null, "", window.location.pathname);
      if (recovery?.accessToken) {
        setLinkError("");
        setReady(true);
        return;
      }
      setLinkError(fromHash.message);
      setReady(true);
      return;
    }

    const storedErr = consumePasswordResetError();
    if (storedErr?.message) {
      if (recovery?.accessToken) {
        setLinkError("");
        setReady(true);
        return;
      }
      setLinkError(storedErr.message);
      setReady(true);
      return;
    }

    if (recovery?.accessToken) {
      setLinkError("");
      setReady(true);
      return;
    }

    setLinkError(
      "This password reset link is missing, expired, or was already used. Please contact support@novisociety.com for a new link."
    );
    setReady(true);
  }, [recovery]);

  useEffect(() => {
    if (!recovery?.accessToken || linkError) return;
    base44.auth.storeSession({
      access_token: recovery.accessToken,
      refresh_token: recovery.refreshToken
    });
  }, [recovery, linkError]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (linkError) return;

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
      setLinkError(
        "This password reset link is missing, expired, or was already used. Please contact support@novisociety.com for a new link."
      );
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
      clearPasswordResetError();
      const currentUser = await base44.auth.me();
      setAuthenticatedSession(currentUser);
      navigate(getDashboardPathForRole(currentUser?.role), { replace: true });
    } catch (error) {
      const status = error?.status;
      const message = error?.message || "";
      if (status === 410 || /already created your password|already been used|expired|invalid/i.test(message)) {
        setLinkError(
          message ||
            "This password reset link has expired or was already used. Please contact support@novisociety.com for a new link."
        );
      } else {
        setFormError(message || "Unable to set password. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const showForm = ready && !linkError && recovery?.accessToken;

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f5f3ef" }}>
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: "rgba(30,37,53,0.1)", borderTopColor: "#C8E63C" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#f5f3ef", fontFamily: "'DM Sans', sans-serif" }}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: "#fff", boxShadow: "0 14px 40px rgba(30,37,53,0.12)", border: "1px solid rgba(30,37,53,0.08)" }}>
        <div style={{ background: "linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%)", padding: "28px 24px", textAlign: "center" }}>
          <h1 style={{ margin: 0, color: "#fff", fontSize: 26, fontWeight: 700 }}>
            {linkError ? "Link not valid" : "Set Your Password"}
          </h1>
          <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.88)", fontSize: 14 }}>
            {linkError
              ? "Your reset link cannot be used"
              : "Create your password, then sign in with your email to access the provider dashboard"}
          </p>
        </div>

        <div style={{ padding: 24 }}>
          {linkError ? (
            <div>
              <p style={{ margin: "0 0 20px", color: "#dc2626", fontSize: 14, lineHeight: 1.6 }}>{linkError}</p>
              <button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                style={{
                  width: "100%",
                  height: 46,
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg,#2D6B7F,#7B8EC8)",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Go to login
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "#475569", fontWeight: 600 }}>New Password</label>
              <input
                type="password"
                value={form.password}
                disabled={!showForm || submitting}
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
                disabled={!showForm || submitting}
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
                disabled={!showForm || submitting}
                style={{
                  width: "100%",
                  height: 46,
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg,#2D6B7F,#7B8EC8)",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: !showForm || submitting ? "not-allowed" : "pointer",
                  opacity: !showForm || submitting ? 0.7 : 1
                }}
              >
                {submitting ? "Saving..." : "Set Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
