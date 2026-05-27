import { useEffect, useState, useMemo } from "react";
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
import {
  readProviderSignupGoal,
  clearProviderSignupGoal,
  clearSkipExploreFlag,
  GOAL_NEED_MD_COVERAGE,
  GOAL_NEED_TRAINING,
} from "@/lib/providerSignupIntent";

const LICENSE_TYPES = ["RN", "NP", "PA", "MD", "DO", "esthetician", "other"];
const US_ZIP_REGEX = /^\d{5}(-\d{4})?$/;

const labelStyle = { color: "rgba(30,37,53,0.6)" };
const inputClass = "w-full min-w-0 max-w-full box-border bg-white/80 border-slate-200";
const dateInputClass = `${inputClass} onboarding-date-input`;

export default function ProviderBasicOnboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const goal = useMemo(() => readProviderSignupGoal(), []);
  const goalHeadline = useMemo(() => {
    if (goal === GOAL_NEED_MD_COVERAGE) return "Medical director coverage";
    if (goal === GOAL_NEED_TRAINING) return "Certification & training";
    return "Tell us about yourself";
  }, [goal]);
  const goalSub = useMemo(() => {
    if (goal === GOAL_NEED_MD_COVERAGE) {
      return "You indicated you already have credentials and need MD oversight. We still need your license on file for compliance.";
    }
    if (goal === GOAL_NEED_TRAINING) {
      return "You’re on the training path — complete this profile and license so we can reserve courses and verify your RN/NP/PA status.";
    }
    return "We need some basic information and your professional license to get you started.";
  }, [goal]);
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
      clearProviderSignupGoal();
      clearSkipExploreFlag();
      qc.invalidateQueries({ queryKey: ["my-licenses"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["provider-basic-onboarding"] });
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
        background: "linear-gradient(135deg, #2D6B7F 0%, #4a8fa8 38%, #7B8EC8 68%, #DA6A63 100%)",
        backgroundAttachment: "fixed",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .onboarding-date-input {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
        }
        .onboarding-date-input::-webkit-date-and-time-value {
          min-width: 0;
          text-align: left;
        }
      `}</style>

      {/* Background blobs */}
      <div style={{ position: "fixed", top: "-20%", left: "-8%", width: "55%", height: "130%", borderRadius: "60% 40% 70% 30%/50% 60% 40% 50%", background: "rgba(218,106,99,0.35)", filter: "blur(50px)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "-10%", right: "-5%", width: "45%", height: "110%", borderRadius: "40% 60% 30% 70%/60% 40% 60% 40%", background: "rgba(200,230,60,0.2)", filter: "blur(55px)", pointerEvents: "none", zIndex: 0 }} />

      {/* Logo */}
      <div className="mb-8" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ background: "#1e2535", padding: "10px 20px", borderRadius: 14, display: "inline-flex", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
          <img src="/novi-logo-neon-green.png" alt="NOVI Society" style={{ height: 32, width: "auto", display: "block" }} />
        </div>
      </div>

      <div className="w-full max-w-2xl min-w-0" style={{ position: "relative", zIndex: 1 }}>
        <div className="text-center mb-8">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#C8E63C", letterSpacing: "0.2em", textShadow: "0 1px 6px rgba(0,0,0,0.2)" }}>Provider Registration</p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "white", fontStyle: "italic", lineHeight: 1.2, textShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
            {goalHeadline}
          </h1>
          <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
            {goalSub}
          </p>
        </div>

        {/* Applicant info */}
        {me && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6" style={{ background: "rgba(45,107,127,0.08)", border: "1px solid rgba(45,107,127,0.18)" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: "#7B8EC8", color: "white" }}>
              {me.full_name?.[0] || "?"}
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{me.full_name}</p>
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>{me.email}</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden mb-6 min-w-0" style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.65)", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
          <div className="px-4 sm:px-5 pt-5 pb-4 space-y-5 min-w-0 overflow-x-hidden">

            {/* Personal Info */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#2D6B7F" }}>Personal Information</p>
              <div className="min-w-0">
                <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>Date of Birth (Must be 18+) *</Label>
                <Input
                  type="date"
                  value={form.dob}
                  onChange={e => {
                    const value = e.target.value;
                    setForm(f => ({ ...f, dob: value }));
                    setFieldErrors(prev => ({ ...prev, dob: "" }));
                  }}
                  className={dateInputClass}
                />
                {fieldErrors.dob && <p className="text-xs mt-1 text-red-600">{fieldErrors.dob}</p>}
              </div>
            </div>

            {/* Address */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#7B8EC8" }}>Address</p>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="min-w-0 sm:col-span-2">
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
                  <div className="min-w-0">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="min-w-0 sm:max-w-[12rem]">
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
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#DA6A63" }}>Professional License</p>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>License Type *</Label>
                    <Select value={form.license_type} onValueChange={v => {
                      setForm(f => ({ ...f, license_type: v }));
                      setFieldErrors(prev => ({ ...prev, license_type: "" }));
                    }}>
                      <SelectTrigger className={`${inputClass} w-full`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LICENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {fieldErrors.license_type && <p className="text-xs mt-1 text-red-600">{fieldErrors.license_type}</p>}
                  </div>
                  <div className="min-w-0">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0 sm:max-w-[8rem]">
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
                  <div className="min-w-0">
                    <Label className="text-xs mb-1.5 block font-semibold uppercase tracking-wide" style={labelStyle}>
                      Expiration Date <span className="opacity-50 font-normal normal-case">(optional)</span>
                    </Label>
                    <Input
                      type="date"
                      value={form.expiration_date}
                      onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))}
                      className={dateInputClass}
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