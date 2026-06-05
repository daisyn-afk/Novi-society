import { query } from "../db.js";

export const TRANSFER_PURPOSE_PROVIDER_PAYOUT = "provider_payout";
export const TRANSFER_PURPOSE_LEGACY_GFE_FEE = "legacy_gfe_fee";

export async function findMarketplaceTransferByPaymentIntent(paymentIntentId, transferPurpose) {
  const pi = String(paymentIntentId || "").trim();
  const purpose = String(transferPurpose || "").trim();
  if (!pi || !purpose) return null;

  const { rows } = await query(
    `select * from public.connect_marketplace_transfers
      where stripe_payment_intent_id = $1
        and transfer_purpose = $2
      limit 1`,
    [pi, purpose]
  );
  return rows[0] || null;
}

export async function insertMarketplaceTransferPending({
  stripePaymentIntentId,
  transferPurpose,
  destinationAccountId,
  amountCents,
  currency,
  metadata,
}) {
  const { rows } = await query(
    `insert into public.connect_marketplace_transfers (
       stripe_payment_intent_id,
       transfer_purpose,
       destination_account_id,
       amount_cents,
       currency,
       status,
       metadata
     ) values ($1, $2, $3, $4, $5, 'pending', $6::jsonb)
     on conflict (stripe_payment_intent_id, transfer_purpose) do nothing
     returning *`,
    [
      stripePaymentIntentId,
      transferPurpose,
      destinationAccountId,
      amountCents,
      currency || "usd",
      JSON.stringify(metadata || {}),
    ]
  );
  return rows[0] || null;
}

export async function markMarketplaceTransferCreated(id, stripeTransferId) {
  await query(
    `update public.connect_marketplace_transfers
        set status = 'created',
            stripe_transfer_id = $2,
            error_message = null
      where id = $1`,
    [id, stripeTransferId || null]
  );
}

export async function markMarketplaceTransferFailed(id, errorMessage) {
  await query(
    `update public.connect_marketplace_transfers
        set status = 'failed',
            error_message = $2
      where id = $1`,
    [id, String(errorMessage || "").slice(0, 500) || null]
  );
}
