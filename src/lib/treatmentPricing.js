/** Injectable sub-offerings (keys match PracticeTreatmentsTab). */
export const INJECTABLE_SUB_OFFERINGS = [
  {
    key: "tox",
    label: "Neurotoxin (Botox / Dysport / Xeomin)",
    matchTerms: ["neurotoxin", "botox", "dysport", "xeomin", "tox"],
    pricingHints: ["Per unit", "Per area", "Flat fee"],
  },
  {
    key: "filler",
    label: "Dermal Filler",
    matchTerms: ["filler", "dermal", "juvederm", "restylane", "cheek", "lip", "syringe"],
    pricingHints: ["Per syringe", "Per area", "Package price"],
  },
];

export const PRICING_MODEL = {
  UNIT: "unit",
  AREA: "area",
  FLAT: "flat",
  PACKAGE: "package",
};

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
  if (h.includes("flat")) return PRICING_MODEL.FLAT;
  return PRICING_MODEL.FLAT;
}

export function pricingModelLabel(model) {
  switch (model) {
    case PRICING_MODEL.UNIT:
      return "Per unit";
    case PRICING_MODEL.AREA:
      return "Per area";
    case PRICING_MODEL.PACKAGE:
      return "Package price";
    default:
      return "Flat fee";
  }
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

/**
 * Find the treatment-menu offering row for an appointment service label.
 */
export function resolveOfferingForAppointment({
  serviceLabel = "",
  serviceTypeId = null,
  serviceTypeName = "",
  offerings = {},
  injectableServiceTypeIds = [],
} = {}) {
  const entries = Object.entries(offerings || {});
  if (!entries.length) return null;

  const label = String(serviceLabel || "").trim();
  const stId = String(serviceTypeId || "").trim();
  const stName = normalizeText(serviceTypeName);

  if (label) {
    for (const [key, data] of entries) {
      for (const sub of INJECTABLE_SUB_OFFERINGS) {
        if (key.endsWith(`_${sub.key}`) && serviceMatchesSub(label, sub)) {
          return { key, data, subLabel: sub.label, pricingModel: normalizePricingModel(data?.pricing_model) };
        }
        if (normalizeText(sub.label) === normalizeText(label)) {
          return { key, data, subLabel: sub.label, pricingModel: normalizePricingModel(data?.pricing_model) };
        }
      }
      if (normalizeText(data?.display_name) === normalizeText(label)) {
        return { key, data, subLabel: label, pricingModel: normalizePricingModel(data?.pricing_model) };
      }
    }
  }

  if (stId) {
    for (const sub of INJECTABLE_SUB_OFFERINGS) {
      const key = `${stId}_${sub.key}`;
      if (offerings[key]) {
        const data = offerings[key];
        if (!label || serviceMatchesSub(label, sub) || injectableServiceTypeIds.includes(stId)) {
          return { key, data, subLabel: sub.label, pricingModel: normalizePricingModel(data?.pricing_model) };
        }
      }
    }
    if (offerings[stId]) {
      const data = offerings[stId];
      return {
        key: stId,
        data,
        subLabel: label || data?.display_name || serviceTypeName || "Treatment",
        pricingModel: normalizePricingModel(data?.pricing_model),
      };
    }
  }

  if (stName) {
    for (const [key, data] of entries) {
      if (normalizeText(key) === stName || normalizeText(data?.display_name) === stName) {
        return { key, data, subLabel: label || data?.display_name || serviceTypeName, pricingModel: normalizePricingModel(data?.pricing_model) };
      }
    }
  }

  const live = entries.find(([, data]) => data?.is_live);
  if (live) {
    const [key, data] = live;
    return { key, data, subLabel: label || data?.display_name || "Treatment", pricingModel: normalizePricingModel(data?.pricing_model) };
  }

  const [key, data] = entries[0];
  return { key, data, subLabel: label || "Treatment", pricingModel: normalizePricingModel(data?.pricing_model) };
}

/**
 * @param {object} opts
 * @param {string[]} [opts.chargeModes] - subset of unit|area|flat
 */
export function calculateTreatmentTotal({
  offering = {},
  pricingModel = PRICING_MODEL.FLAT,
  unitsUsed = 0,
  areasTreated = [],
  chargeModes = null,
  unitRate = null,
  areaRate = null,
  flatAmount = null,
} = {}) {
  const unitPrice = parseMoney(unitRate ?? offering?.price);
  const areaPrice = parseMoney(areaRate ?? offering?.price);
  const flatPrice = parseMoney(flatAmount ?? offering?.price);
  const units = Math.max(0, parseMoney(unitsUsed));
  const areaCount = Math.max(0, Array.isArray(areasTreated) ? areasTreated.length : 0);

  const modes =
    Array.isArray(chargeModes) && chargeModes.length
      ? chargeModes
      : [pricingModel || PRICING_MODEL.FLAT];

  const lines = [];
  let subtotal = 0;

  if (modes.includes(PRICING_MODEL.UNIT) && units > 0) {
    const amount = Math.round(unitPrice * units * 100) / 100;
    lines.push({
      type: PRICING_MODEL.UNIT,
      label: "Units",
      quantity: units,
      unit_price: unitPrice,
      amount,
    });
    subtotal += amount;
  }

  if (modes.includes(PRICING_MODEL.AREA) && areaCount > 0) {
    const amount = Math.round(areaPrice * areaCount * 100) / 100;
    lines.push({
      type: PRICING_MODEL.AREA,
      label: "Areas treated",
      quantity: areaCount,
      unit_price: areaPrice,
      amount,
    });
    subtotal += amount;
  }

  if (modes.includes(PRICING_MODEL.FLAT) || modes.includes(PRICING_MODEL.PACKAGE)) {
    const amount = flatPrice;
    if (amount > 0 || lines.length === 0) {
      lines.push({
        type: PRICING_MODEL.FLAT,
        label: pricingModelLabel(PRICING_MODEL.FLAT),
        quantity: 1,
        unit_price: flatPrice,
        amount,
      });
      subtotal += amount;
    }
  }

  if (!lines.length && flatPrice > 0) {
    lines.push({
      type: PRICING_MODEL.FLAT,
      label: pricingModelLabel(PRICING_MODEL.FLAT),
      quantity: 1,
      unit_price: flatPrice,
      amount: flatPrice,
    });
    subtotal = flatPrice;
  }

  const maxPrice = parseMoney(offering?.price_max);
  let capped = subtotal;
  if (maxPrice > 0 && capped > maxPrice) capped = maxPrice;

  return {
    lines,
    subtotal: Math.round(subtotal * 100) / 100,
    total: Math.round(capped * 100) / 100,
    unitPrice,
    areaPrice,
    flatPrice,
  };
}

export function defaultChargeModesForModel(model) {
  if (model === PRICING_MODEL.UNIT) return [PRICING_MODEL.UNIT];
  if (model === PRICING_MODEL.AREA) return [PRICING_MODEL.AREA];
  return [PRICING_MODEL.FLAT];
}

export function applyTreatmentDiscount(subtotal, discountAmount) {
  const sub = parseMoney(subtotal);
  const disc = Math.min(parseMoney(discountAmount), sub);
  return {
    discount: Math.round(disc * 100) / 100,
    totalAfterDiscount: Math.max(0, Math.round((sub - disc) * 100) / 100),
  };
}

export function amountDueAfterDeposit(total, depositPaid) {
  const t = parseMoney(total);
  const d = parseMoney(depositPaid);
  return Math.max(0, Math.round((t - d) * 100) / 100);
}

/** Treatment balance: (subtotal − discount) − booking deposit already paid. */
export function treatmentAmountDue({ subtotal, discount = 0, depositPaid = 0 } = {}) {
  const { totalAfterDiscount } = applyTreatmentDiscount(subtotal, discount);
  return amountDueAfterDeposit(totalAfterDiscount, depositPaid);
}

export function formatUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "$0.00";
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
}
