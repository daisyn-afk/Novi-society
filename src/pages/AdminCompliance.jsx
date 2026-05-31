import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { adminApiRequest } from "@/api/adminApiRequest";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { ShieldCheck, Plus, Search, AlertTriangle, Star, Flag, CheckCircle, Trash2, Pencil, Upload, FileText, X } from "lucide-react";
import { format } from "date-fns";
import {
  COMPLIANCE_LOG_TYPES,
  COMPLIANCE_LOG_TYPE_INFO,
  EMPTY_COMPLIANCE_LOG_FORM,
  formatLogTypeLabel,
  isLogPendingAction,
  isAutomatedLog,
} from "@/lib/complianceLogs";

export default function AdminCompliance() {
  const [compSearch, setCompSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_COMPLIANCE_LOG_FORM);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [actionTaken, setActionTaken] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["compliance-logs"],
    queryFn: () => base44.entities.ComplianceLog.list("-created_date"),
  });

  const create = useMutation({
    mutationFn: () =>
      base44.entities.ComplianceLog.create({
        log_type: form.log_type,
        summary: form.summary,
        details: form.details,
        provider_email: String(form.provider_email || "").trim().toLowerCase(),
        action_required: form.action_required,
        attachments: form.attachments || [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance-logs"] });
      qc.invalidateQueries({ queryKey: ["md-compliance-logs"] });
      setOpen(false);
      setForm(EMPTY_COMPLIANCE_LOG_FORM);
      toast({ title: "Compliance log saved" });
    },
    onError: (err) => {
      toast({ title: "Save failed", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const resolve = useMutation({
    mutationFn: ({ id, action_taken }) =>
      base44.entities.ComplianceLog.update(id, {
        resolved_at: new Date().toISOString(),
        action_required: false,
        action_taken: action_taken || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance-logs"] });
      qc.invalidateQueries({ queryKey: ["md-compliance-logs"] });
      setResolveTarget(null);
      setActionTaken("");
      toast({ title: "Log marked resolved" });
    },
    onError: (err) => {
      toast({ title: "Resolve failed", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const deleteLog = useMutation({
    mutationFn: (id) => base44.entities.ComplianceLog.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance-logs"] });
      qc.invalidateQueries({ queryKey: ["md-compliance-logs"] });
      toast({ title: "Compliance log deleted" });
    },
    onError: (err) => {
      toast({ title: "Delete failed", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const updateLog = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ComplianceLog.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance-logs"] });
      qc.invalidateQueries({ queryKey: ["md-compliance-logs"] });
      setEditing(null);
      setForm(EMPTY_COMPLIANCE_LOG_FORM);
      toast({ title: "Compliance log updated" });
    },
    onError: (err) => {
      toast({ title: "Update failed", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      !compSearch ||
      l.provider_email?.toLowerCase().includes(compSearch.toLowerCase()) ||
      l.summary?.toLowerCase().includes(compSearch.toLowerCase());
    const matchesType = typeFilter === "all" || l.log_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const pendingCount = logs.filter(isLogPendingAction).length;

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["reviews"],
    queryFn: () => base44.entities.Review.list("-created_date"),
  });

  const reviewUpdate = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Review.update(id, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["marketplace-catalog"] });
      if (variables?.data?.is_verified) {
        toast({ title: "Review approved — visible in marketplace" });
      } else if (variables?.data?.is_flagged) {
        toast({ title: "Review flagged" });
      }
    },
    onError: (err) => {
      toast({ title: "Update failed", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const deleteReview = useMutation({
    mutationFn: (id) => base44.entities.Review.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["marketplace-catalog"] });
      toast({ title: "Review deleted" });
    },
    onError: (err) => {
      toast({ title: "Delete failed", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const filteredReviews = reviews.filter(
    (r) =>
      !reviewSearch ||
      r.patient_name?.toLowerCase().includes(reviewSearch.toLowerCase()) ||
      r.comment?.toLowerCase().includes(reviewSearch.toLowerCase())
  );

  const renderStars = (rating) =>
    Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-3.5 h-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
    ));

  const openEdit = (log) => {
    setEditing(log);
    setForm({
      ...EMPTY_COMPLIANCE_LOG_FORM,
      log_type: log.log_type || "note",
      summary: log.summary || "",
      details: log.details || "",
      provider_email: log.provider_email || "",
      action_required: Boolean(log.action_required),
      attachments: Array.isArray(log.attachments) ? log.attachments : [],
    });
  };

  const uploadAttachment = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAttachment(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const uploaded = await adminApiRequest("/admin/uploads/md-document", { method: "POST", body });
      setForm((f) => ({
        ...f,
        attachments: [...(f.attachments || []), { name: file.name, url: uploaded?.url || "" }],
      }));
    } catch (err) {
      toast({ title: "Upload failed", description: err?.message || "Try again.", variant: "destructive" });
    } finally {
      setUploadingAttachment(false);
      e.target.value = "";
    }
  };

  const removeAttachment = (index) => {
    setForm((f) => ({
      ...f,
      attachments: (f.attachments || []).filter((_, i) => i !== index),
    }));
  };

  const renderLogFormFields = (onSave, saveLabel, saving) => (
    <>
      <div>
        <Label>Provider Email *</Label>
        <Input
          type="email"
          value={form.provider_email || ""}
          onChange={(e) => setForm({ ...form, provider_email: e.target.value })}
          placeholder="provider@example.com"
        />
      </div>
      <div>
        <Label>Log Type</Label>
        <Select value={form.log_type} onValueChange={(v) => setForm({ ...form, log_type: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPLIANCE_LOG_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {formatLogTypeLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500 mt-1">{COMPLIANCE_LOG_TYPE_INFO[form.log_type]}</p>
      </div>
      <div>
        <Label>Summary *</Label>
        <Input value={form.summary || ""} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
      </div>
      <div>
        <Label>Details</Label>
        <Textarea value={form.details || ""} onChange={(e) => setForm({ ...form, details: e.target.value })} rows={3} />
      </div>
      <div>
        <Label>Attachments</Label>
        <div className="space-y-2 mb-2">
          {(form.attachments || []).map((doc, i) => (
            <div key={i} className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-2 text-sm">
              <FileText className="w-4 h-4 text-slate-500" />
              <a href={doc.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-blue-600 hover:underline">
                {doc.name || doc.url}
              </a>
              <button type="button" onClick={() => removeAttachment(i)} className="text-slate-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-600 border border-dashed rounded-lg px-3 py-2 hover:bg-slate-50">
          <Upload className="w-4 h-4" />
          {uploadingAttachment ? "Uploading..." : "Add attachment"}
          <input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg" onChange={uploadAttachment} disabled={uploadingAttachment} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={form.action_required} onCheckedChange={(v) => setForm({ ...form, action_required: v })} />
        <Label>Action Required</Label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); setForm(EMPTY_COMPLIANCE_LOG_FORM); }}>
          Cancel
        </Button>
        <Button
          style={{ background: "#FA6F30", color: "#fff" }}
          onClick={onSave}
          disabled={!form.summary?.trim() || !form.provider_email?.trim() || saving}
        >
          {saving ? "Saving..." : saveLabel}
        </Button>
      </DialogFooter>
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Compliance & Reviews</h2>
        <p className="text-slate-500 text-sm mt-1">
          Internal audit trail for regulatory documentation. Providers are not notified and cannot see these logs.
        </p>
        <p className="text-slate-500 text-sm mt-1">
          {pendingCount} compliance actions needed · {reviews.filter((r) => r.is_flagged && !r.is_verified).length} reviews flagged
        </p>
      </div>

      <Tabs defaultValue="compliance">
        <TabsList>
          <TabsTrigger value="compliance" className="gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Compliance
            {pendingCount > 0 && (
              <span className="ml-1 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center bg-amber-100 text-amber-700">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1.5">
            <Star className="w-3.5 h-3.5" /> Reviews
            {reviews.filter((r) => r.is_flagged && !r.is_verified).length > 0 && (
              <span className="ml-1 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center bg-red-100 text-red-700">
                {reviews.filter((r) => r.is_flagged && !r.is_verified).length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compliance" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-9" placeholder="Search logs..." value={compSearch} onChange={(e) => setCompSearch(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {COMPLIANCE_LOG_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {formatLogTypeLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditing(null); setForm(EMPTY_COMPLIANCE_LOG_FORM); setOpen(true); }} style={{ background: "#FA6F30", color: "#fff" }}>
              <Plus className="w-4 h-4 mr-2" /> New Log
            </Button>
          </div>

          {logsLoading ? (
            <div className="space-y-3">{[1, 2].map((i) => <Card key={i} className="h-20 animate-pulse bg-slate-100" />)}</div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((l) => (
                <Card key={l.id} className={isLogPendingAction(l) ? "border-amber-200" : ""}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {isLogPendingAction(l) ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900">{l.summary}</span>
                            <Badge variant="outline" className="text-xs capitalize">
                              {formatLogTypeLabel(l.log_type)}
                            </Badge>
                            {isLogPendingAction(l) && <Badge className="bg-amber-100 text-amber-700 text-xs">Action Required</Badge>}
                            {l.resolved_at && <Badge className="bg-green-100 text-green-700 text-xs">Resolved</Badge>}
                            {isAutomatedLog(l) && <Badge className="bg-slate-100 text-slate-600 text-xs">Automated</Badge>}
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">{l.provider_email || l.provider_id || "Unknown provider"}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {l.created_date ? format(new Date(l.created_date), "MMM d, yyyy") : ""}
                            {l.resolved_at ? ` · Resolved ${format(new Date(l.resolved_at), "MMM d, yyyy")}` : ""}
                          </p>
                          {l.details && <p className="text-sm text-slate-600 mt-2">{l.details}</p>}
                          {l.action_taken && (
                            <p className="text-xs text-green-700 mt-2">
                              <strong>Action taken:</strong> {l.action_taken}
                            </p>
                          )}
                          {(l.attachments || []).length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {l.attachments.map((doc, i) => (
                                <a
                                  key={i}
                                  href={doc.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" />
                                  {doc.name || "Attachment"}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {!isAutomatedLog(l) && (
                          <Button size="sm" variant="ghost" onClick={() => openEdit(l)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {isLogPendingAction(l) && (
                          <Button size="sm" variant="outline" onClick={() => setResolveTarget(l)}>
                            Mark Resolved
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => deleteLog.mutate(l.id)}
                          disabled={deleteLog.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredLogs.length === 0 && <p className="text-center text-slate-400 py-10">No compliance logs</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search reviews..." value={reviewSearch} onChange={(e) => setReviewSearch(e.target.value)} />
          </div>

          {reviewsLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Card key={i} className="h-20 animate-pulse bg-slate-100" />)}</div>
          ) : (
            <div className="space-y-3">
              {filteredReviews.map((r) => (
                <Card key={r.id} className={r.is_flagged && !r.is_verified ? "border-red-200" : ""}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{r.patient_name || "Anonymous"}</span>
                          <div className="flex">{renderStars(r.rating)}</div>
                          {r.is_flagged && (
                            <Badge className="bg-red-100 text-red-700 text-xs">
                              <Flag className="w-3 h-3 mr-1" />
                              Flagged
                            </Badge>
                          )}
                          {r.is_verified && <Badge className="bg-green-100 text-green-700 text-xs">Verified</Badge>}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{r.comment}</p>
                        {r.flag_reason && <p className="text-xs text-red-500 mt-1">Flag reason: {r.flag_reason}</p>}
                        <p className="text-xs text-slate-400 mt-1">
                          {r.created_date ? format(new Date(r.created_date), "MMM d, yyyy") : ""}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {!r.is_verified && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600"
                            onClick={() => reviewUpdate.mutate({ id: r.id, data: { is_verified: true, is_flagged: false } })}
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                        )}
                        {!r.is_flagged && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-500"
                            onClick={() => reviewUpdate.mutate({ id: r.id, data: { is_flagged: true, flag_reason: "Admin flagged" } })}
                          >
                            <Flag className="w-3.5 h-3.5 mr-1" /> Flag
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500"
                          onClick={() => deleteReview.mutate(r.id)}
                          disabled={deleteReview.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredReviews.length === 0 && <p className="text-center text-slate-400 py-10">No reviews found</p>}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setForm(EMPTY_COMPLIANCE_LOG_FORM); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Compliance Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {renderLogFormFields(() => create.mutate(), "Save Log", create.isPending)}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(next) => { if (!next) { setEditing(null); setForm(EMPTY_COMPLIANCE_LOG_FORM); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Compliance Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {renderLogFormFields(
              () =>
                updateLog.mutate({
                  id: editing.id,
                  data: {
                    log_type: form.log_type,
                    summary: form.summary,
                    details: form.details,
                    provider_email: String(form.provider_email || "").trim().toLowerCase(),
                    action_required: form.action_required,
                    attachments: form.attachments || [],
                  },
                }),
              "Save Changes",
              updateLog.isPending
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resolveTarget)} onOpenChange={(next) => !next && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark log resolved</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Closing out <strong>{resolveTarget?.summary}</strong>. This is internal documentation only — the provider is not notified.
          </p>
          <div>
            <Label>Action taken (optional)</Label>
            <Textarea
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              rows={3}
              placeholder="What was done to address this?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => resolve.mutate({ id: resolveTarget.id, action_taken: actionTaken })}
              disabled={resolve.isPending}
            >
              {resolve.isPending ? "Saving..." : "Mark Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
