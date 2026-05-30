import { Input } from "@/components/ui/input";
import { Zap, Globe } from "lucide-react";
import FieldLabel from "../shared/FieldLabel";
import InfoBanner from "../shared/InfoBanner";

export default function ApplicationRoutingSection({ form, update }) {
  return (
    <>
      <InfoBanner tone="warning" icon={<Zap className="w-3.5 h-3.5" />}>
        <strong>Critical:</strong> When a provider submits an application for this supplier, the
        email below receives it — along with all provider credentials, verified license data, and
        custom field responses.
      </InfoBanner>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel className="mb-1">Rep Name</FieldLabel>
          <Input
            value={form.account_rep_name}
            onChange={(e) => update({ account_rep_name: e.target.value })}
            placeholder="Jane Smith"
          />
        </div>
        <div>
          <FieldLabel required className="mb-1">
            Rep Email (applications sent here)
          </FieldLabel>
          <Input
            type="email"
            value={form.account_rep_email}
            onChange={(e) => update({ account_rep_email: e.target.value })}
            placeholder="rep@supplier.com"
          />
        </div>
      </div>

      <div>
        <FieldLabel className="mb-1">JotForm Application Link</FieldLabel>
        <div className="relative">
          <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            className="pl-8"
            value={form.jotform_application_url}
            onChange={(e) => update({ jotform_application_url: e.target.value })}
            placeholder="https://form.jotform.com/..."
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Optional. When set, providers are sent to this external form instead of the built-in NOVI
          application flow.
        </p>
      </div>
    </>
  );
}
