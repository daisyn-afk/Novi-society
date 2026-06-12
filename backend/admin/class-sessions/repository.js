import { query } from "../db.js";
import {
  attachRedemptionStatsToSessions,
  countRedemptionsForSession,
  isSharedClassDateSession,
} from "./redemptions.js";

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
       create index if not exists idx_class_session_provider_id on public.class_session(provider_id);
       create index if not exists idx_class_session_provider_email on public.class_session(lower(provider_email));
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

export async function listClassSessions(filters = {}) {
  await ensureClassSessionTable();
  const id = filters?.id ? String(filters.id).trim() : "";
  const providerId = filters?.provider_id ? String(filters.provider_id).trim() : "";
  const providerEmail = filters?.provider_email ? String(filters.provider_email).trim().toLowerCase() : "";
  const courseId = filters?.course_id ? String(filters.course_id).trim() : "";
  const enrollmentId = filters?.enrollment_id ? String(filters.enrollment_id).trim() : "";
  const sessionCode = filters?.session_code ? String(filters.session_code).trim().toUpperCase() : "";
  const sessionDate = filters?.session_date ? String(filters.session_date).trim() : "";

  const whereClauses = [];
  const params = [];
  if (id) {
    params.push(id);
    whereClauses.push(`id::text = $${params.length}`);
  }
  if (providerId) {
    params.push(providerId);
    whereClauses.push(`provider_id::text = $${params.length}`);
  }
  if (providerEmail) {
    params.push(providerEmail);
    whereClauses.push(`lower(provider_email) = $${params.length}`);
  }
  if (courseId) {
    params.push(courseId);
    whereClauses.push(`course_id::text = $${params.length}`);
  }
  if (enrollmentId) {
    params.push(enrollmentId);
    whereClauses.push(`enrollment_id = $${params.length}`);
  }
  if (sessionCode) {
    params.push(sessionCode);
    whereClauses.push(`upper(session_code) = $${params.length}`);
  }
  if (sessionDate) {
    params.push(sessionDate);
    whereClauses.push(`session_date::text = $${params.length}`);
  }
  const whereSql = whereClauses.length ? `where ${whereClauses.join(" and ")}` : "";

  const { rows } = await query(
    `select *
     from public.class_session
     ${whereSql}
     order by created_date desc`,
    params
  );
  const sessions = rows.map(rowToApi);
  const sharedCourseIds = [
    ...new Set(
      sessions
        .filter(isSharedClassDateSession)
        .map((session) => String(session.course_id || ""))
        .filter(Boolean)
    ),
  ];
  if (!sharedCourseIds.length) return sessions;

  const { rows: courseRows } = await query(
    `select id, session_dates
     from public.scheduled_courses
     where id = any($1::uuid[])`,
    [sharedCourseIds]
  );
  const coursesById = new Map(courseRows.map((row) => [String(row.id), row]));
  return attachRedemptionStatsToSessions(sessions, coursesById);
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

  const normalizedEnrollmentId = nullIfBlank(enrollment_id);
  const normalizedSessionCode = String(nullIfBlank(session_code) || "").trim().toUpperCase();
  if (!normalizedSessionCode) {
    const err = new Error("session_code is required.");
    err.statusCode = 400;
    throw err;
  }

  const { rows } = await query(
    `insert into public.class_session (
      enrollment_id, course_id, course_title, provider_id, provider_name, provider_email,
      session_date, session_code
    ) values ($1, $2, $3, $4, $5, $6, $7::date, $8)
    on conflict (enrollment_id) where enrollment_id is not null do update set
      course_id = excluded.course_id,
      course_title = excluded.course_title,
      provider_id = excluded.provider_id,
      provider_name = excluded.provider_name,
      provider_email = excluded.provider_email,
      session_date = excluded.session_date,
      session_code = excluded.session_code,
      code_used = false,
      code_used_at = null,
      attendance_confirmed = false
    returning *`,
    [
      normalizedEnrollmentId,
      nullIfBlank(course_id),
      nullIfBlank(course_title),
      nullIfBlank(provider_id),
      nullIfBlank(provider_name),
      nullIfBlank(provider_email),
      nullIfBlank(session_date),
      normalizedSessionCode,
    ]
  );
  return rowToApi(rows[0]);
}

export async function updateClassSession(id, patch) {
  await ensureClassSessionTable();
  const { rows: existingRows } = await query(`select * from public.class_session where id = $1 limit 1`, [id]);
  const existing = existingRows[0] || null;
  if (!existing) return null;

  const allowed = ["session_code", "attendance_confirmed", "code_used", "code_used_at"];
  const keys = Object.keys(patch || {}).filter((k) => allowed.includes(k));
  if (keys.length === 0) {
    return rowToApi(existing);
  }

  // Once redeemed, class code must not be regenerated.
  if (keys.includes("session_code")) {
    if (isSharedClassDateSession(existing)) {
      const redemptionCount = await countRedemptionsForSession(existing.id);
      if (redemptionCount > 0) {
        const err = new Error("Cannot regenerate class code after it has been redeemed.");
        err.statusCode = 400;
        throw err;
      }
    } else if (existing.code_used) {
      const err = new Error("Cannot regenerate class code after it has been redeemed.");
      err.statusCode = 400;
      throw err;
    }
  }

  const sets = [];
  const vals = [];
  for (const k of keys) {
    if (k === "session_code") {
      vals.push(String(patch[k] || "").trim().toUpperCase());
    } else {
      vals.push(patch[k]);
    }
    sets.push(`${k} = $${vals.length}`);
  }
  vals.push(id);
  const { rows } = await query(
    `update public.class_session set ${sets.join(", ")} where id = $${vals.length} returning *`,
    vals
  );
  return rowToApi(rows[0]);
}
