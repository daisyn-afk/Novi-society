import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { adminApiRequest } from "@/api/adminApiRequest";
import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, CheckCircle, XCircle, FileText, ExternalLink, Award, Plus } from "lucide-react";
import { format } from "date-fns";
import { issueCourseCertification } from "@/lib/issueCourseCertification";
import {
  CERTIFICATE_EXPIRATION_DATE,
  CERTIFICATE_EXPIRATION_NEVER,
  validateCertificateIssueForm,
} from "@/lib/certificateIssueForm";
import CertificateSignaturePad from "@/components/admin/CertificateSignaturePad";
import { hasCertificateDocument, openCertificateDocument } from "@/lib/certificateDocument";
import {
  getCertificationDateMeta,
  isExternalSubmittedCert,
  isExternalUploadedCert,
  isNoviIssuedCert,
  minExpirationDateInputValue,
  resolveCertificationDocumentUrl,
} from "@/lib/certificationBuckets";

const licenseStatusColor = {
  pending_review: "bg-yellow-100 text-yellow-700",
  verified: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-slate-100 text-slate-600",
};

const certStatusColor = { active: "bg-green-100 text-green-700", expired: "bg-slate-100 text-slate-500", revoked: "bg-red-100 text-red-700", pending: "bg-yellow-100 text-yellow-700" };
const normalizePossibleUrl = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (value.toUpperCase() === "N/A" || value === "/N/A") return null;
  const cleaned = value.replace(/[),.;]+$/g, "");
  if (cleaned.toUpperCase() === "N/A" || cleaned === "/N/A") return null;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (cleaned.startsWith("//")) return `https:${cleaned}`;
  if (cleaned.startsWith("/")) return cleaned;
  if (/^[\w.-]+\//.test(cleaned) || cleaned.startsWith("storage/")) return `/${cleaned.replace(/^\/+/, "")}`;
  return null;
};
const extractTextFromJsonish = (raw) => {
  if (!raw || typeof raw !== "string") return [];
  const text = raw.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "string") return [parsed];
    if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === "string");
    if (parsed && typeof parsed === "object") return Object.values(parsed).filter((v) => typeof v === "string");
  } catch {
    return [];
  }
  return [];
};
const extractSubmitterFromNotes = (notes) => {
  const text = String(notes || "");
  const tagged = text.match(/\[submitter\]\s*name=([^;]+);\s*email=([^;]+);\s*id=([^\n]+)/i);
  if (!tagged) return null;
  return {
    name: String(tagged[1] || "").trim(),
    email: String(tagged[2] || "").trim(),
    id: String(tagged[3] || "").trim(),
  };
};
const extractDocumentUrl = (cert) => {
  const directUrl =
    normalizePossibleUrl(cert?.certificate_url) ||
    normalizePossibleUrl(cert?.certification_url) ||
    normalizePossibleUrl(cert?.certification_file_url) ||
    normalizePossibleUrl(cert?.document_url) ||
    normalizePossibleUrl(cert?.file_url) ||
    normalizePossibleUrl(cert?.attachment_url);
  if (directUrl) return directUrl;
  const notes = String(cert?.notes || "");
  const taggedUrl = notes.match(/(?:Certificate|License)\s+document:\s*(https?:\/\/\S+)/i)?.[1];
  if (taggedUrl) return normalizePossibleUrl(taggedUrl);
  const firstUrl = notes.match(/https?:\/\/\S+/i)?.[0];
  const notesUrl = normalizePossibleUrl(firstUrl);
  if (notesUrl) return notesUrl;

  // Last-resort scan: any URL-like value in the record payload, including JSON-ish text fields.
  for (const value of Object.values(cert || {})) {
    const candidates = [];
    if (typeof value === "string") {
      candidates.push(value, ...extractTextFromJsonish(value));
    } else if (Array.isArray(value)) {
      candidates.push(...value.filter((v) => typeof v === "string"));
    } else if (value && typeof value === "object") {
      candidates.push(...Object.values(value).filter((v) => typeof v === "string"));
    }
    for (const candidate of candidates) {
      const maybeUrl = normalizePossibleUrl(candidate) || normalizePossibleUrl(String(candidate).match(/https?:\/\/\S+/i)?.[0]);
      if (maybeUrl) return maybeUrl;
    }
  }
  return null;
};
const isLikelyEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

