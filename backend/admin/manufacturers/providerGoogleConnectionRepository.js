import { query } from "../db.js";
import { decryptToken, encryptToken } from "../lib/tokenCrypto.js";

// Single source of truth for a provider's Google OAuth grant.
//
// The same connection backs both Google Calendar (Meet link creation) and
// Gmail messaging. Whether Gmail scopes are present is determined by reading
// the `scopes` column with hasGmailScope() / hasCalendarScope() helpers.
//
// Tokens are stored AES-256-GCM-encrypted at rest (see lib/tokenCrypto.js).
// rowToApi() decrypts on read; upsert/update wrap incoming plaintext before
// binding. Existing plaintext rows pass through decryptToken() untouched until
// the backfill script (scripts/encryptExistingGoogleTokens.js) rewrites them.

const CONNECTION_COLUMNS = `
  id,
  provider_id,
  google_email,
  access_token,
  refresh_token,
  token_expiry,
  scopes,
  created_at,
  updated_at
`;

function rowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider_id: row.provider_id,
    google_email: row.google_email ?? "",
    access_token: decryptToken(row.access_token),
    refresh_token: decryptToken(row.refresh_token ?? ""),
    token_expiry: row.token_expiry,
    scopes: row.scopes ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const CALENDAR_SCOPE_PATTERNS = [
  "calendar.events",
  "calendar.readonly",
  "calendar",
];
const GMAIL_REQUIRED_SCOPES = ["gmail.modify", "gmail.send"];

export function hasCalendarScope(connection) {
  const scopes = String(connection?.scopes || "");
  return CALENDAR_SCOPE_PATTERNS.some((p) => scopes.includes(p));
}

export function hasGmailScope(connection) {
  const scopes = String(connection?.scopes || "");
  return GMAIL_REQUIRED_SCOPES.every((p) => scopes.includes(p));
}

export function mergeScopes(existing, incoming) {
  const set = new Set();
  for (const s of String(existing || "").split(/\s+/).filter(Boolean)) set.add(s);
  for (const s of String(incoming || "").split(/\s+/).filter(Boolean)) set.add(s);
  return Array.from(set).join(" ");
}

export async function getProviderGoogleConnection(providerId) {
  const pid = String(providerId || "").trim();
  if (!pid) return null;

  const { rows } = await query(
    `select ${CONNECTION_COLUMNS}
     from public.provider_google_connections
     where provider_id::text = $1
     limit 1`,
    [pid]
  );
  return rows[0] ? rowToApi(rows[0]) : null;
}

/**
 * Insert or update the provider's Google connection.
 *
 * The optional `merge_scopes: true` flag preserves any previously-granted
 * scopes that are not in the incoming token's scope string. This is the
 * correct behavior for incremental consent flows where the new grant only
 * lists the *newly* requested scopes (Q2: include_granted_scopes=true).
 */
export async function upsertProviderGoogleConnection(payload = {}) {
  const providerId = String(payload.provider_id || "").trim();
  const googleEmail = String(payload.google_email || "").trim().toLowerCase();
  const accessToken = String(payload.access_token || "").trim();

  if (!providerId || !googleEmail || !accessToken) {
    const err = new Error(
      "provider_id, google_email, and access_token are required."
    );
    err.statusCode = 400;
    throw err;
  }

  let scopesValue = payload.scopes || null;
  if (payload.merge_scopes && scopesValue) {
    const existing = await getProviderGoogleConnection(providerId);
    scopesValue = mergeScopes(existing?.scopes, scopesValue);
  }

  const { rows } = await query(
    `insert into public.provider_google_connections (
       provider_id,
       google_email,
       access_token,
       refresh_token,
       token_expiry,
       scopes
     )
     values ($1, $2, $3, $4, $5, $6)
     on conflict (provider_id)
     do update set
       google_email = excluded.google_email,
       access_token = excluded.access_token,
       refresh_token = coalesce(excluded.refresh_token, public.provider_google_connections.refresh_token),
       token_expiry = excluded.token_expiry,
       scopes = excluded.scopes,
       updated_at = now()
     returning ${CONNECTION_COLUMNS}`,
    [
      providerId,
      googleEmail,
      encryptToken(accessToken),
      payload.refresh_token ? encryptToken(payload.refresh_token) : null,
      payload.token_expiry || null,
      scopesValue,
    ]
  );
  return rowToApi(rows[0]);
}

export async function updateProviderGoogleTokens(providerId, patch = {}) {
  const pid = String(providerId || "").trim();
  if (!pid) return null;

  const { rows } = await query(
    `update public.provider_google_connections
     set
       access_token = coalesce($2, access_token),
       refresh_token = coalesce($3, refresh_token),
       token_expiry = coalesce($4, token_expiry),
       updated_at = now()
     where provider_id::text = $1
     returning ${CONNECTION_COLUMNS}`,
    [
      pid,
      patch.access_token ? encryptToken(patch.access_token) : null,
      patch.refresh_token ? encryptToken(patch.refresh_token) : null,
      patch.token_expiry || null,
    ]
  );
  return rows[0] ? rowToApi(rows[0]) : null;
}

export async function deleteProviderGoogleConnection(providerId) {
  const pid = String(providerId || "").trim();
  if (!pid) return false;
  const { rowCount } = await query(
    `delete from public.provider_google_connections
     where provider_id::text = $1`,
    [pid]
  );
  return rowCount > 0;
}
