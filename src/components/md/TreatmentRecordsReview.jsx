import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, Flag, MessageSquare, AlertTriangle, ChevronDown, ChevronUp, Image, ShieldCheck } from "lucide-react";
import GFEStatusBadge from "@/components/GFEStatusBadge";
import { format } from "date-fns";

const STATUS_STYLE = {
  draft: { bg: "bg-slate-100", text: "text-slate-500", label: "Draft" },
  submitted: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending Review" },
  approved: { bg: "bg-green-100", text: "text-green-700", label: "Approved" },
  flagged: { bg: "bg-red-100", text: "text-red-600", label: "Flagged" },
  changes_requested: { bg: "bg-orange-100", text: "text-orange-700", label: "Changes Requested" },
};

export default function TreatmentRecordsReview() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(null);
  const [reviewDialog, setReviewDialog] = useState({ open: false, record: null, action: null });
  const [reviewNote, setReviewNote] = useState("");

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["md-treatment-records"],
    queryFn: async () => {
      const me = await base44.auth.me();
      // Get providers under this MD
      const rels = await base44.entities.MedicalDirectorRelationship.filter({ medical_director_id: me.id, status: "active" });
      const providerIds = rels.map(r => r.provider_id);
      if (!providerIds.length) return [];
      const all = await base44.entities.TreatmentRecord.list("-created_date", 200);
      return all.filter(r => providerIds.includes(r.provider_id));
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, status, notes, record }) => {
      const me = await base44.auth.me();
      await base44.entities.TreatmentRecord.update(id, {
        status,
        md_review_notes: notes,
        md_reviewed_by: me.full_name || me.email,
        md_reviewed_at: new Date().toISOString(),
      });
      // Notify the provider
      const msgMap = {
        approved: `Your treatment record for ${record.service} (${record.patient_name}) has been approved by your MD.`,
        flagged: `Your treatment record for ${record.service} (${record.patient_name}) has been flagged by your MD. Notes: ${notes}`,
        changes_requested: `Your MD has requested changes to your treatment record for ${record.service} (${record.patient_name}). Notes: ${notes}`,
      };
      await base44.entities.Notification.create({
        user_id: record.provider_id,
        user_email: record.provider_email,
        type: "general",
        message: msgMap[status] || `Your treatment record status has been updated to: ${status}`,
        link_page: "ProviderPractice",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(["md-treatment-records"]);
      setReviewDialog({ open: false, record: null, action: null });
      setReviewNote("");
    },
  });

  const pendingCount = records.filter(r => r.status === "submitted").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold" style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>Treatment Records</h3>
          <p className="text-xs mt-0.5" style={{ color: "#9a8f7e" }}>{pendingCount} pending your review</p>
        </div>
      </div>

      {/* Filter tabs */}
      {["submitted", "all"].map(f => null)}

      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <Card key={i} className="h-16 animate-pulse" style={{ background: "rgba(198,190,168,0.2)" }} />)}</div>
      ) : records.length === 0 ? (
        <div className="text-center py-10" style={{ color: "#9a8f7e" }}>
          <p className="text-sm">No treatment records from your providers yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map(r => {
            const ss = STATUS_STYLE[r.status] || STATUS_STYLE.draft;
            const isOpen = expanded === r.id;
            return (
              <Card key={r.id} style={{
                border: r.status === "submitted" ? "1.5px solid rgba(250,111,48,0.35)" : "1px solid rgba(198,190,168,0.4)"
              }}>
                <CardContent className="pt-3 pb-3">
                  <button className="w-full flex items-center gap-3 text-left" onClick={() => setExpanded(isOpen ? null : r.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: "#243257" }}>{r.service}</span>
                        <Badge className={`text-xs border-0 ${ss.bg} ${ss.text}`}>{ss.label}</Badge>
                        {r.adverse_reaction && (
                          <Badge className="text-xs border-0 bg-red-100 text-red-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />Adverse Reaction
                          </Badge>
                        )}
                        <GFEStatusBadge status={r.gfe_status} examUrl={r.gfe_exam_url} />
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "#6B7DB3" }}>
                        {r.provider_name} → {r.patient_name} · {r.treatment_date ? format(new Date(r.treatment_date), "MMM d, yyyy") : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {r.status === "submitted" && (
                        <>
                          <Button size="sm" style={{ background: "#FA6F30", color: "#fff" }}
                            onClick={e => { e.stopPropagation(); setReviewDialog({ open: true, record: r, action: "approve" }); }}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-orange-600 border-orange-200"
                            onClick={e => { e.stopPropagation(); setReviewDialog({ open: true, record: r, action: "flag" }); }}>
                            <Flag className="w-3.5 h-3.5 mr-1" />Flag
                          </Button>
                        </>
                      )}
                      {isOpen ? <ChevronUp className="w-4 h-4" style={{ color: "#C6BEA8" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "#C6BEA8" }} />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-3 pt-3 space-y-4" style={{ borderTop: "1px solid rgba(198,190,168,0.3)" }}>
                      {r.areas_treated?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#DA6A63" }}>Areas Treated</p>
                          <div className="flex flex-wrap gap-1.5">
                            {r.areas_treated.map(a => (
                              <span key={a} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(107,125,179,0.12)", color: "#6B7DB3" }}>{a}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid sm:grid-cols-2 gap-4">
                        {r.units_used && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#DA6A63" }}>Units</p>
                            <p className="text-sm" style={{ color: "#243257" }}>{r.units_used} {r.units_label || "units"}</p>
                          </div>
                        )}
                        {r.products_used?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#DA6A63" }}>Products</p>
                            {r.products_used.map((p, i) => (
                              <p key={i} className="text-sm" style={{ color: "#243257" }}>{p.product_name} {p.batch_lot && `· Lot: ${p.batch_lot}`} {p.amount && `· ${p.amount}`}</p>
                            ))}
                          </div>
                        )}
                      </div>

                      {r.clinical_notes && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#DA6A63" }}>Clinical Notes</p>
                          <p className="text-sm leading-relaxed" style={{ color: "#243257" }}>{r.clinical_notes}</p>
                        </div>
                      )}

                      {r.adverse_reaction && r.adverse_reaction_notes && (
                        <div className="px-3 py-2 rounded-xl" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                          <p className="text-xs font-semibold flex items-center gap-1 mb-1 text-red-600"><AlertTriangle className="w-3 h-3" />Adverse Reaction</p>
                          <p className="text-sm text-red-700">{r.adverse_reaction_notes}</p>
                        </div>
                      )}

                      {(r.before_photo_urls?.length > 0 || r.after_photo_urls?.length > 0) && (
                        <div className="grid grid-cols-2 gap-4">
                          {["before", "after"].map(type => {
                            const photos = type === "before" ? r.before_photo_urls : r.after_photo_urls;
                            if (!photos?.length) return null;
                            return (
                              <div key={type}>
                                <p className="text-xs font-semibold uppercase tracking-widest mb-2 capitalize" style={{ color: "#DA6A63" }}>{type} Photos</p>
                                <div className="flex flex-wrap gap-2">
                                  {photos.map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                      <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg hover:opacity-80 transition-opacity" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* GFE Section */}
                      {r.gfe_status && r.gfe_status !== "not_required" && (
                        <div className="px-3 py-3 rounded-xl space-y-2" style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)" }}>
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" style={{ color: "#16a34a" }} />
                            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#16a34a" }}>Good Faith Exam (Qualiphy)</p>
                          </div>
                          <div className="flex flex-wrap gap-3 text-sm">
                            <GFEStatusBadge status={r.gfe_status} examUrl={r.gfe_exam_url} size="md" />
                            {r.gfe_provider_name && <span style={{ color: "#6B7DB3" }}>by {r.gfe_provider_name}</span>}
                            {r.gfe_exam_url && (
                              <a href={r.gfe_exam_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline" style={{ color: "#4a5fa0" }}>View GFE Document</a>
                            )}
                          </div>
                          {r.gfe_questions_answers?.length > 0 && (
                            <details className="mt-1">
                              <summary className="text-xs cursor-pointer font-medium" style={{ color: "#6B7DB3" }}>View Q&amp;A ({r.gfe_questions_answers.length} questions)</summary>
                              <div className="mt-2 space-y-1">
                                {r.gfe_questions_answers.map((qa, i) => (
                                  <div key={i} className="text-xs px-2 py-1.5 rounded-lg" style={{ background: "rgba(107,125,179,0.07)" }}>
                                    <p className="font-semibold" style={{ color: "#243257" }}>{qa.question}</p>
                                    <p style={{ color: "#6B7DB3" }}>{Array.isArray(qa.answer) ? qa.answer.join(", ") : qa.answer}</p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      )}

                      {r.md_review_notes && (
                        <div className="px-3 py-2 rounded-xl" style={{ background: "rgba(107,125,179,0.08)" }}>
                          <p className="text-xs font-semibold mb-1" style={{ color: "#6B7DB3" }}>MD Review Notes</p>
                          <p className="text-sm" style={{ color: "#243257" }}>{r.md_review_notes}</p>
                          {r.md_reviewed_at && <p className="text-xs mt-1" style={{ color: "#9a8f7e" }}>{format(new Date(r.md_reviewed_at), "MMM d, yyyy 'at' h:mm a")}</p>}
                        </div>
                      )}

                      {r.status === "submitted" && (
                        <div className="flex gap-2">
                          <Button size="sm" style={{ background: "#FA6F30", color: "#fff" }}
                            onClick={() => setReviewDialog({ open: true, record: r, action: "approve" })}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-orange-600 border-orange-200"
                            onClick={() => setReviewDialog({ open: true, record: r, action: "flag" })}>
                            <Flag className="w-3.5 h-3.5 mr-1" />Flag
                          </Button>
                          <Button size="sm" variant="outline" className="text-blue-600 border-blue-200"
                            onClick={() => setReviewDialog({ open: true, record: r, action: "changes_requested" })}>
                            <MessageSquare className="w-3.5 h-3.5 mr-1" />Request Changes
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialog.open} onOpenChange={v => setReviewDialog(d => ({ ...d, open: v }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>
              {reviewDialog.action === "approve" ? "Approve Treatment Record" : reviewDialog.action === "flag" ? "Flag Treatment Record" : "Request Changes"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm" style={{ color: "#6B7DB3" }}>{reviewDialog.record?.service} — {reviewDialog.record?.provider_name}</p>
            <Textarea
              placeholder={reviewDialog.action === "approve" ? "Optional approval notes..." : "Describe what needs attention or changes..."}
              rows={4}
              value={reviewNote}
              onChange={e => setReviewNote(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReviewDialog({ open: false, record: null, action: null })}>Cancel</Button>
              <Button
                style={reviewDialog.action === "approve"
                  ? { background: "#FA6F30", color: "#fff" }
                  : { background: reviewDialog.action === "flag" ? "#dc2626" : "#ea580c", color: "#fff" }}
                onClick={() => review.mutate({
                  id: reviewDialog.record?.id,
                  status: reviewDialog.action === "approve" ? "approved" : reviewDialog.action === "flag" ? "flagged" : "changes_requested",
                  notes: reviewNote,
                  record: reviewDialog.record,
                })}
                disabled={review.isPending || (reviewDialog.action !== "approve" && !reviewNote)}
              >
                {reviewDialog.action === "approve" ? "Confirm Approval" : reviewDialog.action === "flag" ? "Submit Flag" : "Send Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}