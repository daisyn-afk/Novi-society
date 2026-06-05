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
import {
  buildOnboardingMessaging,
  buildStatusDetailsFromStripeAccount,
} from "./statusDetails.js";

function appBaseUrl() {
  return String(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173").replace(
    /\/$/,
    ""
  );
}

export function mapStripeConnectStatus(row, { configured = isStripeConnectConfigured(), account = null } = {}) {
  const chargesEnabled = Boolean(account?.charges_enabled ?? row?.stripe_connect_charges_enabled);
  const payoutsEnabled = Boolean(account?.payouts_enabled ?? row?.stripe_connect_payouts_enabled);
  const detailsSubmitted = Boolean(account?.details_submitted ?? row?.stripe_connect_details_submitted);
  const accountId = String(account?.id || row?.stripe_connect_account_id || "").trim();
  const readyForPayments = configured && chargesEnabled && Boolean(accountId);

  const details = buildStatusDetailsFromStripeAccount(account, row, { configured });
  const messaging = buildOnboardingMessaging(details.onboarding_state, {
    requirementsDueLabels: details.requirements_due_labels,
  });

  return {
    enabled: isStripeConnectEnabled(),
    configured,
    account_id: accountId || null,
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    details_submitted: detailsSubmitted,
    ready_for_payments: readyForPayments,
    onboarded_at: row?.stripe_connect_onboarded_at || null,
    onboarding_state: details.onboarding_state,
    requirements_due: details.requirements_due,
    requirements_due_labels: details.requirements_due_labels,
    disabled_reason: details.disabled_reason,
    status_title: messaging.title,
    status_message: messaging.message,
    action_label: messaging.action_label,
  };
}

async function retrieveConnectAccount(accountId) {
  const stripe = getConnectStripeClient();
  const id = String(accountId || "").trim();
  if (!stripe || !id) return null;
  return stripe.accounts.retrieve(id);
}

export async function getProviderStripeConnectStatus(authUserId, { live = false } = {}) {
  const row = await getProviderStripeConnectByAuthUserId(authUserId);
  const accountId = String(row?.stripe_connect_account_id || "").trim();
  if (!live || !accountId || !isStripeConnectConfigured()) {
    return mapStripeConnectStatus(row);
  }

  try {
    const account = await retrieveConnectAccount(accountId);
    return mapStripeConnectStatus(row, { account });
  } catch {
    return mapStripeConnectStatus(row);
  }
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

  return mapStripeConnectStatus(updated, { account });
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

  let status = mapStripeConnectStatus(row);
  try {
    const account = await stripe.accounts.retrieve(accountId);
    status = mapStripeConnectStatus(row, { account });
  } catch {
    // best effort — link still works
  }

  return {
    url: accountLink.url,
    account_id: accountId,
    expires_at: accountLink.expires_at,
    status,
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
