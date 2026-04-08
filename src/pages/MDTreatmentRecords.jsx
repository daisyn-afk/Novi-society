import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import TreatmentRecordsReview from "@/components/md/TreatmentRecordsReview";
import { ClipboardList, ShieldCheck, CreditCard, MapPin, User } from "lucide-react";

export default function MDTreatmentRecords() {
  const [selectedProvider, setSelectedProvider] = useState(null);

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ["md-supervised-providers"],
    queryFn: async () => {
      const me = await base44.auth.me();
      const rels = await base44.entities.MedicalDirectorRelationship.filter({ medical_director_id: me.id, status: "active" });
      if (!rels.length) return [];
      const allUsers = await base44.entities.User.list();
      return rels.map(rel => {
        const user = allUsers.find(u => u.id === rel.provider_id) || {};
        return { ...rel, user };
      });
    },
  });

  const { data: providerDetails } = useQuery({
    queryKey: ["md-provider-details", selectedProvider],
    queryFn: async () => {
      if (!selectedProvider) return null;
      const [licenses, certs, subs] = await Promise.all([
        base44.entities.License.filter({ provider_id: selectedProvider }),
        base44.entities.Certification.filter({ provider_id: selectedProvider }),
        base44.entities.MDSubscription.filter({ provider_id: selectedProvider, status: "active" }),
      ]);
      return { licenses, certs, subs };
    },
    enabled: !!selectedProvider,
  });

  const selectedRel = providers.find(p => p.provider_id === selectedProvider);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>Treatment Records</h1>
        <p className="text-sm mt-1" style={{ color: "#9a8f7e" }}>Review submitted treatment records from your supervised providers</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Provider list */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#9a8f7e" }}>My Providers</p>
          {isLoading && <p className="text-sm text-slate-400">Loading...</p>}
          {!isLoading && providers.length === 0 && <p className="text-sm text-slate-400">No active providers yet.</p>}
          {providers.map(rel => (
            <button
              key={rel.provider_id}
              onClick={() => setSelectedProvider(rel.provider_id === selectedProvider ? null : rel.provider_id)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${selectedProvider === rel.provider_id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
            >
              <p className="font-semibold text-sm" style={{ color: "#243257" }}>{rel.user?.full_name || rel.provider_name}</p>
              <p className="text-xs mt-0.5" style={{ color: "#9a8f7e" }}>{rel.user?.email || rel.provider_email}</p>
            </button>
          ))}
        </div>

        {/* Provider details panel */}
        <div className="lg:col-span-2">
          {selectedProvider && selectedRel ? (
            <Tabs defaultValue="credentials">
              <TabsList className="mb-4">
                <TabsTrigger value="credentials">Credentials</TabsTrigger>
                <TabsTrigger value="memberships">Memberships & Services</TabsTrigger>
                <TabsTrigger value="records">Treatment Records</TabsTrigger>
              </TabsList>

              {/* Credentials Tab */}
              <TabsContent value="credentials" className="space-y-4">
                <Card>
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <p className="font-semibold text-sm" style={{ color: "#243257" }}>Provider Info</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Name</p>
                        <p className="font-medium">{selectedRel.user?.full_name || selectedRel.provider_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Email</p>
                        <p className="font-medium">{selectedRel.user?.email || selectedRel.provider_email}</p>
                      </div>
                      {selectedRel.user?.city && (
                        <div className="flex items-start gap-1 col-span-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm">{[selectedRel.user.city, selectedRel.user.state].filter(Boolean).join(", ")}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                      <p className="font-semibold text-sm" style={{ color: "#243257" }}>Licenses</p>
                    </div>
                    {!providerDetails?.licenses?.length && <p className="text-sm text-slate-400">No licenses on file.</p>}
                    <div className="space-y-2">
                      {providerDetails?.licenses?.map(lic => (
                        <div key={lic.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-slate-50 border border-slate-100">
                          <div>
                            <p className="text-sm font-semibold">{lic.license_type} · {lic.issuing_state}</p>
                            <p className="text-xs text-slate-400">#{lic.license_number} · Exp: {lic.expiration_date}</p>
                          </div>
                          <Badge className={`text-xs border-0 ${lic.status === "verified" ? "bg-green-100 text-green-700" : lic.status === "pending_review" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
                            {lic.status?.replace("_", " ")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                      <p className="font-semibold text-sm" style={{ color: "#243257" }}>Certifications</p>
                    </div>
                    {!providerDetails?.certs?.length && <p className="text-sm text-slate-400">No certifications on file.</p>}
                    <div className="space-y-2">
                      {providerDetails?.certs?.map(cert => (
                        <div key={cert.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-slate-50 border border-slate-100">
                          <div>
                            <p className="text-sm font-semibold">{cert.certification_name}</p>
                            <p className="text-xs text-slate-400">{cert.service_type_name} · Issued: {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString() : "—"}</p>
                          </div>
                          <Badge className={`text-xs border-0 ${cert.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                            {cert.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Memberships Tab */}
              <TabsContent value="memberships" className="space-y-3">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="w-4 h-4 text-slate-400" />
                      <p className="font-semibold text-sm" style={{ color: "#243257" }}>Active MD Memberships</p>
                    </div>
                    {!providerDetails?.subs?.length && <p className="text-sm text-slate-400">No active memberships.</p>}
                    <div className="space-y-2">
                      {providerDetails?.subs?.map(sub => (
                        <div key={sub.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-slate-50 border border-slate-100">
                          <div>
                            <p className="text-sm font-semibold">{sub.service_type_name}</p>
                            <p className="text-xs text-slate-400">Tier {sub.coverage_tier || 1} · ${sub.service_type_monthly_fee || 0}/mo</p>
                          </div>
                          <Badge className="bg-green-100 text-green-700 text-xs border-0">Active</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Treatment Records Tab */}
              <TabsContent value="records">
                <TreatmentRecordsReview />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center rounded-2xl border border-dashed border-slate-200">
              <ClipboardList className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">Select a provider to view their credentials, memberships, and treatment records</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}