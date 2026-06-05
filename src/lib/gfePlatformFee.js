export const GFE_FEE_LINE_LABEL = "GFE Fees";

export const DEFAULT_GFE_PLATFORM_FEE_USD = 50;

function parseMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function computeTreatmentPaymentBreakdown({
  treatmentAmount,
  requiresGfe,
  gfePlatformFeeUsd = DEFAULT_GFE_PLATFORM_FEE_USD,
}) {
  const treatment = parseMoney(treatmentAmount);
  const treatmentCents = Math.round(treatment * 100);
  const feeUsd = requiresGfe === true ? parseMoney(gfePlatformFeeUsd) : 0;
  const platformFeeCents = Math.round(feeUsd * 100);
  const chargeCents = treatmentCents + platformFeeCents;

  return {
    treatmentAmount: treatmentCents / 100,
    platformFeeAmount: platformFeeCents / 100,
    totalChargeAmount: chargeCents / 100,
    feeApplied: platformFeeCents > 0,
  };
}

export function formatTreatmentChargeLabel(amount) {
  const n = parseMoney(amount);
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}
