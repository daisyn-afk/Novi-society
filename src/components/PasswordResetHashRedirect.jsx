import { useLayoutEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { parseAuthHash, storePasswordResetError } from "@/lib/passwordResetHash";
import { bootstrapPasswordResetFromHash } from "@/lib/bootstrapPasswordResetHash";

/**
 * Fallback if hash appears after client navigation (primary redirect runs in index.html + main.jsx).
 */
export default function PasswordResetHashRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useLayoutEffect(() => {
    if (bootstrapPasswordResetFromHash()) return;

    const hash = window.location.hash || "";
    if (!hash || hash === "#") return;

    const parsed = parseAuthHash(hash);
    if (!parsed) return;

    if (parsed.kind === "error") {
      storePasswordResetError({
        message: parsed.message,
        errorCode: parsed.errorCode
      });
      window.history.replaceState(null, "", `${location.pathname}${location.search}`);
      navigate("/set-password", { replace: true });
      return;
    }

    if (parsed.kind === "recovery") {
      base44.auth.consumeRecoveryHash(hash);
      window.history.replaceState(null, "", `${location.pathname}${location.search}`);
      navigate("/set-password", { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  return null;
}
