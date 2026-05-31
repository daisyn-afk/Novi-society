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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { ShieldCheck, Plus, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import TreatmentRecordsReview from "@/components/md/TreatmentRecordsReview.jsx";
import {
  COMPLIANCE_LOG_TYPES,
  COMPLIANCE_LOG_TYPE_INFO,
  EMPTY_COMPLIANCE_LOG_FORM,
  formatLogTypeLabel,
  isLogPendingAction,
  isAutomatedLog,
} from "@/lib/complianceLogs";

export default function MDCompliance() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_COMPLIANCE_LOG_FORM, log_type: "supervision_check" });
  const [resolveTarget, setResolveTarget] = useState(null);
  const [actionTaken, setActionTaken] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: relationships = [] } = useQuery({
    queryKey: ["md-relationships"],
    queryFn: () => base44.entities.MedicalDirectorRelationship.list(),
  });

  const supervisedProviders = relationships
    .filter((r) => String(r.status || "").toLowerCase() === "active")
    .map((r) => ({
      provider_id: r.provider_id,
      provider_email: r.provider_email || r.provider_name || r.provider_id,
      label: r.provider_name || r.provider_email || r.provider_id,
    }));

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["md-compliance-logs"],
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
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["md-compliance-logs"] });
      qc.invalidateQueries({ queryKey: ["compliance-logs"] });
      setOpen(false);
      setForm({ ...EMPTY_COMPLIANCE_LOG_FORM, log_type: "supervision_check" });
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
      qc.invalidateQueries({ queryKey: ["md-compliance-logs"] });
      qc.invalidateQueries({ queryKey: ["compliance-logs"] });
      setResolveTarget(null);
      setActionTaken("");
      toast({ title: "Log marked resolved" });
    },
    onError: (err) => {
      toast({ title: "Resolve failed", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const pendingCount = logs.filter(isLogPendingAction).length;

  return (
    <div className="space-y-8">
      <TreatmentRecordsReview />

      <div style={{ borderTop: "1px solid rgba(198,190,168,0.4)" }} className="pt-6" />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Compliance Logs</h2>
          <p className="text-slate-500 text-sm mt-1">{pendingCount} requiring action</p>
        </div>
        <Button onClick={() => setOpen(true)} style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}>
          <Plus className="w-4 h-4 mr-2" /> New Log
        </Button>
      </div>

      {supervisedProviders.length === 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          You have no active supervised providers yet. Compliance logs can be created once supervision relationships are active.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Card key={i} className="h-20 animate-pulse bg-slate-100" />)}</div>
      ) : (
        <div className="space-y-3">
          {logs.map((l) => (
            <Card key={l.id} className={isLogPendingAction(l) ? "border-amber-200" : ""}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
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
                      <p className="text-sm text-slate-500">{l.provider_email || l.provider_id}</p>
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
                    </div>
                  </div>
                  {isLogPendingAction(l) && (
                    <Button size="sm" variant="outline" onClick={() => setResolveTarget(l)}>
                      Resolve
                    </Button>
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
          <DialogHeader>
            <DialogTitle>New Compliance Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
            <div className="flex items-center gap-3">
              <Switch checked={form.action_required} onCheckedChange={(v) => setForm({ ...form, action_required: v })} />
              <Label>Action Required</Label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}
                onClick={() => create.mutate()}
                disabled={!form.summary?.trim() || !form.provider_email?.trim() || create.isPending}
              >
                Save
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resolveTarget)} onOpenChange={(next) => !next && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve compliance log</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Mark <strong>{resolveTarget?.summary}</strong> as handled. The provider will not be notified.
          </p>
          <div>
            <Label>Action taken (optional)</Label>
            <Textarea
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              rows={3}
              placeholder="What did you do to address this?"
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
