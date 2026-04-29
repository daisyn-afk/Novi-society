import { query } from "../db.js";

let ensureTablePromise = null;

async function ensureClassSessionTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = query(
      `create extension if not exists pgcrypto;
       create table if not exists public.class_session (
         id uuid primary key default gen_random_uuid(),
         created_date timestamptz not null default now(),
         enrollment_id text,
         course_id uuid,
         course_title text,
         provider_id uuid,
         provider_name text,
         provider_email text,
         session_date date,
         session_code text not null,
         code_used boolean not null default false,
         code_used_at timestamptz,
         attendance_confirmed boolean not null default false
       );
       create index if not exists idx_class_session_course_date on public.class_session(course_id, session_date);
       create unique index if not exists idx_class_session_enrollment_id on public.class_session(enrollment_id)
       where enrollment_id is not null;`
    ).catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }
  return ensureTablePromise;
}

function formatDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function nullIfBlank(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function rowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    enrollment_id: row.enrollment_id,
    course_id: row.course_id,
    course_title: row.course_title,
    provider_id: row.provider_id,
    provider_name: row.provider_name,
    provider_email: row.provider_email,
    session_date: formatDate(row.session_date),
    session_code: row.session_code,
    code_used: row.code_used,
    code_used_at: row.code_used_at,
    attendance_confirmed: row.attendance_confirmed,
    created_date: row.created_date,
  };
}

export async function listClassSessions() {
  await ensureClassSessionTable();
  const { rows } = await query(
    `select *
     from public.class_session
     order by created_date desc`
  );
  return rows.map(rowToApi);
}

export async function createClassSession(body) {
  await ensureClassSessionTable();
  const {
    enrollment_id,
    course_id,
    course_title,
    provider_id,
    provider_name,
    provider_email,
    session_date,
    session_code,
  } = body;

  const { rows } = await query(
    `insert into public.class_session (
      enrollment_id, course_id, course_title, provider_id, provider_name, provider_email,
      session_date, session_code
    ) values ($1, $2, $3, $4, $5, $6, $7::date, $8)
    returning *`,
    [
      nullIfBlank(enrollment_id),
      nullIfBlank(course_id),
      nullIfBlank(course_title),
      nullIfBlank(provider_id),
      nullIfBlank(provider_name),
      nullIfBlank(provider_email),
      nullIfBlank(session_date),
      nullIfBlank(session_code),
    ]
  );
  return rowToApi(rows[0]);
}

export async function updateClassSession(id, patch) {
  await ensureClassSessionTable();
  const allowed = ["session_code", "attendance_confirmed", "code_used", "code_used_at"];
  const keys = Object.keys(patch || {}).filter((k) => allowed.includes(k));
  if (keys.length === 0) {
    const { rows } = await query(`select * from public.class_session where id = $1`, [id]);
    return rowToApi(rows[0]);
  }

  const sets = [];
  const vals = [];
  for (const k of keys) {
    vals.push(patch[k]);
    sets.push(`${k} = $${vals.length}`);
  }
  vals.push(id);
  const { rows } = await query(
    `update public.class_session set ${sets.join(", ")} where id = $${vals.length} returning *`,
    vals
  );
  return rowToApi(rows[0]);
}
