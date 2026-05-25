import { query } from "../db.js";

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
    access_token: row.access_token,
    refresh_token: row.refresh_token ?? "",
    token_expiry: row.token_expiry,
    scopes: row.scopes ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getProviderGoogleCalendarConnection(providerId) {
  const pid = String(providerId || "").trim();
  if (!pid) return null;

  const { rows } = await query(
    `select ${CONNECTION_COLUMNS}
     from public.provider_google_calendar_connections
     where provider_id::text = $1
     limit 1`,
    [pid]
  );
  return rows[0] ? rowToApi(rows[0]) : null;
}

export async function upsertProviderGoogleCalendarConnection(payload = {}) {
  const providerId = String(payload.provider_id || "").trim();
  const googleEmail = String(payload.google_email || "").trim().toLowerCase();
  const accessToken = String(payload.access_token || "").trim();

  if (!providerId || !googleEmail || !accessToken) {
    const err = new Error("provider_id, google_email, and access_token are required.");
    err.statusCode = 400;
    throw err;
  }

  const { rows } = await query(
    `insert into public.provider_google_calendar_connections (
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
       refresh_token = coalesce(excluded.refresh_token, public.provider_google_calendar_connections.refresh_token),
       token_expiry = excluded.token_expiry,
       scopes = excluded.scopes,
       updated_at = now()
     returning ${CONNECTION_COLUMNS}`,
    [
      providerId,
      googleEmail,
      accessToken,
      payload.refresh_token || null,
      payload.token_expiry || null,
      payload.scopes || null,
    ]
  );
  return rowToApi(rows[0]);
}

export async function updateProviderGoogleCalendarTokens(providerId, patch = {}) {
  const pid = String(providerId || "").trim();
  if (!pid) return null;

  const { rows } = await query(
    `update public.provider_google_calendar_connections
     set
       access_token = coalesce($2, access_token),
       refresh_token = coalesce($3, refresh_token),
       token_expiry = coalesce($4, token_expiry),
       updated_at = now()
     where provider_id::text = $1
     returning ${CONNECTION_COLUMNS}`,
    [
      pid,
      patch.access_token || null,
      patch.refresh_token || null,
      patch.token_expiry || null,
    ]
  );
  return rows[0] ? rowToApi(rows[0]) : null;
}

export async function deleteProviderGoogleCalendarConnection(providerId) {
  const pid = String(providerId || "").trim();
  if (!pid) return false;
  const { rowCount } = await query(
    `delete from public.provider_google_calendar_connections
     where provider_id::text = $1`,
    [pid]
  );
  return rowCount > 0;
}
