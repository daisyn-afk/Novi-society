import {
  getConnectGfePlatformFeeCents,
  PAYMENT_TYPE_APPOINTMENT_TREATMENT,
  resolveConnectPlatformFeeCents,
  shouldApplyPlatformFee,
} from "./config.js";

export const GFE_FEE_LINE_LABEL = "GFE Fees";

export function appointmentRequiresGfe(appt) {
  if (appt?.requires_gfe === true) return true;
  if (appt?.requires_gfe === false) return false;

  const status = String(appt?.gfe_status || "").toLowerCase();
  if (status === "not_required") return false;
  return ["not_sent", "pending", "approved", "deferred", "not_available"].includes(status);
}

export function computeTreatmentPaymentBreakdown({
  treatmentAmount,
  requiresGfe,
  paymentType = PAYMENT_TYPE_APPOINTMENT_TREATMENT,
}) {
  const treatmentUsd = Number(treatmentAmount);
  const treatment = Number.isFinite(treatmentUsd) && treatmentUsd > 0 ? treatmentUsd : 0;
  const treatmentCents = Math.round(treatment * 100);
  const feeContext = {
    paymentType,
    requiresGfe: requiresGfe === true,
  };
  const platformFeeCents = resolveConnectPlatformFeeCents(feeContext);
  const chargeCents = treatmentCents + platformFeeCents;

  return {
    treatmentCents,
    platformFeeCents,
    chargeCents,
    treatmentAmount: treatmentCents / 100,
    platformFeeAmount: platformFeeCents / 100,
    totalChargeAmount: chargeCents / 100,
    feeApplied: platformFeeCents > 0,
    gfePlatformFeeCents: getConnectGfePlatformFeeCents(),
  };
}

export function buildTreatmentCheckoutLineItems({
  serviceLabel,
  description,
  treatmentCents,
  platformFeeCents,
}) {
  const items = [
    {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: treatmentCents,
        product_data: {
          name: `Treatment — ${serviceLabel}`,
          description,
        },
      },
    },
  ];

  if (platformFeeCents > 0) {
    items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: platformFeeCents,
        product_data: {
          name: GFE_FEE_LINE_LABEL,
          description: "Platform fee for Good Faith Exam services",
        },
      },
    });
  }

  return items;
}

export { shouldApplyPlatformFee };
