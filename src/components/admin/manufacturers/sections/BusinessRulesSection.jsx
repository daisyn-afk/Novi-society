import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import FieldLabel from "../shared/FieldLabel";

export default function BusinessRulesSection({ form, update }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel className="mb-1">Default Min Order Amount ($)</FieldLabel>
          <Input
            type="number"
            value={form.min_order_amount ?? ""}
            onChange={(e) => update({ min_order_amount: e.target.value })}
            placeholder="e.g. 500"
          />
        </div>
        <div>
          <FieldLabel className="mb-1">Ships To States</FieldLabel>
          <Input
            value={form.ships_to_states ?? ""}
            onChange={(e) => update({ ships_to_states: e.target.value })}
            placeholder="All US States, or TX, CA, FL"
          />
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 cursor-pointer rounded-lg border border-slate-200 px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Active — visible to providers in marketplace
          </p>
          <p className="text-xs text-slate-500">
            Inactive suppliers are hidden from providers but preserved in the system
          </p>
        </div>
        <Switch
          checked={!!form.is_active}
          onCheckedChange={(v) => update({ is_active: v })}
        />
      </label>
    </>
  );
}
