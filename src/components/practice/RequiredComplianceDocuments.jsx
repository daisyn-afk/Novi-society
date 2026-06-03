import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Shield, AlertTriangle } from "lucide-react";
import ComplianceCertCard from "@/components/practice/ComplianceCertCard.jsx";
import {
  BBP_CERT_NAME,
  BBP_FREE_COURSE_URL,
  CPR_BLS_CERT_NAME,
  isBbpCert,
  isCprBlsCert,
} from "@/lib/complianceCerts";

function GlassInput({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all ${className}`}
      style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535" }}
    />
  );
}

function FieldLabel({ children }) {
  return (
    <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(30,37,53,0.55)" }}>{children}</p>
  );
}

export default function RequiredComplianceDocuments({
  form,
  setForm,
  me,
  focusSection,
  activeServiceIds = new Set(),
}) {
  const sectionRef = useRef(null);
  const f = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const { data: certs = [] } = useQuery({
    queryKey: ["my-certs"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.Certification.filter({ provider_id: u.id });
    },
    enabled: !!me?.id,
  });

  const { data: mdRelationships = [] } = useQuery({
    queryKey: ["my-md-relationships"],
    queryFn: () => base44.entities.MedicalDirectorRelationship.list(),
    enabled: !!me?.id,
  });

  const activeRelationship = mdRelationships.find(
    (r) => String(r.status || "").toLowerCase() === "active"
  );
  const hasActiveMdCoverage = activeServiceIds.size > 0 || Boolean(activeRelationship);
  const mdNameFilled = Boolean(String(form.md_name || "").trim());

  useEffect(() => {
    if (!activeRelationship || mdNameFilled) return;
    setForm((prev) => ({
      ...prev,
      md_name: prev.md_name || activeRelationship.medical_director_name || "",
    }));
  }, [activeRelationship?.id, activeRelationship?.medical_director_name, mdNameFilled, setForm]);

  useEffect(() => {
    if (!focusSection || !sectionRef.current) return;
    if (["cpr_bls", "bloodborne", "md_mpi", "compliance"].includes(focusSection)) {
      sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusSection]);

  return (
    <div ref={sectionRef} className="space-y-4 scroll-mt-24">
      <div className="flex items-start gap-2">
        <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#DA6A63" }} />
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#b91c1c" }}>
            Required Compliance Documents
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(30,37,53,0.5)" }}>
            These documents are required before seeing patients. Upload them here to keep your practice file complete.
          </p>
        </div>
      </div>

      {/* Medical Director (MPI) */}
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
          <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#7B8EC8" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Medical Director (MPI)</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(30,37,53,0.55)" }}>
              Your supervising MD must be listed in your Medical Professional Information profile. NOVI assigns you a
              Board MD when you activate MD Coverage — enter their name and license info below.
            </p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          {activeRelationship?.medical_director_name && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(123,142,200,0.1)", color: "#4a5fa8" }}>
              Assigned Board MD: <strong>{activeRelationship.medical_director_name}</strong>
              {activeRelationship.medical_director_email ? ` · ${activeRelationship.medical_director_email}` : ""}
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldLabel>MD Full Name</FieldLabel>
              <GlassInput
                placeholder="e.g. Dr. Ashley Lane, MD"
                value={form.md_name || ""}
                onChange={(e) => f("md_name", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>MD License Number</FieldLabel>
              <GlassInput
                placeholder="State medical license #"
                value={form.md_license_number || ""}
                onChange={(e) => f("md_license_number", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>MD License State</FieldLabel>
              <GlassInput
                placeholder="TX"
                value={form.md_license_state || ""}
                onChange={(e) => f("md_license_state", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Supervision Agreement Date</FieldLabel>
              <GlassInput
                type="date"
                value={form.supervision_agreement_date || ""}
                onChange={(e) => f("supervision_agreement_date", e.target.value)}
              />
            </div>
          </div>
          {!hasActiveMdCoverage && !mdNameFilled && (
            <div
              className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs leading-relaxed"
              style={{ background: "rgba(250,111,48,0.08)", color: "#c2410c", border: "1px solid rgba(250,111,48,0.2)" }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Required</strong> — activate MD Coverage first to get your assigned Board MD.
              </span>
            </div>
          )}
        </div>
      </div>

      <ComplianceCertCard
        me={me}
        certs={certs}
        config={{
          certName: CPR_BLS_CERT_NAME,
          title: "CPR / BLS Certification",
          description:
            "Current BLS or CPR certification (AHA or Red Cross). Must be renewed every 2 years.",
          filterCert: isCprBlsCert,
        }}
      />

      <ComplianceCertCard
        me={me}
        certs={certs}
        config={{
          certName: BBP_CERT_NAME,
          title: "Bloodborne Pathogens (BBP) Certification",
          description:
            "OSHA Bloodborne Pathogens training completion certificate. Required by federal law. Free 1–2 hour online course available via Red Cross.",
          filterCert: isBbpCert,
          externalLink: {
            href: BBP_FREE_COURSE_URL,
            label: "Take free BBP course →",
          },
        }}
      />

      <p className="text-[11px] text-center" style={{ color: "rgba(30,37,53,0.4)" }}>
        Save your profile below to store MD information. Certificate uploads are submitted for admin review immediately.
      </p>
    </div>
  );
}
