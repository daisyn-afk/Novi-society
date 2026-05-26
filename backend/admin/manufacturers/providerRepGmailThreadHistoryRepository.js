import { query } from "../db.js";

const HISTORY_COLUMNS = `
  id,
  provider_id,
  rep_email,
  thread_id,
  subject,
  snippet,
  last_internal_date,
  created_at,
  updated_at
`;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function rowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider_id: row.provider_id,
    rep_email: row.rep_email,
    thread_id: row.thread_id,
    subject: row.subject || null,
    snippet: row.snippet || null,
    last_internal_date: row.last_internal_date
      ? Number(row.last_internal_date)
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function upsertRepThreadHistory(payload = {}) {
  const providerId = String(payload.provider_id || "").trim();
  const repEmail = normalizeEmail(payload.rep_email);
  const threadId = String(payload.thread_id || "").trim();

  if (!providerId || !repEmail || !threadId) return null;

  const { rows } = await query(
    `insert into public.provider_rep_gmail_thread_history (
       provider_id,
       rep_email,
       thread_id,
       subject,
       snippet,
       last_internal_date
     )
     values ($1, $2, $3, $4, $5, $6)
     on conflict (provider_id, rep_email, thread_id)
     do update set
       subject = coalesce(excluded.subject, public.provider_rep_gmail_thread_history.subject),
       snippet = coalesce(excluded.snippet, public.provider_rep_gmail_thread_history.snippet),
       last_internal_date = coalesce(
         excluded.last_internal_date,
         public.provider_rep_gmail_thread_history.last_internal_date
       ),
       updated_at = now()
     returning ${HISTORY_COLUMNS}`,
    [
      providerId,
      repEmail,
      threadId,
      payload.subject || null,
      payload.snippet || null,
      payload.last_internal_date != null
        ? Number(payload.last_internal_date)
        : null,
    ]
  );
  return rowToApi(rows[0]);
}

export async function listRepThreadHistoryRows({ providerId, repEmail, limit = 50 }) {
  const pid = String(providerId || "").trim();
  const email = normalizeEmail(repEmail);
  if (!pid || !email) return [];

  const cap = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const { rows } = await query(
    `select ${HISTORY_COLUMNS}
     from public.provider_rep_gmail_thread_history
     where provider_id::text = $1 and lower(rep_email) = $2
     order by last_internal_date desc nulls last, updated_at desc
     limit $3`,
    [pid, email, cap]
  );
  return rows.map(rowToApi);
}

export async function deleteRepThreadHistoryForProvider(providerId) {
  const pid = String(providerId || "").trim();
  if (!pid) return 0;
  const { rowCount } = await query(
    `delete from public.provider_rep_gmail_thread_history where provider_id::text = $1`,
    [pid]
  );
  return rowCount;
}
