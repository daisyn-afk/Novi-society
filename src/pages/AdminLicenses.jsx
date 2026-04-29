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
      const result = await adminApiRequest("/admin/users?page=1&page_size=500");
      return Array.isArray(result?.data) ? result.data : [];
    },
  });

  const userNameByEmail = new Map(
    usersForNameLookup
      .filter((u) => u?.email)
      .map((u) => [String(u.email).trim().toLowerCase(), u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || null])
  );
  const userNameByAuthUserId = new Map(
    usersForNameLookup
      .filter((u) => u?.auth_user_id)
      .map((u) => [String(u.auth_user_id), u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || null])
  );

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
    const matchSearch = !licSearch || l.provider_email?.toLowerCase().includes(licSearch.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // --- Certifications ---
  const { data: certs = [], isLoading: certLoading } = useQuery({
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

  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));
  const certifiedEnrollmentIds = new Set(certs.map(c => c.enrollment_id));
  const pendingCertification = enrollments.filter(e => !certifiedEnrollmentIds.has(e.id));
  const pendingExternalCerts = certs.filter(c => c.status === "pending" && c.issued_by && c.issued_by !== "NOVI Platform");

  const issue = useMutation({
    mutationFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Certification.create({
        provider_id: issueDialog.provider_id,
        provider_email: issueDialog.provider_email,
        provider_name: issueDialog.provider_name,
        course_id: issueDialog.course_id,
        enrollment_id: issueDialog.id,
        certification_name: issueForm.certification_name || courseMap[issueDialog.course_id]?.certification_name,
        category: courseMap[issueDialog.course_id]?.category,
        issued_by: me.full_name,
        issued_by_email: me.email,
        issued_at: new Date().toISOString(),
        expires_at: issueForm.expires_at,
        certificate_number: `NOVI-${Date.now()}`,
        status: "active",
      });
    },
    onSuccess: () => { qc.invalidateQueries(["certifications"]); setIssueDialog(null); setIssueForm({}); },
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
    mutationFn: (id) => base44.entities.Certification.update(id, { status: "revoked" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["certifications"] }),
  });

  const filteredCerts = certs.filter(c => !certSearch || c.provider_name?.toLowerCase().includes(certSearch.toLowerCase()) || c.provider_email?.toLowerCase().includes(certSearch.toLowerCase()));

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

          {pendingExternalCerts.length > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4 pb-4">
                <p className="font-semibold text-blue-800 mb-3">External Certifications Pending Review ({pendingExternalCerts.length})</p>
                <div className="space-y-2">
                  {pendingExternalCerts.map(c => (
                    <div key={c.id} className="bg-white rounded-lg px-4 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{c.provider_name || c.provider_email}</p>
                          <p className="text-xs text-slate-500 mt-0.5"><strong>{c.certification_name}</strong> — from {c.issued_by}</p>
                          {c.service_type_name && <p className="text-xs text-blue-700 mt-0.5">Applying for: <strong>{c.service_type_name}</strong></p>}
                          {c.notes && <p className="text-xs text-slate-400 mt-0.5">{c.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {c.certificate_url && (
                            <a href={c.certificate_url} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"><ExternalLink className="w-3 h-3" /> View</Button>
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
            <Input className="pl-9" placeholder="Search certifications..." value={certSearch} onChange={e => setCertSearch(e.target.value)} />
          </div>

          {certLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="h-20 animate-pulse bg-slate-100" />)}</div>
          ) : (
            <div className="space-y-3">
              {filteredCerts.map(c => (
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
                          <p className="text-sm text-slate-500">{c.provider_name || c.provider_email}</p>
                          <div className="flex gap-3 text-xs text-slate-400 mt-1">
                            <span>#{c.certificate_number}</span>
                            {c.issued_at && <span>Issued {format(new Date(c.issued_at), "MMM d, yyyy")}</span>}
                            {c.expires_at && <span>Expires {format(new Date(c.expires_at), "MMM d, yyyy")}</span>}
                          </div>
                        </div>
                      </div>
                      {c.status === "active" && (
                        <Button size="sm" variant="outline" className="text-red-500" onClick={() => revoke.mutate(c.id)}>Revoke</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
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