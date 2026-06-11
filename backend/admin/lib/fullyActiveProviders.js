import { query } from "../db.js";

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

/** Match md_subscription rows to a provider user row (auth id, users.id, or email). */
export function providerLookupKeysForRow(row) {
  const keys = new Set();
  for (const raw of [row?.auth_user_id, row?.users_table_id, row?.id]) {
    const v = norm(raw);
    if (v) keys.add(v);
  }
  return keys;
}

export function mdSubscriptionMatchesProvider(providerRow, subscription) {
  const keys = providerLookupKeysForRow(providerRow);
  const providerId = norm(subscription?.provider_id);
  if (providerId && keys.has(providerId)) return true;

  const email = norm(providerRow?.email);
  const subscriptionEmail = norm(subscription?.provider_email);
  return Boolean(email && subscriptionEmail && subscriptionEmail === email);
}

export function providerHasActiveMdSubscription(providerRow, mdSubscriptions = []) {
  return (mdSubscriptions || []).some(
    (subscription) =>
      norm(subscription?.status) === "active" &&
      mdSubscriptionMatchesProvider(providerRow, subscription)
  );
}

export async function fetchProviderDirectoryRows() {
  const { rows } = await query(
    `select u.id as users_table_id,
            u.auth_user_id,
            u.email,
            u.full_name,
            u.role,
            u.is_active,
            pp.city,
            pp.state,
            pp.metadata
       from public.users u
       left join public.provider_profiles pp on pp.user_id = u.id
      where u.role = 'provider'
      order by u.full_name nulls last, u.email`
  );
  return rows || [];
}

export async function fetchAllMdSubscriptions() {
  const { rows } = await query(
    `select *
       from public.md_subscription
      order by created_at desc nulls last`
  );
  return rows || [];
}

/**
 * Providers with at least one active MD subscription — same rule as AdminProviders "Fully Active".
 */
export async function listFullyActiveProviderRows({
  requireAuthUserId = false,
  requireActiveAccount = false,
} = {}) {
  const [providers, mdSubscriptions] = await Promise.all([
    fetchProviderDirectoryRows(),
    fetchAllMdSubscriptions(),
  ]);

  return providers.filter((provider) => {
    if (requireAuthUserId && !String(provider.auth_user_id || "").trim()) return false;
    if (requireActiveAccount && provider.is_active === false) return false;
    return providerHasActiveMdSubscription(provider, mdSubscriptions);
  });
}

export function buildProviderLookupMaps(providerRows) {
  const authIdByKey = new Map();
  const keys = new Set();
  const emails = new Set();

  for (const row of providerRows || []) {
    const authId = String(row.auth_user_id || "").trim();
    if (!authId) continue;

    authIdByKey.set(norm(authId), authId);
    keys.add(authId);

    const usersTableId = String(row.users_table_id || row.id || "").trim();
    if (usersTableId) {
      authIdByKey.set(norm(usersTableId), authId);
      keys.add(usersTableId);
    }

    const email = norm(row.email);
    if (email) {
      authIdByKey.set(`email:${email}`, authId);
      emails.add(email);
    }
  }

  return { authIdByKey, keys: [...keys], emails: [...emails] };
}

export function resolveProviderAuthId(record, authIdByKey) {
  const providerId = norm(record?.provider_id);
  if (providerId && authIdByKey.has(providerId)) return authIdByKey.get(providerId);

  const email = norm(record?.provider_email);
  if (email && authIdByKey.has(`email:${email}`)) return authIdByKey.get(`email:${email}`);

  return null;
}

export function normalizeProviderScopedRows(rows, authIdByKey) {
  return (rows || [])
    .map((row) => {
      const authId = resolveProviderAuthId(row, authIdByKey);
      if (!authId) return null;
      return { ...row, provider_id: authId };
    })
    .filter(Boolean);
}
