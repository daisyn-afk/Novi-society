import { useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle, XCircle, CheckCircle2, ChevronDown, ChevronUp,
  TrendingUp, MapPin, FileText, GraduationCap, Sparkles,
  ShieldCheck, Lock, ArrowRight,
} from "lucide-react";
import { PRICE_TIER_LABELS, normalizeCustomFieldForClient } from "@/components/admin/manufacturers/constants";
import { toExternalUrl } from "@/lib/utils";
import { createPageUrl } from "@/utils";
import {
  providerHasManufacturerCoverage,
  resolveRequiredServiceTypes,
} from "@/lib/manufacturerCoverage";

export const DEFAULT_NOVI_UNLOCK_BENEFITS = [
  "Exclusive NOVI member pricing",
  "Device financing programs",
  "Clinical training & certification",
  "Practice marketing support",
];

const DEFAULT_STANDALONE_ACCESS = [
  "Standard distributor pricing",
  "Weeks to approval process",
  "No MD oversight included",
  "Manual paperwork required",
];

const DEFAULT_NOVI_ACCESS = DEFAULT_NOVI_UNLOCK_BENEFITS;

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
];

function parseTierStates(statesValue) {
  if (Array.isArray(statesValue)) {
    return statesValue.map((s) => String(s || "").trim().toUpperCase()).filter(Boolean);
  }
  return String(statesValue || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => US_STATES.includes(s));
}

function hasText(value) {
  return Boolean(String(value || "").trim());
}

function hasItems(list) {
  return Array.isArray(list) && list.some((item) => {
    if (typeof item === "string") return hasText(item);
    if (item && typeof item === "object") {
      return Object.values(item).some((v) => hasText(v));
    }
    return false;
  });
}

export function areCustomFieldsComplete(customFields = [], responses = {}) {
  return (customFields || [])
    .filter((f) => f.required)
    .every((field) => {
      const val = responses[field.label];
      if (field.input_type === "checkbox") return val === true;
      return hasText(val);
    });
}