export default function AdminLicenses() {
  const location = useLocation();
  const [licSearch, setLicSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rejectDialog, setRejectDialog] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [certSearch, setCertSearch] = useState("");
  const [issueDialog, setIssueDialog] = useState(null);
  const [issueForm, setIssueForm] = useState({});
  const [hasIssuerSignature, setHasIssuerSignature] = useState(false);
  const [issueError, setIssueError] = useState("");
  const signaturePadRef = useRef(null);
  const [certRejectDialog, setCertRejectDialog] = useState(null);
  const [certRejectReason, setCertRejectReason] = useState("");
  const [activeTab, setActiveTab] = useState("licenses");
  const [focusedSubmission, setFocusedSubmission] = useState({ type: "", id: "" });
  const qc = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const tab = String(params.get("tab") || "").toLowerCase();
    const focusType = String(params.get("focus_type") || "").toLowerCase();
    const focusId = String(params.get("focus_id") || "").trim();
    if (tab === "licenses" || tab === "certifications") {
      setActiveTab(tab);
    }
    setFocusedSubmission({ type: focusType, id: focusId });
  }, [location.search]);

  // --- Licenses ---
  const { data: licenses = [], isLoading: licLoading } = useQuery({
    queryKey: ["licenses"],
    queryFn: () => base44.entities.License.list("-created_date"),
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });
  const { data: usersForNameLookup = [] } = useQuery({
    queryKey: ["users-license-name-lookup"],
    queryFn: async () => {
      const allUsers = [];
      const pageSize = 500;
      for (let page = 1; page <= 20; page += 1) {
        const result = await adminApiRequest(`/admin/users?page=${page}&page_size=${pageSize}`);
        const batch = Array.isArray(result?.data) ? result.data : [];
        allUsers.push(...batch);
        if (batch.length < pageSize) break;
      }
      return allUsers;
    },
  });
  const { data: base44UsersForFallback = [] } = useQuery({
    queryKey: ["users-license-name-lookup-base44"],
    queryFn: () => base44.entities.User.list(),
  });

  const mergedUsersForLookup = [...usersForNameLookup, ...base44UsersForFallback];

  const userNameByEmail = new Map(
    mergedUsersForLookup
      .filter((u) => u?.email)
      .map((u) => [String(u.email).trim().toLowerCase(), u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || null])
  );
  const userNameByAuthUserId = new Map(
    mergedUsersForLookup
      .filter((u) => u?.auth_user_id)
      .map((u) => [String(u.auth_user_id), u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || null])
  );
  const userNameByUserId = new Map(
    mergedUsersForLookup
      .filter((u) => u?.id)
      .map((u) => [String(u.id), u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || null])
  );
  const userEmailByAuthUserId = new Map(
    mergedUsersForLookup
      .filter((u) => u?.auth_user_id)
      .map((u) => [String(u.auth_user_id), String(u.email || "").trim().toLowerCase() || null])
  );
  const userEmailByUserId = new Map(
    mergedUsersForLookup
      .filter((u) => u?.id)
      .map((u) => [String(u.id), String(u.email || "").trim().toLowerCase() || null])
  );

  const resolveProviderName = (cert) => {
    const providerId = String(cert?.provider_id || cert?.user_id || cert?.created_by || cert?.owner_id || "").trim();
    const providerEmail = String(
      cert?.provider_email || cert?.user_email || cert?.submitted_by_email || cert?.created_by_email || cert?.email || ""
    ).trim().toLowerCase();
    const createdByRaw = String(cert?.created_by || "").trim();
    const createdByEmail = isLikelyEmail(createdByRaw) ? createdByRaw.toLowerCase() : "";
    const submitterFromNotes = extractSubmitterFromNotes(cert?.notes);
    const metadataStrings = extractTextFromJsonish(cert?.metadata);
    const metadataName = metadataStrings.find((v) => /[a-z]/i.test(v) && !String(v).includes("@") && !String(v).startsWith("http"));
    const fallbackEmail =
      providerEmail ||
      createdByEmail ||
      String(cert?.provider_email || "").trim().toLowerCase() ||
      String(cert?.created_by_email || "").trim().toLowerCase();
    const fallbackFromEmail = fallbackEmail ? fallbackEmail.split("@")[0].replace(/[._-]+/g, " ").trim() : "";
    return (
      cert?.provider_name_resolved ||
      cert?.provider_name ||
      submitterFromNotes?.name ||
      cert?.submitted_by_name ||
      cert?.created_by_name ||
      cert?.user_name ||
      cert?.name ||
      cert?.full_name ||
      userNameByAuthUserId.get(providerId) ||
      userNameByUserId.get(providerId) ||
      userNameByEmail.get(providerEmail) ||
      userNameByEmail.get(createdByEmail) ||
      userNameByEmail.get(String(cert?.created_by_email || "").trim().toLowerCase()) ||
      submitterFromNotes?.email ||
      metadataName ||
      fallbackFromEmail ||
      (providerId ? `User ${providerId.slice(0, 8)}` : "") ||
      "Unknown Provider"
    );
  };

  const resolveProviderEmail = (cert) => {
    const providerId = String(cert?.provider_id || cert?.user_id || cert?.created_by || cert?.owner_id || "").trim();
    const metadataStrings = extractTextFromJsonish(cert?.metadata);
    const metadataEmail = metadataStrings.find((v) => String(v).includes("@"));
    const submitterFromNotes = extractSubmitterFromNotes(cert?.notes);
    const createdByRaw = String(cert?.created_by || "").trim();
    const createdByEmail = isLikelyEmail(createdByRaw) ? createdByRaw.toLowerCase() : null;
    return (
      cert?.provider_email_resolved ||
      cert?.provider_email ||
      submitterFromNotes?.email ||
      cert?.user_email ||
      cert?.submitted_by_email ||
      cert?.created_by_email ||
      cert?.email ||
      createdByEmail ||
      userEmailByAuthUserId.get(providerId) ||
      userEmailByUserId.get(providerId) ||
      metadataEmail ||
      null
    );
  };
  const licUpdate = useMutation({
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ["licenses"] });
      const previous = qc.getQueryData(["licenses"]);
      qc.setQueryData(["licenses"], (old = []) =>
        (Array.isArray(old) ? old : []).map((row) =>
          row?.id === id ? { ...row, ...(data || {}) } : row
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(["licenses"], context.previous);
    },
    mutationFn: ({ id, data }) => base44.entities.License.update(id, data),
    onSuccess: () => { qc.invalidateQueries(["licenses"]); setRejectDialog(null); setRejectReason(""); },
  });

  const verify = (license) => {
    licUpdate.mutate({ id: license.id, data: { status: "verified", verified_at: new Date().toISOString() } });
    if (license.provider_id) {
      base44.entities.Notification.create({
        user_id: license.provider_id,
        user_email: license.provider_email,
        type: "license_verified",
        message: `Your ${license.license_type} license (${license.license_number}) has been verified!`,
        link_page: "ProviderCredentialsCoverage",
      });
    }
  };

  const reject = () => {
    const license = licenses.find(l => l.id === rejectDialog);
    const trimmedReason = String(rejectReason || "").trim();
    licUpdate.mutate({ id: rejectDialog, data: { status: "rejected", rejection_reason: trimmedReason } });
    if (license?.provider_id) {
      base44.entities.Notification.create({
        user_id: license.provider_id,
        user_email: license.provider_email,
        type: "license_rejected",
        message: `Your ${license.license_type} license was not approved: ${trimmedReason}`,
        link_page: "ProviderCredentialsCoverage",
      });
    }
  };

  const filteredLicenses = licenses.filter(l => {
    const query = licSearch.toLowerCase();
    const matchSearch =
      !query ||
      l.provider_email?.toLowerCase().includes(query) ||
      l.provider_full_name?.toLowerCase().includes(query);
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // --- Certifications ---
  const { data: certs = [], isLoading: certLoading } = useQuery({
    queryKey: ["certifications"],
    queryFn: async () => {
      const result = await adminApiRequest("/admin/certifications");
      if (Array.isArray(result)) return result;
      if (Array.isArray(result?.data)) return result.data;
      return [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: activeTab === "certifications" ? 3000 : false,
  });

  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["enrollments"],
    queryFn: async () => {
      const rows = await base44.entities.Enrollment.list("-created_date");
      return rows.filter((row) => ["attended", "completed"].includes(String(row?.status || "").toLowerCase()));
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: activeTab === "certifications" ? 3000 : false,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: () => base44.entities.Course.list(),
  });

  const normalizedCerts = certs.map((c) => {
    const dateMeta = getCertificationDateMeta(c);
    return {
      ...c,
      status: c?.status || "pending",
      certification_name: c?.certification_name || c?.cert_name || "Certification",
      provider_display_name: resolveProviderName(c),
      provider_display_email: resolveProviderEmail(c),
      certificate_display_number: c?.certificate_number || c?.cert_number || "N/A",
      issued_display_label: dateMeta.label,
      issued_display_at: dateMeta.displayAt,
      is_novi_issued: isNoviIssuedCert(c),
      is_external_submission: isExternalSubmittedCert(c),
      is_external_upload: isExternalUploadedCert(c),
    };
  });

  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));
  const certifiedEnrollmentIds = new Set(
    normalizedCerts
      .filter((c) => String(c?.status || "").toLowerCase() === "active" && c?.enrollment_id)
      .map((c) => c.enrollment_id)
  );
  const pendingCertification = enrollments.filter(e => !certifiedEnrollmentIds.has(e.id));
  const canShowAwaitingCertifications = !certLoading && !enrollmentsLoading && pendingCertification.length > 0;
  const pendingExternalCerts = normalizedCerts.filter((c) => c.is_external_submission);

  const { data: issueIssuer } = useQuery({
    queryKey: ["admin-license-issue-issuer"],
    queryFn: () => base44.auth.me(),
    enabled: !!issueDialog,
    staleTime: 60_000,
  });

  const issue = useMutation({
    mutationFn: async (payload) => {
      const me = issueIssuer || await base44.auth.me();
      return issueCourseCertification({
        enrollment: payload.enrollment,
        course: payload.course,
        issueForm: payload.issueForm,
        issuerName: me?.full_name || "NOVI Society",
        issuerEmail: me?.email || null,
      });
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ["certifications"] });
      const previousCerts = qc.getQueryData(["certifications"]);
      const optimisticId = `optimistic-cert-${Date.now()}`;
      const optimisticCert = {
        id: optimisticId,
        enrollment_id: payload.enrollment.id,
        provider_id: payload.enrollment.provider_id,
        provider_email: payload.enrollment.provider_email,
        provider_name: payload.enrollment.provider_name,
        course_id: payload.enrollment.course_id,
        certification_name: payload.course?.certification_name || payload.course?.title || "Course Certification",
        certificate_number: `NOVI-${Date.now()}`,
        status: "active",
        issued_at: new Date().toISOString(),
        expires_at: payload.issueForm?.expiration_type === "never" ? null : payload.issueForm?.expires_at || null,
      };
      qc.setQueryData(["certifications"], (old = []) => [optimisticCert, ...(Array.isArray(old) ? old : [])]);
      setIssueDialog(null);
      setIssueForm({});
      setHasIssuerSignature(false);
      setIssueError("");
      return { previousCerts };
    },
    onError: (error, payload, context) => {
      if (context?.previousCerts) qc.setQueryData(["certifications"], context.previousCerts);
      if (payload?.enrollment) setIssueDialog(payload.enrollment);
      if (payload?.issueForm) setIssueForm(payload.issueForm);
      setHasIssuerSignature(Boolean(payload?.issueForm?.issuer_signature_data));
      setIssueError(error?.message || "Unable to issue certificate.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["certifications"] });
      qc.invalidateQueries({ queryKey: ["enrollments"] });
    },
  });

  const revoke = useMutation({
    mutationFn: (id) =>
      adminApiRequest(`/admin/certifications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "revoked" }),
      }),
    onSuccess: () => qc.invalidateQueries(["certifications"]),
  });

  const approveExternalCert = useMutation({
    onMutate: async (cert) => {
      await qc.cancelQueries({ queryKey: ["certifications"] });
      const previous = qc.getQueryData(["certifications"]);
      qc.setQueryData(["certifications"], (old = []) =>
        (Array.isArray(old) ? old : []).map((row) =>
          row?.id === cert?.id
            ? {
              ...row,
              status: "active",
              issued_at: new Date().toISOString(),
              certificate_number: row.certificate_number || `NOVI-EXT-${Date.now()}`,
            }
            : row
        )
      );
      return { previous };
    },
    onError: (_err, _cert, context) => {
      if (context?.previous) qc.setQueryData(["certifications"], context.previous);
    },
    mutationFn: async (cert) => {
      await adminApiRequest(`/admin/certifications/${cert.id}`, {
        method: "PATCH",
        body: JSON.stringify({
        status: "active",
        issued_at: new Date().toISOString(),
        certificate_number: cert.certificate_number || `NOVI-EXT-${Date.now()}`,
        }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["certifications"] }),
  });

  const rejectExternalCert = useMutation({
    onMutate: async ({ cert }) => {
      if (!cert?.id) return { previous: qc.getQueryData(["certifications"]) };
      setCertRejectDialog(null);
      setCertRejectReason("");
      await qc.cancelQueries({ queryKey: ["certifications"] });
      const previous = qc.getQueryData(["certifications"]);
      qc.setQueryData(["certifications"], (old = []) =>
        (Array.isArray(old) ? old : []).map((row) =>
          row?.id === cert?.id
            ? { ...row, status: "revoked" }
            : row
        )
      );
      return { previous };
    },
    onError: (_err, _cert, context) => {
      if (context?.previous) qc.setQueryData(["certifications"], context.previous);
    },
    mutationFn: async ({ cert, reason }) => {
      if (!cert?.id) throw new Error("No certification selected for rejection.");
      await adminApiRequest(`/admin/certifications/${cert.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "revoked", rejection_reason: String(reason || "").trim() || null }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certifications"] });
    },
  });
  const matchesCertSearch = (c) => {
    const q = String(certSearch || "").toLowerCase();
    if (!q) return true;
    return String(c.provider_display_name || "").toLowerCase().includes(q)
      || String(c.provider_display_email || "").toLowerCase().includes(q)
      || String(c.certification_name || "").toLowerCase().includes(q);
  };
  const filteredCerts = normalizedCerts.filter(matchesCertSearch);
  const noviIssuedCerts = filteredCerts.filter((c) => c.is_novi_issued);
  const externalCerts = filteredCerts.filter((c) => c.is_external_upload);
  const otherCerts = filteredCerts.filter((c) => !c.is_novi_issued && !c.is_external_upload);
  const fallbackFocusedLicenseId =
    focusedSubmission.type === "license" && !focusedSubmission.id
      ? String(
        (licenses || []).find((l) => String(l?.status || "").toLowerCase() === "pending_review")?.id || ""
      )
      : "";
  const fallbackFocusedCertificationId =
    focusedSubmission.type === "certification" && !focusedSubmission.id
      ? String(
        (normalizedCerts || []).find((c) => String(c?.status || "").toLowerCase() === "pending")?.id || ""
      )
      : "";
  const effectiveFocusedLicenseId = String(focusedSubmission.id || fallbackFocusedLicenseId || "");
  const effectiveFocusedCertificationId = String(focusedSubmission.id || fallbackFocusedCertificationId || "");
  const isFocusedLicense = (license) =>
    focusedSubmission.type === "license" &&
    String(effectiveFocusedLicenseId || "") === String(license?.id || "") &&
    String(license?.status || "").toLowerCase() === "pending_review";
  const isFocusedCertification = (cert) =>
    focusedSubmission.type === "certification" &&
    String(effectiveFocusedCertificationId || "") === String(cert?.id || "") &&
    String(cert?.status || "").toLowerCase() === "pending";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Licenses & Certifications</h2>
        <p className="text-slate-500 text-sm mt-1">
          {licenses.filter(l => l.status === "pending_review").length} licenses pending · {pendingCertification.length + pendingExternalCerts.length} certs pending
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="licenses" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Licenses
            {licenses.filter(l => l.status === "pending_review").length > 0 && (
              <span className="ml-1 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center bg-amber-100 text-amber-700">
                {licenses.filter(l => l.status === "pending_review").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="certifications" className="gap-1.5">
            <Award className="w-3.5 h-3.5" /> Certifications
            {(pendingCertification.length + pendingExternalCerts.length) > 0 && (
              <span className="ml-1 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center bg-amber-100 text-amber-700">
                {pendingCertification.length + pendingExternalCerts.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* LICENSES TAB */}
        <TabsContent value="licenses" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-9" placeholder="Search by provider..." value={licSearch} onChange={e => setLicSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {licLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="h-20 animate-pulse bg-slate-100" />)}</div>
          ) : (
            <div className="space-y-3">
              {filteredLicenses.map(l => (
                <Card
                  key={l.id}
                  className={isFocusedLicense(l) ? "ring-2 ring-amber-300 border-amber-300 bg-amber-50/40 transition-colors" : ""}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span className="font-semibold text-slate-900">{l.license_type} – {l.license_number}</span>
                          <Badge className={licenseStatusColor[l.status]}>{l.status?.replace("_"," ")}</Badge>
                        </div>
                        <p className="text-sm font-medium text-slate-700 mt-0.5">
                          {l.provider_name ||
                            userNameByAuthUserId.get(String(l.provider_id || "")) ||
                            userNameByEmail.get(String(l.provider_email || "").trim().toLowerCase()) ||
                            "Unknown Provider"}
                        </p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {l.provider_email || "No email on file"}
                          {l.issuing_state ? ` · ${l.issuing_state}` : ""}
                        </p>
                        <div className="flex gap-3 text-xs text-slate-400 mt-1">
                          {l.expiration_date && <span>Expires: {format(new Date(l.expiration_date), "MMM d, yyyy")}</span>}
                          {l.rejection_reason && <span className="text-red-500">Reason: {l.rejection_reason}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {l.document_url && (
                          <a href={l.document_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline"><ExternalLink className="w-3.5 h-3.5 mr-1" />View Doc</Button>
                          </a>
                        )}
                        {l.status === "pending_review" && (
                          <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => verify(l)}>
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Verify
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-500" onClick={() => { setRejectDialog(l.id); setRejectReason(""); }}>
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredLicenses.length === 0 && <p className="text-center text-slate-400 py-10">No licenses found</p>}
            </div>
          )}
        </TabsContent>

        {/* CERTIFICATIONS TAB */}
        <TabsContent value="certifications" className="space-y-4 mt-4">
          {canShowAwaitingCertifications && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4 pb-4">
                <p className="font-semibold text-amber-800 mb-3">Awaiting Certification ({pendingCertification.length})</p>
                <div className="space-y-2">
                  {pendingCertification.map(e => (
                    <div key={e.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-slate-800">{e.provider_name || e.provider_email}</span>
                        <p className="text-xs text-slate-500">{courseMap[e.course_id]?.title}</p>
                      </div>
                      <Button size="sm" style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}
                        onClick={() => {
                          setIssueDialog(e);
                          setIssueForm({ expiration_type: "", expires_at: "", issuer_signature_data: "" });
                          setHasIssuerSignature(false);
                          setIssueError("");
                        }}>
                        <Award className="w-3.5 h-3.5 mr-1" /> Issue Certificate
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search certifications..." value={certSearch} onChange={e => setCertSearch(e.target.value)} />
          </div>

          {certLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="h-20 animate-pulse bg-slate-100" />)}</div>
          ) : (
            <div className="space-y-3">
              {[
                { title: "NOVI Issued Certificates", rows: noviIssuedCerts },
                { title: "External Uploaded Certifications", rows: externalCerts },
                { title: "Other Certifications", rows: otherCerts },
              ].filter((section) => section.rows.length > 0).map((section) => (
                <div key={section.title} className="space-y-3">
                  <p className="text-sm font-semibold text-slate-700">{section.title} ({section.rows.length})</p>
                  {section.rows.map((c) => {
                const canViewCertificate = hasCertificateDocument(c);
                return (
                <Card
                  key={c.id}
                  className={isFocusedCertification(c) ? "ring-2 ring-amber-300 border-amber-300 bg-amber-50/40 transition-colors" : ""}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Award className="w-5 h-5 text-amber-500 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900">{c.certification_name}</span>
                            <Badge className={certStatusColor[c.status]}>{c.status}</Badge>
                          </div>
                          <p className="text-sm text-slate-500">{c.provider_display_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{c.provider_display_email || "No email on file"}</p>
                          {c.service_type_name && (
                            <p className="text-xs text-blue-700 mt-0.5">
                              Applying for: <strong>{c.service_type_name}</strong>
                            </p>
                          )}
                          <div className="flex gap-3 text-xs text-slate-400 mt-1">
                            <span>#{c.certificate_display_number}</span>
                            {c.issued_display_at && <span>{c.issued_display_label} {format(new Date(c.issued_display_at), "MMM d, yyyy")}</span>}
                            {c.expires_at && <span>Expires {format(new Date(c.expires_at), "MMM d, yyyy")}</span>}
                          </div>
                        </div>
                      </div>
                      {String(c.status || "").toLowerCase() === "pending" ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={!canViewCertificate}
                            onClick={() => openCertificateDocument(c)}
                          >
                            <ExternalLink className="w-4 h-4" /> View Certificate
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => approveExternalCert.mutate(c)}
                            disabled={approveExternalCert.isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-500 border-red-200"
                            onClick={() => {
                              setCertRejectDialog(c);
                              setCertRejectReason("");
                            }}
                            disabled={rejectExternalCert.isPending}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : String(c.status || "").toLowerCase() === "active" ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={!canViewCertificate}
                            onClick={() => openCertificateDocument(c)}
                          >
                            <ExternalLink className="w-4 h-4" /> View Certificate
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-500" onClick={() => revoke.mutate(c.id)}>Revoke</Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={!canViewCertificate}
                          onClick={() => openCertificateDocument(c)}
                        >
                          <ExternalLink className="w-4 h-4" /> View Certificate
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )})}
                </div>
              ))}
              {filteredCerts.length === 0 && <p className="text-center text-slate-400 py-10">No certifications found</p>}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Reject License Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject License</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Reason for rejection</Label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explain why..." rows={3} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={reject} disabled={!String(rejectReason || "").trim() || licUpdate.isPending}>
                Reject License
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Issue Certificate Dialog */}
      <Dialog open={!!issueDialog} onOpenChange={() => { setIssueDialog(null); setIssueError(""); setHasIssuerSignature(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Issue Certification</DialogTitle></DialogHeader>
          {issueDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg text-sm">
                <p className="font-medium text-slate-800">{issueDialog.provider_name}</p>
                <p className="text-slate-500">{courseMap[issueDialog.course_id]?.title}</p>
              </div>
              <div>
                <Label>Expiration</Label>
                <Select
                  value={issueForm.expiration_type || ""}
                  onValueChange={(value) => setIssueForm({
                    ...issueForm,
                    expiration_type: value,
                    expires_at: value === CERTIFICATE_EXPIRATION_NEVER ? "" : issueForm.expires_at,
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select expiration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CERTIFICATE_EXPIRATION_DATE}>Expires on a date</SelectItem>
                    <SelectItem value={CERTIFICATE_EXPIRATION_NEVER}>Never expires</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {issueForm.expiration_type === CERTIFICATE_EXPIRATION_DATE && (
                <div>
                  <Label>Expiration Date</Label>
                  <Input
                    type="date"
                    min={minExpirationDateInputValue()}
                    value={issueForm.expires_at || ""}
                    onChange={(e) => setIssueForm({ ...issueForm, expires_at: e.target.value })}
                  />
                </div>
              )}
              <CertificateSignaturePad
                ref={signaturePadRef}
                key={issueDialog.id}
                signerName={issueIssuer?.full_name || "NOVI Society"}
                onChange={({ hasSignature, signatureDataUrl }) => {
                  setHasIssuerSignature(hasSignature);
                  setIssueForm((previous) => ({ ...previous, issuer_signature_data: signatureDataUrl }));
                }}
              />
              {issueError && (
                <p className="text-sm text-red-600">{issueError}</p>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setIssueDialog(null); setIssueError(""); }}>Cancel</Button>
                <Button
                  style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}
                  onClick={() => {
                    const signature = signaturePadRef.current?.captureSignature?.() || {
                      hasSignature: hasIssuerSignature,
                      signatureDataUrl: issueForm.issuer_signature_data,
                    };
                    const nextForm = { ...issueForm, issuer_signature_data: signature.signatureDataUrl };
                    const validationError = validateCertificateIssueForm(nextForm, { hasSignature: signature.hasSignature });
                    if (validationError) {
                      setIssueError(validationError);
                      return;
                    }
                    setIssueError("");
                    issue.mutate({
                      enrollment: issueDialog,
                      course: courseMap[issueDialog.course_id],
                      issueForm: nextForm,
                    });
                  }}
                  disabled={issue.isPending}
                >
                  {issue.isPending ? "Issuing..." : "Issue Certificate"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Certification Dialog */}
      <Dialog open={!!certRejectDialog} onOpenChange={() => setCertRejectDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Certification</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Reason for rejection</Label>
            <Textarea
              value={certRejectReason}
              onChange={e => setCertRejectReason(e.target.value)}
              placeholder="Explain why this certification was rejected..."
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCertRejectDialog(null)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  if (!certRejectDialog) return;
                  rejectExternalCert.mutate({ cert: certRejectDialog, reason: certRejectReason });
                }}
                disabled={!String(certRejectReason || "").trim() || rejectExternalCert.isPending}
              >
                Reject Certification
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}