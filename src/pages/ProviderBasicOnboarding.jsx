import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Upload, CheckCircle, ArrowRight } from "lucide-react";
import { providerOnboardingApi } from "@/api/providerOnboardingApi";
import { getDashboardPathForRole } from "@/lib/routeAccessPolicy";
import { adminUploadsApi } from "@/api/adminUploadsApi";

const LICENSE_TYPES = ["RN", "NP", "PA", "MD", "DO", "esthetician", "other"];
const US_ZIP_REGEX = /^\d{5}(-\d{4})?$/;

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
  const [fieldErrors, setFieldErrors] = useState({
    dob: "",
    address_line1: "",
    city: "",
    state: "",
    zip: "",
    license_type: "",
    license_number: "",
    document_url: "",
  });
  const [uploadError, setUploadError] = useState("");

  const { data: me, isLoading: isLoadingMe, isError: meLoadFailed } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    retry: false
  });

  useEffect(() => {
    if (me && me.role !== "provider") {
      navigate(createPageUrl("Onboarding"));
    }
  }, [me, navigate]);

  const validateForm = () => {
    const errors = {
      dob: "",
      address_line1: "",
      city: "",
      state: "",
      zip: "",
      license_type: "",
      license_number: "",
      document_url: "",
    };
    const trimmedState = form.state.trim();
    const trimmedZip = form.zip.trim();
    const trimmedLicenseNumber = form.license_number.trim();
    if (!form.dob) errors.dob = "Date of birth is required.";
    if (!form.address_line1.trim()) errors.address_line1 = "Street address is required.";
    if (!form.city.trim()) errors.city = "City is required.";
    if (!trimmedState) errors.state = "State is required.";
    if (!trimmedZip) errors.zip = "ZIP is required.";
    else if (!US_ZIP_REGEX.test(trimmedZip)) errors.zip = "Enter a valid ZIP code.";
    if (!form.license_type) errors.license_type = "License type is required.";
    if (!trimmedLicenseNumber) errors.license_number = "License number is required.";
    if (!documentUrl) errors.document_url = "License document is required.";
    if (form.dob) {
      const dobDate = new Date(form.dob);
      const today = new Date();
      let age = today.getFullYear() - dobDate.getFullYear();
      const monthDiff = today.getMonth() - dobDate.getMonth();
      const dayDiff = today.getDate() - dobDate.getDate();
      if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
      if (age < 18) errors.dob = "You must be 18 or older to register as a provider.";
    }
    return errors;
  };

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError("");
    setFieldErrors(prev => ({ ...prev, document_url: "" }));
    setUploading(true);
    try {
      const uploaded = await adminUploadsApi.uploadLicenseDocument(file);
      const nextUrl = uploaded?.url || uploaded?.file_url || "";
      if (!nextUrl) {
        throw new Error("Upload succeeded but no file URL was returned.");
      }
      setDocumentUrl(nextUrl);
    } catch (error) {
      setUploadError(error?.message || "License upload failed. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const submitOnboarding = useMutation({
    mutationFn: async () => {
      const dobDate = new Date(form.dob);
      const today = new Date();
      const age = today.getFullYear() - dobDate.getFullYear();
      const monthDiff = today.getMonth() - dobDate.getMonth();
      if (age < 18 || (age === 18 && monthDiff < 0)) {
        throw new Error("You must be 18 or older to register as a provider.");
      }
      return providerOnboardingApi.submitBasic({
        dob: form.dob,
        address_line1: form.address_line1,
        address_line2: form.address_line2 || null,
        city: form.city,
        state: form.state,
        zip: form.zip,
        license_type: form.license_type,
        license_number: form.license_number,
        issuing_state: form.issuing_state || null,
        expiration_date: form.expiration_date || null,
        document_url: documentUrl || null
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-licenses"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      navigate(createPageUrl("ProviderDashboard"));
    },
  });

  if (isLoadingMe) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (meLoadFailed) {
    window.location.href = `/login?next=${encodeURIComponent("/ProviderBasicOnboarding")}`;
    return null;
  }

  if (me?.role && me.role !== "provider") {
    window.location.href = getDashboardPathForRole(me.role);
    return null;
  }

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
  const handleSubmit = () => {
    const errors = validateForm();
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    submitOnboarding.mutate();
  };

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
                  onChange={e => {
                    const value = e.target.value;
                    setForm(f => ({ ...f, dob: value }));
                    setFieldErrors(prev => ({ ...prev, dob: "" }));
                  }}
                  className={inputClass}
                />
                {fieldErrors.dob && <p className="text-xs mt-1 text-red-600">{fieldErrors.dob}</p>}
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
                    onChange={e => {
                      const value = e.target.value;
                      setForm(f => ({ ...f, address_line1: value }));
                      setFieldErrors(prev => ({ ...prev, address_line1: "" }));
                    }}
                    placeholder="123 Main St"
                    className={inputClass}
                  />
                  {fieldErrors.address_line1 && <p className="text-xs mt-1 text-red-600">{fieldErrors.address_line1}</p>}
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
                      onChange={e => {
                        const value = e.target.value;
                        setForm(f => ({ ...f, city: value }));
                        setFieldErrors(prev => ({ ...prev, city: "" }));
                      }}
                      placeholder="Dallas"
                      className={inputClass}
                    />
                    {fieldErrors.city && <p className="text-xs mt-1 text-red-600">{fieldErrors.city}</p>}
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>State *</Label>
                    <Input
                      value={form.state}
                      onChange={e => {
                        const value = e.target.value.toUpperCase();
                        setForm(f => ({ ...f, state: value }));
                        setFieldErrors(prev => ({ ...prev, state: "" }));
                      }}
                      placeholder="TX"
                      maxLength={2}
                      className={inputClass}
                    />
                    {fieldErrors.state && <p className="text-xs mt-1 text-red-600">{fieldErrors.state}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>ZIP *</Label>
                    <Input
                      value={form.zip}
                      onChange={e => {
                        const value = e.target.value;
                        setForm(f => ({ ...f, zip: value }));
                        setFieldErrors(prev => ({ ...prev, zip: "" }));
                      }}
                      placeholder="75201"
                      className={inputClass}
                    />
                    {fieldErrors.zip && <p className="text-xs mt-1 text-red-600">{fieldErrors.zip}</p>}
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
                    <Select value={form.license_type} onValueChange={v => {
                      setForm(f => ({ ...f, license_type: v }));
                      setFieldErrors(prev => ({ ...prev, license_type: "" }));
                    }}>
                      <SelectTrigger className={inputClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LICENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {fieldErrors.license_type && <p className="text-xs mt-1 text-red-600">{fieldErrors.license_type}</p>}
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>License Number *</Label>
                    <Input
                      value={form.license_number}
                      onChange={e => {
                        const value = e.target.value;
                        setForm(f => ({ ...f, license_number: value }));
                        setFieldErrors(prev => ({ ...prev, license_number: "" }));
                      }}
                      placeholder="e.g. RN-123456"
                      className={inputClass}
                    />
                    {fieldErrors.license_number && <p className="text-xs mt-1 text-red-600">{fieldErrors.license_number}</p>}
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
                  {fieldErrors.document_url && <p className="text-xs mt-1 text-red-600">{fieldErrors.document_url}</p>}
                  {uploadError && <p className="text-xs mt-1 text-red-600">{uploadError}</p>}
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
        {uploadError && (
          <div className="mb-4 px-4 py-3 rounded-xl" style={{ background: "rgba(250,111,48,0.15)", border: "1px solid rgba(250,111,48,0.35)" }}>
            <p className="text-sm font-semibold" style={{ color: "#FA6F30" }}>{uploadError}</p>
          </div>
        )}

        <button
          disabled={uploading || submitOnboarding.isPending}
          onClick={handleSubmit}
          className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
          style={{
            background: !(uploading || submitOnboarding.isPending) ? "linear-gradient(135deg, #FA6F30, #DA6A63)" : "rgba(30,37,53,0.1)",
            color: !(uploading || submitOnboarding.isPending) ? "white" : "rgba(30,37,53,0.3)",
          }}
        >
          {submitOnboarding.isPending ? "Submitting…" : "Submit"} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}