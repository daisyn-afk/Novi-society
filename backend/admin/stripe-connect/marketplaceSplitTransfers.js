import { getConnectStripeClient, isLegacyFeeTransferEnabled } from "./config.js";
import { getPlatformStripeConnectSettings } from "./platformLegacyRepository.js";
import {
  findMarketplaceTransferByPaymentIntent,
  insertMarketplaceTransferPending,
  markMarketplaceTransferCreated,
  markMarketplaceTransferFailed,
  TRANSFER_PURPOSE_LEGACY_GFE_FEE,
  TRANSFER_PURPOSE_PROVIDER_PAYOUT,
} from "./marketplaceTransferRepository.js";

const MARKETPLACE_CHECKOUT_TYPES = new Set(["appointment", "appointment_treatment"]);

function isMarketplaceConnectPayment(paymentIntent) {
  const metadata = paymentIntent?.metadata || {};
  if (String(metadata.stripe_platform || "").toLowerCase() !== "connect") return false;
  const checkoutType = String(metadata.checkout_type || "").toLowerCase();
  return MARKETPLACE_CHECKOUT_TYPES.has(checkoutType);
}

function getChargeId(paymentIntent) {
  return typeof paymentIntent?.latest_charge === "string"
    ? paymentIntent.latest_charge
    : paymentIntent?.latest_charge?.id || null;
}

async function ensureTransferRow({
  paymentIntentId,
  transferPurpose,
  destinationAccountId,
  amountCents,
  currency,
  metadata,
}) {
  const existing = await findMarketplaceTransferByPaymentIntent(paymentIntentId, transferPurpose);
  if (existing?.status === "created" && existing?.stripe_transfer_id) {
    return existing;
  }

  let row = existing;
  if (!row) {
    row = await insertMarketplaceTransferPending({
      stripePaymentIntentId: paymentIntentId,
      transferPurpose,
      destinationAccountId,
      amountCents,
      currency,
      metadata,
    });
  }

  if (!row?.id) {
    const again = await findMarketplaceTransferByPaymentIntent(paymentIntentId, transferPurpose);
    if (again?.status === "created" && again?.stripe_transfer_id) return again;
    row = again;
  }

  return row?.id ? row : null;
}

async function createConnectedTransfer({
  paymentIntent,
  transferPurpose,
  destinationAccountId,
  amountCents,
  idempotencyKey,
  extraMetadata = {},
}) {
  const stripe = getConnectStripeClient();
  if (!stripe) return null;

  const paymentIntentId = String(paymentIntent?.id || "").trim();
  const chargeId = getChargeId(paymentIntent);
  if (!paymentIntentId || !destinationAccountId || amountCents <= 0) return null;

  const row = await ensureTransferRow({
    paymentIntentId,
    transferPurpose,
    destinationAccountId,
    amountCents,
    currency: String(paymentIntent.currency || "usd"),
    metadata: {
      checkout_type: paymentIntent.metadata?.checkout_type || null,
      provider_id: paymentIntent.metadata?.provider_id || null,
      ...extraMetadata,
    },
  });
  if (!row?.id) return null;

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: amountCents,
        currency: String(paymentIntent.currency || "usd"),
        destination: destinationAccountId,
        ...(chargeId ? { source_transaction: chargeId } : {}),
        metadata: {
          payment_intent_id: paymentIntentId,
          stripe_charge_id: chargeId || "",
          checkout_type: String(paymentIntent.metadata?.checkout_type || ""),
          transfer_purpose: transferPurpose,
        },
      },
      { idempotencyKey }
    );

    await markMarketplaceTransferCreated(row.id, transfer.id);
    return { ...row, status: "created", stripe_transfer_id: transfer.id };
  } catch (error) {
    await markMarketplaceTransferFailed(row.id, error?.message || "Transfer failed.");
    // eslint-disable-next-line no-console
    console.error(`[stripe-connect/marketplace-split] ${transferPurpose} failed:`, error?.message || error);
    return null;
  }
}

/**
 * After a platform-owned marketplace charge succeeds, split funds to provider + legacy accounts.
 */
export async function processMarketplacePaymentSplit(paymentIntent) {
  if (!paymentIntent?.id) return null;
  if (!isMarketplaceConnectPayment(paymentIntent)) return null;

  const metadata = paymentIntent.metadata || {};
  const providerAccountId = String(metadata.stripe_connect_account_id || "").trim();
  const providerTransferCents = Number(metadata.provider_transfer_cents || 0);
  const platformFeeCents = Number(metadata.platform_fee_cents || 0);

  const results = { provider: null, legacy: null };

  if (providerAccountId && providerTransferCents > 0) {
    results.provider = await createConnectedTransfer({
      paymentIntent,
      transferPurpose: TRANSFER_PURPOSE_PROVIDER_PAYOUT,
      destinationAccountId: providerAccountId,
      amountCents: providerTransferCents,
      idempotencyKey: `marketplace-provider-${paymentIntent.id}`,
    });
  }

  if (platformFeeCents > 0 && isLegacyFeeTransferEnabled()) {
    const settings = await getPlatformStripeConnectSettings();
    const legacyAccountId = String(settings?.legacy_connected_account_id || "").trim();
    if (legacyAccountId && settings?.fee_transfer_enabled !== false) {
      results.legacy = await createConnectedTransfer({
        paymentIntent,
        transferPurpose: TRANSFER_PURPOSE_LEGACY_GFE_FEE,
        destinationAccountId: legacyAccountId,
        amountCents: platformFeeCents,
        idempotencyKey: `legacy-gfe-fee-${paymentIntent.id}`,
        extraMetadata: { legacy_account_id: legacyAccountId },
      });
    }
  }

  return results;
}
