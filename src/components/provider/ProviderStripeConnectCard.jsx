import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, ExternalLink, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
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

export default function ProviderStripeConnectCard({ bookingDeposit }) {
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["stripe-connect-status"],
    queryFn: () => fetchStripeConnectStatus(),
    staleTime: 30_000,
  });

  const connectEnabled = Boolean(status?.enabled);
  const ready = Boolean(status?.ready_for_payments);
  const hasDeposit = Number(bookingDeposit) > 0;

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
    setError(null);
    try {
      await refreshStripeConnectStatus();
      await refetch();
      qc.invalidateQueries({ queryKey: ["stripe-connect-status"] });
    } catch (e) {
      setError(String(e?.message || "Could not refresh status."));
    }
  };

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
        ) : ready ? (
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#16a34a" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Stripe connected</p>
              <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>
                Patient deposits and treatment payments are paid out to your connected Stripe account.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: "#d97706" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Connect Stripe to accept online payments</p>
              <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>
                {hasDeposit
                  ? "Patients cannot pay booking deposits until you finish Stripe setup."
                  : "Required before patients can pay treatment balances online via Stripe."}
              </p>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs font-medium" style={{ color: "#b91c1c" }}>{error}</p>
        )}

        {status?.configured && !ready && (
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-60"
            style={{ background: "#635bff" }}
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            {connecting ? "Opening Stripe…" : "Connect Stripe"}
          </button>
        )}

        {status?.configured && (
          <button
            type="button"
            onClick={handleRefresh}
            className="text-xs font-semibold underline-offset-2 hover:underline"
            style={{ color: "#7B8EC8" }}
          >
            Refresh status
          </button>
        )}
      </div>
    </div>
  );
}
