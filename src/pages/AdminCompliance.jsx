import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Plus, Search, AlertTriangle, Star, Flag, CheckCircle } from "lucide-react";
import { format } from "date-fns";

const LOG_TYPES = ["supervision_check","chart_review","incident_report","license_review","certification_review","note"];

export default function AdminCompliance() {
  const [compSearch, setCompSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ log_type: "note", action_required: false });
  const [reviewSearch, setReviewSearch] = useState("");
  const qc = useQueryClient();

  // --- Compliance Logs ---
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["compliance-logs"],
    queryFn: () => base44.entities.ComplianceLog.list("-created_date"),
  });

  const create = useMutation({
    mutationFn: () => base44.entities.ComplianceLog.create(form),
    onSuccess: () => { qc.invalidateQueries(["compliance-logs"]); setOpen(false); setForm({ log_type: "note", action_required: false }); },
  });

  const resolve = useMutation({
    mutationFn: (id) => base44.entities.ComplianceLog.update(id, { resolved_at: new Date().toISOString(), action_required: false }),
    onSuccess: () => qc.invalidateQueries(["compliance-logs"]),
  });

  const filteredLogs = logs.filter(l => !compSearch || l.provider_email?.toLowerCase().includes(compSearch.toLowerCase()) || l.summary?.toLowerCase().includes(compSearch.toLowerCase()));

  // --- Reviews ---
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["reviews"],
    queryFn: () => base44.entities.Review.list("-created_date"),
  });

  const reviewUpdate = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Review.update(id, data),
    onSuccess: () => qc.invalidateQueries(["reviews"]),
  });

  const filteredReviews = reviews.filter(r => !reviewSearch || r.patient_name?.toLowerCase().includes(reviewSearch.toLowerCase()) || r.comment?.toLowerCase().includes(reviewSearch.toLowerCase()));

  const renderStars = (rating) => Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={`w-3.5 h-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
  ));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Compliance & Reviews</h2>
        <p className="text-slate-500 text-sm mt-1">
          {logs.filter(l => l.action_required && !l.resolved_at).length} compliance actions needed · {reviews.filter(r => r.is_flagged && !r.is_verified).length} reviews flagged
        </p>
      </div>

      <Tabs defaultValue="compliance">
        <TabsList>
          <TabsTrigger value="compliance" className="gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Compliance
            {logs.filter(l => l.action_required && !l.resolved_at).length > 0 && (
              <span className="ml-1 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center bg-amber-100 text-amber-700">
                {logs.filter(l => l.action_required && !l.resolved_at).length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1.5">
            <Star className="w-3.5 h-3.5" /> Reviews
            {reviews.filter(r => r.is_flagged && !r.is_verified).length > 0 && (
              <span className="ml-1 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center bg-red-100 text-red-700">
                {reviews.filter(r => r.is_flagged && !r.is_verified).length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* COMPLIANCE TAB */}
        <TabsContent value="compliance" className="space-y-4 mt-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-9" placeholder="Search logs..." value={compSearch} onChange={e => setCompSearch(e.target.value)} />
            </div>
            <Button onClick={() => setOpen(true)} style={{ background: "#FA6F30", color: "#fff" }}>
              <Plus className="w-4 h-4 mr-2" /> New Log
            </Button>
          </div>

          {logsLoading ? (
            <div className="space-y-3">{[1,2].map(i => <Card key={i} className="h-20 animate-pulse bg-slate-100" />)}</div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map(l => (
                <Card key={l.id} className={l.action_required && !l.resolved_at ? "border-amber-200" : ""}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {l.action_required && !l.resolved_at
                          ? <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          : <ShieldCheck className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900">{l.summary}</span>
                            <Badge variant="outline" className="text-xs capitalize">{l.log_type?.replace("_"," ")}</Badge>
                            {l.action_required && !l.resolved_at && <Badge className="bg-amber-100 text-amber-700 text-xs">Action Required</Badge>}
                            {l.resolved_at && <Badge className="bg-green-100 text-green-700 text-xs">Resolved</Badge>}
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">{l.provider_email}</p>
                          <p className="text-xs text-slate-400 mt-1">{l.created_date ? format(new Date(l.created_date), "MMM d, yyyy") : ""}</p>
                          {l.details && <p className="text-sm text-slate-600 mt-2">{l.details}</p>}
                        </div>
                      </div>
                      {l.action_required && !l.resolved_at && (
                        <Button size="sm" variant="outline" className="flex-shrink-0" onClick={() => resolve.mutate(l.id)}>Mark Resolved</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredLogs.length === 0 && <p className="text-center text-slate-400 py-10">No compliance logs</p>}
            </div>
          )}
        </TabsContent>

        {/* REVIEWS TAB */}
        <TabsContent value="reviews" className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search reviews..." value={reviewSearch} onChange={e => setReviewSearch(e.target.value)} />
          </div>

          {reviewsLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="h-20 animate-pulse bg-slate-100" />)}</div>
          ) : (
            <div className="space-y-3">
              {filteredReviews.map(r => (
                <Card key={r.id} className={r.is_flagged && !r.is_verified ? "border-red-200" : ""}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{r.patient_name || "Anonymous"}</span>
                          <div className="flex">{renderStars(r.rating)}</div>
                          {r.is_flagged && <Badge className="bg-red-100 text-red-700 text-xs"><Flag className="w-3 h-3 mr-1" />Flagged</Badge>}
                          {r.is_verified && <Badge className="bg-green-100 text-green-700 text-xs">Verified</Badge>}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{r.comment}</p>
                        {r.flag_reason && <p className="text-xs text-red-500 mt-1">Flag reason: {r.flag_reason}</p>}
                        <p className="text-xs text-slate-400 mt-1">{r.created_date ? format(new Date(r.created_date), "MMM d, yyyy") : ""}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {!r.is_verified && (
                          <Button size="sm" variant="outline" className="text-green-600"
                            onClick={() => reviewUpdate.mutate({ id: r.id, data: { is_verified: true, is_flagged: false } })}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                        )}
                        {!r.is_flagged && (
                          <Button size="sm" variant="outline" className="text-red-500"
                            onClick={() => reviewUpdate.mutate({ id: r.id, data: { is_flagged: true, flag_reason: "Admin flagged" } })}>
                            <Flag className="w-3.5 h-3.5 mr-1" /> Flag
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="text-red-500"
                          onClick={() => base44.entities.Review.delete(r.id).then(() => qc.invalidateQueries(["reviews"]))}>
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

      {/* New Compliance Log Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Compliance Log</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Provider Email</Label>
              <Input value={form.provider_email || ""} onChange={e => setForm({ ...form, provider_email: e.target.value })} placeholder="provider@email.com" />
            </div>
            <div>
              <Label>Log Type</Label>
              <Select value={form.log_type} onValueChange={v => setForm({ ...form, log_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOG_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace("_"," ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Summary *</Label>
              <Input value={form.summary || ""} onChange={e => setForm({ ...form, summary: e.target.value })} />
            </div>
            <div>
              <Label>Details</Label>
              <Textarea value={form.details || ""} onChange={e => setForm({ ...form, details: e.target.value })} rows={3} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.action_required} onCheckedChange={v => setForm({ ...form, action_required: v })} />
              <Label>Action Required</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button style={{ background: "#FA6F30", color: "#fff" }} onClick={() => create.mutate()} disabled={!form.summary || create.isPending}>
                Save Log
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}