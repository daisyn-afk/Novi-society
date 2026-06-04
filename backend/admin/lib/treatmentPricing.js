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

const TOX_SUB = INJECTABLE_SUB_OFFERINGS.find((s) => s.key === "tox");
const FILLER_SUB = INJECTABLE_SUB_OFFERINGS.find((s) => s.key === "filler");

export function pickInjectableSubKey({ serviceLabel = "", unitsLabel = "", unitsUsed = 0 } = {}) {
  const label = normalizeText(serviceLabel);
  const ul = normalizeText(unitsLabel);
  const qty = parseMoney(unitsUsed);
  const toxMatch = TOX_SUB ? serviceMatchesSub(serviceLabel, TOX_SUB) : false;
  const fillerMatch = FILLER_SUB ? serviceMatchesSub(serviceLabel, FILLER_SUB) : false;

  if (fillerMatch && !toxMatch) return "filler";
  if (toxMatch && !fillerMatch) return "tox";
  if (ul.includes("syringe")) return "filler";
  if (ul.includes("ml") && !ul.includes("unit")) return "filler";
  if (qty > 0 && !ul.includes("syringe")) return "tox";
  if (label.includes("filler") && !label.includes("neurotoxin") && !label.includes("botox")) return "filler";
  return "tox";
}

function injectableSubKeyFromOfferingKey(offeringKey = "") {
  const k = String(offeringKey || "");
  if (k.endsWith("_filler")) return "filler";
  if (k.endsWith("_tox")) return "tox";
  return null;
}

export function resolveOfferingForAppointment({
  serviceLabel = "",
  serviceTypeId = null,
  serviceTypeName = "",
  offerings = {},
  injectableSubKey = null,
  menuOfferingKey = null,
  unitsLabel = "",
  unitsUsed = 0,
} = {}) {
  const entries = Object.entries(offerings || {});
  if (!entries.length) return null;

  const label = String(serviceLabel || "").trim();
  const stId = String(serviceTypeId || "").trim();

  if (stId) {
    const toxKey = `${stId}_tox`;
    const fillerKey = `${stId}_filler`;
    const hasTox = Boolean(offerings[toxKey]);
    const hasFiller = Boolean(offerings[fillerKey]);
    if (hasTox && hasFiller) {
      const forced =
        injectableSubKey === "tox" || injectableSubKey === "filler"
          ? injectableSubKey
          : injectableSubKeyFromOfferingKey(menuOfferingKey);
      const subKey =
        forced || pickInjectableSubKey({ serviceLabel: label, unitsLabel, unitsUsed });
      const key = subKey === "filler" ? fillerKey : toxKey;
      return { key, data: offerings[key], pricingModel: normalizePricingModel(offerings[key]?.pricing_model) };
    }
    if (hasTox) {
      return { key: toxKey, data: offerings[toxKey], pricingModel: normalizePricingModel(offerings[toxKey]?.pricing_model) };
    }
    if (hasFiller) {
      return { key: fillerKey, data: offerings[fillerKey], pricingModel: normalizePricingModel(offerings[fillerKey]?.pricing_model) };
    }
  }

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

  if (stId) {
    for (const sub of INJECTABLE_SUB_OFFERINGS) {
      const key = `${stId}_${sub.key}`;
      if (offerings[key]) {
        return { key, data: offerings[key], pricingModel: normalizePricingModel(offerings[key]?.pricing_model) };
      }
    }
    if (offerings[stId]) {
      return { key: stId, data: offerings[stId], pricingModel: normalizePricingModel(offerings[stId]?.pricing_model) };
    }
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
  const base = parseMoney(offering?.price);
  const unitPrice = parseMoney(unitRate ?? base);
  const areaPrice = parseMoney(areaRate ?? offering?.price_per_area ?? base);
  const flatPrice = parseMoney(flatAmount ?? base);
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
    lines.push({ type: PRICING_MODEL.UNIT, label: "Per unit", quantity: units, unit_price: unitPrice, amount });
    subtotal += amount;
  }
  if (modes.includes(PRICING_MODEL.AREA) && areaCount > 0) {
    const amount = Math.round(areaPrice * areaCount * 100) / 100;
    lines.push({ type: PRICING_MODEL.AREA, label: "Per area", quantity: areaCount, unit_price: areaPrice, amount });
    subtotal += amount;
  }
  if ((modes.includes(PRICING_MODEL.FLAT) || modes.includes(PRICING_MODEL.PACKAGE)) && flatPrice > 0) {
    lines.push({ type: PRICING_MODEL.FLAT, label: "Flat fee", quantity: 1, unit_price: flatPrice, amount: flatPrice });
    subtotal += flatPrice;
  }

  const maxPrice = parseMoney(offering?.price_max);
  let total = Math.round(subtotal * 100) / 100;
  if (maxPrice > 0 && total > maxPrice) total = maxPrice;
  if (finalTotal != null && Number.isFinite(Number(finalTotal))) {
    total = Math.round(Number(finalTotal) * 100) / 100;
  }

  return { lines, subtotal: Math.round(subtotal * 100) / 100, total };
}

