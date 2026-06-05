import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, ExternalLink, Loader2, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import {
  fetchStripeConnectStatus,
  fetchStripeConnectUrl,
  refreshStripeConnectStatus,
} from "@/lib/stripeConnectApi";

const GLASS_STYLE = {
  background: "rgba(255,255,255,0.5)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.75)",
  boxShadow: "0 2px 12px rgba(30,37,53,0.06)",
};

function StatusIcon({ onboardingState }) {
  if (onboardingState === "ready") {
    return <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#16a34a" }} />;
  }
  if (onboardingState === "pending_review") {
    return <Clock className="w-5 h-5 flex-shrink-0" style={{ color: "#7B8EC8" }} />;
  }
  return <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: "#d97706" }} />;
}

export default function ProviderStripeConnectCard({ bookingDeposit, preferRefresh = false }) {
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["stripe-connect-status", preferRefresh ? "refresh" : "live"],
    queryFn: () => fetchStripeConnectStatus({ refresh: preferRefresh, live: !preferRefresh }),
    staleTime: 30_000,
  });

  const connectEnabled = Boolean(status?.enabled);
  const ready = Boolean(status?.ready_for_payments);
  const onboardingState = status?.onboarding_state || (ready ? "ready" : "not_started");
  const hasDeposit = Number(bookingDeposit) > 0;
  const requirementLabels = Array.isArray(status?.requirements_due_labels)
    ? status.requirements_due_labels.filter(Boolean)
    : [];

  const title =
    status?.status_title ||
    (ready ? "Stripe connected" : "Connect Stripe to accept online payments");

  const message =
    status?.status_message ||
    (hasDeposit
      ? "Patients cannot pay booking deposits until you finish Stripe setup."
      : "Required before patients can pay treatment balances online via Stripe.");

  const oauthConnect = Boolean(status?.oauth_configured);
  const actionLabel =
    status?.action_label ||
    (onboardingState === "not_started"
      ? oauthConnect
        ? "Connect with Stripe"
        : "Connect Stripe"
      : "Continue Stripe setup");

  if (!connectEnabled && !isLoading) {
    return null;
  }

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const { url } = await fetchStripeConnectUrl("/ProviderPractice");
      if (!url) throw new Error("No onboarding URL returned.");
      window.location.href = url;
    } catch (e) {
      setError(String(e?.message || "Could not start Stripe setup."));
      setConnecting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refreshStripeConnectStatus();
      await refetch();
      qc.invalidateQueries({ queryKey: ["stripe-connect-status"] });
    } catch (e) {
      setError(String(e?.message || "Could not refresh status."));
    } finally {
      setRefreshing(false);
    }
  };

  const showStatusPills = status?.configured && !ready && (
    <div className="flex flex-wrap gap-2 mt-2">
      {status.details_submitted != null && (
        <span
          className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
          style={{
            background: status.details_submitted ? "rgba(200,230,60,0.25)" : "rgba(250,111,48,0.12)",
            color: status.details_submitted ? "#4a6b10" : "#c2410c",
          }}
        >
          Details {status.details_submitted ? "submitted" : "incomplete"}
        </span>
      )}
      {status.charges_enabled != null && (
        <span
          className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
          style={{
            background: status.charges_enabled ? "rgba(200,230,60,0.25)" : "rgba(250,111,48,0.12)",
            color: status.charges_enabled ? "#4a6b10" : "#c2410c",
          }}
        >
          Payments {status.charges_enabled ? "enabled" : "not enabled"}
        </span>
      )}
      {status.payouts_enabled != null && (
        <span
          className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
          style={{
            background: status.payouts_enabled ? "rgba(200,230,60,0.25)" : "rgba(123,142,200,0.15)",
            color: status.payouts_enabled ? "#4a6b10" : "#5b6b9a",
          }}
        >
          Payouts {status.payouts_enabled ? "enabled" : "pending"}
        </span>
      )}
    </div>
  );

  return (
    <div className="rounded-2xl overflow-hidden" style={GLASS_STYLE}>
      <div className="px-6 py-3.5" style={{ borderBottom: "1px solid rgba(30,37,53,0.07)" }}>
        <p className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: "#635bff" }}>
          <CreditCard className="w-3.5 h-3.5" />
          Stripe payouts
        </p>
      </div>
      <div className="px-6 py-5 space-y-4">
        {isLoading ? (
          <p className="text-sm flex items-center gap-2" style={{ color: "rgba(30,37,53,0.55)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Checking Stripe…
          </p>
        ) : !status?.configured ? (
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.55)" }}>
            Stripe Connect is not configured on this environment yet.
          </p>
        ) : (
          <div className="flex items-start gap-3">
            <StatusIcon onboardingState={onboardingState} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{title}</p>
              <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>{message}</p>
              {showStatusPills}
              {onboardingState === "action_required" && requirementLabels.length > 0 && (
                <ul className="mt-3 space-y-1.5 list-disc list-inside">
                  {requirementLabels.map((label) => (
                    <li key={label} className="text-xs" style={{ color: "rgba(30,37,53,0.65)" }}>
                      {label}
                    </li>
                  ))}
                </ul>
              )}
              {status?.disabled_reason && (
                <p className="text-xs mt-2 font-medium" style={{ color: "#b45309" }}>
                  Stripe restriction: {String(status.disabled_reason).replace(/_/g, " ")}
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs font-medium" style={{ color: "#b91c1c" }}>{error}</p>
        )}

        {status?.configured && !ready && actionLabel && (
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-60"
            style={{ background: "#635bff" }}
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            {connecting ? "Opening Stripe…" : actionLabel}
          </button>
        )}

        {status?.configured && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-50"
            style={{ color: "#7B8EC8" }}
          >
            {refreshing ? "Refreshing…" : "Refresh status"}
          </button>
        )}
      </div>
    </div>
  );
}
