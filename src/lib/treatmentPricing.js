/** Injectable sub-offerings (keys match PracticeTreatmentsTab). */
export const INJECTABLE_SUB_OFFERINGS = [
  {
    key: "tox",
    label: "Neurotoxin (Botox / Dysport / Xeomin)",
    matchTerms: ["neurotoxin", "botox", "dysport", "xeomin", "tox"],
    pricingHints: ["Per unit", "Per area", "Flat fee"],
    popularAreas: [
      "Forehead",
      "Glabella",
      "Crow's Feet",
      "Brow lift",
      "Bunny lines",
      "Lip flip",
      "Chin",
      "Neck",
    ],
  },
  {
    key: "filler",
    label: "Dermal Filler",
    matchTerms: ["filler", "dermal", "juvederm", "restylane", "cheek", "lip", "syringe"],
    pricingHints: ["Per syringe", "Per area", "Package price"],
    popularAreas: [
      "Lips",
      "Nasolabial Folds",
      "Cheeks",
      "Under-eye",
      "Jawline",
      "Chin",
      "Temples",
      "Marionette Lines",
    ],
  },
];

/** Injectable MD coverage often has two menu rows: neurotoxin + dermal filler. */
export function injectableSubKeysAvailable(offerings = {}, serviceTypeId = null) {
  const stId = String(serviceTypeId || "").trim();
  if (!stId) return [];
  const keys = [];
  if (offerings[`${stId}_tox`]) keys.push("tox");
  if (offerings[`${stId}_filler`]) keys.push("filler");
  return keys;
}

/** @deprecated Combined injectable log replaces per-visit tox/filler tabs. */
export function needsInjectableSubPicker() {
  return false;
}

export function injectableSubKeyFromOfferingKey(offeringKey = "") {
  const k = String(offeringKey || "");
  if (k.endsWith("_filler")) return "filler";
  if (k.endsWith("_tox")) return "tox";
  return null;
}

const ALL_INJECTABLE_AREA_SUGGESTIONS = [
  ...new Set(INJECTABLE_SUB_OFFERINGS.flatMap((s) => s.popularAreas || [])),
];

export function getCombinedInjectableMenus(offerings = {}, serviceTypeId = null) {
  const stId = String(serviceTypeId || "").trim();
  if (!stId) return null;
  const tox = offerings[`${stId}_tox`];
  const filler = offerings[`${stId}_filler`];
  if (!tox || !filler) return null;
  return {
    stId,
    tox: { key: `${stId}_tox`, data: tox },
    filler: { key: `${stId}_filler`, data: filler },
    menuOfferingKey: `${stId}_combined`,
  };
}

export function isCombinedInjectableLog(offerings = {}, serviceTypeId = null) {
  return Boolean(getCombinedInjectableMenus(offerings, serviceTypeId));
}

/**
 * Combined injectable visits store both counts in existing `units_used` as JSON.
 * Example: {"units":20,"syringes":2} — no extra DB columns required.
 */
export function parseBillingQuantities(source = {}) {
  const raw =
    typeof source === "string" || typeof source === "number"
      ? String(source)
      : String(source?.units_used ?? source?.unitsUsed ?? "").trim();
  const legacySyringes = String(source?.syringes_used ?? source?.syringesUsed ?? "").trim();
  const label = String(source?.units_label ?? source?.unitsLabel ?? "").toLowerCase();

  if (raw.startsWith("{")) {
    try {
      const j = JSON.parse(raw);
      return {
        units: j.units ?? j.neurotoxin ?? "",
        syringes: j.syringes ?? j.filler ?? "",
        isCombinedPayload: true,
      };
    } catch {
      /* plain text */
    }
  }

  if (legacySyringes) {
    return { units: raw, syringes: legacySyringes, isCombinedPayload: true };
  }
  if (label.includes("syringe")) {
    return { units: "", syringes: raw, isCombinedPayload: false };
  }
  return { units: raw, syringes: "", isCombinedPayload: false };
}

export function serializeBillingQuantities({ units = "", syringes = "", isCombined = false } = {}) {
  const u = parseMoney(units);
  const s = parseMoney(syringes);
  if (isCombined && (u > 0 || s > 0)) {
    return JSON.stringify({ units: u, syringes: s });
  }
  if (s > 0 && u === 0) return String(s);
  return units === "" || units == null ? "" : String(units);
}

