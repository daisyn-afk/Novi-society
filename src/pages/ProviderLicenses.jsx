import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProviderLockGate from "@/components/ProviderLockGate";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Plus, Upload } from "lucide-react";
import { format } from "date-fns";

const statusColor = { pending_review: "bg-yellow-100 text-yellow-700", verified: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700", expired: "bg-slate-100 text-slate-500" };
const LICENSE_TYPES = ["RN","NP","PA","MD","DO","esthetician","other"];

export default function ProviderLicenses() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ license_type: "RN" });
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ["my-licenses"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.License.filter({ provider_id: me.id });
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.License.create({ ...form, provider_id: me.id, provider_email: me.email });
    },
    onSuccess: () => { qc.invalidateQueries(["my-licenses"]); setOpen(false); setForm({ license_type: "RN" }); },
  });

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, document_url: file_url }));
    setUploading(false);
  };

  return (
    <ProviderLockGate feature="licenses">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Licenses</h2>
          <p className="text-slate-500 text-sm mt-1">{licenses.length} licenses on file</p>
        </div>
        <Button onClick={() => setOpen(true)} style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}>
          <Plus className="w-4 h-4 mr-2" /> Add License
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1].map(i => <Card key={i} className="h-24 animate-pulse bg-slate-100" />)}</div>
      ) : licenses.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400">No licenses uploaded yet</p>
          <Button className="mt-4" onClick={() => setOpen(true)} style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}>Upload License</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {licenses.map(l => (
            <Card key={l.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{l.license_type} – {l.license_number}</span>
                      <Badge className={statusColor[l.status]}>{l.status?.replace("_"," ")}</Badge>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{l.issuing_state}</p>
                    <div className="flex gap-3 text-xs text-slate-400 mt-1">
                      {l.issue_date && <span>Issued: {format(new Date(l.issue_date), "MMM d, yyyy")}</span>}
                      {l.expiration_date && <span>Expires: {format(new Date(l.expiration_date), "MMM d, yyyy")}</span>}
                    </div>
                    {l.rejection_reason && <p className="text-xs text-red-500 mt-1">Rejected: {l.rejection_reason}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add License</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>License Type</Label>
                <Select value={form.license_type} onValueChange={v => setForm({ ...form, license_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LICENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>License Number *</Label>
                <Input value={form.license_number || ""} onChange={e => setForm({ ...form, license_number: e.target.value })} />
              </div>
              <div>
                <Label>Issuing State</Label>
                <Input value={form.issuing_state || ""} onChange={e => setForm({ ...form, issuing_state: e.target.value })} placeholder="TX" />
              </div>
              <div>
                <Label>Issue Date</Label>
                <Input type="date" value={form.issue_date || ""} onChange={e => setForm({ ...form, issue_date: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Expiration Date</Label>
                <Input type="date" value={form.expiration_date || ""} onChange={e => setForm({ ...form, expiration_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Upload Document</Label>
              <label className="mt-1 flex items-center gap-2 cursor-pointer border rounded-lg p-3 hover:bg-slate-50">
                <Upload className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">{uploading ? "Uploading..." : form.document_url ? "Document uploaded ✓" : "Choose file"}</span>
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={uploadFile} />
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button style={{ background: "var(--novi-gold)", color: "#1A1A2E" }} onClick={() => create.mutate()} disabled={!form.license_number || create.isPending || uploading}>
                Submit License
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </ProviderLockGate>
  );
}