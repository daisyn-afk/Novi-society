import { query } from "../db.js";

const CALL_COLUMNS = `
  id,
  provider_id,
  manufacturer_id,
  manufacturer_name,
  rep_name,
  rep_email,
  provider_email,
  provider_name,
  scheduled_at,
  duration_minutes,
  timezone,
  topic,
  notes,
  google_event_id,
  meet_link,
  status,
  created_at,
  updated_at
`;

function rowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider_id: row.provider_id,
    manufacturer_id: row.manufacturer_id,
    manufacturer_name: row.manufacturer_name ?? "",
    rep_name: row.rep_name ?? "",
    rep_email: row.rep_email ?? "",
    provider_email: row.provider_email ?? "",
    provider_name: row.provider_name ?? "",
    scheduled_at: row.scheduled_at,
    duration_minutes: row.duration_minutes,
    timezone: row.timezone ?? "",
    topic: row.topic ?? "",
    notes: row.notes ?? "",
    google_event_id: row.google_event_id ?? "",
    meet_link: row.meet_link ?? "",
    status: row.status ?? "scheduled",
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

export async function createProviderRepCall(payload = {}) {
  const { rows } = await query(
    `insert into public.provider_rep_calls (
       provider_id,
       manufacturer_id,
       manufacturer_name,
       rep_name,
       rep_email,
       provider_email,
       provider_name,
       scheduled_at,
       duration_minutes,
       timezone,
       topic,
       notes,
       google_event_id,
       meet_link,
       status
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     returning ${CALL_COLUMNS}`,
    [
      payload.provider_id,
      payload.manufacturer_id,
      payload.manufacturer_name || null,
      payload.rep_name || null,
      payload.rep_email,
      payload.provider_email || null,
      payload.provider_name || null,
      payload.scheduled_at,
      payload.duration_minutes,
      payload.timezone,
      payload.topic || null,
      payload.notes || null,
      payload.google_event_id || null,
      payload.meet_link || null,
      payload.status || "scheduled",
    ]
  );
  return rowToApi(rows[0]);
}

export async function listProviderRepCalls({
  providerId,
  manufacturerId,
  upcomingOnly = false,
} = {}) {
  const values = [];
  const where = [];

  if (providerId) {
    values.push(String(providerId));
    where.push(`provider_id::text = $${values.length}`);
  }
  if (manufacturerId) {
    values.push(String(manufacturerId));
    where.push(`manufacturer_id::text = $${values.length}`);
  }
  if (upcomingOnly) {
    where.push(`scheduled_at >= now()`);
    where.push(`status = 'scheduled'`);
  }

  const { rows } = await query(
    `select ${CALL_COLUMNS}
     from public.provider_rep_calls
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by scheduled_at asc`,
    values
  );
  return rows.map(rowToApi);
}

/**
 * Parse a local date/time in an IANA timezone to timestamptz via PostgreSQL.
 */
export async function parseScheduledAt({ date, time, timezone }) {
  const dateValue = String(date || "").trim();
  const timeValue = String(time || "").trim();
  const tz = String(timezone || "").trim();
  if (!dateValue || !timeValue || !tz) {
    const err = new Error("date, time, and timezone are required.");
    err.statusCode = 400;
    throw err;
  }

  const { rows } = await query(
    `select
       ($1::timestamp AT TIME ZONE $2)::timestamptz as scheduled_at,
       ($1::timestamp AT TIME ZONE $2)::timestamptz > now() as is_future`,
    [`${dateValue} ${timeValue}:00`, tz]
  );

  return {
    scheduledAt: rows[0]?.scheduled_at,
    isFuture: Boolean(rows[0]?.is_future),
  };
}

export function addMinutesToLocalDateTime(date, time, minutes) {
  const [year, month, day] = String(date).split("-").map(Number);
  const [hour, minute] = String(time).split(":").map(Number);
  const totalMinutes = hour * 60 + minute + Number(minutes || 0);
  const end = new Date(year, month - 1, day, 0, totalMinutes, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}:00`;
}