export function billingQuantitiesForForm(unitsUsedField = "", isCombinedInjectable = false) {
  const parsed = parseBillingQuantities({ units_used: unitsUsedField });
  if (isCombinedInjectable || parsed.isCombinedPayload) {
    return { units_used: parsed.units, syringes_used: parsed.syringes };
  }
  return { units_used: unitsUsedField, syringes_used: "" };
}

/** Suggestions for areas chips (menu + defaults); user can add custom areas too. */
export function combinedInjectableAreaSuggestions(offerings = {}, serviceTypeId = null) {
  const bundle = getCombinedInjectableMenus(offerings, serviceTypeId);
  const collected = [];
  if (bundle) {
    for (const row of [bundle.tox.data, bundle.filler.data]) {
      const fromMenu = row?.areas_offered;
      if (Array.isArray(fromMenu)) collected.push(...fromMenu);
    }
  }
  return [...new Set([...collected.filter(Boolean), ...ALL_INJECTABLE_AREA_SUGGESTIONS])];
}

export function areasForInjectableOffering(menuOffering = {}, injectableSubKey = null) {
  const fromMenu = menuOffering?.data?.areas_offered;
  if (Array.isArray(fromMenu) && fromMenu.length > 0) return fromMenu;
  const sub =
    injectableSubKey ||
    injectableSubKeyFromOfferingKey(menuOffering?.key) ||
    (menuOffering?.key?.includes("filler") ? "filler" : menuOffering?.key?.includes("tox") ? "tox" : null);
  const def = INJECTABLE_SUB_OFFERINGS.find((s) => s.key === sub);
  if (def?.popularAreas?.length) return def.popularAreas;
  return ALL_INJECTABLE_AREA_SUGGESTIONS;
}

/** Combined injectable visit: units (tox menu) + syringes (filler menu) + areas in one form. */
export function combinedInjectableLogFormConfig() {
  return {
    injectableCombined: true,
    unit: true,
    area: true,
    flat: false,
    showAreasOnLog: true,
    showAreasBeforeQuantity: false,
    showAmountOnLog: false,
    showUnitsField: true,
    showSyringesField: true,
    menuPrimary: "combined",
    logHelper:
      "Log neurotoxin units, filler syringes, and areas treated in one visit. Invoice uses both rows from your treatment menu.",
  };
}

function areaRateFromOffering(offering = {}) {
  const rates = menuRatesFromOffering(offering);
  const explicit = parseMoney(offering?.price_per_area);
  return explicit > 0 ? explicit : rates.areaRate;
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

  if (units > 0 && toxOffering?.price != null) {
    const rates = menuRatesFromOffering(toxOffering);
    const amount = Math.round(rates.unitRate * units * 100) / 100;
    lines.push({
      type: PRICING_MODEL.UNIT,
      label: menuPricingLineLabel(PRICING_MODEL.UNIT, toxOffering),
      quantity: units,
      unit_price: rates.unitRate,
      amount,
    });
    subtotal += amount;
  }

  if (syringes > 0 && fillerOffering?.price != null) {
    const rates = menuRatesFromOffering(fillerOffering);
    const amount = Math.round(rates.unitRate * syringes * 100) / 100;
    lines.push({
      type: PRICING_MODEL.UNIT,
      label: menuPricingLineLabel(PRICING_MODEL.UNIT, fillerOffering) || "Per syringe",
      quantity: syringes,
      unit_price: rates.unitRate,
      amount,
    });
    subtotal += amount;
  }

  if (areaCount > 0) {
    const toxArea = areaRateFromOffering(toxOffering);
    const fillerArea = areaRateFromOffering(fillerOffering);
    const areaPrice = Math.max(toxArea, fillerArea);
    if (areaPrice > 0) {
      const amount = Math.round(areaPrice * areaCount * 100) / 100;
      lines.push({
        type: PRICING_MODEL.AREA,
        label: "Per area",
        quantity: areaCount,
        unit_price: areaPrice,
        amount,
      });
      subtotal += amount;
    }
  }

  return {
    lines,
    subtotal: Math.round(subtotal * 100) / 100,
    total: Math.round(subtotal * 100) / 100,
  };
}

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

