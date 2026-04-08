/**
 * ProviderApplication
 * Short application form for new providers:
 *  - Basic info (already have name/email from auth)
 *  - License type + number + upload
 *  - Choose path: NOVI Course or External Cert
 * After submit: license is saved as pending_review, redirect to ProviderDashboard
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Upload, BookOpen, Award, CheckCircle, ArrowRight, Stethoscope, FileText,
  ChevronLeft, Clock
} from "lucide-react";

const LICENSE_TYPES = ["RN", "NP", "PA", "MD", "DO", "esthetician", "other"];

const PATHS = [
  {
    id: "novi_course",
    title: "Enroll in a NOVI Course",
    subtitle: "Train with NOVI's expert instructors and earn a certification upon completion.",
    icon: BookOpen,
    color: "#FA6F30",
    perks: [
      "Hands-on training with top injectors",
      "NOVI certification awarded at completion",
      "Earn MD Board coverage eligibility",
      "Access to pre-course study materials",
    ],
  },
  {
    id: "external_cert",
    title: "Submit External Certification",
    subtitle: "Already certified elsewhere? Submit your existing credentials for NOVI approval.",
    icon: Award,
    color: "#7B8EC8",
    perks: [
      "Upload cert from any accredited school",
      "NOVI team reviews within 1–2 business days",
      "Earn MD Board coverage upon approval",
      "No re-training required if cert is valid",
    ],
  },
];

export default function ProviderApplication() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState(0); // 0: path selection, 1: license form, 2: success
  const [selectedPath, setSelectedPath] = useState(null);
  const [form, setForm] = useState({ license_type: "RN", license_number: "", issuing_state: "", expiration_date: "" });
  const [uploading, setUploading] = useState(false);
  const [documentUrl, setDocumentUrl] = useState("");

  const { data: me, isLoading: loadingMe } = useQuery({ 
    queryKey: ["me"], 
    queryFn: async () => {
      try {
        return await base44.auth.me();
      } catch (error) {
        // User not logged in - redirect to login
        if (error.status === 403 || error.status === 401) {
          base44.auth.redirectToLogin(window.location.href);
        }
        throw error;
      }
    }
  });

  if (loadingMe) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setDocumentUrl(file_url);
    setUploading(false);
  };

  const submitApplication = useMutation({
    mutationFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.License.create({
        provider_id: u.id,
        provider_email: u.email,
        license_type: form.license_type,
        license_number: form.license_number,
        issuing_state: form.issuing_state || null,
        expiration_date: form.expiration_date || null,
        document_url: documentUrl || null,
        status: "pending_review",
        notes: `Application path: ${selectedPath}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-licenses"] });
      setStep(2);
    },
  });

  const canSubmit = form.license_number.trim().length > 0 && !uploading && !submitApplication.isPending;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-8 pb-16 px-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>

      {/* Logo */}
      <div className="flex items-baseline gap-1.5 mb-8">
        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, fontStyle: "italic", color: "rgba(255,255,255,0.9)", lineHeight: 1 }}>novi</span>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>Society</span>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-3 mb-8">
        {["Choose Path", "Your License", "Done"].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  background: i < step ? "#C8E63C" : i === step ? "#FA6F30" : "rgba(255,255,255,0.15)",
                  color: i < step ? "#1a2540" : "white",
                }}>
                {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className="text-xs font-semibold hidden sm:block" style={{ color: i <= step ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)" }}>{label}</span>
            </div>
            {i < 2 && <div className="w-6 h-px" style={{ background: "rgba(255,255,255,0.2)" }} />}
          </div>
        ))}
      </div>

      <div className="w-full max-w-xl">

        {/* ── STEP 0: Choose Path ── */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(218,106,99,0.9)" }}>Welcome to NOVI</p>
              <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "rgba(255,255,255,0.95)", fontStyle: "italic", lineHeight: 1.2 }}>
                How would you like<br />to get certified?
              </h1>
              <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                Choose a path to join the NOVI provider network.
              </p>
            </div>

            <div className="space-y-3">
              {PATHS.map(({ id, title, subtitle, icon: Icon, color, perks }) => (
                <button
                  key={id}
                  onClick={() => setSelectedPath(id)}
                  className="w-full text-left rounded-2xl overflow-hidden transition-all hover:brightness-110"
                  style={{
                    background: selectedPath === id ? `${color}18` : "rgba(255,255,255,0.1)",
                    border: selectedPath === id ? `2px solid ${color}` : "2px solid rgba(255,255,255,0.15)",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}22` }}>
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{title}</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{subtitle}</p>
                      </div>
                      {selectedPath === id && (
                        <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: color }}>
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pl-1">
                      {perks.map((p, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: selectedPath === id ? color : "rgba(255,255,255,0.25)" }} />
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <button
              disabled={!selectedPath}
              onClick={() => setStep(1)}
              className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: selectedPath ? "linear-gradient(135deg, #FA6F30, #DA6A63)" : "rgba(255,255,255,0.1)", color: selectedPath ? "white" : "rgba(255,255,255,0.3)" }}
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 1: License Form ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <button onClick={() => setStep(0)} className="flex items-center gap-1.5 text-xs font-semibold mb-4 hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.5)" }}>
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(218,106,99,0.9)" }}>
                {selectedPath === "novi_course" ? "NOVI Course Path" : "External Cert Path"}
              </p>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: "rgba(255,255,255,0.95)", fontStyle: "italic" }}>
                Submit Your License
              </h2>
              <p className="mt-1.5 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                We need your professional license to verify your qualifications. This typically takes 1–2 business days.
              </p>
            </div>

            {/* Applicant info (read-only) */}
            {me && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: "#7B8EC8", color: "white" }}>
                  {me.full_name?.[0] || "?"}
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{me.full_name}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{me.email}</p>
                </div>
              </div>
            )}

            <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)" }}>
              <div className="px-5 pt-5 pb-4 space-y-4">
                {/* License type + number */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white/70 text-xs mb-1.5 block font-semibold uppercase tracking-wide">License Type *</Label>
                    <Select value={form.license_type} onValueChange={v => setForm(f => ({ ...f, license_type: v }))}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LICENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white/70 text-xs mb-1.5 block font-semibold uppercase tracking-wide">License Number *</Label>
                    <Input
                      value={form.license_number}
                      onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))}
                      placeholder="e.g. RN-123456"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                    />
                  </div>
                  <div>
                    <Label className="text-white/70 text-xs mb-1.5 block font-semibold uppercase tracking-wide">Issuing State</Label>
                    <Input
                      value={form.issuing_state}
                      onChange={e => setForm(f => ({ ...f, issuing_state: e.target.value }))}
                      placeholder="e.g. TX"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                    />
                  </div>
                  <div>
                    <Label className="text-white/70 text-xs mb-1.5 block font-semibold uppercase tracking-wide">Expiration Date</Label>
                    <Input
                      type="date"
                      value={form.expiration_date}
                      onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))}
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                </div>

                {/* Document upload */}
                <div>
                  <Label className="text-white/70 text-xs mb-1.5 block font-semibold uppercase tracking-wide">License Document *</Label>
                  <label className="flex items-center gap-3 cursor-pointer rounded-xl border-2 border-dashed px-4 py-4 transition-all hover:brightness-110"
                    style={{ borderColor: documentUrl ? "rgba(200,230,60,0.5)" : "rgba(255,255,255,0.2)", background: documentUrl ? "rgba(200,230,60,0.08)" : "rgba(255,255,255,0.06)" }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: documentUrl ? "rgba(200,230,60,0.2)" : "rgba(255,255,255,0.1)" }}>
                      {documentUrl ? <CheckCircle className="w-5 h-5" style={{ color: "#C8E63C" }} /> : <Upload className="w-5 h-5" style={{ color: "rgba(255,255,255,0.4)" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: documentUrl ? "#C8E63C" : "rgba(255,255,255,0.7)" }}>
                        {uploading ? "Uploading…" : documentUrl ? "Document uploaded ✓" : "Upload license (PDF, JPG, PNG)"}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {documentUrl ? "Click to replace" : "Required for verification"}
                      </p>
                    </div>
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={uploadFile} />
                  </label>
                </div>
              </div>
            </div>

            {/* Note about what happens next */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(123,142,200,0.12)", border: "1px solid rgba(123,142,200,0.25)" }}>
              <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#7B8EC8" }} />
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
                After submitting, you can browse all provider tabs while we review your license. Full access unlocks once approved — typically within 1–2 business days.
              </p>
            </div>

            <button
              disabled={!canSubmit}
              onClick={() => submitApplication.mutate()}
              className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: canSubmit ? "linear-gradient(135deg, #FA6F30, #DA6A63)" : "rgba(255,255,255,0.1)", color: canSubmit ? "white" : "rgba(255,255,255,0.3)" }}
            >
              {submitApplication.isPending ? "Submitting…" : "Submit Application"} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 2: Success ── */}
        {step === 2 && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(200,230,60,0.15)", border: "2px solid rgba(200,230,60,0.4)" }}>
              <CheckCircle className="w-10 h-10" style={{ color: "#C8E63C" }} />
            </div>
            <div>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: "rgba(255,255,255,0.95)", fontStyle: "italic" }}>
                Application Submitted!
              </h2>
              <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.7, maxWidth: 380, margin: "8px auto 0" }}>
                Our team will review your license and get back to you within <strong style={{ color: "white" }}>1–2 business days</strong>. In the meantime, you can explore everything the NOVI portal has to offer.
              </p>
            </div>

            <div className="rounded-2xl px-5 py-4 text-left space-y-3" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)" }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>While you wait</p>
              {selectedPath === "novi_course" ? (
                <>
                  <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                    <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: "#FA6F30" }} />
                    Browse available NOVI courses and plan your enrollment
                  </div>
                  <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                    <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "#7B8EC8" }} />
                    Review what MD Board coverage entails
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                    <Award className="w-4 h-4 flex-shrink-0" style={{ color: "#7B8EC8" }} />
                    Prepare to submit your external certification once approved
                  </div>
                  <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                    <Stethoscope className="w-4 h-4 flex-shrink-0" style={{ color: "#DA6A63" }} />
                    Explore services you'll be able to offer on NOVI
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => navigate(createPageUrl("ProviderDashboard"))}
              className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 text-white"
              style={{ background: "linear-gradient(135deg, #FA6F30, #DA6A63)" }}
            >
              Go to My Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}