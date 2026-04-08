import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Upload, CheckCircle, ArrowRight } from "lucide-react";

const LICENSE_TYPES = ["RN", "NP", "PA", "MD", "DO", "esthetician", "other"];

const labelStyle = { color: "rgba(30,37,53,0.6)" };
const inputClass = "bg-white/80 border-slate-200";

export default function ProviderBasicOnboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    dob: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip: "",
    license_type: "RN",
    license_number: "",
    issuing_state: "",
    expiration_date: "",
  });
  const [uploading, setUploading] = useState(false);
  const [documentUrl, setDocumentUrl] = useState("");

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setDocumentUrl(file_url);
    setUploading(false);
  };

  const submitOnboarding = useMutation({
    mutationFn: async () => {
      const u = await base44.auth.me();
      const dobDate = new Date(form.dob);
      const today = new Date();
      const age = today.getFullYear() - dobDate.getFullYear();
      const monthDiff = today.getMonth() - dobDate.getMonth();
      if (age < 18 || (age === 18 && monthDiff < 0)) {
        throw new Error("You must be 18 or older to register as a provider.");
      }
      await base44.auth.updateMe({
        dob: form.dob,
        address_line1: form.address_line1,
        address_line2: form.address_line2 || null,
        city: form.city,
        state: form.state,
        zip: form.zip,
      });
      await base44.entities.License.create({
        provider_id: u.id,
        provider_email: u.email,
        license_type: form.license_type,
        license_number: form.license_number,
        issuing_state: form.issuing_state || null,
        expiration_date: form.expiration_date || null,
        document_url: documentUrl || null,
        status: "verified",
        verified_at: new Date().toISOString(),
        verified_by: "auto_verified_onboarding",
      });
      return u;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-licenses"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      navigate(createPageUrl("ProviderDashboard"));
    },
  });

  const canSubmit =
    form.dob &&
    form.address_line1 &&
    form.city &&
    form.state &&
    form.zip &&
    form.license_number.trim().length > 0 &&
    documentUrl &&
    !uploading &&
    !submitOnboarding.isPending;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start pt-8 pb-16 px-4"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "linear-gradient(150deg, #ede9fb 0%, #f5f2ff 40%, #eaf5c8 75%, #C8E63C 100%)",
        backgroundAttachment: "fixed",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>

      {/* Logo */}
      <div className="flex items-baseline gap-1.5 mb-8">
        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, fontStyle: "italic", color: "#1e2535", lineHeight: 1 }}>novi</span>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(30,37,53,0.5)" }}>Society</span>
      </div>

      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#DA6A63" }}>Provider Registration</p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", fontStyle: "italic", lineHeight: 1.2 }}>
            Tell us about yourself
          </h1>
          <p className="mt-3 text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
            We need some basic information and your professional license to get you started.
          </p>
        </div>

        {/* Applicant info */}
        {me && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(30,37,53,0.1)" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: "#7B8EC8", color: "white" }}>
              {me.full_name?.[0] || "?"}
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{me.full_name}</p>
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>{me.email}</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.1)" }}>
          <div className="px-5 pt-5 pb-4 space-y-5">

            {/* Personal Info */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.5)" }}>Personal Information</p>
              <div>
                <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>Date of Birth (Must be 18+) *</Label>
                <Input
                  type="date"
                  value={form.dob}
                  onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.5)" }}>Address</p>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>Street Address *</Label>
                  <Input
                    value={form.address_line1}
                    onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))}
                    placeholder="123 Main St"
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>Apt, Suite, etc.</Label>
                  <Input
                    value={form.address_line2}
                    onChange={e => setForm(f => ({ ...f, address_line2: e.target.value }))}
                    placeholder="Apt 4B"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>City *</Label>
                    <Input
                      value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      placeholder="Dallas"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>State *</Label>
                    <Input
                      value={form.state}
                      onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                      placeholder="TX"
                      maxLength={2}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>ZIP *</Label>
                    <Input
                      value={form.zip}
                      onChange={e => setForm(f => ({ ...f, zip: e.target.value }))}
                      placeholder="75201"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* License */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.5)" }}>Professional License</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>License Type *</Label>
                    <Select value={form.license_type} onValueChange={v => setForm(f => ({ ...f, license_type: v }))}>
                      <SelectTrigger className={inputClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LICENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>License Number *</Label>
                    <Input
                      value={form.license_number}
                      onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))}
                      placeholder="e.g. RN-123456"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>
                      Issuing State <span className="opacity-50 font-normal normal-case">(optional)</span>
                    </Label>
                    <Input
                      value={form.issuing_state}
                      onChange={e => setForm(f => ({ ...f, issuing_state: e.target.value }))}
                      placeholder="TX"
                      maxLength={2}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>
                      Expiration Date <span className="opacity-50 font-normal normal-case">(optional)</span>
                    </Label>
                    <Input
                      type="date"
                      value={form.expiration_date}
                      onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Document upload */}
                <div>
                  <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>License Document *</Label>
                  <label
                    className="flex items-center gap-3 cursor-pointer rounded-xl border-2 border-dashed px-4 py-4 transition-all hover:brightness-110"
                    style={{
                      borderColor: documentUrl ? "rgba(200,230,60,0.5)" : "rgba(30,37,53,0.2)",
                      background: documentUrl ? "rgba(200,230,60,0.08)" : "rgba(255,255,255,0.4)",
                    }}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: documentUrl ? "rgba(200,230,60,0.2)" : "rgba(30,37,53,0.08)" }}>
                      {documentUrl
                        ? <CheckCircle className="w-5 h-5" style={{ color: "#C8E63C" }} />
                        : <Upload className="w-5 h-5" style={{ color: "rgba(30,37,53,0.4)" }} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: documentUrl ? "#5a7a20" : "rgba(30,37,53,0.7)" }}>
                        {uploading ? "Uploading…" : documentUrl ? "Document uploaded ✓" : "Upload license (PDF, JPG, PNG)"}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.4)" }}>
                        {documentUrl ? "Click to replace" : "Required for verification"}
                      </p>
                    </div>
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={uploadFile} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {submitOnboarding.error && (
          <div className="mb-4 px-4 py-3 rounded-xl" style={{ background: "rgba(250,111,48,0.15)", border: "1px solid rgba(250,111,48,0.35)" }}>
            <p className="text-sm font-semibold" style={{ color: "#FA6F30" }}>{submitOnboarding.error.message}</p>
          </div>
        )}

        <button
          disabled={!canSubmit}
          onClick={() => submitOnboarding.mutate()}
          className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
          style={{
            background: canSubmit ? "linear-gradient(135deg, #FA6F30, #DA6A63)" : "rgba(30,37,53,0.1)",
            color: canSubmit ? "white" : "rgba(30,37,53,0.3)",
          }}
        >
          {submitOnboarding.isPending ? "Submitting…" : "Continue to Dashboard"} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}