/** Prefer the exact label saved on the treatment menu row. */
export function menuPricingLineLabel(model, offering = {}) {
  const saved = String(offering?.pricing_model || "").trim();
  if (saved) return saved;
  return pricingModelLabel(model);
}

/**
 * Stored value for treatment_records.units_label (billing quantity type).
 * Set from Treatment Menu — not a free-form dropdown on log treatment.
 */
export function billingUnitsLabelForMenu(pricingModel, menuPricingHint = "") {
  const hint = String(menuPricingHint || "").trim().toLowerCase();
  if (hint.includes("syringe")) return "syringes";
  if (pricingModel === PRICING_MODEL.UNIT || hint.includes("per unit")) return "units";
  if (hint.includes("package")) return "package";
  if (hint.includes("flat")) return "treatment";
  return "units";
}

/** @deprecated Use billingUnitsLabelForMenu — menu picks the billing unit. */
export function unitLabelOptionsForMenu(pricingModel, menuPricingHint = "") {
  const value = billingUnitsLabelForMenu(pricingModel, menuPricingHint);
  const labels = {
    units: "Units",
    syringes: "Syringes",
    package: "Package",
    treatment: "Treatment",
    areas: "Areas",
  };
  return [{ value, label: labels[value] || value }];
}

export function defaultUnitLabelForMenu(pricingModel, menuPricingHint = "") {
  return billingUnitsLabelForMenu(pricingModel, menuPricingHint);
}

/** Human label for the quantity input (matches menu pricing model). */
export function quantityFieldLabelForMenu(menuPricingHint = "") {
  const h = String(menuPricingHint || "").trim().toLowerCase();
  if (h.includes("syringe")) {
    return {
      label: "Number of syringes",
      placeholder: "e.g. 2",
      billingNote: "Counts toward invoice (per syringe × your menu price). Product mL goes under Products Used.",
    };
  }
  if (h.includes("per unit")) {
    return {
      label: "Number of units",
      placeholder: "e.g. 20",
      billingNote: "Botox/Dysport units for invoice. Product details go under Products Used.",
    };
  }
  return {
    label: "Quantity",
    placeholder: "e.g. 1",
    billingNote: "Used for invoice calculation from your treatment menu.",
  };
}

/**
 * Which charge types and log fields apply for this service (provider treatment menu).
 * Injectables: unit/syringe + area + optional flat at checkout.
 * IV / flat-only services: flat fee only, no units/areas on log form.
 */
export function serviceChargeCapabilities({
  menuPricingHint = "",
  serviceLabel = "",
  serviceCategory = "",
} = {}) {
  const hint = String(menuPricingHint || "").trim().toLowerCase();
  const svc = String(serviceLabel || "").trim().toLowerCase();
  const cat = String(serviceCategory || "").trim().toLowerCase();

  const looksLikeIv =
    svc.includes("iv therapy") ||
    svc.includes("iv drip") ||
    svc.includes("intravenous") ||
    /\biv\b/.test(svc);
  const flatOnlyMenu =
    (hint.includes("flat fee") || hint === "flat fee") &&
    !hint.includes("unit") &&
    !hint.includes("syringe") &&
    !hint.includes("area");
  const injectable =
    cat === "injectables" ||
    svc.includes("neurotoxin") ||
    svc.includes("botox") ||
    svc.includes("filler") ||
    svc.includes("injectable");

  if (looksLikeIv || (flatOnlyMenu && !injectable)) {
    return {
      unit: false,
      area: false,
      flat: true,
      unitChargeLabel: "Per unit",
      showAreasOnLog: false,
      showAmountOnLog: false,
      showUnitLabelOnLog: false,
    };
  }

  if (hint.includes("per area") && !hint.includes("syringe") && !hint.includes("per unit")) {
    return {
      unit: true,
      area: true,
      flat: true,
      unitChargeLabel: "Per unit",
      menuPrimary: "area",
      showAreasOnLog: true,
      showAmountOnLog: false,
      showUnitLabelOnLog: false,
    };
  }
  if (hint.includes("syringe")) {
    return {
      unit: true,
      area: true,
      flat: true,
      unitChargeLabel: "Per syringe",
      menuPrimary: "unit",
      showAreasOnLog: true,
      showAmountOnLog: true,
      showUnitLabelOnLog: false,
    };
  }
  if (hint.includes("package")) {
    return {
      unit: true,
      area: true,
      flat: true,
      unitChargeLabel: "Per unit",
      menuPrimary: "flat",
      showAreasOnLog: true,
      showAmountOnLog: false,
      showUnitLabelOnLog: false,
    };
  }
  if (hint.includes("flat")) {
    return {
      unit: false,
      area: false,
      flat: true,
      unitChargeLabel: "Per unit",
      menuPrimary: "flat",
      showAreasOnLog: false,
      showAmountOnLog: false,
      showUnitLabelOnLog: false,
    };
  }
  if (hint.includes("per unit")) {
    return {
      unit: true,
      area: true,
      flat: true,
      unitChargeLabel: "Per unit",
      menuPrimary: "unit",
      showAreasOnLog: true,
      showAmountOnLog: true,
      showUnitLabelOnLog: false,
    };
  }

  const unitChargeLabel = hint.includes("syringe") ? "Per syringe" : "Per unit";
  return {
    unit: true,
    area: true,
    flat: true,
    unitChargeLabel,
    menuPrimary: "unit",
    showAreasOnLog: true,
    showAmountOnLog: true,
    showUnitLabelOnLog: false,
  };
}

