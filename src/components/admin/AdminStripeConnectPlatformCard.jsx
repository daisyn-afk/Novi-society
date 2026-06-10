import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, ExternalLink, Loader2, CheckCircle, AlertTriangle, Unlink } from "lucide-react";
import {
  disconnectPlatformLegacyConnect,
  fetchPlatformLegacyConnectStatus,
  fetchPlatformLegacyOAuthUrl,
  refreshPlatformLegacyConnectStatus,
  setPlatformLegacyFeeTransferEnabled,
} from "@/lib/stripeConnectPlatformApi";

export default function AdminStripeConnectPlatformCard() {
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ["stripe-connect-platform-status"],
    queryFn: () => fetchPlatformLegacyConnectStatus(),
    staleTime: 30_000,
  });

  if (!isLoading && !status?.connect_enabled) {
    return null;
  }

  const connected = Boolean(status?.legacy_connected);
  const feeTransferActive = Boolean(status?.fee_transfer_active);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const { url } = await fetchPlatformLegacyOAuthUrl();
      if (!url) throw new Error("No OAuth URL returned.");
      window.location.href = url;
    } catch (e) {
      setError(String(e?.message || "Could not start Stripe OAuth."));
      setConnecting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refreshPlatformLegacyConnectStatus();
      qc.invalidateQueries({ queryKey: ["stripe-connect-platform-status"] });
    } catch (e) {
      setError(String(e?.message || "Could not refresh status."));
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect the legacy Stripe account from this Connect platform?")) return;
    setError(null);
    try {
      await disconnectPlatformLegacyConnect();
      qc.invalidateQueries({ queryKey: ["stripe-connect-platform-status"] });
    } catch (e) {
      setError(String(e?.message || "Could not disconnect."));
    }
  };

  const handleToggleFeeTransfer = async (enabled) => {
    setError(null);
    try {
      await setPlatformLegacyFeeTransferEnabled(enabled);
      qc.invalidateQueries({ queryKey: ["stripe-connect-platform-status"] });
    } catch (e) {
      setError(String(e?.message || "Could not update fee transfer setting."));
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{
      background: "rgba(255,255,255,0.22)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      border: "1px solid rgba(255,255,255,0.35)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
    }}>
      <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(30,37,53,0.1)" }}>
        <div className="flex items-center gap-2.5">
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(99,91,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CreditCard style={{ width: 13, height: 13, color: "#635bff" }} />
          </div>
          <span className="font-semibold text-sm" style={{ color: "#1e2535" }}>Stripe Connect — Legacy fee account</span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {isLoading ? (
          <p className="text-sm flex items-center gap-2" style={{ color: "rgba(30,37,53,0.55)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </p>
        ) : !status?.oauth_configured ? (
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.55)" }}>
            Set <code className="text-xs">STRIPE_CONNECT_CLIENT_ID</code> and Connect keys to enable legacy account OAuth.
          </p>
        ) : connected ? (
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#16a34a" }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Legacy account connected</p>
              <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>
                {status.legacy_account_id_masked}
                {status.legacy_account_email ? ` · ${status.legacy_account_email}` : ""}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: feeTransferActive ? "rgba(200,230,60,0.25)" : "rgba(250,111,48,0.12)", color: feeTransferActive ? "#4a6b10" : "#c2410c" }}>
                  Fee transfer {feeTransferActive ? "active" : "inactive"}
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: "rgba(123,142,200,0.15)", color: "#5b6b9a" }}>
                  GFE fee ${Number(status.gfe_platform_fee_usd ?? 29).toFixed(0)} flat
                </span>
              </div>
              {!status.fee_transfer_env_enabled && (
                <p className="text-xs mt-2" style={{ color: "#b45309" }}>
                  Set <code className="text-[10px]">STRIPE_CONNECT_LEGACY_FEE_TRANSFER_ENABLED=true</code> to send GFE fees to legacy after payment.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: "#d97706" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Connect legacy Stripe account</p>
              <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>
                OAuth-connect your legacy Stripe account as a Standard connected account. Application fees from marketplace payments can be transferred there after each successful payment.
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-xs font-medium" style={{ color: "#b91c1c" }}>{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          {!connected && status?.oauth_configured && (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "#635bff" }}
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              {connecting ? "Opening Stripe…" : "Connect legacy Stripe"}
            </button>
          )}
          {connected && (
            <>
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: "#1e2535" }}>
                <input
                  type="checkbox"
                  checked={Boolean(status?.fee_transfer_db_enabled)}
                  onChange={(e) => handleToggleFeeTransfer(e.target.checked)}
                />
                Transfer application fees to legacy account
              </label>
              <button
                type="button"
                onClick={handleDisconnect}
                className="inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: "#b91c1c" }}
              >
                <Unlink className="w-3.5 h-3.5" /> Disconnect
              </button>
            </>
          )}
          {status?.oauth_configured && (
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
    </div>
  );
}
