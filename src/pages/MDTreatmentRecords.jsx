import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import TreatmentRecordsReview from "@/components/md/TreatmentRecordsReview";
import { ClipboardList, ShieldCheck, CreditCard, MapPin, User } from "lucide-react";

function licenseStatusBadge(status) {
  const value = String(status || "").toLowerCase();
  if (value === "verified") return { label: "Verified", className: "bg-green-100 text-green-700" };
  if (value === "pending_review") return { label: "Pending", className: "bg-amber-100 text-amber-700" };
  if (value === "rejected" || value === "denied") return { label: "Rejected", className: "bg-red-100 text-red-600" };
  return { label: status?.replace(/_/g, " ") || "Unknown", className: "bg-slate-100 text-slate-600" };
}

function certificationStatusBadge(status) {
  const value = String(status || "").toLowerCase();
  if (value === "active" || value === "verified") return { label: "Active", className: "bg-green-100 text-green-700" };
  if (value === "expired") return { label: "Expired", className: "bg-red-100 text-red-600" };
  return { label: status || "Unknown", className: "bg-slate-100 text-slate-600" };
}

export default function MDTreatmentRecords() {
  const [selectedProvider, setSelectedProvider] = useState(null);

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ["md-supervised-providers"],
    queryFn: async () => {
      const me = await base44.auth.me();
      const rels = await base44.entities.MedicalDirectorRelationship.filter({
        medical_director_id: me.id,
        status: "active",
      });
      const byProvider = new Map();
      for (const rel of rels || []) {
        if (!rel.provider_id) continue;
        if (!byProvider.has(rel.provider_id)) {
          byProvider.set(rel.provider_id, rel);
        }
      }
      return Array.from(byProvider.values());
    },
  });

  const { data: providerDetails } = useQuery({
    queryKey: ["md-provider-details", selectedProvider],
    queryFn: async () => {
      if (!selectedProvider) return null;
      const [licenses, certs, subs, profile] = await Promise.all([
        base44.entities.License.filter({ provider_id: selectedProvider }),
        base44.entities.Certification.filter({ provider_id: selectedProvider }),
        base44.entities.MDSubscription.filter({ provider_id: selectedProvider, status: "active" }),
        base44.entities.MedicalDirectorRelationship.getSupervisedProvider(selectedProvider).catch(() => null),
      ]);
      return { licenses, certs, subs, profile };
    },
    enabled: !!selectedProvider,
  });

  const selectedRel = providers.find((p) => p.provider_id === selectedProvider);
  const profile = providerDetails?.profile;
  const displayName = profile?.full_name || selectedRel?.provider_name || selectedRel?.provider_email;
  const displayEmail = profile?.email || selectedRel?.provider_email;
  const locationLabel =
    profile?.location_label ||
    [profile?.city, profile?.state].filter(Boolean).join(", ") ||
    null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>
          Treatment Records
        </h1>
        <p className="text-sm mt-1" style={{ color: "#9a8f7e" }}>
          Review submitted treatment records from your supervised providers
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#9a8f7e" }}>
            My Providers
          </p>
          {isLoading && <p className="text-sm text-slate-400">Loading...</p>}
          {!isLoading && providers.length === 0 && (
            <p className="text-sm text-slate-400">No active providers yet.</p>
          )}
          {providers.map((rel) => (
            <button
              key={rel.provider_id}
              type="button"
              onClick={() => setSelectedProvider(rel.provider_id)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                selectedProvider === rel.provider_id
                  ? "border-blue-300 bg-blue-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <p className="font-semibold text-sm" style={{ color: "#243257" }}>
                {rel.provider_name || rel.provider_email}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#9a8f7e" }}>
                {rel.provider_email}
              </p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selectedProvider && selectedRel ? (
            <Tabs key={selectedProvider} defaultValue="records">
              <TabsList className="mb-4">
                <TabsTrigger value="credentials">Credentials</TabsTrigger>
                <TabsTrigger value="memberships">Memberships & Services</TabsTrigger>
                <TabsTrigger value="records">Treatment Records</TabsTrigger>
              </TabsList>

              <TabsContent value="credentials" className="space-y-4">
                <Card>
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <p className="font-semibold text-sm" style={{ color: "#243257" }}>
                        Provider Info
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Name</p>
                        <p className="font-medium">{displayName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Email</p>
                        <p className="font-medium">{displayEmail}</p>
                      </div>
                      {locationLabel && (
                        <div className="flex items-start gap-1 col-span-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-slate-400 mb-0.5">Location</p>
                            <p className="text-sm font-medium">{locationLabel}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                      <p className="font-semibold text-sm" style={{ color: "#243257" }}>
                        Licenses
                      </p>
                    </div>
                    {!providerDetails?.licenses?.length && (
                      <p className="text-sm text-slate-400">No licenses on file.</p>
                    )}
                    <div className="space-y-2">
                      {providerDetails?.licenses?.map((lic) => {
                        const badge = licenseStatusBadge(lic.status);
                        return (
                          <div
                            key={lic.id}
                            className="flex items-center justify-between rounded-lg px-3 py-2 bg-slate-50 border border-slate-100"
                          >
                            <div>
                              <p className="text-sm font-semibold">
                                {lic.license_type} · {lic.issuing_state}
                              </p>
                              <p className="text-xs text-slate-400">
                                #{lic.license_number} · Exp: {lic.expiration_date}
                              </p>
                            </div>
                            <Badge className={`text-xs border-0 ${badge.className}`}>{badge.label}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                      <p className="font-semibold text-sm" style={{ color: "#243257" }}>
                        Certifications
                      </p>
                    </div>
                    {!providerDetails?.certs?.length && (
                      <p className="text-sm text-slate-400">No certifications on file.</p>
                    )}
                    <div className="space-y-2">
                      {providerDetails?.certs?.map((cert) => {
                        const badge = certificationStatusBadge(cert.status);
                        return (
                          <div
                            key={cert.id}
                            className="flex items-center justify-between rounded-lg px-3 py-2 bg-slate-50 border border-slate-100"
                          >
                            <div>
                              <p className="text-sm font-semibold">
                                {cert.certification_name || cert.cert_name || "Certification"}
                              </p>
                              <p className="text-xs text-slate-400">
                                {cert.service_type_name || cert.service_name || "—"}
                                {cert.issued_at
                                  ? ` · Issued: ${new Date(cert.issued_at).toLocaleDateString()}`
                                  : ""}
                              </p>
                            </div>
                            <Badge className={`text-xs border-0 ${badge.className}`}>{badge.label}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="memberships" className="space-y-3">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="w-4 h-4 text-slate-400" />
                      <p className="font-semibold text-sm" style={{ color: "#243257" }}>
                        Active MD Memberships
                      </p>
                    </div>
                    {!providerDetails?.subs?.length && (
                      <p className="text-sm text-slate-400">No active memberships.</p>
                    )}
                    <div className="space-y-2">
                      {providerDetails?.subs?.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-slate-50 border border-slate-100"
                        >
                          <div>
                            <p className="text-sm font-semibold">{sub.service_type_name}</p>
                            <p className="text-xs text-slate-400">
                              Tier {sub.coverage_tier || 1} · $
                              {Number(sub.service_type_monthly_fee ?? 0).toLocaleString()}/mo
                            </p>
                          </div>
                          <Badge className="bg-green-100 text-green-700 text-xs border-0">Active</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="records">
                <TreatmentRecordsReview providerId={selectedProvider} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center rounded-2xl border border-dashed border-slate-200">
              <ClipboardList className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">
                Select a provider to view their credentials, memberships, and treatment records
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
