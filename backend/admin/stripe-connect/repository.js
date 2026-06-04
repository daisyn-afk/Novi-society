import { query } from "../db.js";

export async function getProviderStripeConnectByAuthUserId(authUserId) {
  const id = String(authUserId || "").trim();
  if (!id) return null;

  const { rows } = await query(
    `select pp.stripe_connect_account_id,
            pp.stripe_connect_charges_enabled,
            pp.stripe_connect_payouts_enabled,
            pp.stripe_connect_details_submitted,
            pp.stripe_connect_onboarded_at,
            u.id as user_row_id,
            u.email as user_email,
            u.full_name as user_full_name
       from public.users u
       join public.provider_profiles pp on pp.user_id = u.id
      where u.auth_user_id::text = $1
      limit 1`,
    [id]
  );
  return rows[0] || null;
}

export async function ensureProviderProfileForAuthUser(authUserId) {
  const id = String(authUserId || "").trim();
  if (!id) return null;

  const existing = await getProviderStripeConnectByAuthUserId(id);
  if (existing) return existing;

  const { rows: userRows } = await query(
    `select id from public.users where auth_user_id::text = $1 limit 1`,
    [id]
  );
  const userRow = userRows[0];
  if (!userRow?.id) return null;

  await query(
    `insert into public.provider_profiles (user_id)
     values ($1)
     on conflict (user_id) do nothing`,
    [userRow.id]
  );

  return getProviderStripeConnectByAuthUserId(id);
}

export async function updateProviderStripeConnectByAuthUserId(authUserId, fields) {
  const id = String(authUserId || "").trim();
  if (!id) return null;

  const { rows } = await query(
    `update public.provider_profiles pp
        set stripe_connect_account_id = coalesce($2, pp.stripe_connect_account_id),
            stripe_connect_charges_enabled = coalesce($3, pp.stripe_connect_charges_enabled),
            stripe_connect_payouts_enabled = coalesce($4, pp.stripe_connect_payouts_enabled),
            stripe_connect_details_submitted = coalesce($5, pp.stripe_connect_details_submitted),
            stripe_connect_onboarded_at = case
              when $6::timestamptz is not null then $6::timestamptz
              when coalesce($3, pp.stripe_connect_charges_enabled) = true
                   and pp.stripe_connect_onboarded_at is null
                then now()
              else pp.stripe_connect_onboarded_at
            end,
            updated_at = now()
      from public.users u
     where pp.user_id = u.id
       and u.auth_user_id::text = $1
     returning pp.stripe_connect_account_id,
               pp.stripe_connect_charges_enabled,
               pp.stripe_connect_payouts_enabled,
               pp.stripe_connect_details_submitted,
               pp.stripe_connect_onboarded_at`,
    [
      id,
      fields.stripe_connect_account_id ?? null,
      fields.stripe_connect_charges_enabled ?? null,
      fields.stripe_connect_payouts_enabled ?? null,
      fields.stripe_connect_details_submitted ?? null,
      fields.stripe_connect_onboarded_at ?? null,
    ]
  );
  return rows[0] || null;
}

export async function getProviderStripeConnectByAccountId(accountId) {
  const acct = String(accountId || "").trim();
  if (!acct) return null;

  const { rows } = await query(
    `select pp.stripe_connect_account_id,
            pp.stripe_connect_charges_enabled,
            pp.stripe_connect_payouts_enabled,
            pp.stripe_connect_details_submitted,
            pp.stripe_connect_onboarded_at,
            u.auth_user_id::text as provider_auth_user_id
       from public.provider_profiles pp
       join public.users u on u.id = pp.user_id
      where pp.stripe_connect_account_id = $1
      limit 1`,
    [acct]
  );
  return rows[0] || null;
}
