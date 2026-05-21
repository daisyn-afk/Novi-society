import { Input } from "@/components/ui/input";
import { XCircle, CheckCircle2 } from "lucide-react";
import FieldLabel from "../shared/FieldLabel";
import ChipListEditor from "../shared/ChipListEditor";
import InfoBanner from "../shared/InfoBanner";

function ComparisonColumn({
  side,
  pricingNote,
  onPricingNoteChange,
  accessItems,
  onAccessItemsChange,
}) {
  const isNovi = side === "novi";
  const accent = isNovi ? "#4a6b10" : "#DA6A63";
  const tone = isNovi ? "lime" : "slate";
  const Icon = isNovi ? CheckCircle2 : XCircle;
  const heading = isNovi ? "WITH NOVI" : "ON THEIR OWN";
  const pricingPlaceholder = isNovi
    ? "e.g. 15–40% below distributor"
    : "e.g. Standard distributor pricing";
  const accessPlaceholder = isNovi
    ? "e.g. Exclusive NOVI pricing"
    : "e.g. Weeks to approval";

  return (
    <div
      className="rounded-xl p-3.5 space-y-3"
      style={{
        background: isNovi ? "rgba(200,230,60,0.06)" : "rgba(218,106,99,0.05)",
        border: `1px solid ${isNovi ? "rgba(200,230,60,0.25)" : "rgba(218,106,99,0.18)"}`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="w-4 h-4" style={{ color: accent }} />
        <p className="text-xs font-bold tracking-wider" style={{ color: accent }}>
          {heading}
        </p>
      </div>

      <div>
        <FieldLabel className="mb-1">Pricing Note</FieldLabel>
        <Input
          value={pricingNote || ""}
          onChange={(e) => onPricingNoteChange(e.target.value)}
          placeholder={pricingPlaceholder}
        />
      </div>

      <div>
        <FieldLabel className="mb-1.5">Access Items</FieldLabel>
        <ChipListEditor
          items={accessItems}
          onChange={onAccessItemsChange}
          placeholder={accessPlaceholder}
          emptyHint="Defaults will show if empty"
          chipTone={tone}
        />
      </div>
    </div>
  );
}

export default function NoviVsStandaloneSection({ form, update }) {
  return (
    <>
      <InfoBanner tone="warning" icon={<span>📊</span>}>
        <strong>Conversion tool:</strong> Show providers side-by-side what they'd get approaching
        this supplier on their own vs. through NOVI. This powers the comparison card on the
        provider detail page.
      </InfoBanner>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ComparisonColumn
          side="standalone"
          pricingNote={form.standalone_pricing_note}
          onPricingNoteChange={(v) => update({ standalone_pricing_note: v })}
          accessItems={form.standalone_access}
          onAccessItemsChange={(v) => update({ standalone_access: v })}
        />
        <ComparisonColumn
          side="novi"
          pricingNote={form.novi_pricing_note}
          onPricingNoteChange={(v) => update({ novi_pricing_note: v })}
          accessItems={form.novi_access}
          onAccessItemsChange={(v) => update({ novi_access: v })}
        />
      </div>
    </>
  );
}
