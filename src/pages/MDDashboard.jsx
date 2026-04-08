import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Users, ShieldCheck, AlertTriangle, ChevronRight, Clock, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

export default function MDDashboard() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const { data: relationships = [] } = useQuery({
    queryKey: ["md-relationships"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.MedicalDirectorRelationship.filter({ medical_director_id: user.id });
    },
  });

  const { data: complianceLogs = [] } = useQuery({
    queryKey: ["compliance-logs"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.ComplianceLog.filter({ medical_director_id: user.id }, "-created_date");
    },
  });

  const activeRelationships = relationships.filter(r => r.status === "active");
  const pendingRelationships = relationships.filter(r => r.status === "pending");
  const pendingActions = complianceLogs.filter(l => l.action_required && !l.resolved_at);

  const glassCard = {
    background: "rgba(255,255,255,0.65)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.85)",
    borderRadius: 20,
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(218,106,99,0.9)" }}>Medical Director</p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: "#1e2535", lineHeight: 1.1, fontStyle: "italic" }}>
          Welcome, Dr. {me?.full_name?.split(" ").slice(-1)[0] || "Doctor"}
        </h1>
        <p style={{ color: "rgba(30,37,53,0.6)", fontSize: 13, marginTop: 4 }}>Supervision overview and compliance status</p>
      </div>

      {/* Pending approvals alert */}
      {pendingRelationships.length > 0 && (
        <Link to={createPageUrl("MDProviderRelationships")}>
          <div className="flex items-center gap-3 px-5 py-4 rounded-2xl cursor-pointer hover:opacity-90 transition-opacity" style={{ background: "rgba(250,111,48,0.2)", border: "1px solid rgba(250,111,48,0.4)" }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: "#FA6F30" }} />
            <div className="flex-1">
              <p className="font-semibold text-white text-sm">{pendingRelationships.length} provider{pendingRelationships.length > 1 ? "s" : ""} awaiting your approval</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Review and approve supervision requests</p>
            </div>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(255,255,255,0.5)" }} />
          </div>
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Active Providers", value: activeRelationships.length, icon: Users, color: "#7B8EC8" },
          { label: "Pending Approvals", value: pendingRelationships.length, icon: Clock, color: "#FA6F30" },
          { label: "Compliance Actions", value: pendingActions.length, icon: AlertTriangle, color: "#DA6A63" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="px-5 py-5 text-center" style={glassCard}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(30,37,53,0.06)" }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 36, color: "#1e2535", lineHeight: 1, fontWeight: 400 }}>{value}</p>
            <p style={{ fontSize: 11, color: "rgba(30,37,53,0.55)", fontWeight: 500, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* My Providers */}
        <div style={glassCard} className="overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(30,37,53,0.08)" }}>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: "#7B8EC8" }} />
              <span className="font-semibold text-sm" style={{ color: "#1e2535" }}>My Providers</span>
            </div>
            <Link to={createPageUrl("MDProviderRelationships")} className="text-xs font-semibold hover:opacity-70 transition-opacity flex items-center gap-1" style={{ color: "#C8E63C" }}>
              Manage <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-5">
            {relationships.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "rgba(30,37,53,0.4)" }}>No providers yet</p>
            ) : (
              <div className="space-y-2">
                {relationships.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: "rgba(30,37,53,0.04)" }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#1e2535" }}>{r.provider_name || r.provider_email}</p>
                      <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>{r.provider_email}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      r.status === "active" ? "bg-green-100 text-green-700" :
                      r.status === "pending" ? "bg-orange-100 text-orange-600" :
                      "bg-slate-100 text-slate-600"
                    }`}>{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Compliance Logs */}
        <div style={glassCard} className="overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(30,37,53,0.08)" }}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" style={{ color: "#C8E63C" }} />
              <span className="font-semibold text-sm" style={{ color: "#1e2535" }}>Compliance Logs</span>
            </div>
            <Link to={createPageUrl("MDCompliance")} className="text-xs font-semibold hover:opacity-70 transition-opacity flex items-center gap-1" style={{ color: "#C8E63C" }}>
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-5">
            {complianceLogs.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "rgba(30,37,53,0.4)" }}>No logs yet</p>
            ) : (
              <div className="space-y-2">
                {complianceLogs.slice(0, 4).map(l => (
                  <div key={l.id} className="flex items-start justify-between px-3 py-2.5 rounded-xl gap-3" style={{ background: "rgba(30,37,53,0.04)" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "#1e2535" }}>{l.summary}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{l.created_date ? format(new Date(l.created_date), "MMM d") : ""}</p>
                    </div>
                    {l.action_required && !l.resolved_at && (
                      <span className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: "rgba(250,111,48,0.2)", color: "#FA6F30" }}>Action</span>
                    )}
                    {l.resolved_at && (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-400" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}