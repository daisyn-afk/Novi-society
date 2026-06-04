import {
  getConnectStripeClient,
  isStripeConnectConfigured,
  isStripeConnectEnabled,
} from "./config.js";
import {
  ensureProviderProfileForAuthUser,
  getProviderStripeConnectByAuthUserId,
  getProviderStripeConnectByAccountId,
  updateProviderStripeConnectByAuthUserId,
} from "./repository.js";

function appBaseUrl() {
  return String(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173").replace(
    /\/$/,
    ""
  );
}

export function mapStripeConnectStatus(row, { configured = isStripeConnectConfigured() } = {}) {
  const chargesEnabled = Boolean(row?.stripe_connect_charges_enabled);
  const payoutsEnabled = Boolean(row?.stripe_connect_payouts_enabled);
  const detailsSubmitted = Boolean(row?.stripe_connect_details_submitted);
  const accountId = String(row?.stripe_connect_account_id || "").trim();

  return {
    enabled: isStripeConnectEnabled(),
    configured,
    account_id: accountId || null,
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    details_submitted: detailsSubmitted,
    ready_for_payments: configured && chargesEnabled && Boolean(accountId),
    onboarded_at: row?.stripe_connect_onboarded_at || null,
  };
}

export async function getProviderStripeConnectStatus(authUserId) {
  const row = await getProviderStripeConnectByAuthUserId(authUserId);
  return mapStripeConnectStatus(row);
}

export async function syncStripeAccountForProvider(authUserId) {
  const stripe = getConnectStripeClient();
  const id = String(authUserId || "").trim();
  if (!stripe || !id) return mapStripeConnectStatus(null);

  const row = await getProviderStripeConnectByAuthUserId(id);
  const accountId = String(row?.stripe_connect_account_id || "").trim();
  if (!accountId) return mapStripeConnectStatus(row);

  const account = await stripe.accounts.retrieve(accountId);
  const updated = await updateProviderStripeConnectByAuthUserId(id, {
    stripe_connect_account_id: account.id,
    stripe_connect_charges_enabled: Boolean(account.charges_enabled),
    stripe_connect_payouts_enabled: Boolean(account.payouts_enabled),
    stripe_connect_details_submitted: Boolean(account.details_submitted),
    stripe_connect_onboarded_at: account.charges_enabled ? new Date().toISOString() : null,
  });

  return mapStripeConnectStatus(updated);
}

async function createExpressAccount({ email, fullName }) {
  const stripe = getConnectStripeClient();
  if (!stripe) {
    const err = new Error("Stripe Connect is not configured.");
    err.statusCode = 503;
    throw err;
  }

  return stripe.accounts.create({
    type: "express",
    email: email || undefined,
    business_type: "individual",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { novi_provider: "true" },
    business_profile: fullName
      ? { name: String(fullName).slice(0, 200) }
      : undefined,
  });
}

export async function createStripeConnectOnboardingLink({
  authUserId,
  email,
  fullName,
  returnPath = "/ProviderPractice",
}) {
  const stripe = getConnectStripeClient();
  if (!stripe) {
    const err = new Error("Stripe Connect is not configured.");
    err.statusCode = 503;
    throw err;
  }

  await ensureProviderProfileForAuthUser(authUserId);
  let row = await getProviderStripeConnectByAuthUserId(authUserId);
  let accountId = String(row?.stripe_connect_account_id || "").trim();

  if (!accountId) {
    const account = await createExpressAccount({ email, fullName });
    accountId = account.id;
    await updateProviderStripeConnectByAuthUserId(authUserId, {
      stripe_connect_account_id: accountId,
      stripe_connect_charges_enabled: false,
      stripe_connect_payouts_enabled: false,
      stripe_connect_details_submitted: false,
    });
    row = await getProviderStripeConnectByAuthUserId(authUserId);
  }

  const base = appBaseUrl();
  const returnUrl = `${base}${returnPath}?tab=profile&stripe_connect=return`;
  const refreshUrl = `${base}${returnPath}?tab=profile&stripe_connect=refresh`;

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });

  return {
    url: accountLink.url,
    account_id: accountId,
    expires_at: accountLink.expires_at,
    status: mapStripeConnectStatus(row),
  };
}

export async function assertProviderReadyForMarketplacePayments(providerAuthUserId) {
  if (!isStripeConnectConfigured()) {
    return { useConnect: false, connectAccountId: null, stripe: null };
  }

  const row = await getProviderStripeConnectByAuthUserId(providerAuthUserId);
  const status = mapStripeConnectStatus(row);

  if (!status.ready_for_payments) {
    const err = new Error(
      "Your provider has not finished Stripe setup. They must connect Stripe in Practice Profile before you can pay online."
    );
    err.statusCode = 409;
    err.code = "provider_stripe_not_ready";
    throw err;
  }

  return {
    useConnect: true,
    connectAccountId: status.account_id,
    stripe: getConnectStripeClient(),
  };
}

export async function handleConnectAccountUpdated(account) {
  const accountId = String(account?.id || "").trim();
  if (!accountId) return;

  const link = await getProviderStripeConnectByAccountId(accountId);
  if (!link?.provider_auth_user_id) return;

  await updateProviderStripeConnectByAuthUserId(link.provider_auth_user_id, {
    stripe_connect_account_id: accountId,
    stripe_connect_charges_enabled: Boolean(account.charges_enabled),
    stripe_connect_payouts_enabled: Boolean(account.payouts_enabled),
    stripe_connect_details_submitted: Boolean(account.details_submitted),
    stripe_connect_onboarded_at: account.charges_enabled ? new Date().toISOString() : null,
  });
}
