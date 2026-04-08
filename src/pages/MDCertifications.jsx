import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award } from "lucide-react";
import { format } from "date-fns";

const statusColor = { active: "bg-green-100 text-green-700", expired: "bg-slate-100 text-slate-500", revoked: "bg-red-100 text-red-700" };

export default function MDCertifications() {
  const { data: relationships = [] } = useQuery({
    queryKey: ["md-relationships"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.MedicalDirectorRelationship.filter({ medical_director_id: me.id });
    },
  });

  const providerIds = new Set(relationships.map(r => r.provider_id));

  const { data: allCerts = [], isLoading } = useQuery({
    queryKey: ["all-certs-for-md"],
    queryFn: () => base44.entities.Certification.list("-issued_at"),
    enabled: relationships.length > 0,
  });

  const certs = allCerts.filter(c => providerIds.has(c.provider_id));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Provider Certifications</h2>
        <p className="text-slate-500 text-sm mt-1">{certs.length} certifications across your providers</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <Card key={i} className="h-20 animate-pulse bg-slate-100" />)}</div>
      ) : certs.length === 0 ? (
        <div className="text-center py-16">
          <Award className="w-12 h-12 mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400">No certifications for your providers yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {certs.map(c => (
            <Card key={c.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <Award className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{c.certification_name}</span>
                      <Badge className={statusColor[c.status] || "bg-slate-100 text-slate-600"}>{c.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-500">{c.provider_name || c.provider_email}</p>
                    <div className="flex gap-3 text-xs text-slate-400 mt-1">
                      <span>#{c.certificate_number}</span>
                      {c.issued_at && <span>Issued {format(new Date(c.issued_at), "MMM d, yyyy")}</span>}
                      {c.expires_at && <span>Expires {format(new Date(c.expires_at), "MMM d, yyyy")}</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}