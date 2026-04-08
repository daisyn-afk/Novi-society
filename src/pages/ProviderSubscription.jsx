import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ProviderLockGate from "@/components/ProviderLockGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, CheckCircle, Zap } from "lucide-react";
import { format } from "date-fns";

const plans = [
  { id: "basic", name: "Basic", price: 49, features: ["Course enrollment", "License management", "Basic certifications"] },
  { id: "professional", name: "Professional", price: 149, features: ["Everything in Basic", "Patient booking", "Priority support", "Custom profile page"] },
  { id: "enterprise", name: "Enterprise", price: 299, features: ["Everything in Professional", "Medical director oversight", "Compliance tracking", "White-label certificates"] },
];

export default function ProviderSubscription() {
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Subscription.filter({ provider_id: me.id });
    },
  });

  const activeSub = subscriptions.find(s => s.status === "active");

  return (
    <ProviderLockGate feature="subscription">
      <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Subscription</h2>
        <p className="text-slate-500 text-sm mt-1">Manage your NOVI subscription plan</p>
      </div>

      {activeSub && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 capitalize">Current Plan: {activeSub.plan}</p>
                <div className="flex gap-3 text-xs text-amber-700 mt-1">
                  <Badge className="bg-amber-200 text-amber-800 capitalize">{activeSub.status}</Badge>
                  {activeSub.current_period_end && (
                    <span>Renews {format(new Date(activeSub.current_period_end), "MMM d, yyyy")}</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {plans.map(plan => {
          const isActive = activeSub?.plan === plan.id;
          return (
            <Card key={plan.id} className={isActive ? "border-2 ring-2" : ""} style={isActive ? { borderColor: "var(--novi-gold)", ringColor: "var(--novi-gold)" } : {}}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  {isActive && <Badge style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}>Current</Badge>}
                </div>
                <p className="text-2xl font-bold text-slate-900">${plan.price}<span className="text-sm font-normal text-slate-500">/mo</span></p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={isActive ? "outline" : "default"}
                  style={!isActive ? { background: "var(--novi-gold)", color: "#1A1A2E" } : {}}
                  disabled={isActive}>
                  {isActive ? "Current Plan" : "Upgrade"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      </div>
    </ProviderLockGate>
  );
}