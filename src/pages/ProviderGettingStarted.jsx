import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Award, BookOpen, Upload, ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const LICENSE_TYPES = ["RN","NP","PA","MD","DO","esthetician","other"];

export default function ProviderGettingStarted() {
  const [certDialog, setCertDialog] = useState(false);
  const [form, setForm] = useState({ license_type: "RN" });
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const qc = useQueryClient();

  const submitCert = useMutation({
    mutationFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.License.create({
        ...form,
        provider_id: me.id,
        provider_email: me.email,
        status: "pending_review",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(["my-licenses"]);
      setCertDialog(false);
      setSubmitted(true);
    },
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <style>{`:root { --novi-gold: #C9A96E; --novi-dark: #1A1A2E; }`}</style>

      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--novi-dark)" }}>
            <span className="text-white font-bold text-2xl">N</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Get Started with NOVI</h1>
          <p className="text-slate-500 mt-2">To access your provider dashboard, choose one of the options below.</p>
        </div>

        {submitted ? (
          <Card className="border-green-200 bg-green-50 text-center">
            <CardContent className="pt-8 pb-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-bold text-green-800 text-lg">Certification Submitted!</h3>
              <p className="text-green-700 text-sm mt-1">Our team will review your submission. You'll be notified once approved.</p>
              <p className="text-green-600 text-xs mt-3">In the meantime, you can also browse and enroll in NOVI courses.</p>
              <Link to={createPageUrl("CourseCatalog")}>
                <Button className="mt-4" style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}>
                  Browse NOVI Courses <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {/* Option 1: Submit cert from another school */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-slate-200 hover:border-[#C9A96E]"
              onClick={() => setCertDialog(true)}>
              <CardContent className="pt-6 pb-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "#1A1A2E" }}>
                  <Award className="w-7 h-7 text-[#C9A96E]" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Submit Existing Certification</h3>
                <p className="text-slate-500 text-sm">Already certified from another school? Upload your credentials for review and we'll verify your qualifications.</p>
                <Button className="w-full" style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}>
                  <Upload className="w-4 h-4 mr-2" /> Submit Credentials
                </Button>
              </CardContent>
            </Card>

            {/* Option 2: Enroll in a NOVI course */}
            <Card className="hover:shadow-lg transition-shadow border-2 border-slate-200 hover:border-[#C9A96E]">
              <CardContent className="pt-6 pb-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "#0F3460" }}>
                  <BookOpen className="w-7 h-7 text-[#C9A96E]" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Enroll in a NOVI Course</h3>
                <p className="text-slate-500 text-sm">Take a NOVI-certified aesthetic training course and earn your certification upon completion.</p>
                <Link to={createPageUrl("CourseCatalog")} className="block">
                  <Button className="w-full" style={{ background: "var(--novi-dark)", color: "white" }}>
                    <BookOpen className="w-4 h-4 mr-2" /> Browse Courses
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Features preview */}
        <div className="rounded-2xl p-6 text-white" style={{ background: "linear-gradient(135deg, #1A1A2E, #0F3460)" }}>
          <h3 className="font-bold text-lg mb-4">What you'll unlock as a verified provider</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              "Verified provider badge on your profile",
              "Patient appointment booking",
              "NOVI certification on your record",
              "Medical director oversight",
              "Compliance tracking tools",
              "Premium course access",
            ].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-white/80">
                <CheckCircle className="w-4 h-4 text-[#C9A96E] flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Submit cert dialog */}
      <Dialog open={certDialog} onOpenChange={setCertDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit Your Credentials</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>License / Cert Type</Label>
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
                <Label>Issuing State / School</Label>
                <Input value={form.issuing_state || ""} onChange={e => setForm({ ...form, issuing_state: e.target.value })} placeholder="e.g. TX or School Name" />
              </div>
              <div>
                <Label>Expiration Date</Label>
                <Input type="date" value={form.expiration_date || ""} onChange={e => setForm({ ...form, expiration_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Upload Certificate / Document *</Label>
              <label className="mt-1 flex items-center gap-2 cursor-pointer border-2 border-dashed rounded-lg p-4 hover:bg-slate-50">
                <Upload className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">{uploading ? "Uploading..." : form.document_url ? "Document uploaded ✓" : "Click to upload PDF or image"}</span>
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={uploadFile} />
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCertDialog(false)}>Cancel</Button>
              <Button style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}
                onClick={() => submitCert.mutate()}
                disabled={!form.license_number || !form.document_url || submitCert.isPending || uploading}>
                Submit for Review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}