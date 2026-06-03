import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import FieldLabel from "../shared/FieldLabel";
import ChipListEditor from "../shared/ChipListEditor";
import InfoBanner from "../shared/InfoBanner";
import { EMPTY_PRICING_ROW, EMPTY_ROI_STAT } from "../constants";

function RowEditor({ rows, onChange, columns, emptyLabel, accent }) {
  const update = (i, key, value) => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  };
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));

  if (!rows || rows.length === 0) {
    return (
      <p className="text-xs text-slate-400">{emptyLabel}</p>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 flex items-center gap-2"
        >
          <div
            className="grid gap-2 flex-1"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            {columns.map((col) => (
              <Input
                key={col.key}
                value={row[col.key] || ""}
                onChange={(e) => update(i, col.key, e.target.value)}
                placeholder={col.placeholder}
                className="bg-white text-sm h-9"
                style={col.accent ? { color: accent, fontWeight: 600 } : undefined}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-slate-300 hover:text-red-500 p-1"
            aria-label="Remove row"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function SalesPricingSection({ form, update }) {
  const addPricingRow = () =>
    update({ pricing_highlights: [...(form.pricing_highlights || []), { ...EMPTY_PRICING_ROW }] });
  const addRoiStat = () =>
    update({ roi_stats: [...(form.roi_stats || []), { ...EMPTY_ROI_STAT }] });

  return (
    <>
      <InfoBanner tone="warning" icon={<span>🔥</span>}>
        <strong>This section powers the provider-facing sales card.</strong> Fill in pricing
        callouts, ROI stats, and persuasive copy to drive more providers to apply and purchase.
      </InfoBanner>

      <div>
        <FieldLabel className="mb-1" hint="Bold hook shown on the marketplace card. Keep it under 10 words.">
          Sales Headline
        </FieldLabel>
        <Input
          value={form.sales_headline}
          onChange={(e) => update({ sales_headline: e.target.value })}
          placeholder="e.g. Save up to 40% vs. retail — exclusive NOVI pricing"
        />
      </div>

      <div>
        <FieldLabel className="mb-1" hint="Short label shown as a badge on the card. Drives urgency.">
          Promo Badge
        </FieldLabel>
        <Input
          value={form.promo_badge}
          onChange={(e) => update({ promo_badge: e.target.value })}
          placeholder="e.g. NOVI Exclusive · Limited-Time Offer · New Partner"
        />
      </div>

      <div>
        <FieldLabel className="mb-1">Sales Pitch (2–3 sentences)</FieldLabel>
        <textarea
          value={form.sales_pitch}
          onChange={(e) => update({ sales_pitch: e.target.value })}
          className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 min-h-[88px] resize-y focus:outline-none focus:ring-1 focus:ring-slate-400"
          placeholder="e.g. NOVI providers get direct-to-provider pricing on Allergan's full portfolio — no distributor markups, no minimums. Apply in 60 seconds and start ordering the same day."
        />
      </div>

      <div>
        <FieldLabel className="mb-1">Social Proof / Credibility Line</FieldLabel>
        <Input
          value={form.social_proof}
          onChange={(e) => update({ social_proof: e.target.value })}
          placeholder="e.g. Used by 5,000+ injectors nationwide · #1 rated injectable brand"
        />
      </div>

      <div>
        <FieldLabel className="mb-1.5">Key Selling Points (shown as ✓ checkmarks)</FieldLabel>
        <ChipListEditor
          items={form.selling_points}
          onChange={(v) => update({ selling_points: v })}
          placeholder="e.g. Direct-to-provider pricing, no middlemen"
          emptyHint="No selling points yet"
          chipTone="lime"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <FieldLabel hint="Show specific product pricing vs. market to make the savings tangible.">
            Exclusive Pricing Highlights
          </FieldLabel>
          <Button type="button" variant="outline" size="sm" onClick={addPricingRow}>
            <Plus className="w-3 h-3 mr-1" /> Add Price Row
          </Button>
        </div>
        <RowEditor
          rows={form.pricing_highlights}
          onChange={(v) => update({ pricing_highlights: v })}
          accent="#5a7a20"
          emptyLabel="No price comparisons yet"
          columns={[
            { key: "product", placeholder: "Product (e.g. Botox 100u)" },
            { key: "retail", placeholder: "Retail (e.g. $625)" },
            { key: "novi", placeholder: "NOVI (e.g. $475)", accent: true },
          ]}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <FieldLabel hint="Big numbers that show providers the revenue opportunity (e.g. avg. revenue per treatment).">
            ROI & Revenue Stats
          </FieldLabel>
          <Button type="button" variant="outline" size="sm" onClick={addRoiStat}>
            <Plus className="w-3 h-3 mr-1" /> Add Stat
          </Button>
        </div>
        <RowEditor
          rows={form.roi_stats}
          onChange={(v) => update({ roi_stats: v })}
          emptyLabel="No ROI stats yet"
          columns={[
            { key: "value", placeholder: "Stat (e.g. $1,200)" },
            { key: "label", placeholder: "Label (e.g. avg. revenue per syringe)" },
          ]}
        />
      </div>

    </>
  );
}