export function parseBillingQuantities(source = {}) {
  const raw = String(source?.units_used ?? source?.unitsUsed ?? "").trim();
  const legacySyringes = String(source?.syringes_used ?? source?.syringesUsed ?? "").trim();
  const label = String(source?.units_label ?? source?.unitsLabel ?? "").toLowerCase();

  if (raw.startsWith("{")) {
    try {
      const j = JSON.parse(raw);
      return {
        units: j.units ?? j.neurotoxin ?? "",
        syringes: j.syringes ?? j.filler ?? "",
      };
    } catch {
      /* fall through */
    }
  }
  if (legacySyringes) return { units: raw, syringes: legacySyringes };
  if (label.includes("syringe")) return { units: "", syringes: raw };
  return { units: raw, syringes: "" };
}

export function getCombinedInjectableMenus(offerings = {}, serviceTypeId = null) {
  const stId = String(serviceTypeId || "").trim();
  if (!stId) return null;
  const tox = offerings[`${stId}_tox`];
  const filler = offerings[`${stId}_filler`];
  if (!tox || !filler) return null;
  return { stId, tox: { data: tox }, filler: { data: filler } };
}

export function calculateCombinedInjectableTotal({
  toxOffering = {},
  fillerOffering = {},
  unitsUsed = 0,
  syringesUsed = 0,
  areasTreated = [],
} = {}) {
  const lines = [];
  let subtotal = 0;
  const units = parseMoney(unitsUsed);
  const syringes = parseMoney(syringesUsed);
  const areaCount = Array.isArray(areasTreated) ? areasTreated.length : 0;

  if (units > 0) {
    const unitPrice = parseMoney(toxOffering?.price);
    const amount = Math.round(unitPrice * units * 100) / 100;
    lines.push({ type: PRICING_MODEL.UNIT, label: "Per unit", quantity: units, unit_price: unitPrice, amount });
    subtotal += amount;
  }
  if (syringes > 0) {
    const unitPrice = parseMoney(fillerOffering?.price);
    const amount = Math.round(unitPrice * syringes * 100) / 100;
    lines.push({ type: PRICING_MODEL.UNIT, label: "Per syringe", quantity: syringes, unit_price: unitPrice, amount });
    subtotal += amount;
  }
  if (areaCount > 0) {
    const toxArea = parseMoney(fillerOffering?.price_per_area) || parseMoney(toxOffering?.price_per_area) || parseMoney(toxOffering?.price);
    const fillerArea = parseMoney(fillerOffering?.price_per_area) || parseMoney(fillerOffering?.price);
    const areaPrice = Math.max(toxArea, fillerArea);
    if (areaPrice > 0) {
      const amount = Math.round(areaPrice * areaCount * 100) / 100;
      lines.push({ type: PRICING_MODEL.AREA, label: "Per area", quantity: areaCount, unit_price: areaPrice, amount });
      subtotal += amount;
    }
  }

  const total = Math.round(subtotal * 100) / 100;
  return { lines, subtotal: total, total };
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
