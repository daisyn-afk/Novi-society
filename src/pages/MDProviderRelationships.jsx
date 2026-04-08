import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Users, CheckCircle2, Clock, AlertTriangle, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { format, differenceInMonths } from "date-fns";

export default function MDProviderRelationships() {
  const [approvalDialog, setApprovalDialog] = useState(null);
  const [notes, setNotes] = useState("");
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

  const approveMutation = useMutation({
    mutationFn: ({ id, supervisionNotes }) =>
      base44.entities.MedicalDirectorRelationship.update(id, {
        status: "active",
        start_date: format(new Date(), "yyyy-MM-dd"),
        supervision_notes: supervisionNotes,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["md-provider-relationships"] }); setApprovalDialog(null); setNotes(""); },
  });

  const declineMutation = useMutation({
    mutationFn: (id) => base44.entities.MedicalDirectorRelationship.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["md-provider-relationships"] }),
  });

  const suspendMutation = useMutation({
    mutationFn: (id) => base44.entities.MedicalDirectorRelationship.update(id, { status: "suspended" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["md-provider-relationships"] }),
  });

  const terminateMutation = useMutation({
    mutationFn: (id) => base44.entities.MedicalDirectorRelationship.update(id, { status: "terminated", end_date: format(new Date(), "yyyy-MM-dd") }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["md-provider-relationships"] }),
  });

  const pending = relationships.filter(r => r.status === "pending");
  const active = relationships.filter(r => r.status === "active");
  const other = relationships.filter(r => r.status !== "pending" && r.status !== "active");

  const glassCard = {
    background: "rgba(255,255,255,0.65)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.85)",
    borderRadius: 20,
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(218,106,99,0.9)" }}>Medical Director</p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", lineHeight: 1.1 }}>
          Provider Supervision
        </h1>
        <p style={{ color: "rgba(30,37,53,0.6)", fontSize: 13, marginTop: 4 }}>Approve requests and manage your supervised providers</p>
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div style={glassCard} className="overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(30,37,53,0.08)" }}>
            <AlertTriangle className="w-4 h-4" style={{ color: "#FA6F30" }} />
            <span className="font-bold text-sm" style={{ color: "#1e2535" }}>Pending Approval</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full ml-1" style={{ background: "#FA6F30", color: "#fff" }}>{pending.length}</span>
          </div>
          <div className="p-4 space-y-3">
            {pending.map(rel => (
              <div key={rel.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(250,111,48,0.2)" }}>
                <div>
                  <p className="font-semibold" style={{ color: "#1e2535" }}>{rel.provider_name || rel.provider_email}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{rel.provider_email}</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.4)" }}>Requested {rel.created_date ? format(new Date(rel.created_date), "MMM d, yyyy") : ""}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="font-semibold" style={{ background: "#C8E63C", color: "#1a2540" }} onClick={() => setApprovalDialog(rel)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-300 hover:text-red-200" onClick={() => declineMutation.mutate(rel.id)}>
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active relationships */}
      <div style={glassCard} className="overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(30,37,53,0.08)" }}>
         <Users className="w-4 h-4" style={{ color: "#7B8EC8" }} />
          <span className="font-bold text-sm" style={{ color: "#1e2535" }}>Active Supervision</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full ml-1" style={{ background: "rgba(200,230,60,0.2)", color: "#C8E63C", border: "1px solid rgba(200,230,60,0.3)" }}>{active.length}</span>
        </div>
        <div className="p-4">
          {active.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: "rgba(30,37,53,0.4)" }}>No active providers yet</p>
          ) : (
            <div className="space-y-2">
              {active.map(rel => {
                const months = rel.start_date ? differenceInMonths(new Date(), new Date(rel.start_date)) : 0;
                const isExpanded = expanded === rel.id;
                return (
                  <div key={rel.id} className="rounded-xl overflow-hidden" style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.08)" }}>
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 transition-colors" onClick={() => setExpanded(isExpanded ? null : rel.id)}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.15)" }}>
                        <CheckCircle2 className="w-5 h-5" style={{ color: "#C8E63C" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{rel.provider_name || rel.provider_email}</p>
                        <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>{months} months supervised · {rel.provider_email}</p>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full mr-2" style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10" }}>Active</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.4)" }} /> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.4)" }} />}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "rgba(30,37,53,0.08)" }}>
                        <div className="grid grid-cols-2 gap-3 pt-3 text-sm">
                          <div>
                            <p style={{ color: "rgba(30,37,53,0.45)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Started</p>
                            <p className="font-semibold mt-0.5" style={{ color: "#1e2535" }}>{rel.start_date ? format(new Date(rel.start_date), "MMM d, yyyy") : "N/A"}</p>
                          </div>
                          <div>
                            <p style={{ color: "rgba(30,37,53,0.45)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Duration</p>
                            <p className="font-semibold mt-0.5" style={{ color: "#1e2535" }}>{months} months</p>
                          </div>
                        </div>
                        {rel.supervision_notes && (
                          <div className="rounded-lg px-3 py-2" style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.08)" }}>
                            <p className="text-xs font-semibold mb-1" style={{ color: "rgba(30,37,53,0.45)" }}>Notes</p>
                            <p className="text-sm" style={{ color: "rgba(30,37,53,0.75)" }}>{rel.supervision_notes}</p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => suspendMutation.mutate(rel.id)}>
                            Suspend
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => { if (window.confirm("Terminate this relationship?")) terminateMutation.mutate(rel.id); }}>
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

      {/* Terminated / suspended */}
      {other.length > 0 && (
        <div style={glassCard} className="overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(30,37,53,0.08)" }}>
            <span className="font-bold text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>Past Relationships</span>
          </div>
          <div className="p-4 space-y-2">
            {other.map(rel => (
              <div key={rel.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{ background: "rgba(30,37,53,0.04)" }}>
                <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>{rel.provider_name || rel.provider_email}</p>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ background: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.5)" }}>{rel.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval Dialog */}
      <Dialog open={!!approvalDialog} onOpenChange={() => { setApprovalDialog(null); setNotes(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve Provider Supervision</DialogTitle></DialogHeader>
          {approvalDialog && (
            <div className="space-y-4">
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                <p className="font-semibold text-slate-900">{approvalDialog.provider_name}</p>
                <p className="text-sm text-slate-500">{approvalDialog.provider_email}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Supervision Notes (optional)</label>
                <Textarea placeholder="Add supervision requirements, notes, or conditions..." value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setApprovalDialog(null); setNotes(""); }}>Cancel</Button>
            <Button style={{ background: "#C8E63C", color: "#1a2540" }} className="font-bold"
              onClick={() => approveMutation.mutate({ id: approvalDialog.id, supervisionNotes: notes })}
              disabled={approveMutation.isPending}>
              {approveMutation.isPending ? "Approving..." : "Approve Supervision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}