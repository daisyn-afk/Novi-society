import { query } from "../db.js";

// One row per (provider, rep_email) pointing at the Gmail thread that holds
// their conversation. Message bodies live in Gmail; this table only stores
// the pointer + a few sync fields so we can fast-path threads.get on dialog
// open instead of re-running threads.list?q=from:rep every time (Q4 B).

const THREAD_COLUMNS = `
  id,
  provider_id,
  rep_email,
  manufacturer_id,
  thread_id,
  last_message_id,
  last_history_id,
  last_synced_at,
  created_at,
  updated_at
`;

function rowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider_id: row.provider_id,
    rep_email: row.rep_email,
    manufacturer_id: row.manufacturer_id || null,
    thread_id: row.thread_id,
    last_message_id: row.last_message_id || null,
    last_history_id: row.last_history_id || null,
    last_synced_at: row.last_synced_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export async function getRepThread({ providerId, repEmail }) {
  const pid = String(providerId || "").trim();
  const email = normalizeEmail(repEmail);
  if (!pid || !email) return null;

  const { rows } = await query(
    `select ${THREAD_COLUMNS}
     from public.provider_rep_gmail_threads
     where provider_id::text = $1 and lower(rep_email) = $2
     limit 1`,
    [pid, email]
  );
  return rows[0] ? rowToApi(rows[0]) : null;
}

export async function upsertRepThread(payload = {}) {
  const providerId = String(payload.provider_id || "").trim();
  const repEmail = normalizeEmail(payload.rep_email);
  const threadId = String(payload.thread_id || "").trim();

  if (!providerId || !repEmail || !threadId) {
    const err = new Error(
      "provider_id, rep_email, and thread_id are required."
    );
    err.statusCode = 400;
    throw err;
  }

  const { rows } = await query(
    `insert into public.provider_rep_gmail_threads (
       provider_id,
       rep_email,
       manufacturer_id,
       thread_id,
       last_message_id,
       last_history_id,
       last_synced_at
     )
     values ($1, $2, $3, $4, $5, $6, coalesce($7, now()))
     on conflict (provider_id, rep_email)
     do update set
       manufacturer_id = coalesce(excluded.manufacturer_id, public.provider_rep_gmail_threads.manufacturer_id),
       thread_id       = excluded.thread_id,
       last_message_id = coalesce(excluded.last_message_id, public.provider_rep_gmail_threads.last_message_id),
       last_history_id = coalesce(excluded.last_history_id, public.provider_rep_gmail_threads.last_history_id),
       last_synced_at  = coalesce(excluded.last_synced_at, now()),
       updated_at      = now()
     returning ${THREAD_COLUMNS}`,
    [
      providerId,
      repEmail,
      payload.manufacturer_id || null,
      threadId,
      payload.last_message_id || null,
      payload.last_history_id || null,
      payload.last_synced_at || null,
    ]
  );
  return rowToApi(rows[0]);
}

export async function touchRepThreadSync(threadRowId, { lastMessageId, lastHistoryId } = {}) {
  if (!threadRowId) return null;
  const { rows } = await query(
    `update public.provider_rep_gmail_threads
     set
       last_message_id = coalesce($2, last_message_id),
       last_history_id = coalesce($3, last_history_id),
       last_synced_at  = now(),
       updated_at      = now()
     where id = $1
     returning ${THREAD_COLUMNS}`,
    [threadRowId, lastMessageId || null, lastHistoryId || null]
  );
  return rows[0] ? rowToApi(rows[0]) : null;
}

export async function deleteRepThreadsForProvider(providerId) {
  const pid = String(providerId || "").trim();
  if (!pid) return 0;
  const { rowCount } = await query(
    `delete from public.provider_rep_gmail_threads where provider_id::text = $1`,
    [pid]
  );
  return rowCount;
}
