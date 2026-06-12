import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { format, differenceInMonths } from "date-fns";
import { groupRelationshipsByProvider } from "@/lib/mdRelationships";

export default function MDProviderRelationships() {
  const [expanded, setExpanded] = useState(null);
  const qc = useQueryClient();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const { data: relationships = [] } = useQuery({
    queryKey: ["md-provider-relationships"],
    queryFn: async () => {
      if (!me) return [];
      return base44.entities.MedicalDirectorRelationship.filter({ medical_director_id: me.id });
    },
    enabled: !!me,
  });

  const suspendMutation = useMutation({
    mutationFn: (id) => base44.entities.MedicalDirectorRelationship.update(id, { status: "suspended" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["md-provider-relationships"] }),
  });

  const terminateMutation = useMutation({
    mutationFn: (id) =>
      base44.entities.MedicalDirectorRelationship.update(id, {
        status: "terminated",
        end_date: format(new Date(), "yyyy-MM-dd"),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["md-provider-relationships"] }),
  });

  const active = groupRelationshipsByProvider(relationships, { status: "active" });
  const other = groupRelationshipsByProvider(relationships.filter((r) => r.status !== "active"));

  const glassCard = {
    background: "rgba(255,255,255,0.65)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.85)",
    borderRadius: 20,
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(218,106,99,0.9)" }}>
          Medical Director
        </p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", lineHeight: 1.1 }}>
          Provider Supervision
        </h1>
        <p style={{ color: "rgba(30,37,53,0.6)", fontSize: 13, marginTop: 4 }}>
          Providers assigned by NOVI are active immediately — manage supervision below
        </p>
      </div>

      <div style={glassCard} className="overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(30,37,53,0.08)" }}>
          <Users className="w-4 h-4" style={{ color: "#7B8EC8" }} />
          <span className="font-bold text-sm" style={{ color: "#1e2535" }}>
            Active Supervision
          </span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full ml-1"
            style={{ background: "rgba(200,230,60,0.2)", color: "#C8E63C", border: "1px solid rgba(200,230,60,0.3)" }}
          >
            {active.length}
          </span>
        </div>
        <div className="p-4">
          {active.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: "rgba(30,37,53,0.4)" }}>
              No active providers yet. New assignments appear here automatically when NOVI links a provider to you.
            </p>
          ) : (
            <div className="space-y-2">
              {active.map((rel) => {
                const months = rel.start_date ? differenceInMonths(new Date(), new Date(rel.start_date)) : 0;
                const rowKey = rel.provider_id || rel.id;
                const isExpanded = expanded === rowKey;
                const serviceLabel = rel.serviceCount > 1
                  ? `${rel.serviceCount} services supervised`
                  : "1 service supervised";
                return (
                  <div
                    key={rowKey}
                    className="rounded-xl overflow-hidden"
                    style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.08)" }}
                  >
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 transition-colors"
                      onClick={() => setExpanded(isExpanded ? null : rowKey)}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(200,230,60,0.15)" }}
                      >
                        <CheckCircle2 className="w-5 h-5" style={{ color: "#C8E63C" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>
                          {rel.provider_name || rel.provider_email}
                        </p>
                        <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
                          {months} months · {serviceLabel} · {rel.provider_email}
                        </p>
                      </div>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full mr-2"
                        style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10" }}
                      >
                        Active
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.4)" }} />
                      ) : (
                        <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.4)" }} />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "rgba(30,37,53,0.08)" }}>
                        <div className="grid grid-cols-2 gap-3 pt-3 text-sm">
                          <div>
                            <p
                              style={{
                                color: "rgba(30,37,53,0.45)",
                                fontSize: 11,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                            >
                              Started
                            </p>
                            <p className="font-semibold mt-0.5" style={{ color: "#1e2535" }}>
                              {rel.start_date ? format(new Date(rel.start_date), "MMM d, yyyy") : "N/A"}
                            </p>
                          </div>
                          <div>
                            <p
                              style={{
                                color: "rgba(30,37,53,0.45)",
                                fontSize: 11,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                            >
                              Duration
                            </p>
                            <p className="font-semibold mt-0.5" style={{ color: "#1e2535" }}>
                              {months} months
                            </p>
                          </div>
                        </div>
                        {rel.serviceCount > 1 && (
                          <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>
                            This provider has {rel.serviceCount} active MD coverage services under your supervision.
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rel.relationships.forEach((r) => suspendMutation.mutate(r.id))}
                          >
                            Suspend
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => {
                              if (window.confirm("Terminate supervision for this provider?")) {
                                rel.relationships.forEach((r) => terminateMutation.mutate(r.id));
                              }
                            }}
                          >
                            Terminate
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {other.length > 0 && (
        <div style={glassCard} className="overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(30,37,53,0.08)" }}>
            <span className="font-bold text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
              Past Relationships
            </span>
          </div>
          <div className="p-4 space-y-2">
            {other.map((rel) => (
              <div
                key={rel.provider_id || rel.id}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                style={{ background: "rgba(30,37,53,0.04)" }}
              >
                <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
                  {rel.provider_name || rel.provider_email}
                </p>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                  style={{ background: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.5)" }}
                >
                  {rel.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
