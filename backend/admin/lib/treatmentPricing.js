export const PRICING_MODEL = {
  UNIT: "unit",
  AREA: "area",
  FLAT: "flat",
  PACKAGE: "package",
};

const INJECTABLE_SUB_OFFERINGS = [
  {
    key: "tox",
    label: "Neurotoxin (Botox / Dysport / Xeomin)",
    matchTerms: ["neurotoxin", "botox", "dysport", "xeomin", "tox"],
  },
  {
    key: "filler",
    label: "Dermal Filler",
    matchTerms: ["filler", "dermal", "juvederm", "restylane", "cheek", "lip", "syringe"],
  },
];

const UNIT_HINTS = new Set(["per unit", "per syringe"]);
const AREA_HINTS = new Set(["per area"]);
const FLAT_HINTS = new Set(["flat fee", "package price"]);

export function normalizePricingModel(hint) {
  const h = String(hint || "").trim().toLowerCase();
  if (UNIT_HINTS.has(h)) return PRICING_MODEL.UNIT;
  if (AREA_HINTS.has(h)) return PRICING_MODEL.AREA;
  if (FLAT_HINTS.has(h)) return PRICING_MODEL.FLAT;
  if (h.includes("package")) return PRICING_MODEL.PACKAGE;
  if (h.includes("unit") || h.includes("syringe")) return PRICING_MODEL.UNIT;
  if (h.includes("area")) return PRICING_MODEL.AREA;
  return PRICING_MODEL.FLAT;
}

function parseMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function serviceMatchesSub(serviceLabel, sub) {
  const s = normalizeText(serviceLabel);
  if (!s) return false;
  if (normalizeText(sub.label) === s) return true;
  return (sub.matchTerms || []).some((term) => s.includes(term));
}

export function resolveOfferingForAppointment({
  serviceLabel = "",
  serviceTypeId = null,
  serviceTypeName = "",
  offerings = {},
} = {}) {
  const entries = Object.entries(offerings || {});
  if (!entries.length) return null;

  const label = String(serviceLabel || "").trim();
  const stId = String(serviceTypeId || "").trim();

  if (label) {
    for (const [key, data] of entries) {
      for (const sub of INJECTABLE_SUB_OFFERINGS) {
        if (key.endsWith(`_${sub.key}`) && serviceMatchesSub(label, sub)) {
          return { key, data, pricingModel: normalizePricingModel(data?.pricing_model) };
        }
      }
    }
    if (stId && offerings[stId]) {
      return { key: stId, data: offerings[stId], pricingModel: normalizePricingModel(offerings[stId]?.pricing_model) };
    }
  }

  if (stId && offerings[stId]) {
    return { key: stId, data: offerings[stId], pricingModel: normalizePricingModel(offerings[stId]?.pricing_model) };
  }

  const live = entries.find(([, data]) => data?.is_live);
  if (live) {
    const [key, data] = live;
    return { key, data, pricingModel: normalizePricingModel(data?.pricing_model) };
  }

  const [key, data] = entries[0];
  return { key, data, pricingModel: normalizePricingModel(data?.pricing_model) };
}

export function calculateTreatmentTotal({
  offering = {},
  pricingModel = PRICING_MODEL.FLAT,
  unitsUsed = 0,
  areasTreated = [],
  chargeModes = null,
  unitRate = null,
  areaRate = null,
  flatAmount = null,
  finalTotal = null,
} = {}) {
  const unitPrice = parseMoney(unitRate ?? offering?.price);
  const areaPrice = parseMoney(areaRate ?? offering?.price);
  const flatPrice = parseMoney(flatAmount ?? offering?.price);
  const units = Math.max(0, parseMoney(unitsUsed));
  const areaCount = Math.max(0, Array.isArray(areasTreated) ? areasTreated.length : 0);

  const modes =
    Array.isArray(chargeModes) && chargeModes.length
      ? chargeModes
      : pricingModel === PRICING_MODEL.UNIT
        ? [PRICING_MODEL.UNIT]
        : pricingModel === PRICING_MODEL.AREA
          ? [PRICING_MODEL.AREA]
          : [PRICING_MODEL.FLAT];

  const lines = [];
  let subtotal = 0;

  if (modes.includes(PRICING_MODEL.UNIT) && units > 0) {
    const amount = Math.round(unitPrice * units * 100) / 100;
    lines.push({ type: PRICING_MODEL.UNIT, label: "Units", quantity: units, unit_price: unitPrice, amount });
    subtotal += amount;
  }
  if (modes.includes(PRICING_MODEL.AREA) && areaCount > 0) {
    const amount = Math.round(areaPrice * areaCount * 100) / 100;
    lines.push({ type: PRICING_MODEL.AREA, label: "Areas treated", quantity: areaCount, unit_price: areaPrice, amount });
    subtotal += amount;
  }
  if (modes.includes(PRICING_MODEL.FLAT) || modes.includes(PRICING_MODEL.PACKAGE)) {
    const amount = flatPrice;
    if (amount > 0 || !lines.length) {
      lines.push({ type: PRICING_MODEL.FLAT, label: "Service fee", quantity: 1, unit_price: flatPrice, amount });
      subtotal += amount;
    }
  }

  const maxPrice = parseMoney(offering?.price_max);
  let total = Math.round(subtotal * 100) / 100;
  if (maxPrice > 0 && total > maxPrice) total = maxPrice;
  if (finalTotal != null && Number.isFinite(Number(finalTotal))) {
    total = Math.round(Number(finalTotal) * 100) / 100;
  }

  return { lines, subtotal: Math.round(subtotal * 100) / 100, total };
}

import { query } from "../db.js";

export async function loadProviderOfferings(providerId) {
  const pid = String(providerId || "").trim();
  if (!pid) return {};
  const { rows } = await query(
    `select pp.metadata
       from public.users u
       left join public.provider_profiles pp on pp.user_id = u.id
      where u.auth_user_id::text = $1 or u.id::text = $1
      limit 1`,
    [pid]
  );
  const metadata = rows[0]?.metadata && typeof rows[0].metadata === "object" ? rows[0].metadata : {};
  return metadata.service_offerings_v2 && typeof metadata.service_offerings_v2 === "object"
    ? metadata.service_offerings_v2
    : {};
}