function SectionHeading({ children, icon: Icon, color = "rgba(30,37,53,0.35)" }) {
  return (
    <p
      className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-1.5"
      style={{ color, letterSpacing: "0.14em" }}
    >
      {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
      {children}
    </p>
  );
}

export function SupplierCardTeaser({ mfr }) {
  const headline = String(mfr?.sales_headline || "").trim();
  if (!headline) return null;
  return (
    <p
      className="text-xs mt-1.5 line-clamp-2 leading-relaxed font-medium"
      style={{ color: "#4a6b10" }}
    >
      {headline}
    </p>
  );
}

export function SupplierPromoBadge({ mfr, className = "" }) {
  const badge = String(mfr?.promo_badge || "").trim();
  if (!badge) return null;
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full max-w-[70%] truncate ${className}`}
      style={{
        background: "rgba(200,230,60,0.9)",
        color: "#1e2535",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
      title={badge}
    >
      {badge}
    </span>
  );
}

export function SupplierPositioningBadges({ mfr }) {
  const badges = [];
  if (mfr?.training_approved) {
    badges.push({ key: "training", label: "Training Approved", icon: GraduationCap });
  }
  if (mfr?.price_tier && mfr.price_tier !== "mid") {
    badges.push({
      key: "tier",
      label: PRICE_TIER_LABELS[mfr.price_tier] || mfr.price_tier,
      icon: Sparkles,
    });
  }
  if (!badges.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {badges.map(({ key, label, icon: Icon }) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{
            background: "rgba(200,230,60,0.12)",
            color: "#4a6b10",
            border: "1px solid rgba(200,230,60,0.3)",
          }}
        >
          <Icon className="w-3 h-3" />
          {label}
        </span>
      ))}
    </div>
  );
}

function SupplierSalesPricingSection({ mfr }) {
  const hasSales =
    hasText(mfr?.sales_pitch) ||
    hasText(mfr?.social_proof) ||
    hasItems(mfr?.selling_points) ||
    hasItems(mfr?.pricing_highlights) ||
    hasItems(mfr?.roi_stats);

  if (!hasSales) return null;

  const pricingRows = (mfr.pricing_highlights || []).filter(
    (row) => hasText(row?.product) || hasText(row?.retail) || hasText(row?.novi)
  );
  const roiStats = (mfr.roi_stats || []).filter(
    (row) => hasText(row?.value) || hasText(row?.label)
  );
  const sellingPoints = (mfr.selling_points || []).filter(hasText);

  return (
    <div className="px-6 py-5">
      <SectionHeading icon={TrendingUp} color="#5a7a20">Sales & Pricing</SectionHeading>

      {hasText(mfr.sales_pitch) ? (
        <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(30,37,53,0.7)" }}>
          {mfr.sales_pitch}
        </p>
      ) : null}

      {hasText(mfr.social_proof) ? (
        <p
          className="text-xs font-medium mb-4 px-3 py-2 rounded-lg"
          style={{ background: "rgba(123,142,200,0.08)", color: "rgba(30,37,53,0.65)" }}
        >
          {mfr.social_proof}
        </p>
      ) : null}

      {sellingPoints.length > 0 ? (
        <div className="space-y-2 mb-4">
          {sellingPoints.map((point, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#5a7a20" }} />
              <p className="text-sm" style={{ color: "rgba(30,37,53,0.75)" }}>{point}</p>
            </div>
          ))}
        </div>
      ) : null}

      {pricingRows.length > 0 ? (
        <div className="mb-4 overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(30,37,53,0.08)" }}>
          <table className="w-full text-sm min-w-[280px]">
            <thead>
              <tr style={{ background: "rgba(30,37,53,0.04)" }}>
                <th className="text-left px-3 py-2 text-xs font-bold" style={{ color: "rgba(30,37,53,0.5)" }}>Product</th>
                <th className="text-left px-3 py-2 text-xs font-bold" style={{ color: "rgba(30,37,53,0.5)" }}>Retail</th>
                <th className="text-left px-3 py-2 text-xs font-bold" style={{ color: "#4a6b10" }}>NOVI</th>
              </tr>
            </thead>
            <tbody>
              {pricingRows.map((row, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(30,37,53,0.06)" }}>
                  <td className="px-3 py-2" style={{ color: "#1e2535" }}>{row.product || "—"}</td>
                  <td className="px-3 py-2" style={{ color: "rgba(30,37,53,0.55)" }}>{row.retail || "—"}</td>
                  <td className="px-3 py-2 font-semibold" style={{ color: "#4a6b10" }}>{row.novi || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {roiStats.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {roiStats.map((stat, i) => (
            <div
              key={i}
              className="rounded-xl px-3 py-3 text-center"
              style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.2)" }}
            >
              <p className="text-lg font-bold" style={{ color: "#1e2535" }}>{stat.value || "—"}</p>
              <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "rgba(30,37,53,0.5)" }}>
                {stat.label || ""}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ComparisonColumn({ side, pricingNote, accessItems }) {
  const isNovi = side === "novi";
  const accent = isNovi ? "#4a6b10" : "#DA6A63";
  const Icon = isNovi ? CheckCircle2 : XCircle;
  const heading = isNovi ? "WITH NOVI" : "ON THEIR OWN";
  const items = (accessItems || []).filter(hasText);

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: isNovi ? "rgba(200,230,60,0.06)" : "rgba(218,106,99,0.05)",
        border: `1px solid ${isNovi ? "rgba(200,230,60,0.25)" : "rgba(218,106,99,0.18)"}`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="w-4 h-4" style={{ color: accent }} />
        <p className="text-xs font-bold tracking-wider" style={{ color: accent }}>{heading}</p>
      </div>

      {hasText(pricingNote) ? (
        <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{pricingNote}</p>
      ) : null}

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: accent }} />
            <p className="text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SupplierNoviComparisonSection({ mfr }) {
  const standaloneAccess = hasItems(mfr?.standalone_access)
    ? mfr.standalone_access
    : DEFAULT_STANDALONE_ACCESS;
  const noviAccess = hasItems(mfr?.novi_access) ? mfr.novi_access : DEFAULT_NOVI_ACCESS;

  return (
    <div className="px-6 py-5">
      <SectionHeading color="#7B8EC8">NOVI vs. On Your Own</SectionHeading>
      <div className="grid sm:grid-cols-2 gap-3">
        <ComparisonColumn
          side="standalone"
          pricingNote={mfr.standalone_pricing_note}
          accessItems={standaloneAccess}
        />
        <ComparisonColumn
          side="novi"
          pricingNote={mfr.novi_pricing_note}
          accessItems={noviAccess}
        />
      </div>
    </div>
  );
}

function NetworkTierCard({ tier, highlighted }) {
  const states = parseTierStates(tier.states);
  const contractUrl = String(tier.contract_url || "").trim();

  return (
    <div
      className="rounded-xl p-4 space-y-2"
      style={{
        background: highlighted ? "rgba(200,230,60,0.08)" : "rgba(30,37,53,0.02)",
        border: highlighted
          ? "1.5px solid rgba(200,230,60,0.4)"
          : "1px solid rgba(30,37,53,0.08)",
      }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-bold" style={{ color: "#1e2535" }}>
          {tier.name?.trim() || "Network Tier"}
        </p>
        {highlighted ? (
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10" }}
          >
            Your Region
          </span>
        ) : null}
      </div>

      {states.length > 0 ? (
        <p className="text-xs flex items-center gap-1" style={{ color: "rgba(30,37,53,0.55)" }}>
          <MapPin className="w-3 h-3 shrink-0" />
          {states.join(", ")}
        </p>
      ) : null}

      {tier.min_order_amount ? (
        <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>
          Min. order: <strong>${Number(tier.min_order_amount).toLocaleString()}</strong>
        </p>
      ) : null}

      {hasText(tier.notes) ? (
        <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.55)" }}>{tier.notes}</p>
      ) : null}

      {contractUrl ? (
        <a
          href={toExternalUrl(contractUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
          style={{ color: "#7B8EC8" }}
        >
          <FileText className="w-3.5 h-3.5" />
          {tier.contract_file_name?.trim() || "View Contract"}
        </a>
      ) : null}
    </div>
  );
}

function SupplierNetworkTiersSection({ mfr, providerState }) {
  if (!mfr?.uses_network_tiers) return null;
  const tiers = (mfr.network_tiers || []).filter(
    (tier) => hasText(tier?.name) || parseTierStates(tier?.states).length > 0
  );
  if (!tiers.length) return null;

  const stateCode = String(providerState || "").trim().toUpperCase();
  const matching = stateCode
    ? tiers.filter((tier) => parseTierStates(tier.states).includes(stateCode))
    : [];
  const others = tiers.filter((tier) => !matching.includes(tier));
  const [othersExpanded, setOthersExpanded] = useState(false);

  return (
    <div className="px-6 py-5">
      <SectionHeading icon={MapPin}>Network & Contracts</SectionHeading>

      {matching.length > 0 ? (
        <div className="space-y-3 mb-3">
          {matching.map((tier, i) => (
            <NetworkTierCard key={`match-${i}`} tier={tier} highlighted />
          ))}
        </div>
      ) : stateCode ? (
        <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "rgba(30,37,53,0.04)", color: "rgba(30,37,53,0.55)" }}>
          No tier configured for {stateCode}. See other regions below.
        </p>
      ) : null}

      {others.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setOthersExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold mb-2 transition-opacity hover:opacity-70"
            style={{ color: "rgba(30,37,53,0.5)" }}
          >
            {othersExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {othersExpanded ? "Hide" : "Show"} other regions ({others.length})
          </button>
          {othersExpanded ? (
            <div className="space-y-3">
              {others.map((tier, i) => (
                <NetworkTierCard key={`other-${i}`} tier={tier} highlighted={false} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SupplierUnlockSection({ mfr }) {
  const items = hasItems(mfr?.novi_access) ? mfr.novi_access.filter(hasText) : DEFAULT_NOVI_ACCESS;

  return (
    <div className="mx-6 my-5 overflow-hidden rounded-2xl" style={{ border: "1px solid rgba(30,37,53,0.08)", boxShadow: "0 2px 12px rgba(30,37,53,0.06)" }}>
      <div className="flex items-start justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(135deg, #1e2535 0%, #2a3355 100%)" }}>
        <div>
          <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: "#C8E63C", letterSpacing: "0.14em" }}>
            What You Unlock
          </p>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: 20, color: "#fff", lineHeight: 1.2 }}>
            Exclusive NOVI benefits
          </p>
        </div>
      </div>
      <div className="px-5 py-4" style={{ background: "#fff" }}>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(200,230,60,0.2)" }}>
                <CheckCircle className="w-2.5 h-2.5" style={{ color: "#5a7a20" }} />
              </div>
              <p className="text-sm" style={{ color: "rgba(30,37,53,0.75)" }}>{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SupplierMarketingContent({ mfr, providerState, showUnlock = true }) {
  const hasSalesSection = (
    hasText(mfr?.sales_pitch) ||
    hasText(mfr?.social_proof) ||
    hasItems(mfr?.selling_points) ||
    hasItems(mfr?.pricing_highlights) ||
    hasItems(mfr?.roi_stats)
  );
  const hasNetwork = mfr?.uses_network_tiers && hasItems(mfr?.network_tiers);

  if (!hasSalesSection && !hasNetwork && !showUnlock) return null;

  return (
    <>
      {hasSalesSection ? (
        <>
          <div className="h-px mx-6" style={{ background: "rgba(30,37,53,0.07)" }} />
          <SupplierSalesPricingSection mfr={mfr} />
        </>
      ) : null}

      <div className="h-px mx-6" style={{ background: "rgba(30,37,53,0.07)" }} />
      <SupplierNoviComparisonSection mfr={mfr} />

      {hasNetwork ? (
        <>
          <div className="h-px mx-6" style={{ background: "rgba(30,37,53,0.07)" }} />
          <SupplierNetworkTiersSection mfr={mfr} providerState={providerState} />
        </>
      ) : null}

      {showUnlock ? <SupplierUnlockSection mfr={mfr} /> : null}
    </>
  );
}

export function SupplierInfoCollapsible({ mfr, providerState }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(30,37,53,0.08)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-opacity hover:opacity-80"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.12em" }}>
            Supplier Info
          </p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: "#1e2535" }}>
            Pricing, comparison & network tiers
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 shrink-0" style={{ color: "rgba(30,37,53,0.4)" }} />
        ) : (
          <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "rgba(30,37,53,0.4)" }} />
        )}
      </button>

      {expanded ? (
        <div style={{ borderTop: "1px solid rgba(30,37,53,0.07)" }}>
          <SupplierMarketingContent mfr={mfr} providerState={providerState} showUnlock />
        </div>
      ) : null}
    </div>
  );
}

function CustomFieldInput({ field, value, onChange, showError }) {
  const label = field.label?.trim() || "Field";
  const placeholder = field.placeholder?.trim() || "";
  const inputId = `custom-field-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const errorStyle = showError ? { borderColor: "#DA6A63" } : undefined;

  if (field.input_type === "checkbox") {
    return (
      <label className="flex items-start gap-2.5 cursor-pointer">
        <Checkbox
          id={inputId}
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
          className="mt-0.5"
        />
        <span className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.75)" }}>
          {label}
          {field.required ? <span style={{ color: "#DA6A63" }}> *</span> : null}
        </span>
      </label>
    );
  }

  if (field.input_type === "textarea") {
    return (
      <div>
        <label htmlFor={inputId} className="text-xs font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
          {label}{field.required ? <span style={{ color: "#DA6A63" }}> *</span> : null}
        </label>
        <Textarea
          id={inputId}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-sm min-h-[80px]"
          style={errorStyle}
        />
      </div>
    );
  }

  if (field.input_type === "select") {
    const options = (field.options || []).filter((o) => String(o || "").trim());
    const selectPlaceholder = placeholder || "Select an option";

    return (
      <div>
        <label htmlFor={inputId} className="text-xs font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
          {label}{field.required ? <span style={{ color: "#DA6A63" }}> *</span> : null}
        </label>
        {options.length > 0 ? (
          <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger
              id={inputId}
              className="h-10 text-sm"
              style={errorStyle}
            >
              <SelectValue placeholder={selectPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "rgba(30,37,53,0.5)", background: "rgba(30,37,53,0.04)" }}>
            No options configured for this field.
          </p>
        )}
      </div>
    );
  }

  const inputType = field.input_type === "number" ? "number"
    : field.input_type === "email" ? "email"
    : field.input_type === "phone" ? "tel"
    : field.input_type === "date" ? "date"
    : "text";

  return (
    <div>
      <label htmlFor={inputId} className="text-xs font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
        {label}{field.required ? <span style={{ color: "#DA6A63" }}> *</span> : null}
      </label>
      <Input
        id={inputId}
        type={inputType}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 text-sm"
        style={errorStyle}
      />
    </div>
  );
}

