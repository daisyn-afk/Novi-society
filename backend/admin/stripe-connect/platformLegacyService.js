import {
  getConnectStripeClient,
  getConnectApplicationFeeBps,
  isLegacyFeeTransferEnabled,
  isStripeConnectConfigured,
  isStripeConnectEnabled,
} from "./config.js";
import {
  clearPlatformLegacyConnection,
  getPlatformStripeConnectSettings,
  setPlatformFeeTransferEnabled,
  updatePlatformLegacyAccountFlags,
  upsertPlatformLegacyConnection,
} from "./platformLegacyRepository.js";
import {
  buildPlatformLegacyOAuthUrl,
  exchangePlatformLegacyOAuthCode,
  isStripeConnectOAuthConfigured,
} from "./platformLegacyOAuth.js";

function maskAccountId(accountId) {
  const id = String(accountId || "").trim();
  if (!id) return null;
  if (id.length <= 8) return id;
  return `${id.slice(0, 7)}…${id.slice(-4)}`;
}

export function mapPlatformLegacyStatus(settings) {
  const accountId = String(settings?.legacy_connected_account_id || "").trim();
  const connected = Boolean(accountId);
  const envFeeTransfer = isLegacyFeeTransferEnabled();
  const dbFeeTransfer = settings?.fee_transfer_enabled !== false;

  return {
    connect_enabled: isStripeConnectEnabled(),
    connect_configured: isStripeConnectConfigured(),
    oauth_configured: isStripeConnectOAuthConfigured(),
    legacy_connected: connected,
    legacy_account_id: accountId || null,
    legacy_account_id_masked: maskAccountId(accountId),
    legacy_account_email: settings?.legacy_account_email || null,
    legacy_charges_enabled: Boolean(settings?.legacy_charges_enabled),
    legacy_payouts_enabled: Boolean(settings?.legacy_payouts_enabled),
    legacy_details_submitted: Boolean(settings?.legacy_details_submitted),
    connected_at: settings?.connected_at || null,
    application_fee_bps: getConnectApplicationFeeBps(),
    fee_transfer_env_enabled: envFeeTransfer,
    fee_transfer_db_enabled: dbFeeTransfer,
    fee_transfer_active: envFeeTransfer && dbFeeTransfer && connected,
  };
}

export async function getPlatformLegacyConnectStatus() {
  const settings = await getPlatformStripeConnectSettings();
  return mapPlatformLegacyStatus(settings);
}

export async function refreshPlatformLegacyAccountFromStripe() {
  const settings = await getPlatformStripeConnectSettings();
  const accountId = String(settings?.legacy_connected_account_id || "").trim();
  if (!accountId) return mapPlatformLegacyStatus(settings);

  const stripe = getConnectStripeClient();
  if (!stripe) return mapPlatformLegacyStatus(settings);

  const account = await stripe.accounts.retrieve(accountId);
  const updated = await upsertPlatformLegacyConnection({
    legacyConnectedAccountId: account.id,
    legacyAccountEmail: account.email || settings?.legacy_account_email || null,
    legacyChargesEnabled: Boolean(account.charges_enabled),
    legacyPayoutsEnabled: Boolean(account.payouts_enabled),
    legacyDetailsSubmitted: Boolean(account.details_submitted),
    connectedByAuthUserId: settings?.connected_by_auth_user_id || null,
  });

  return mapPlatformLegacyStatus(updated);
}

export function getPlatformLegacyOAuthAuthorizeUrl(adminAuthUserId) {
  return buildPlatformLegacyOAuthUrl({ adminAuthUserId });
}

export async function completePlatformLegacyOAuth({ code, adminAuthUserId }) {
  const token = await exchangePlatformLegacyOAuthCode(code);
  if (!token.connectedAccountId) {
    const err = new Error("Stripe OAuth did not return a connected account id.");
    err.statusCode = 502;
    throw err;
  }

  const stripe = getConnectStripeClient();
  let email = null;
  let chargesEnabled = false;
  let payoutsEnabled = false;
  let detailsSubmitted = false;

  if (stripe) {
    const account = await stripe.accounts.retrieve(token.connectedAccountId);
    email = account.email || null;
    chargesEnabled = Boolean(account.charges_enabled);
    payoutsEnabled = Boolean(account.payouts_enabled);
    detailsSubmitted = Boolean(account.details_submitted);
  }

  const updated = await upsertPlatformLegacyConnection({
    legacyConnectedAccountId: token.connectedAccountId,
    legacyAccountEmail: email,
    legacyChargesEnabled: chargesEnabled,
    legacyPayoutsEnabled: payoutsEnabled,
    legacyDetailsSubmitted: detailsSubmitted,
    connectedByAuthUserId: adminAuthUserId,
  });

  return mapPlatformLegacyStatus(updated);
}

export async function disconnectPlatformLegacyAccount() {
  const cleared = await clearPlatformLegacyConnection();
  return mapPlatformLegacyStatus(cleared);
}

export async function updatePlatformFeeTransferEnabled(enabled) {
  const updated = await setPlatformFeeTransferEnabled(enabled);
  return mapPlatformLegacyStatus(updated);
}

export async function handlePlatformLegacyAccountUpdated(account) {
  const accountId = String(account?.id || "").trim();
  if (!accountId) return;

  const settings = await getPlatformStripeConnectSettings();
  if (String(settings?.legacy_connected_account_id || "") !== accountId) return;

  await updatePlatformLegacyAccountFlags({
    legacyChargesEnabled: Boolean(account.charges_enabled),
    legacyPayoutsEnabled: Boolean(account.payouts_enabled),
    legacyDetailsSubmitted: Boolean(account.details_submitted),
  });
}
