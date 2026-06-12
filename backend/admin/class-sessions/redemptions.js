import { query } from "../db.js";
import {
  PAID_ENROLLMENT_STATUSES,
  findSessionEntryByDate,
  parseSeatCount,
  parseSessionDatesField,
  toSessionDateKey,
} from "../lib/sessionDateSeats.js";

let ensureTablePromise = null;

export function isSharedClassDateSession(session) {
  return String(session?.enrollment_id || "").startsWith("class_date:");
}

export async function ensureClassCodeRedemptionTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = query(
      `create extension if not exists pgcrypto;
       create table if not exists public.class_code_redemption (
         id uuid primary key default gen_random_uuid(),
         class_session_id uuid not null references public.class_session(id) on delete cascade,
         course_id uuid,
         session_date date,
         enrollment_id text,
         provider_auth_id uuid,
         provider_user_id uuid,
         provider_id uuid,
         provider_email text,
         redeemed_at timestamptz not null default now()
       );
       create index if not exists idx_class_code_redemption_session
         on public.class_code_redemption(class_session_id);
       create index if not exists idx_class_code_redemption_course_date
         on public.class_code_redemption(course_id, session_date);
       create index if not exists idx_class_code_redemption_provider_auth
         on public.class_code_redemption(class_session_id, provider_auth_id)
         where provider_auth_id is not null;
       create index if not exists idx_class_code_redemption_provider_email
         on public.class_code_redemption(class_session_id, lower(provider_email))
         where provider_email is not null;`
    ).catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }
  return ensureTablePromise;
}

function normalizeEmail(value) {
  const text = String(value || "").trim().toLowerCase();
  return text || null;
}

function buildIdentityEmails(identity = {}) {
  const emails = new Set();
  for (const value of identity.emails || []) {
    const normalized = normalizeEmail(value);
    if (normalized) emails.add(normalized);
  }
  const direct = normalizeEmail(identity.email);
  if (direct) emails.add(direct);
  return [...emails];
}

export async function countRedemptionsForSession(classSessionId) {
  await ensureClassCodeRedemptionTable();
  const { rows } = await query(
    `select count(*)::int as redemption_count
     from public.class_code_redemption
     where class_session_id = $1`,
    [classSessionId]
  );
  return Number(rows[0]?.redemption_count || 0);
}

export async function countRedemptionsForSessions(classSessionIds = []) {
  await ensureClassCodeRedemptionTable();
  const ids = [...new Set((classSessionIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!ids.length) return new Map();
  const { rows } = await query(
    `select class_session_id, count(*)::int as redemption_count
     from public.class_code_redemption
     where class_session_id = any($1::uuid[])
     group by class_session_id`,
    [ids]
  );
  return new Map(rows.map((row) => [String(row.class_session_id), Number(row.redemption_count) || 0]));
}

export async function countPaidEnrollmentsForDate(courseId, sessionDate) {
  const dateKey = toSessionDateKey(sessionDate);
  if (!courseId || !dateKey) return 0;
  const { rows } = await query(
    `select count(*)::int as enrollment_count
     from public.enrollments
     where course_id = $1
       and session_date::date = $2::date
       and lower(coalesce(status, '')) = any($3::text[])`,
    [courseId, dateKey, PAID_ENROLLMENT_STATUSES]
  );
  return Number(rows[0]?.enrollment_count || 0);
}

export function resolveRedemptionCapFromSessionDates(sessionDates, sessionDate) {
  const entry = findSessionEntryByDate(parseSessionDatesField(sessionDates), sessionDate);
  if (!entry) return null;
  const max = parseSeatCount(entry.max_seats);
  const avail = parseSeatCount(entry.available_seats);
  if (max == null || avail == null || max < 0 || avail < 0 || avail > max) return null;
  return Math.max(0, max - avail);
}

export async function resolveRedemptionCap({ courseId, sessionDate, sessionDates }) {
  const soldSeats = resolveRedemptionCapFromSessionDates(sessionDates, sessionDate);
  const enrollmentCount = await countPaidEnrollmentsForDate(courseId, sessionDate);
  if (soldSeats != null) return Math.max(soldSeats, enrollmentCount);
  return enrollmentCount;
}

export async function providerHasRedeemedSession(classSessionId, identity = {}) {
  await ensureClassCodeRedemptionTable();
  const authId = String(identity.authUserId || "").trim();
  const appUserId = String(identity.appUserId || "").trim();
  const providerId = String(identity.providerId || "").trim();
  const emails = buildIdentityEmails(identity);
  if (!authId && !appUserId && !providerId && !emails.length) return false;

  const params = [classSessionId];
  const clauses = [];
  if (authId) {
    params.push(authId);
    clauses.push(`provider_auth_id::text = $${params.length}`);
  }
  if (appUserId) {
    params.push(appUserId);
    clauses.push(`provider_user_id::text = $${params.length}`);
  }
  if (providerId) {
    params.push(providerId);
    clauses.push(`provider_id::text = $${params.length}`);
  }
  if (emails.length) {
    params.push(emails);
    clauses.push(`lower(coalesce(provider_email, '')) = any($${params.length}::text[])`);
  }
  if (!clauses.length) return false;

  const { rows } = await query(
    `select id
     from public.class_code_redemption
     where class_session_id = $1
       and (${clauses.join(" or ")})
     limit 1`,
    params
  );
  return Boolean(rows[0]);
}

export async function insertClassCodeRedemption({
  classSessionId,
  courseId,
  sessionDate,
  enrollmentId,
  identity = {},
}) {
  await ensureClassCodeRedemptionTable();
  const emails = buildIdentityEmails(identity);
  const providerEmail = emails[0] || null;
  const { rows } = await query(
    `insert into public.class_code_redemption (
       class_session_id,
       course_id,
       session_date,
       enrollment_id,
       provider_auth_id,
       provider_user_id,
       provider_id,
       provider_email
     ) values ($1, $2, $3::date, $4, $5, $6, $7, $8)
     returning *`,
    [
      classSessionId,
      courseId || null,
      toSessionDateKey(sessionDate),
      enrollmentId || null,
      identity.authUserId || null,
      identity.appUserId || null,
      identity.providerId || null,
      providerEmail,
    ]
  );
  return rows[0] || null;
}

export async function attachRedemptionStatsToSessions(sessions = [], coursesById = new Map()) {
  const sharedSessions = (sessions || []).filter(isSharedClassDateSession);
  if (!sharedSessions.length) return sessions;

  const counts = await countRedemptionsForSessions(sharedSessions.map((s) => s.id));
  const capBySessionId = new Map();
  await Promise.all(
    sharedSessions.map(async (session) => {
      const course = coursesById.get(String(session.course_id || ""));
      const cap = await resolveRedemptionCap({
        courseId: session.course_id,
        sessionDate: session.session_date,
        sessionDates: course?.session_dates,
      });
      capBySessionId.set(String(session.id), cap);
    })
  );

  return (sessions || []).map((session) => {
    if (!isSharedClassDateSession(session)) return session;
    const redemptionCount = counts.get(String(session.id)) || 0;
    const redemptionCap = capBySessionId.get(String(session.id)) ?? 0;
    const fullyRedeemed = redemptionCap > 0 && redemptionCount >= redemptionCap;
    return {
      ...session,
      redemption_count: redemptionCount,
      redemption_cap: redemptionCap,
      fully_redeemed: fullyRedeemed,
    };
  });
}