function MembershipPill({ name, isActive, size = "sm" }) {
  const isLarge = size === "lg";
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full max-w-full truncate ${
        isLarge ? "text-xs px-3 py-1.5" : "text-[11px] px-2.5 py-1"
      }`}
      style={{
        background: isActive ? "rgba(200,230,60,0.2)" : "rgba(255,255,255,0.92)",
        color: isActive ? "#3d5a0f" : "#1e2535",
        border: `1.5px solid ${isActive ? "rgba(200,230,60,0.55)" : "rgba(30,37,53,0.12)"}`,
        boxShadow: isActive ? "none" : "0 1px 4px rgba(30,37,53,0.06)",
      }}
      title={name}
    >
      {isActive ? (
        <CheckCircle className={isLarge ? "w-3.5 h-3.5 shrink-0" : "w-3 h-3 shrink-0"} style={{ color: "#4a6b10" }} />
      ) : (
        <Lock className={isLarge ? "w-3.5 h-3.5 shrink-0" : "w-3 h-3 shrink-0"} style={{ color: "#D4900A" }} />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}

export function SupplierCoverageBadges({ mfr, serviceTypes = [], activeServiceIds, compact = false }) {
  const required = resolveRequiredServiceTypes(mfr, serviceTypes);
  if (!required.length) return null;

  const covered = providerHasManufacturerCoverage(mfr, activeServiceIds);

  if (compact) {
    if (covered) {
      return (
        <div
          className="mt-2.5 rounded-xl px-2.5 py-2"
          style={{
            background: "rgba(200,230,60,0.1)",
            border: "1px solid rgba(200,230,60,0.35)",
          }}
        >
          <p className="text-[10px] font-black uppercase tracking-widest mb-1.5 flex items-center gap-1" style={{ color: "#4a6b10", letterSpacing: "0.1em" }}>
            <CheckCircle className="w-3 h-3" /> MD Coverage Met
          </p>
          <div className="flex flex-wrap gap-1">
            {required.map((st) => (
              <MembershipPill
                key={st.id}
                name={st.name}
                isActive={activeServiceIds?.has?.(String(st.id))}
              />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div
        className="mt-2.5 rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(250,111,48,0.12) 0%, rgba(212,144,10,0.1) 100%)",
          border: "1.5px solid rgba(250,111,48,0.35)",
          boxShadow: "0 2px 10px rgba(250,111,48,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-2 px-2.5 py-2"
          style={{ background: "linear-gradient(135deg, #1e2535 0%, #2a3355 100%)" }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(250,111,48,0.2)", border: "1px solid rgba(250,111,48,0.35)" }}
          >
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#FA6F30" }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#FA6F30", letterSpacing: "0.12em" }}>
              MD Coverage Required
            </p>
            <p className="text-[10px] leading-snug" style={{ color: "rgba(255,255,255,0.65)" }}>
              Need any one membership below
            </p>
          </div>
        </div>
        <div className="px-2.5 py-2 flex flex-wrap gap-1">
          {required.map((st) => (
            <MembershipPill
              key={st.id}
              name={st.name}
              isActive={activeServiceIds?.has?.(String(st.id))}
            />
          ))}
        </div>
        <Link
          to={createPageUrl("ProviderCredentialsCoverage")}
          className="flex items-center justify-center gap-1 mx-2.5 mb-2.5 py-2 rounded-lg text-[11px] font-bold transition-opacity hover:opacity-90"
          style={{ background: "#FA6F30", color: "#fff" }}
          onClick={(e) => e.stopPropagation()}
        >
          Get MD Coverage <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {required.map((st) => (
        <MembershipPill
          key={st.id}
          name={st.name}
          isActive={activeServiceIds?.has?.(String(st.id))}
          size="lg"
        />
      ))}
    </div>
  );
}

export function SupplierCoveragePanel({ mfr, serviceTypes = [], activeServiceIds, prominent = false }) {
  const required = resolveRequiredServiceTypes(mfr, serviceTypes);
  if (!required.length) return null;

  const covered = providerHasManufacturerCoverage(mfr, activeServiceIds);
  const missingCount = required.filter((st) => !activeServiceIds?.has?.(String(st.id))).length;

  return (
    <div
      className={`rounded-2xl overflow-hidden ${prominent ? "" : "mx-6 my-5"}`}
      style={{
        border: covered
          ? "1.5px solid rgba(200,230,60,0.45)"
          : "2px solid rgba(250,111,48,0.45)",
        boxShadow: covered
          ? "0 4px 20px rgba(200,230,60,0.15)"
          : "0 8px 28px rgba(250,111,48,0.18)",
      }}
    >
      <div
        className="px-5 py-4 flex items-start justify-between gap-4"
        style={{
          background: covered
            ? "linear-gradient(135deg, #1e2535 0%, #2a3355 100%)"
            : "linear-gradient(135deg, #1e2535 0%, #3d2a22 55%, #2a3355 100%)",
        }}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: covered ? "rgba(200,230,60,0.15)" : "rgba(250,111,48,0.2)",
              border: `1px solid ${covered ? "rgba(200,230,60,0.35)" : "rgba(250,111,48,0.4)"}`,
            }}
          >
            {covered ? (
              <CheckCircle className="w-5 h-5" style={{ color: "#C8E63C" }} />
            ) : (
              <ShieldCheck className="w-5 h-5" style={{ color: "#FA6F30" }} />
            )}
          </div>
          <div className="min-w-0">
            <p
              className="text-[11px] font-black uppercase tracking-widest mb-1"
              style={{ color: covered ? "#C8E63C" : "#FA6F30", letterSpacing: "0.14em" }}
            >
              {covered ? "MD Coverage — Ready to Activate" : "MD Coverage Required"}
            </p>
            <p
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: 20,
                color: "#fff",
                lineHeight: 1.2,
                fontWeight: 400,
              }}
            >
              {covered
                ? "You have the membership needed for this supplier"
                : "Add MD coverage before you can activate"}
            </p>
            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              {covered
                ? "Your active membership satisfies this supplier's requirements."
                : `You need any one of ${required.length} membership${required.length > 1 ? "s" : ""} below — ${missingCount} still needed.`}
            </p>
          </div>
        </div>
        {!covered ? (
          <span
            className="hidden sm:inline-flex text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0"
            style={{
              background: "rgba(250,111,48,0.2)",
              color: "#ffb088",
              border: "1px solid rgba(250,111,48,0.4)",
              letterSpacing: "0.1em",
            }}
          >
            Action Needed
          </span>
        ) : null}
      </div>

      <div className="px-5 py-4" style={{ background: covered ? "rgba(200,230,60,0.05)" : "rgba(250,111,48,0.04)" }}>
        <p
          className="text-[10px] font-black uppercase tracking-widest mb-3"
          style={{ color: "rgba(30,37,53,0.4)", letterSpacing: "0.12em" }}
        >
          Accepts any one of these memberships
        </p>
        <div className="space-y-2.5">
          {required.map((st) => {
            const isActive = activeServiceIds?.has?.(String(st.id));
            return (
              <div
                key={st.id}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: "#fff",
                  border: isActive
                    ? "1.5px solid rgba(200,230,60,0.45)"
                    : "1.5px solid rgba(250,111,48,0.25)",
                  boxShadow: isActive ? "none" : "0 2px 8px rgba(250,111,48,0.08)",
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: isActive ? "rgba(200,230,60,0.15)" : "rgba(250,111,48,0.1)",
                  }}
                >
                  {isActive ? (
                    <CheckCircle className="w-4 h-4" style={{ color: "#4a6b10" }} />
                  ) : (
                    <Lock className="w-4 h-4" style={{ color: "#D4900A" }} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate" style={{ color: "#1e2535" }}>{st.name}</p>
                  {st.category ? (
                    <p className="text-xs capitalize mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>{st.category}</p>
                  ) : null}
                </div>
                <span
                  className="text-[10px] font-black uppercase tracking-wider shrink-0 px-2.5 py-1 rounded-full"
                  style={{
                    background: isActive ? "rgba(200,230,60,0.2)" : "rgba(250,111,48,0.12)",
                    color: isActive ? "#4a6b10" : "#C45A20",
                    border: `1px solid ${isActive ? "rgba(200,230,60,0.4)" : "rgba(250,111,48,0.3)"}`,
                  }}
                >
                  {isActive ? "Active" : "Required"}
                </span>
              </div>
            );
          })}
        </div>

        {!covered ? (
          <Link
            to={createPageUrl("ProviderCredentialsCoverage")}
            className="flex items-center justify-center gap-2 mt-4 w-full h-11 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
            style={{
              background: "#FA6F30",
              color: "#fff",
              boxShadow: "0 4px 16px rgba(250, 111, 48, 0.35)",
            }}
          >
            Get MD Coverage <ArrowRight className="w-4 h-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function SupplierCoverageBlockedButton({ className = "" }) {
  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl cursor-not-allowed"
        style={{
          background: "linear-gradient(135deg, rgba(30,37,53,0.06) 0%, rgba(250,111,48,0.08) 100%)",
          border: "1.5px solid rgba(250,111,48,0.35)",
        }}
      >
        <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: "#FA6F30" }} />
        <span className="text-sm font-black tracking-wide" style={{ color: "#C45A20" }}>
          MD COVERAGE REQUIRED
        </span>
      </button>
      <Link
        to={createPageUrl("ProviderCredentialsCoverage")}
        className="flex items-center justify-center gap-1.5 w-full mt-2 py-2 rounded-lg text-xs font-bold transition-opacity hover:opacity-90"
        style={{ background: "#FA6F30", color: "#fff" }}
        onClick={(e) => e.stopPropagation()}
      >
        Get MD Coverage <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

export function SupplierCustomFieldsForm({ fields = [], values = {}, onChange, showErrors = false }) {
  const activeFields = (fields || [])
    .map(normalizeCustomFieldForClient)
    .filter((f) => f.label?.trim());
  if (!activeFields.length) return null;

  const setValue = (label, val) => onChange({ ...values, [label]: val });

  return (
    <div className="space-y-4">
      <p className="text-xs font-black uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.12em" }}>
        Supplier-Specific Questions
      </p>
      {activeFields.map((field, i) => {
        const label = field.label.trim();
        const value = values[label];
        const missing = showErrors && field.required && (
          field.input_type === "checkbox" ? value !== true : !hasText(value)
        );
        return (
          <CustomFieldInput
            key={`${label}-${i}`}
            field={field}
            value={value}
            onChange={(val) => setValue(label, val)}
            showError={missing}
          />
        );
      })}
    </div>
  );
}
