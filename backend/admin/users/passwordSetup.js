import { pool, query } from "../db.js";
import { splitCustomerName } from "./providerSignupLink.js";

export const PASSWORD_SETUP_STATUS = {
  PENDING: "password_reset_pending",
  COMPLETED: "password_created_successfully"
};

export async function getUserPasswordSetupByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;
  const { rows } = await query(
    `select id, auth_user_id, email, password_setup_status,
            password_reset_email_sent_at, password_reset_link_issued_at, password_reset_completed_at
     from public.users
     where lower(email) = lower($1)
     limit 1`,
    [normalized]
  );
  return rows[0] || null;
}

export async function getUserPasswordSetupByAuthUserId(authUserId) {
  if (!authUserId) return null;
  const { rows } = await query(
    `select id, auth_user_id, email, password_setup_status,
            password_reset_email_sent_at, password_reset_link_issued_at, password_reset_completed_at
     from public.users
     where auth_user_id = $1
     limit 1`,
    [authUserId]
  );
  return rows[0] || null;
}

/** True only after the user has actually set their password (not on first link click). */
export function isPasswordResetLinkConsumed(userRow) {
  return userRow?.password_setup_status === PASSWORD_SETUP_STATUS.COMPLETED;
}

/**
 * Looks up the most recent paid course pre-order for an email and returns
 * customer names when auth metadata is missing (checkout invite gap).
 */
export async function lookupCustomerNamesFromPreOrders(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return { firstName: null, lastName: null };

  const { rows } = await query(
    `select first_name, last_name, customer_name
     from public.pre_orders
     where lower(customer_email) = lower($1)
       and status in ('paid', 'completed')
     order by coalesce(paid_at, updated_at, created_at) desc
     limit 1`,
    [normalized]
  );
  const row = rows[0];
  if (!row) return { firstName: null, lastName: null };

  const firstName = String(row.first_name || "").trim() || null;
  const lastName = String(row.last_name || "").trim() || null;
  if (firstName || lastName) {
    return { firstName, lastName };
  }
  return splitCustomerName(row.customer_name);
}

/**
 * Links auth identity after password setup without changing an existing user's role.
 * Used by the generic /set-password flow (admin-created staff, admin, MD, etc.).
 * Inserts with role=provider only when no profile row exists (legacy paid-user migration).
 */
export async function syncUserRecordOnPasswordSetup({ authUserId, email, firstName, lastName }) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;
  const mergedName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;

  const byEmail = await query(
    `update public.users
     set auth_user_id = coalesce(auth_user_id, $1),
         first_name = coalesce(first_name, $3),
         last_name = coalesce(last_name, $4),
         full_name = coalesce(full_name, $5),
         updated_at = now()
     where lower(email) = lower($2)
     returning id, auth_user_id, email, role, permissions, password_setup_status`,
    [authUserId || null, normalized, firstName || null, lastName || null, mergedName]
  );
  if (byEmail.rows[0]) return byEmail.rows[0];

  if (!authUserId) return null;

  const inserted = await query(
    `insert into public.users (
       auth_user_id, email, first_name, last_name, full_name, role
     ) values ($1, $2, $3, $4, $5, 'provider')
     on conflict (auth_user_id)
     do update set
       email = excluded.email,
       first_name = coalesce(public.users.first_name, excluded.first_name),
       last_name = coalesce(public.users.last_name, excluded.last_name),
       full_name = coalesce(public.users.full_name, excluded.full_name),
       updated_at = now()
     returning id, auth_user_id, email, role, permissions, password_setup_status`,
    [authUserId, normalized, firstName || null, lastName || null, mergedName]
  );
  return inserted.rows[0] || null;
}

export async function ensureProviderUserRecord({ authUserId, email, firstName, lastName }) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;
  const mergedName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;

  const byEmail = await query(
    `update public.users
     set auth_user_id = coalesce(auth_user_id, $1),
         first_name = coalesce(first_name, $3),
         last_name = coalesce(last_name, $4),
         full_name = coalesce(full_name, $5),
         role = 'provider',
         updated_at = now()
     where lower(email) = lower($2)
     returning id, auth_user_id, email, role, password_setup_status`,
    [authUserId || null, normalized, firstName || null, lastName || null, mergedName]
  );
  if (byEmail.rows[0]) return byEmail.rows[0];

  if (!authUserId) return null;

  const inserted = await query(
    `insert into public.users (
       auth_user_id, email, first_name, last_name, full_name, role
     ) values ($1, $2, $3, $4, $5, 'provider')
     on conflict (auth_user_id)
     do update set
       email = excluded.email,
       first_name = coalesce(public.users.first_name, excluded.first_name),
       last_name = coalesce(public.users.last_name, excluded.last_name),
       full_name = coalesce(public.users.full_name, excluded.full_name),
       role = 'provider',
       updated_at = now()
     returning id, auth_user_id, email, role, password_setup_status`,
    [authUserId, normalized, firstName || null, lastName || null, mergedName]
  );
  return inserted.rows[0] || null;
}

