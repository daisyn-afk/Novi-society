import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, CheckCircle2, AlertTriangle, Calendar } from "lucide-react";
import { format, differenceInMonths } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProviderLockGate from "@/components/ProviderLockGate";

export default function ProviderMDRelationships() {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: relationships = [] } = useQuery({
    queryKey: ["my-md-relationships"],
    queryFn: async () => {
      if (!me) return [];
      return base44.entities.MedicalDirectorRelationship.filter({
        provider_id: me.id,
      });
    },
    enabled: !!me,
  });

  const activeRelationships = relationships.filter(r => r.status === "active");
  const suspendedRelationships = relationships.filter(r => r.status === "suspended");

  return (
    <ProviderLockGate>
      <div className="space-y-6 max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Medical Director Supervision</h2>
            <p className="text-slate-500 text-sm mt-1">
              NOVI assigns Board medical directors automatically when you activate coverage — you do not request or choose an MD here.
            </p>
          </div>
          <Button asChild style={{ background: "#FA6F30", color: "#fff" }}>
            <Link to={createPageUrl("ProviderCredentialsCoverage")}>Credentials &amp; Coverage</Link>
          </Button>
        </div>

        <Alert className="border-slate-200 bg-slate-50">
          <Shield className="h-4 w-4 text-slate-600" />
          <AlertDescription className="text-slate-700 text-sm">
            When you complete MD coverage checkout for a service, the platform links you to a supervising physician from the NOVI pool for that service. If you already have an active supervisor who covers your new service, that relationship is reused.
          </AlertDescription>
        </Alert>

        {suspendedRelationships.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You have {suspendedRelationships.length} suspended supervision relationship(s). Contact NOVI support or your supervising physician.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Active Supervision ({activeRelationships.length})
          </h3>

          {activeRelationships.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Shield className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                <p className="text-slate-600 text-sm max-w-md mx-auto mb-4">
                  Activate MD coverage under Credentials &amp; Coverage to be assigned a NOVI Board medical director.
                </p>
                <Button asChild variant="outline">
                  <Link to={createPageUrl("ProviderCredentialsCoverage")}>Go to Credentials &amp; Coverage</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeRelationships.map(rel => {
                const monthsSupervised = rel.start_date
                  ? differenceInMonths(new Date(), new Date(rel.start_date))
                  : 0;

                return (
                  <Card key={rel.id}>
                    <CardContent className="py-4">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900">{rel.medical_director_name}</h4>
                            <p className="text-sm text-slate-500">{rel.medical_director_email}</p>
                          </div>
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500">Supervision Since</p>
                            <p className="font-semibold text-slate-900">
                              {rel.start_date ? format(new Date(rel.start_date), "MMM d, yyyy") : "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Duration</p>
                            <p className="font-semibold text-slate-900">{monthsSupervised} months</p>
                          </div>
                        </div>

                        {rel.supervision_notes && (
                          <div className="bg-blue-50 rounded p-3 border border-blue-200">
                            <p className="text-xs text-blue-900 font-medium mb-1">Supervisor Notes</p>
                            <p className="text-sm text-blue-800">{rel.supervision_notes}</p>
                          </div>
                        )}

                        {rel.last_review_date && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Calendar className="w-4 h-4" />
                            Last review: {format(new Date(rel.last_review_date), "MMM d, yyyy")}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProviderLockGate>
  );
}
