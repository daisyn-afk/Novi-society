export const GFE_FEE_LINE_LABEL = "GFE Fees";

function parseMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function computeTreatmentPaymentBreakdown({
  treatmentAmount,
  requiresGfe,
  applicationFeeBps = 0,
}) {
  const treatment = parseMoney(treatmentAmount);
  const treatmentCents = Math.round(treatment * 100);
  const bps = Number.isFinite(Number(applicationFeeBps)) ? Math.max(0, Math.floor(Number(applicationFeeBps))) : 0;
  const platformFeeCents =
    requiresGfe === true && bps > 0 && treatmentCents > 0
      ? Math.round((treatmentCents * bps) / 10000)
      : 0;
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
