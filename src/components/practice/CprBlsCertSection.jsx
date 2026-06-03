import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Award, CheckCircle, ExternalLink, HeartPulse, Loader2, Upload,
} from "lucide-react";
import { CPR_BLS_CERT_NAME, isCprBlsCert } from "@/lib/cprBlsCert";
import {
  hasCertificateDocument,
  openCertificateDocument,
} from "@/lib/certificateDocument";

const GLASS_STYLE = {
  background: "rgba(255,255,255,0.5)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.75)",
  boxShadow: "0 2px 12px rgba(30,37,53,0.06)",
};

const STATUS = {
  active: { label: "Verified", bg: "rgba(200,230,60,0.15)", color: "#4a6b10", border: "rgba(200,230,60,0.4)" },
  pending: { label: "Under Review", bg: "rgba(250,111,48,0.1)", color: "#FA6F30", border: "rgba(250,111,48,0.25)" },
  expired: { label: "Expired", bg: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.4)", border: "rgba(30,37,53,0.1)" },
  revoked: { label: "Revoked", bg: "rgba(218,106,99,0.1)", color: "#DA6A63", border: "rgba(218,106,99,0.25)" },
};

function GlassInput({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all ${className}`}
      style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535" }}
    />
  );
}

function ExistingCertRow({ cert }) {
  const cfg = STATUS[String(cert.status || "pending").toLowerCase()] || STATUS.pending;
  const canView = hasCertificateDocument(cert);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
      style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(30,37,53,0.1)" }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg }}>
        <Award className="w-4 h-4" style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: "#1e2535" }}>
          {cert.certification_name || CPR_BLS_CERT_NAME}
        </p>
        {cert.issued_by && (
          <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>Issued by {cert.issued_by}</p>
        )}
        {cert.expires_at && (
          <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>
            Expires {new Date(cert.expires_at).toLocaleDateString()}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          {cfg.label}
        </span>
        {canView && (
          <button
            type="button"
            onClick={() => openCertificateDocument(cert)}
            className="inline-flex items-center justify-center rounded-md p-1.5"
            style={{ background: "rgba(123,142,200,0.12)", border: "1px solid rgba(123,142,200,0.25)" }}
            title="View certificate"
          >
            <ExternalLink className="w-3.5 h-3.5" style={{ color: "#7B8EC8" }} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function CprBlsCertSection({ me, focusSection }) {
  const qc = useQueryClient();
  const sectionRef = useRef(null);
  const [issuedBy, setIssuedBy] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["my-certs"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.Certification.filter({ provider_id: u.id });
    },
    enabled: !!me?.id,
  });

  const cprCerts = certs.filter(isCprBlsCert);
  const hasPending = cprCerts.some((c) => String(c.status || "").toLowerCase() === "pending");
  const hasActive = cprCerts.some((c) => String(c.status || "").toLowerCase() === "active");

  useEffect(() => {
    if (focusSection === "cpr_bls" && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusSection]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFileUrl(file_url);
    } catch (err) {
      setUploadError(err?.message || "Could not upload file. Please try again.");
      setFileUrl("");
    } finally {
      setUploading(false);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!fileUrl) throw new Error("Please upload your CPR/BLS certificate file.");
      const u = await base44.auth.me();
      return base44.entities.Certification.create({
        provider_id: u.id,
        provider_email: u.email,
        provider_name: u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.email,
        certification_name: CPR_BLS_CERT_NAME,
        category: "compliance",
        issued_by: issuedBy.trim() || null,
        certificate_url: fileUrl,
        issued_at: new Date().toISOString(),
        expires_at: expiresAt || null,
        status: "pending",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-certs"] });
      setFileUrl("");
      setIssuedBy("");
      setExpiresAt("");
      setSubmitError("");
    },
    onError: (err) => {
      setSubmitError(err?.message || "Could not submit certification. Please try again.");
    },
  });

  return (
    <div ref={sectionRef} className="rounded-2xl overflow-hidden scroll-mt-24" style={GLASS_STYLE}>
      <div className="px-6 py-3.5" style={{ borderBottom: "1px solid rgba(30,37,53,0.07)" }}>
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4" style={{ color: "#DA6A63" }} />
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#DA6A63" }}>
            CPR / BLS Certification
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>
          NOVI compliance requirement. Upload your current CPR or Basic Life Support certification for admin review.
        </p>

        {isLoading ? (
          <div className="h-16 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.4)" }} />
        ) : cprCerts.length > 0 ? (
          <div className="space-y-2">
            {cprCerts.map((cert) => (
              <ExistingCertRow key={cert.id} cert={cert} />
            ))}
          </div>
        ) : null}

        {hasActive ? (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(200,230,60,0.12)", color: "#4a6b10", border: "1px solid rgba(200,230,60,0.25)" }}
          >
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Your CPR/BLS certification is on file.
          </div>
        ) : hasPending ? (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: "rgba(250,111,48,0.08)", color: "#c2410c", border: "1px solid rgba(250,111,48,0.2)" }}
          >
            <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
            Your upload is under review. You will be notified once it is verified.
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(30,37,53,0.55)" }}>
                  Issuing Organization (optional)
                </p>
                <GlassInput
                  placeholder="e.g. American Heart Association"
                  value={issuedBy}
                  onChange={(e) => setIssuedBy(e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(30,37,53,0.55)" }}>
                  Expiration Date (optional)
                </p>
                <GlassInput type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(30,37,53,0.55)" }}>
                Certificate File
              </p>
              <label
                className="flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-xl cursor-pointer transition-all hover:opacity-90"
                style={{
                  background: fileUrl ? "rgba(200,230,60,0.08)" : "rgba(255,255,255,0.65)",
                  border: `2px dashed ${fileUrl ? "rgba(200,230,60,0.5)" : "rgba(30,37,53,0.15)"}`,
                }}
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#FA6F30" }} />
                ) : fileUrl ? (
                  <CheckCircle className="w-6 h-6" style={{ color: "#4a6b10" }} />
                ) : (
                  <Upload className="w-6 h-6" style={{ color: "rgba(30,37,53,0.35)" }} />
                )}
                <span className="text-sm font-semibold" style={{ color: fileUrl ? "#4a6b10" : "rgba(30,37,53,0.55)" }}>
                  {uploading ? "Uploading..." : fileUrl ? "File uploaded — ready to submit" : "Click to upload PDF or image"}
                </span>
                <span className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>Max recommended size: 10 MB</span>
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
              </label>
              {uploadError && <p className="text-xs mt-2" style={{ color: "#DA6A63" }}>{uploadError}</p>}
            </div>

            {submitError && (
              <p className="text-sm px-4 py-3 rounded-xl" style={{ background: "rgba(218,106,99,0.08)", color: "#DA6A63" }}>
                {submitError}
              </p>
            )}

            <Button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={!fileUrl || uploading || submitMutation.isPending}
              className="font-bold gap-2"
              style={{ background: "#FA6F30", color: "#fff", borderRadius: 12 }}
            >
              {submitMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
              ) : (
                <><Upload className="w-4 h-4" /> Submit CPR/BLS Cert</>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