export async function markPasswordResetPending({ email, authUserId, firstName, lastName }) {
  const normalized = String(email || "").trim().toLowerCase();
  const client = await pool.connect();
  try {
    const now = new Date();
    const existing = await client.query(
      `select id, auth_user_id from public.users where lower(email) = lower($1) limit 1`,
      [normalized]
    );
    if (existing.rows[0]?.id) {
      const { rows } = await client.query(
        `update public.users
         set password_setup_status = $2,
             password_reset_email_sent_at = $3,
             password_reset_link_issued_at = $3,
             password_reset_completed_at = null,
             auth_user_id = coalesce(auth_user_id, $4),
             first_name = coalesce(first_name, $5),
             last_name = coalesce(last_name, $6),
             role = 'provider',
             updated_at = now()
         where id = $1
         returning id, email, password_setup_status, password_reset_email_sent_at,
                   password_reset_link_issued_at, password_reset_completed_at`,
        [
          existing.rows[0].id,
          PASSWORD_SETUP_STATUS.PENDING,
          now,
          authUserId || null,
          firstName || null,
          lastName || null
        ]
      );
      return rows[0];
    }

    if (!authUserId) {
      return null;
    }

    const mergedName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;
    const { rows } = await client.query(
      `insert into public.users (
         auth_user_id, email, first_name, last_name, full_name, role,
         password_setup_status, password_reset_email_sent_at, password_reset_link_issued_at
       ) values ($1, $2, $3, $4, $5, 'provider', $6, $7, $7)
       on conflict (auth_user_id)
       do update set
         password_setup_status = excluded.password_setup_status,
         password_reset_email_sent_at = excluded.password_reset_email_sent_at,
         password_reset_link_issued_at = excluded.password_reset_link_issued_at,
         password_reset_completed_at = null,
         updated_at = now()
       returning id, email, password_setup_status, password_reset_email_sent_at,
                 password_reset_link_issued_at, password_reset_completed_at`,
      [
        authUserId,
        normalized,
        firstName || null,
        lastName || null,
        mergedName,
        PASSWORD_SETUP_STATUS.PENDING,
        now
      ]
    );
    return rows[0];
  } finally {
    client.release();
  }
}

/**
 * Records that an admin-triggered setup email was dispatched for an already-created user.
 * Unlike markPasswordResetPending, this only updates the password tracking columns and
 * never modifies the user's role — safe for all roles (admin, medical_director, etc.).
 */
export async function markUserSetupEmailSent(authUserId) {
  if (!authUserId) return null;
  const now = new Date();
  const { rows } = await query(
    `update public.users
     set password_setup_status       = $2,
         password_reset_email_sent_at  = $3,
         password_reset_link_issued_at = $3,
         password_reset_completed_at   = null,
         updated_at                    = now()
     where auth_user_id = $1
     returning id, email, password_setup_status`,
    [authUserId, PASSWORD_SETUP_STATUS.PENDING, now]
  );
  return rows[0] || null;
}

export async function markPasswordResetCompleted(authUserId, email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!authUserId && !normalizedEmail) return null;

  const { rows } = await query(
    `update public.users
     set password_setup_status = $2,
         password_reset_completed_at = now(),
         updated_at = now()
     where ($1::uuid is not null and auth_user_id = $1::uuid)
        or ($3 <> '' and lower(email) = lower($3))
     returning id, email, password_setup_status, password_reset_completed_at`,
    [authUserId || null, PASSWORD_SETUP_STATUS.COMPLETED, normalizedEmail]
  );

  if (rows[0] && normalizedEmail) {
    try {
      const { confirmPreOrdersAfterPasswordSetup } = await import("../pre-orders/repository.js");
      await confirmPreOrdersAfterPasswordSetup(normalizedEmail);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[passwordSetup] confirmPreOrdersAfterPasswordSetup failed:", err?.message || err);
    }
  }

  return rows[0] || null;
}
