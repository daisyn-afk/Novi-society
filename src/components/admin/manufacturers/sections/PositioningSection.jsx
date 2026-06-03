import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Star } from "lucide-react";
import FieldLabel from "../shared/FieldLabel";
import { PRICE_TIERS } from "../constants";

function ToggleRow({ icon: Icon, title, subtitle, checked, onChange, accent = "#5a7a20" }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer p-2 -mx-2 rounded-lg hover:bg-slate-50">
      <div className="flex items-start gap-3">
        {Icon ? (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: checked ? "rgba(200,230,60,0.18)" : "#f3f4f6" }}
          >
            <Icon className="w-4 h-4" style={{ color: checked ? accent : "#64748b" }} />
          </div>
        ) : null}
        <div>
          <p className="text-sm font-semibold text-slate-700">{title}</p>
          {subtitle ? <p className="text-xs text-slate-500 leading-snug">{subtitle}</p> : null}
        </div>
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </label>
  );
}

export default function PositioningSection({ form, update }) {
  return (
    <>
      <ToggleRow
        icon={GraduationCap}
        title="Training Approved"
        subtitle="NOVI-certified training is available for this supplier's products"
        checked={form.training_approved}
        onChange={(v) => update({ training_approved: v })}
      />
      <ToggleRow
        icon={Star}
        title="Featured"
        subtitle="Pinned to the top of the provider marketplace"
        checked={form.is_featured}
        onChange={(v) => update({ is_featured: v })}
      />

      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <FieldLabel className="mb-1">Price Tier</FieldLabel>
          <Select value={form.price_tier || "mid"} onValueChange={(v) => update({ price_tier: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRICE_TIERS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel className="mb-1">Sort Order</FieldLabel>
          <Input
            type="number"
            value={form.sort_order ?? 0}
            onChange={(e) => update({ sort_order: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
      </div>
    </>
  );
}
