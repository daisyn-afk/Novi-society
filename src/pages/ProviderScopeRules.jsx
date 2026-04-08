import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, AlertTriangle, CheckCircle, MapPin, Zap, FileText } from "lucide-react";
import ServiceLockGate from "@/components/ServiceLockGate";

export default function ProviderScopeRules() {
  const [selectedService, setSelectedService] = useState(null);

  const { data: mySubscriptions = [] } = useQuery({
    queryKey: ["my-subscriptions"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.MDSubscription.filter({
        provider_id: me.id,
        status: "active",
      });
    },
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });

  const { data: eligibility = {} } = useQuery({
    queryKey: ["scope-eligibility", selectedService?.id],
    queryFn: async () => {
      if (!selectedService) return {};
      const res = await base44.functions.invoke("validateScopeEligibility", {
        service_type_id: selectedService.id,
      });
      return res.data;
    },
    enabled: !!selectedService,
  });

  const servicesBySubscription = Object.fromEntries(
    mySubscriptions.map(sub => [sub.service_type_id, sub])
  );

  const activeServices = serviceTypes.filter(s => servicesBySubscription[s.id]);

  return (
    <ServiceLockGate feature="scope">
      <div className="space-y-6 max-w-4xl">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Scope of Practice Rules</h2>
          <p className="text-slate-500 text-sm mt-1">
            View the scope rules and limitations for services you're qualified to provide
          </p>
        </div>

        {activeServices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShieldCheck className="w-10 h-10 mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400">No active service subscriptions yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {/* Service List */}
            <div className="space-y-2">
              {activeServices.map(service => {
                const isSelected = selectedService?.id === service.id;
                const sub = servicesBySubscription[service.id];
                return (
                  <button
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-amber-400 bg-amber-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{service.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">
                        {service.category}
                      </p>
                      {sub?.monthly_fee && (
                        <p className="text-xs text-slate-500 mt-1">
                          ${sub.monthly_fee}/mo
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Details Panel */}
            {selectedService && (
              <div className="md:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{selectedService.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Eligibility Status */}
                    {eligibility && (
                      <div>
                        {eligibility.eligible ? (
                          <Alert className="bg-green-50 border-green-200">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <AlertDescription className="text-green-800 text-sm">
                              You are eligible to provide {selectedService.name}
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <Alert variant="destructive">
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription>
                              {eligibility.reason}
                            </AlertDescription>
                          </Alert>
                        )}
                        {eligibility.violations && eligibility.violations.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {eligibility.violations.map((violation, i) => (
                              <div key={i} className="flex gap-2 text-sm text-red-700">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{violation}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Description */}
                    {selectedService.description && (
                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm mb-2">Description</h4>
                        <p className="text-sm text-slate-600">{selectedService.description}</p>
                      </div>
                    )}

                    {/* Allowed Areas */}
                    {eligibility.allowed_areas && eligibility.allowed_areas.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="w-4 h-4 text-slate-500" />
                          <h4 className="font-semibold text-slate-900 text-sm">Allowed Treatment Areas</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {eligibility.allowed_areas.map((area, i) => (
                            <Badge key={i} variant="outline" className="capitalize">
                              {area}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Max Units */}
                    {eligibility.max_units_per_session && (
                      <div className="flex items-start gap-3 bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <Zap className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-blue-900">Maximum Units Per Session</p>
                          <p className="text-sm text-blue-700 mt-1">
                            {eligibility.max_units_per_session} units max
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Scope Rules */}
                    {eligibility.scope_rules && eligibility.scope_rules.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-slate-500" />
                          <h4 className="font-semibold text-slate-900 text-sm">Protocol Rules</h4>
                        </div>
                        <div className="space-y-2">
                          {eligibility.scope_rules.map((rule, i) => (
                            <div key={i} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                              <p className="font-medium text-slate-900 text-sm">{rule.rule_name}</p>
                              {rule.rule_value && (
                                <p className="text-sm text-slate-600 mt-1">
                                  <strong>{rule.rule_value}</strong>
                                  {rule.unit && ` ${rule.unit}`}
                                </p>
                              )}
                              {rule.description && (
                                <p className="text-xs text-slate-500 mt-2">{rule.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Protocol Notes */}
                    {selectedService.protocol_notes && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-amber-900 mb-1">Protocol Notes</p>
                        <p className="text-sm text-amber-800">{selectedService.protocol_notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </ServiceLockGate>
  );
}