/** Labels for the amount field on log-treatment (matches treatment menu). */
export function amountFieldLabelForMenu(pricingModel, menuPricingHint = "") {
  const caps = serviceChargeCapabilities({ menuPricingHint });
  if (!caps.showAmountOnLog) {
    return { showAmount: false, amountLabel: "", showUnitLabel: false };
  }
  const hint = String(menuPricingHint || "").trim().toLowerCase();
  if (hint.includes("syringe")) {
    return { showAmount: true, amountLabel: "Syringes used", showUnitLabel: true };
  }
  if (pricingModel === PRICING_MODEL.UNIT || hint.includes("per unit")) {
    return { showAmount: true, amountLabel: "Units used", showUnitLabel: true };
  }
  return { showAmount: true, amountLabel: "Amount used", showUnitLabel: true };
}

/** Log-treatment UI driven by the one pricing model selected in Treatment Menu. */
export function logTreatmentFormConfig(menuPricingHint = "", serviceLabel = "") {
  const hint = String(menuPricingHint || "").trim();
  const caps = serviceChargeCapabilities({ menuPricingHint: hint, serviceLabel });
  const h = hint.toLowerCase();

  let logHelper = "Document this visit; checkout will calculate from your treatment menu prices.";
  if (!caps.showAmountOnLog && !caps.showAreasOnLog) {
    logHelper =
      "This service uses a flat fee on your treatment menu. Record products and notes; no units or areas required.";
  } else if (caps.menuPrimary === "area") {
    logHelper = "Select each area treated. Invoice = areas × your menu price per area.";
  } else if (h.includes("syringe")) {
    logHelper = "Enter how many syringes you administered. Invoice = count × your per-syringe menu price.";
  } else if (h.includes("per unit")) {
    logHelper = "Enter neurotoxin units administered. Invoice = units × your per-unit menu price.";
  } else if (caps.showAmountOnLog) {
    logHelper = "Enter quantity for invoice. Product mL/volume is logged under Products Used.";
  }

  const qty = quantityFieldLabelForMenu(hint);

  return {
    ...caps,
    menuPricingHint: hint,
    quantityLabel: qty.label,
    quantityPlaceholder: qty.placeholder,
    quantityBillingNote: qty.billingNote,
    logHelper,
    showAreasBeforeQuantity: caps.menuPrimary === "area",
  };
}

/** Rates from treatment menu row (supports optional separate per-area price). */
export function menuRatesFromOffering(offering = {}) {
  const unitRate = parseMoney(offering?.price);
  const areaRate = parseMoney(offering?.price_per_area) || unitRate;
  const flatAmount = unitRate;
  return { unitRate, areaRate, flatAmount };
}

/**
 * Auto-build invoice lines from treatment menu + logged treatment record (Ashlan flow).
 * Primary model from menu; injectables also add area/unit lines when those were logged.
 */
