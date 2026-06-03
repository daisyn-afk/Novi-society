import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Award, CheckCircle, ExternalLink, FileText, Loader2, Upload,
} from "lucide-react";
import {
  hasCertificateDocument,
  openCertificateDocument,
} from "@/lib/certificateDocument";

const STATUS = {
  active: { label: "Verified", bg: "rgba(200,230,60,0.15)", color: "#4a6b10", border: "rgba(200,230,60,0.4)" },
  pending: { label: "Under Review", bg: "rgba(250,111,48,0.1)", color: "#FA6F30", border: "rgba(250,111,48,0.25)" },
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

function ExistingCertRow({ cert, displayName }) {
  const cfg = STATUS[String(cert.status || "pending").toLowerCase()] || STATUS.pending;
  const canView = hasCertificateDocument(cert);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(30,37,53,0.1)" }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg }}>
        <Award className="w-4 h-4" style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: "#1e2535" }}>
          {cert.certification_name || displayName}
        </p>
        {cert.issued_by && (
          <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>Issued by {cert.issued_by}</p>
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

/**
 * @param {{ me: object, certs: object[], config: { certName: string, title: string, description: string, filterCert: (c) => boolean, externalLink?: { href: string, label: string } } }} props
 */
export default function ComplianceCertCard({ me, certs = [], config }) {
  const qc = useQueryClient();
  const [issuedBy, setIssuedBy] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const matching = certs.filter(config.filterCert);
  const hasPending = matching.some((c) => String(c.status || "").toLowerCase() === "pending");
  const hasActive = matching.some((c) => String(c.status || "").toLowerCase() === "active");

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
      if (!fileUrl) throw new Error("Please upload your certificate file.");
      const u = await base44.auth.me();
      return base44.entities.Certification.create({
        provider_id: u.id,
        provider_email: u.email,
        provider_name: u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.email,
        certification_name: config.certName,
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
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.5)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.75)",
        boxShadow: "0 2px 12px rgba(30,37,53,0.06)",
      }}
    >
      <div className="px-6 py-4 flex items-start gap-3" style={{ borderBottom: "1px solid rgba(30,37,53,0.07)" }}>
        <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "rgba(30,37,53,0.45)" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{config.title}</p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(30,37,53,0.55)" }}>{config.description}</p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {matching.length > 0 && (
          <div className="space-y-2">
            {matching.map((cert) => (
              <ExistingCertRow key={cert.id} cert={cert} displayName={config.certName} />
            ))}
          </div>
        )}

        {hasActive ? (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(200,230,60,0.12)", color: "#4a6b10", border: "1px solid rgba(200,230,60,0.25)" }}
          >
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Certificate on file.
          </div>
        ) : hasPending ? (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: "rgba(250,111,48,0.08)", color: "#c2410c", border: "1px solid rgba(250,111,48,0.2)" }}
          >
            <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
            Upload under review — you will be notified once verified.
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

            <label
              className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl cursor-pointer transition-all hover:opacity-90"
              style={{
                background: fileUrl ? "rgba(200,230,60,0.08)" : "rgba(255,255,255,0.65)",
                border: `2px dashed ${fileUrl ? "rgba(200,230,60,0.5)" : "rgba(30,37,53,0.15)"}`,
              }}
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#FA6F30" }} />
              ) : fileUrl ? (
                <CheckCircle className="w-5 h-5" style={{ color: "#4a6b10" }} />
              ) : (
                <Upload className="w-5 h-5" style={{ color: "rgba(30,37,53,0.35)" }} />
              )}
              <span className="text-sm font-semibold" style={{ color: fileUrl ? "#4a6b10" : "rgba(30,37,53,0.55)" }}>
                {uploading ? "Uploading…" : fileUrl ? "File ready" : "Upload Certificate (PDF/JPG)"}
              </span>
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
            </label>
            {uploadError && <p className="text-xs" style={{ color: "#DA6A63" }}>{uploadError}</p>}

            {submitError && (
              <p className="text-sm px-4 py-3 rounded-xl" style={{ background: "rgba(218,106,99,0.08)", color: "#DA6A63" }}>
                {submitError}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => submitMutation.mutate()}
                disabled={!fileUrl || uploading || submitMutation.isPending}
                className="gap-2 font-semibold"
                style={{ borderColor: "rgba(250,111,48,0.45)", color: "#FA6F30" }}
              >
                {submitMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                ) : (
                  <><Upload className="w-4 h-4" /> Submit for Review</>
                )}
              </Button>
              {config.externalLink && (
                <a
                  href={config.externalLink.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold hover:underline"
                  style={{ color: "#7B8EC8" }}
                >
                  {config.externalLink.label}
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
