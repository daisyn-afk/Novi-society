import { query } from "../db.js";

const SETTINGS_ID = "default";

export async function getPlatformStripeConnectSettings() {
  const { rows } = await query(
    `select *
       from public.platform_stripe_connect_settings
      where id = $1
      limit 1`,
    [SETTINGS_ID]
  );
  return rows[0] || null;
}

export async function upsertPlatformLegacyConnection({
  legacyConnectedAccountId,
  legacyAccountEmail,
  legacyChargesEnabled,
  legacyPayoutsEnabled,
  legacyDetailsSubmitted,
  connectedByAuthUserId,
}) {
  const { rows } = await query(
    `insert into public.platform_stripe_connect_settings (
       id,
       legacy_connected_account_id,
       legacy_account_email,
       legacy_charges_enabled,
       legacy_payouts_enabled,
       legacy_details_submitted,
       fee_transfer_enabled,
       connected_at,
       connected_by_auth_user_id,
       updated_at
     ) values (
       $1, $2, $3, $4, $5, $6, true, now(), $7, now()
     )
     on conflict (id) do update set
       legacy_connected_account_id = excluded.legacy_connected_account_id,
       legacy_account_email = coalesce(excluded.legacy_account_email, platform_stripe_connect_settings.legacy_account_email),
       legacy_charges_enabled = excluded.legacy_charges_enabled,
       legacy_payouts_enabled = excluded.legacy_payouts_enabled,
       legacy_details_submitted = excluded.legacy_details_submitted,
       connected_at = coalesce(platform_stripe_connect_settings.connected_at, now()),
       connected_by_auth_user_id = coalesce(excluded.connected_by_auth_user_id, platform_stripe_connect_settings.connected_by_auth_user_id),
       updated_at = now()
     returning *`,
    [
      SETTINGS_ID,
      legacyConnectedAccountId || null,
      legacyAccountEmail || null,
      Boolean(legacyChargesEnabled),
      Boolean(legacyPayoutsEnabled),
      Boolean(legacyDetailsSubmitted),
      connectedByAuthUserId || null,
    ]
  );
  return rows[0] || null;
}

export async function updatePlatformLegacyAccountFlags({
  legacyChargesEnabled,
  legacyPayoutsEnabled,
  legacyDetailsSubmitted,
}) {
  const { rows } = await query(
    `update public.platform_stripe_connect_settings
        set legacy_charges_enabled = coalesce($2, legacy_charges_enabled),
            legacy_payouts_enabled = coalesce($3, legacy_payouts_enabled),
            legacy_details_submitted = coalesce($4, legacy_details_submitted),
            updated_at = now()
      where id = $1
        and legacy_connected_account_id is not null
      returning *`,
    [
      SETTINGS_ID,
      legacyChargesEnabled ?? null,
      legacyPayoutsEnabled ?? null,
      legacyDetailsSubmitted ?? null,
    ]
  );
  return rows[0] || null;
}

export async function clearPlatformLegacyConnection() {
  const { rows } = await query(
    `update public.platform_stripe_connect_settings
        set legacy_connected_account_id = null,
            legacy_account_email = null,
            legacy_charges_enabled = false,
            legacy_payouts_enabled = false,
            legacy_details_submitted = false,
            connected_at = null,
            connected_by_auth_user_id = null,
            updated_at = now()
      where id = $1
      returning *`,
    [SETTINGS_ID]
  );
  return rows[0] || null;
}

export async function setPlatformFeeTransferEnabled(enabled) {
  const { rows } = await query(
    `update public.platform_stripe_connect_settings
        set fee_transfer_enabled = $2,
            updated_at = now()
      where id = $1
      returning *`,
    [SETTINGS_ID, Boolean(enabled)]
  );
  return rows[0] || null;
}

export async function findLegacyFeeTransferByPaymentIntent(paymentIntentId) {
  const id = String(paymentIntentId || "").trim();
  if (!id) return null;
  const { rows } = await query(
    `select * from public.connect_legacy_fee_transfers
      where stripe_payment_intent_id = $1
      limit 1`,
    [id]
  );
  return rows[0] || null;
}

export async function insertLegacyFeeTransferPending({
  stripePaymentIntentId,
  stripeChargeId,
  legacyAccountId,
  amountCents,
  currency,
  metadata,
}) {
  const { rows } = await query(
    `insert into public.connect_legacy_fee_transfers (
       stripe_payment_intent_id,
       stripe_charge_id,
       legacy_account_id,
       amount_cents,
       currency,
       status,
       metadata
     ) values ($1, $2, $3, $4, $5, 'pending', $6::jsonb)
     on conflict (stripe_payment_intent_id) do nothing
     returning *`,
    [
      stripePaymentIntentId,
      stripeChargeId || null,
      legacyAccountId,
      amountCents,
      currency || "usd",
      JSON.stringify(metadata || {}),
    ]
  );
  return rows[0] || null;
}

export async function markLegacyFeeTransferCreated(id, stripeTransferId) {
  await query(
    `update public.connect_legacy_fee_transfers
        set status = 'created',
            stripe_transfer_id = $2,
            error_message = null
      where id = $1`,
    [id, stripeTransferId || null]
  );
}

export async function markLegacyFeeTransferFailed(id, errorMessage) {
  await query(
    `update public.connect_legacy_fee_transfers
        set status = 'failed',
            error_message = $2
      where id = $1`,
    [id, String(errorMessage || "").slice(0, 500) || null]
  );
}
