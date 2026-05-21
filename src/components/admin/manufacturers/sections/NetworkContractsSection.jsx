import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import FieldLabel from "../shared/FieldLabel";
import InfoBanner from "../shared/InfoBanner";
import { EMPTY_NETWORK_TIER } from "../constants";

function TierEditor({ tier, onChange, onRemove, index }) {
  const set = (key) => (e) => onChange({ ...tier, [key]: e.target.value });
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 space-y-2.5 relative">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-600">Tier #{index + 1}</p>
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-300 hover:text-red-500 p-1"
          aria-label={`Remove tier ${index + 1}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel className="mb-1">Tier Name</FieldLabel>
          <Input
            value={tier.name}
            onChange={set("name")}
            placeholder="e.g. West Coast"
            className="bg-white h-9 text-sm"
          />
        </div>
        <div>
          <FieldLabel className="mb-1">States</FieldLabel>
          <Input
            value={tier.states}
            onChange={set("states")}
            placeholder="e.g. CA, OR, WA"
            className="bg-white h-9 text-sm"
          />
        </div>
        <div>
          <FieldLabel className="mb-1">Min. Order ($)</FieldLabel>
          <Input
            type="number"
            value={tier.min_order_amount}
            onChange={set("min_order_amount")}
            placeholder="500"
            className="bg-white h-9 text-sm"
          />
        </div>
        <div>
          <FieldLabel className="mb-1">Contract URL</FieldLabel>
          <Input
            value={tier.contract_url}
            onChange={set("contract_url")}
            placeholder="https://..."
            className="bg-white h-9 text-sm"
          />
        </div>
      </div>
      <div>
        <FieldLabel className="mb-1">Notes</FieldLabel>
        <Input
          value={tier.notes}
          onChange={set("notes")}
          placeholder="Tier-specific terms or requirements"
          className="bg-white h-9 text-sm"
        />
      </div>
    </div>
  );
}

export default function NetworkContractsSection({ form, update }) {
  const enabled = !!form.uses_network_tiers;

  const setTiers = (next) => update({ network_tiers: next });

  const addTier = () => setTiers([...(form.network_tiers || []), { ...EMPTY_NETWORK_TIER }]);
  const updateTier = (i, next) =>
    setTiers((form.network_tiers || []).map((t, idx) => (idx === i ? next : t)));
  const removeTier = (i) =>
    setTiers((form.network_tiers || []).filter((_, idx) => idx !== i));

  return (
    <>
      <label className="flex items-center justify-between gap-3 cursor-pointer rounded-lg border border-slate-200 px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold text-slate-700">
            This supplier uses network tiers / state-specific contracts
          </p>
          <p className="text-xs text-slate-500">
            Enable to configure different terms, contracts, and requirements per state or region
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => update({ uses_network_tiers: v })}
        />
      </label>

      {!enabled ? (
        <InfoBanner tone="success">
          No network tiers — this supplier uses a single set of terms for all states. You can
          still set a minimum order and shipping states in Business Rules below.
        </InfoBanner>
      ) : (
        <div className="space-y-2.5">
          {(form.network_tiers || []).length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              No tiers yet — add the first one below.
            </p>
          ) : (
            (form.network_tiers || []).map((tier, i) => (
              <TierEditor
                key={i}
                index={i}
                tier={tier}
                onChange={(next) => updateTier(i, next)}
                onRemove={() => removeTier(i)}
              />
            ))
          )}
          <Button type="button" variant="outline" size="sm" onClick={addTier} className="w-full">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Network Tier
          </Button>
        </div>
      )}
    </>
  );
}
