import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Award, Search, Plus, ExternalLink, CheckCircle } from "lucide-react";
import { format } from "date-fns";

const statusColor = { active: "bg-green-100 text-green-700", expired: "bg-slate-100 text-slate-500", revoked: "bg-red-100 text-red-700", pending: "bg-yellow-100 text-yellow-700" };
const extractDocumentUrl = (cert) => {
  const directUrl = String(cert?.certificate_url || "").trim();
  if (directUrl && directUrl !== "/N/A" && directUrl.toUpperCase() !== "N/A" && directUrl.toUpperCase() !== "/N/A") return directUrl;
  const notes = String(cert?.notes || "");
  const taggedUrl = notes.match(/(?:Certificate|License)\s+document:\s*(https?:\/\/\S+)/i)?.[1];
  if (taggedUrl) return taggedUrl.trim();
  const firstUrl = notes.match(/https?:\/\/\S+/i)?.[0];
  return firstUrl ? firstUrl.trim() : null;
};

export default function AdminCertifications() {
  const [search, setSearch] = useState("");
  const [issueDialog, setIssueDialog] = useState(null); // enrollment to certify
  const [form, setForm] = useState({});
  const qc = useQueryClient();

  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["certifications"],
    queryFn: () => base44.entities.Certification.list("-created_date"),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments"],
    queryFn: () => base44.entities.Enrollment.filter({ status: "completed" }),
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: () => base44.entities.Course.list(),
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-for-certifications"],
    queryFn: () => base44.entities.User.list(),
  });

  const usersById = new Map(
    users.flatMap((u) => {
      const id = String(u?.id || "").trim();
      const authId = String(u?.auth_user_id || "").trim();
      return [
        ...(id ? [[id, u]] : []),
        ...(authId ? [[authId, u]] : []),
      ];
    })
  );
  const usersByEmail = new Map(
    users
      .map((u) => [String(u?.email || "").trim().toLowerCase(), u])
      .filter(([email]) => !!email)
  );

  const normalizedCerts = certs.map((c) => ({
    ...c,
    status: c?.status || "pending",
    certification_name: c?.certification_name || c?.cert_name || "Certification",
    _resolvedUser:
      usersById.get(String(c?.provider_id || "")) ||
      usersByEmail.get(String(c?.provider_email || "").trim().toLowerCase()) ||
      usersById.get(String(c?.created_by || "")) ||
      usersByEmail.get(String(c?.created_by || "").trim().toLowerCase()) ||
      null,
    provider_name:
      c?.provider_name_resolved ||
      c?.provider_name ||
      (
        usersById.get(String(c?.provider_id || "")) ||
        usersByEmail.get(String(c?.provider_email || "").trim().toLowerCase()) ||
        usersById.get(String(c?.created_by || "")) ||
        usersByEmail.get(String(c?.created_by || "").trim().toLowerCase())
      )?.full_name ||
      [(
        usersById.get(String(c?.provider_id || "")) ||
        usersByEmail.get(String(c?.provider_email || "").trim().toLowerCase()) ||
        usersById.get(String(c?.created_by || "")) ||
        usersByEmail.get(String(c?.created_by || "").trim().toLowerCase())
      )?.first_name, (
        usersById.get(String(c?.provider_id || "")) ||
        usersByEmail.get(String(c?.provider_email || "").trim().toLowerCase()) ||
        usersById.get(String(c?.created_by || "")) ||
        usersByEmail.get(String(c?.created_by || "").trim().toLowerCase())
      )?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      c?.provider_email ||
      (String(c?.created_by || "").includes("@") ? String(c.created_by) : "") ||
      (
        usersById.get(String(c?.provider_id || "")) ||
        usersByEmail.get(String(c?.provider_email || "").trim().toLowerCase()) ||
        usersById.get(String(c?.created_by || "")) ||
        usersByEmail.get(String(c?.created_by || "").trim().toLowerCase())
      )?.email ||
      null,
    provider_email:
      c?.provider_email_resolved ||
      c?.provider_email ||
      (String(c?.created_by || "").includes("@") ? String(c.created_by) : "") ||
      (
        usersById.get(String(c?.provider_id || "")) ||
        usersByEmail.get(String(c?.provider_email || "").trim().toLowerCase()) ||
        usersById.get(String(c?.created_by || "")) ||
        usersByEmail.get(String(c?.created_by || "").trim().toLowerCase())
      )?.email ||
      null,
    document_url: extractDocumentUrl(c),
  }));
  // Pending external certs submitted from another school
  const pendingExternalCerts = normalizedCerts.filter((c) => {
    const status = String(c?.status || "").toLowerCase();
    const isExternal = Boolean(c?.certificate_url || c?.service_type_id || c?.issued_by);
    return status === "pending" && isExternal;
  });

  const certifiedEnrollmentIds = new Set(normalizedCerts.map(c => c.enrollment_id));
  const pendingCertification = enrollments.filter(e => !certifiedEnrollmentIds.has(e.id));
  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));

  const issue = useMutation({
    mutationFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Certification.create({
        provider_id: issueDialog.provider_id,
        provider_email: issueDialog.provider_email,
        provider_name: issueDialog.provider_name,
        course_id: issueDialog.course_id,
        enrollment_id: issueDialog.id,
        certification_name: form.certification_name || courseMap[issueDialog.course_id]?.certification_name,
        category: courseMap[issueDialog.course_id]?.category,
        issued_by: me.full_name,
        issued_by_email: me.email,
        issued_at: new Date().toISOString(),
        expires_at: form.expires_at,
        certificate_number: `NOVI-${Date.now()}`,
        status: "active",
      });
    },
    onSuccess: () => { qc.invalidateQueries(["certifications"]); setIssueDialog(null); setForm({}); },
  });

  const revoke = useMutation({
    mutationFn: (id) => base44.entities.Certification.update(id, { status: "revoked" }),
    onSuccess: () => qc.invalidateQueries(["certifications"]),
  });

  const approveExternalCert = useMutation({
    mutationFn: async (cert) => {
      const me = await base44.auth.me();
      await base44.entities.Certification.update(cert.id, {
        status: "active",
        issued_at: new Date().toISOString(),
        issued_by_email: me.email,
        certificate_number: cert.certificate_number || `NOVI-EXT-${Date.now()}`,
      });
      // Notify provider to complete MD coverage for this service
      await base44.entities.Notification.create({
        user_id: cert.provider_id,
        user_email: cert.provider_email,
        type: "cert_awarded",
        message: `Your ${cert.certification_name} certification has been approved! Complete your MD coverage application for ${cert.service_type_name || "this service"} to start offering it.`,
        link_page: `ProviderCredentialsCoverage?prompt_service=${cert.service_type_id}`,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["certifications"] }),
  });

  const rejectExternalCert = useMutation({
    mutationFn: (id) => base44.entities.Certification.update(id, { status: "revoked" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["certifications"] }),
  });

  const filtered = normalizedCerts.filter(c => !search || c.provider_name?.toLowerCase().includes(search.toLowerCase()) || c.provider_email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Certifications</h2>
        <p className="text-slate-500 text-sm mt-1">{certs.length} certifications issued</p>
      </div>

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
                    onClick={() => { setIssueDialog(e); setForm({ certification_name: courseMap[e.course_id]?.certification_name || "" }); }}>
                    <Award className="w-3.5 h-3.5 mr-1" /> Issue Certificate
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pendingExternalCerts.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-4">
            <p className="font-semibold text-blue-800 mb-3">External Certifications Pending Review ({pendingExternalCerts.length})</p>
            <div className="space-y-2">
              {pendingExternalCerts.map(c => (
                <div key={c.id} className="bg-white rounded-lg px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{c.provider_name || "Unknown Provider"}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{c.provider_email || "No email on record"}</p>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        <p><strong>Certification:</strong> {c.certification_name}</p>
                        <p><strong>Issuing School:</strong> {c.issued_by || "N/A"}</p>
                        <p><strong>Service Applying For:</strong> {c.service_type_name || "Not selected"}</p>
                        <p><strong>Status:</strong> {String(c.status || "pending").replaceAll("_", " ")}</p>
                        {c.category && <p><strong>License Type:</strong> {String(c.category).toUpperCase()}</p>}
                        {(c.created_date || c.created_at || c.issued_at) && (
                          <p>
                            <strong>Submitted:</strong>{" "}
                            {format(new Date(c.created_date || c.created_at || c.issued_at), "MMM d, yyyy h:mm a")}
                          </p>
                        )}
                      </div>
                      {c.notes && <p className="text-xs text-slate-400 mt-1">{c.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.document_url && (
                        <a href={c.document_url} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                            <ExternalLink className="w-3 h-3" /> View
                          </Button>
                        </a>
                      )}
                      {String(c.notes || "").includes("License document: ") && (
                        <a href={String(c.notes).split("License document: ")[1]?.trim()} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                            <ExternalLink className="w-3 h-3" /> View License
                          </Button>
                        </a>
                      )}
                      <Button size="sm" className="gap-1 h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => approveExternalCert.mutate(c)} disabled={approveExternalCert.isPending}>
                        <CheckCircle className="w-3 h-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs text-red-500 border-red-200"
                        onClick={() => rejectExternalCert.mutate(c.id)} disabled={rejectExternalCert.isPending}>
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input className="pl-9" placeholder="Search certifications..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="h-20 animate-pulse bg-slate-100" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const certificateDocUrl = c.document_url || extractDocumentUrl(c);
            return (
            <Card key={c.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-amber-500 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{c.certification_name}</span>
                        <Badge className={statusColor[c.status]}>{c.status}</Badge>
                      </div>
                      <p className="text-sm text-slate-500">{c.provider_name || c.provider_email}</p>
                      <div className="flex gap-3 text-xs text-slate-400 mt-1">
                        <span>#{c.certificate_number}</span>
                        {c.issued_at && <span>Issued {format(new Date(c.issued_at), "MMM d, yyyy")}</span>}
                        {c.expires_at && <span>Expires {format(new Date(c.expires_at), "MMM d, yyyy")}</span>}
                      </div>
                    </div>
                  </div>
                  {String(c.status || "").toLowerCase() === "pending" && (
                    <div className="flex items-center gap-2">
                      {certificateDocUrl && (
                        <a href={certificateDocUrl} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                            <ExternalLink className="w-3 h-3" /> View
                          </Button>
                        </a>
                      )}
                      <Button
                        size="sm"
                        className="gap-1 h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => approveExternalCert.mutate(c)}
                        disabled={approveExternalCert.isPending}
                      >
                        <CheckCircle className="w-3 h-3" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-7 text-xs text-red-500 border-red-200"
                        onClick={() => rejectExternalCert.mutate(c.id)}
                        disabled={rejectExternalCert.isPending}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                  {String(c.status || "").toLowerCase() !== "pending" && certificateDocUrl && (
                    <a href={certificateDocUrl} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                        <ExternalLink className="w-3 h-3" /> View
                      </Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )})}
          {filtered.length === 0 && <p className="text-center text-slate-400 py-10">No certifications found</p>}
        </div>
      )}

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
                <Input value={form.certification_name || ""} onChange={e => setForm({ ...form, certification_name: e.target.value })} />
              </div>
              <div>
                <Label>Expiration Date (optional)</Label>
                <Input type="date" value={form.expires_at || ""} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
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