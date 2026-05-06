import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { adminApiRequest } from "@/api/adminApiRequest";
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
  const [licSearch, setLicSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rejectDialog, setRejectDialog] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [certSearch, setCertSearch] = useState("");
  const [issueDialog, setIssueDialog] = useState(null);
  const [issueForm, setIssueForm] = useState({});
  const qc = useQueryClient();

  // --- Licenses ---
  const { data: licenses = [], isLoading: licLoading } = useQuery({
    queryKey: ["licenses"],
    queryFn: () => base44.entities.License.list("-created_date"),
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
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments"],
    queryFn: () => base44.entities.Enrollment.filter({ status: "completed" }),
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: () => base44.entities.Course.list(),
  });

  const normalizedCerts = certs.map((c) => ({
    ...c,
    status: c?.status || "pending",
    certification_name: c?.certification_name || c?.cert_name || "Certification",
    provider_display_name: resolveProviderName(c),
    provider_display_email: resolveProviderEmail(c),
    certificate_display_number: c?.certificate_number || c?.cert_number || "N/A",
    // Pending submissions show submission timestamp; approved certs keep issued_at.
    issued_display_at: c?.issued_at || c?.submitted_at || c?.created_date || c?.created_at || null,
  }));

  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));
  const certifiedEnrollmentIds = new Set(normalizedCerts.map(c => c.enrollment_id));
  const pendingCertification = enrollments.filter(e => !certifiedEnrollmentIds.has(e.id));
  const pendingExternalCerts = normalizedCerts.filter((c) => {
    const status = String(c?.status || "").toLowerCase();
    const isExternal = Boolean(extractDocumentUrl(c) || c?.service_type_id || c?.issued_by);
    return status === "pending" && isExternal;
  });

  const issue = useMutation({
    mutationFn: async () => {
      return adminApiRequest("/admin/certifications", {
        method: "POST",
        body: JSON.stringify({
        provider_id: issueDialog.provider_id,
        provider_email: issueDialog.provider_email,
        provider_name: issueDialog.provider_name,
        course_id: issueDialog.course_id,
        enrollment_id: issueDialog.id,
        certification_name: issueForm.certification_name || courseMap[issueDialog.course_id]?.certification_name,
        category: courseMap[issueDialog.course_id]?.category,
        issued_by: "NOVI Platform",
        issued_at: new Date().toISOString(),
        expires_at: issueForm.expires_at,
        certificate_number: `NOVI-${Date.now()}`,
        status: "active",
        }),
      });
    },
    onSuccess: () => { qc.invalidateQueries(["certifications"]); setIssueDialog(null); setIssueForm({}); },
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
    mutationFn: async (cert) => {
      await adminApiRequest(`/admin/certifications/${cert.id}`, {
        method: "PATCH",
        body: JSON.stringify({
        status: "active",
        issued_at: new Date().toISOString(),
        certificate_number: cert.certificate_number || `NOVI-EXT-${Date.now()}`,
        }),
      });
      await base44.entities.Notification.create({
        user_id: cert.provider_id,
        user_email: cert.provider_email,
        type: "cert_awarded",
        message: `Your ${cert.certification_name} certification has been approved!`,
        link_page: `ProviderCredentialsCoverage?prompt_service=${cert.service_type_id}`,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["certifications"] }),
  });

  const rejectExternalCert = useMutation({
    mutationFn: (id) =>
      adminApiRequest(`/admin/certifications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "revoked" }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["certifications"] }),
  });
  const filteredCerts = normalizedCerts.filter((c) => {
    const q = String(certSearch || "").toLowerCase();
    if (!q) return true;
    return String(c.provider_display_name || "").toLowerCase().includes(q) || String(c.provider_display_email || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Licenses & Certifications</h2>
        <p className="text-slate-500 text-sm mt-1">
          {licenses.filter(l => l.status === "pending_review").length} licenses pending · {pendingCertification.length + pendingExternalCerts.length} certs pending
        </p>
      </div>

      <Tabs defaultValue="licenses">
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
                <Card key={l.id}>
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
          {pendingCertification.length > 0 && (
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
                        onClick={() => { setIssueDialog(e); setIssueForm({ certification_name: courseMap[e.course_id]?.certification_name || "" }); }}>
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
              {filteredCerts.map(c => {
                const certificateDocUrl = extractDocumentUrl(c);
                return (
                <Card key={c.id}>
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
                            {c.issued_display_at && <span>Submitted {format(new Date(c.issued_display_at), "MMM d, yyyy")}</span>}
                            {c.expires_at && <span>Expires {format(new Date(c.expires_at), "MMM d, yyyy")}</span>}
                          </div>
                        </div>
                      </div>
                      {String(c.status || "").toLowerCase() === "pending" ? (
                        <div className="flex items-center gap-2">
                          {certificateDocUrl ? (
                            <a href={certificateDocUrl} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline" className="gap-1">
                                <ExternalLink className="w-4 h-4" /> View Certificate
                              </Button>
                            </a>
                          ) : (
                            <Button size="sm" variant="outline" className="gap-1" disabled>
                              <ExternalLink className="w-4 h-4" /> View Certificate
                            </Button>
                          )}
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
                            onClick={() => rejectExternalCert.mutate(c.id)}
                            disabled={rejectExternalCert.isPending}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : String(c.status || "").toLowerCase() === "active" ? (
                        <div className="flex items-center gap-2">
                          {certificateDocUrl ? (
                            <a href={certificateDocUrl} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline" className="gap-1">
                                <ExternalLink className="w-4 h-4" /> View Certificate
                              </Button>
                            </a>
                          ) : (
                            <Button size="sm" variant="outline" className="gap-1" disabled>
                              <ExternalLink className="w-4 h-4" /> View Certificate
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="text-red-500" onClick={() => revoke.mutate(c.id)}>Revoke</Button>
                        </div>
                      ) : (
                        certificateDocUrl ? (
                          <a href={certificateDocUrl} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="gap-1">
                              <ExternalLink className="w-4 h-4" /> View Certificate
                            </Button>
                          </a>
                        ) : (
                          <Button size="sm" variant="outline" className="gap-1" disabled>
                            <ExternalLink className="w-4 h-4" /> View Certificate
                          </Button>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              )})}
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
      <Dialog open={!!issueDialog} onOpenChange={() => setIssueDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Issue Certification</DialogTitle></DialogHeader>
          {issueDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg text-sm">
                <p className="font-medium text-slate-800">{issueDialog.provider_name}</p>
                <p className="text-slate-500">{courseMap[issueDialog.course_id]?.title}</p>
              </div>
              <div>
                <Label>Certificate Name</Label>
                <Input value={issueForm.certification_name || ""} onChange={e => setIssueForm({ ...issueForm, certification_name: e.target.value })} />
              </div>
              <div>
                <Label>Expiration Date (optional)</Label>
                <Input type="date" value={issueForm.expires_at || ""} onChange={e => setIssueForm({ ...issueForm, expires_at: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIssueDialog(null)}>Cancel</Button>
                <Button style={{ background: "var(--novi-gold)", color: "#1A1A2E" }} onClick={() => issue.mutate()} disabled={issue.isPending}>
                  Issue Certificate
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}