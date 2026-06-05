import { getConnectStripeClient, isLegacyFeeTransferEnabled } from "./config.js";
import {
  findLegacyFeeTransferByPaymentIntent,
  getPlatformStripeConnectSettings,
  insertLegacyFeeTransferPending,
  markLegacyFeeTransferCreated,
  markLegacyFeeTransferFailed,
} from "./platformLegacyRepository.js";

const MARKETPLACE_CHECKOUT_TYPES = new Set(["appointment", "appointment_treatment"]);

function isMarketplaceConnectPayment(paymentIntent) {
  const metadata = paymentIntent?.metadata || {};
  if (String(metadata.stripe_platform || "").toLowerCase() !== "connect") return false;
  const checkoutType = String(metadata.checkout_type || "").toLowerCase();
  return MARKETPLACE_CHECKOUT_TYPES.has(checkoutType);
}

export async function transferPlatformFeeToLegacyAccount(paymentIntent) {
  if (!isLegacyFeeTransferEnabled()) return null;
  if (!paymentIntent?.id) return null;
  if (!isMarketplaceConnectPayment(paymentIntent)) return null;

  const feeCents = Number(paymentIntent.application_fee_amount || 0);
  if (!Number.isFinite(feeCents) || feeCents <= 0) return null;

  const settings = await getPlatformStripeConnectSettings();
  const legacyAccountId = String(settings?.legacy_connected_account_id || "").trim();
  if (!legacyAccountId || settings?.fee_transfer_enabled === false) return null;

  const existing = await findLegacyFeeTransferByPaymentIntent(paymentIntent.id);
  if (existing?.status === "created" && existing?.stripe_transfer_id) {
    return existing;
  }

  const stripe = getConnectStripeClient();
  if (!stripe) return null;

  const chargeId =
    typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id || null;

  let row = existing;
  if (!row) {
    row = await insertLegacyFeeTransferPending({
      stripePaymentIntentId: paymentIntent.id,
      stripeChargeId: chargeId,
      legacyAccountId,
      amountCents: feeCents,
      currency: String(paymentIntent.currency || "usd"),
      metadata: {
        checkout_type: paymentIntent.metadata?.checkout_type || null,
        provider_id: paymentIntent.metadata?.provider_id || null,
      },
    });
  }

  if (!row?.id) {
    const again = await findLegacyFeeTransferByPaymentIntent(paymentIntent.id);
    if (again?.status === "created" && again?.stripe_transfer_id) return again;
    row = again;
  }
  if (!row?.id) return null;

  try {
    // Transfer from platform balance (application fee). Do not use source_transaction —
    // destination charges lock source_transaction to the provider destination account only.
    const transfer = await stripe.transfers.create(
      {
        amount: feeCents,
        currency: String(paymentIntent.currency || "usd"),
        destination: legacyAccountId,
        metadata: {
          payment_intent_id: paymentIntent.id,
          stripe_charge_id: chargeId || "",
          checkout_type: String(paymentIntent.metadata?.checkout_type || ""),
          transfer_purpose: "platform_application_fee",
        },
      },
      { idempotencyKey: `legacy-fee-${paymentIntent.id}` }
    );

    await markLegacyFeeTransferCreated(row.id, transfer.id);
    return { ...row, status: "created", stripe_transfer_id: transfer.id };
  } catch (error) {
    await markLegacyFeeTransferFailed(row.id, error?.message || "Transfer failed.");
    // eslint-disable-next-line no-console
    console.error("[stripe-connect/legacy-fee-transfer] failed:", error?.message || error);
    return null;
  }
}
