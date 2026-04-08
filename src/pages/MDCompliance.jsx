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
import { ShieldCheck, Plus, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import TreatmentRecordsReview from "@/components/md/TreatmentRecordsReview.jsx";

const LOG_TYPES = ["supervision_check","chart_review","incident_report","license_review","certification_review","note"];

export default function MDCompliance() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ log_type: "supervision_check", action_required: false });
  const qc = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["md-compliance-logs"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.ComplianceLog.filter({ medical_director_id: me.id }, "-created_date");
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.ComplianceLog.create({ ...form, medical_director_id: me.id });
    },
    onSuccess: () => { qc.invalidateQueries(["md-compliance-logs"]); setOpen(false); setForm({ log_type: "supervision_check", action_required: false }); },
  });

  const resolve = useMutation({
    mutationFn: (id) => base44.entities.ComplianceLog.update(id, { resolved_at: new Date().toISOString(), action_required: false }),
    onSuccess: () => qc.invalidateQueries(["md-compliance-logs"]),
  });

  return (
    <div className="space-y-8">
      <TreatmentRecordsReview />

      <div style={{ borderTop: "1px solid rgba(198,190,168,0.4)" }} className="pt-6" />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Compliance Logs</h2>
          <p className="text-slate-500 text-sm mt-1">{logs.filter(l => l.action_required && !l.resolved_at).length} requiring action</p>
        </div>
        <Button onClick={() => setOpen(true)} style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}>
          <Plus className="w-4 h-4 mr-2" /> New Log
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <Card key={i} className="h-20 animate-pulse bg-slate-100" />)}</div>
      ) : (
        <div className="space-y-3">
          {logs.map(l => (
            <Card key={l.id} className={l.action_required && !l.resolved_at ? "border-amber-200" : ""}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {l.action_required && !l.resolved_at ? <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" /> : <ShieldCheck className="w-4 h-4 text-slate-400 mt-0.5" />}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{l.summary}</span>
                        <Badge variant="outline" className="text-xs capitalize">{l.log_type?.replace("_"," ")}</Badge>
                        {l.action_required && !l.resolved_at && <Badge className="bg-amber-100 text-amber-700 text-xs">Action Required</Badge>}
                        {l.resolved_at && <Badge className="bg-green-100 text-green-700 text-xs">Resolved</Badge>}
                      </div>
                      <p className="text-sm text-slate-500">{l.provider_email}</p>
                      <p className="text-xs text-slate-400 mt-1">{l.created_date ? format(new Date(l.created_date), "MMM d, yyyy") : ""}</p>
                    </div>
                  </div>
                  {l.action_required && !l.resolved_at && (
                    <Button size="sm" variant="outline" onClick={() => resolve.mutate(l.id)}>Resolve</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {logs.length === 0 && <p className="text-center text-slate-400 py-10">No compliance logs yet</p>}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Compliance Log</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Provider Email</Label>
              <Input value={form.provider_email || ""} onChange={e => setForm({ ...form, provider_email: e.target.value })} />
            </div>
            <div>
              <Label>Log Type</Label>
              <Select value={form.log_type} onValueChange={v => setForm({ ...form, log_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LOG_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace("_"," ")}</SelectItem>)}</SelectContent>
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
              <Button style={{ background: "var(--novi-gold)", color: "#1A1A2E" }} onClick={() => create.mutate()} disabled={!form.summary || create.isPending}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}