export function buildAutoInvoiceChargeModes({
  menuPricingHint = "",
  capabilities = {},
  unitsUsed = 0,
  areasTreated = [],
} = {}) {
  const units = parseMoney(unitsUsed);
  const areaCount = Array.isArray(areasTreated) ? areasTreated.length : 0;
  const hint = String(menuPricingHint || "").trim().toLowerCase();
  const primary = capabilities.menuPrimary || "unit";

  if (!capabilities.unit && !capabilities.area && capabilities.flat) {
    return [PRICING_MODEL.FLAT];
  }

  const modes = [];

  if (primary === "unit" && units > 0) modes.push(PRICING_MODEL.UNIT);
  if (primary === "area" && areaCount > 0) modes.push(PRICING_MODEL.AREA);
  if (primary === "flat" || hint.includes("package") || hint.includes("flat fee")) {
    modes.push(PRICING_MODEL.FLAT);
  }

  if (capabilities.unit && !modes.includes(PRICING_MODEL.UNIT) && units > 0) {
    modes.push(PRICING_MODEL.UNIT);
  }
  if (capabilities.area && !modes.includes(PRICING_MODEL.AREA) && areaCount > 0) {
    modes.push(PRICING_MODEL.AREA);
  }

  if (!modes.length) {
    if (units > 0) modes.push(PRICING_MODEL.UNIT);
    else if (areaCount > 0) modes.push(PRICING_MODEL.AREA);
    else modes.push(PRICING_MODEL.FLAT);
  }

  return modes;
}

/** Sync checkout toggles with auto charge modes. */
export function checkoutTogglesFromChargeModes(chargeModes = [], capabilities = {}) {
  const modes = chargeModes || [];
  return {
    chargeUnit: Boolean(capabilities.unit) && modes.includes(PRICING_MODEL.UNIT),
    chargeArea: Boolean(capabilities.area) && modes.includes(PRICING_MODEL.AREA),
    chargeFlat: Boolean(capabilities.flat) && modes.includes(PRICING_MODEL.FLAT),
  };
}

export function defaultCheckoutChargeToggles(opts) {
  const modes = buildAutoInvoiceChargeModes(opts);
  return checkoutTogglesFromChargeModes(modes, opts.capabilities);
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

/** When tox + filler menu rows exist, pick which sub-offering applies to this visit. */
export function pickInjectableSubKey({ serviceLabel = "", unitsLabel = "", unitsUsed = 0 } = {}) {
  const label = normalizeText(serviceLabel);
  const ul = normalizeText(unitsLabel);
  const qty = parseMoney(unitsUsed);
  const toxMatch = TOX_SUB ? serviceMatchesSub(serviceLabel, TOX_SUB) : false;
  const fillerMatch = FILLER_SUB ? serviceMatchesSub(serviceLabel, FILLER_SUB) : false;

  if (fillerMatch && !toxMatch) return "filler";
  if (toxMatch && !fillerMatch) return "tox";

  if (ul.includes("syringe")) return "filler";
  /* legacy records may have mL in units_label from old UI */
  if (ul.includes("ml") && !ul.includes("unit")) return "filler";
  if (qty > 0 && !ul.includes("syringe")) return "tox";
  if (label.includes("filler") && !label.includes("neurotoxin") && !label.includes("botox")) return "filler";

  return "tox";
}

function offeringResult(key, data, subLabel, pricingModel) {
  return {
    key,
    data,
    subLabel,
    pricingModel: normalizePricingModel(data?.pricing_model || pricingModel),
  };
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
  injectableSubKey = null,
  menuOfferingKey = null,
  unitsLabel = "",
  unitsUsed = 0,
} = {}) {
  const entries = Object.entries(offerings || {});
  if (!entries.length) return null;

  const label = String(serviceLabel || "").trim();
  const stId = String(serviceTypeId || "").trim();
  const stName = normalizeText(serviceTypeName);

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
      const sub = INJECTABLE_SUB_OFFERINGS.find((s) => s.key === subKey);
      return offeringResult(key, offerings[key], sub?.label || label, offerings[key]?.pricing_model);
    }
    if (hasTox && !hasFiller) {
      return offeringResult(toxKey, offerings[toxKey], INJECTABLE_SUB_OFFERINGS[0].label, offerings[toxKey]?.pricing_model);
    }
    if (hasFiller && !hasTox) {
      return offeringResult(fillerKey, offerings[fillerKey], INJECTABLE_SUB_OFFERINGS[1].label, offerings[fillerKey]?.pricing_model);
    }
  }

  if (label) {
    for (const [key, data] of entries) {
      for (const sub of INJECTABLE_SUB_OFFERINGS) {
        if (key.endsWith(`_${sub.key}`) && serviceMatchesSub(label, sub)) {
          return offeringResult(key, data, sub.label, data?.pricing_model);
        }
        if (normalizeText(sub.label) === normalizeText(label)) {
          return offeringResult(key, data, sub.label, data?.pricing_model);
        }
      }
      if (normalizeText(data?.display_name) === normalizeText(label)) {
        return offeringResult(key, data, label, data?.pricing_model);
      }
    }
  }

  if (stId) {
    for (const sub of INJECTABLE_SUB_OFFERINGS) {
      const key = `${stId}_${sub.key}`;
      if (offerings[key]) {
        const data = offerings[key];
        if (!label || serviceMatchesSub(label, sub) || injectableServiceTypeIds.includes(stId)) {
          return offeringResult(key, data, sub.label, data?.pricing_model);
        }
      }
    }
    if (offerings[stId]) {
      const data = offerings[stId];
      return offeringResult(
        stId,
        data,
        label || data?.display_name || serviceTypeName || "Treatment",
        data?.pricing_model
      );
    }
  }

  if (stName) {
    for (const [key, data] of entries) {
      if (normalizeText(key) === stName || normalizeText(data?.display_name) === stName) {
        return offeringResult(key, data, label || data?.display_name || serviceTypeName, data?.pricing_model);
      }
    }
  }

  const live = entries.find(([, data]) => data?.is_live);
  if (live) {
    const [key, data] = live;
    return offeringResult(key, data, label || data?.display_name || "Treatment", data?.pricing_model);
  }

  const [key, data] = entries[0];
  return offeringResult(key, data, label || "Treatment", data?.pricing_model);
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
  const rates = menuRatesFromOffering(offering);
  const unitPrice = parseMoney(unitRate ?? rates.unitRate);
  const areaPrice = parseMoney(areaRate ?? rates.areaRate);
  const flatPrice = parseMoney(flatAmount ?? rates.flatAmount);
  const units = Math.max(0, parseMoney(unitsUsed));
  const areaCount = Math.max(0, Array.isArray(areasTreated) ? areasTreated.length : 0);

  const modes =
    Array.isArray(chargeModes) && chargeModes.length
      ? chargeModes
      : defaultChargeModesForModel(pricingModel);

  const lines = [];
  let subtotal = 0;

  if (modes.includes(PRICING_MODEL.UNIT) && units > 0) {
    const amount = Math.round(unitPrice * units * 100) / 100;
    lines.push({
      type: PRICING_MODEL.UNIT,
      label: menuPricingLineLabel(PRICING_MODEL.UNIT, offering),
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
      label: menuPricingLineLabel(PRICING_MODEL.AREA, offering),
      quantity: areaCount,
      unit_price: areaPrice,
      amount,
    });
    subtotal += amount;
  }

  if ((modes.includes(PRICING_MODEL.FLAT) || modes.includes(PRICING_MODEL.PACKAGE)) && flatPrice > 0) {
    lines.push({
      type: PRICING_MODEL.FLAT,
      label: menuPricingLineLabel(PRICING_MODEL.FLAT, offering),
      quantity: 1,
      unit_price: flatPrice,
      amount: flatPrice,
    });
    subtotal += flatPrice;
  }

  const maxPrice = parseMoney(offering?.price_max);
  let capped = subtotal;
  const priceCapApplied = maxPrice > 0 && capped > maxPrice;
  if (priceCapApplied) capped = maxPrice;

  return {
    lines,
    subtotal: Math.round(subtotal * 100) / 100,
    total: Math.round(capped * 100) / 100,
    maxPrice: maxPrice > 0 ? maxPrice : null,
    priceCapApplied,
    priceCapReduction: priceCapApplied ? Math.round((subtotal - capped) * 100) / 100 : 0,
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

/** When menu max price is lower than the calculated total, block invoicing until fixed. */
export function maxPriceCapValidationError(estimate) {
  if (!estimate?.priceCapApplied) return null;
  return `Calculated total (${formatUsd(estimate.subtotal)}) exceeds your menu max price (${formatUsd(estimate.maxPrice)}). Go to Practice → Treatments and increase or clear Max Price ($) for this service, then try again.`;
}
