import { query } from "../db.js";
import {
  PAID_ENROLLMENT_STATUSES,
  parseSessionDatesField,
  reconcileSessionDatesWithEnrollmentCounts,
} from "../lib/sessionDateSeats.js";

async function loadEnrollmentCountsByDate(courseIds, client) {
  if (!courseIds.length) return new Map();
  const q = client ? (sql, params) => client.query(sql, params) : query;
  const { rows } = await q(
    `select course_id,
            to_char(session_date::date, 'YYYY-MM-DD') as session_day,
            count(*)::int as enrollment_count
     from public.enrollments
     where course_id = any($1::uuid[])
       and session_date is not null
       and lower(coalesce(status, '')) = any($2::text[])
     group by course_id, session_date::date`,
    [courseIds, PAID_ENROLLMENT_STATUSES]
  );

  const byCourse = new Map();
  for (const row of rows) {
    const courseId = String(row.course_id);
    if (!byCourse.has(courseId)) byCourse.set(courseId, new Map());
    byCourse.get(courseId).set(row.session_day, Number(row.enrollment_count) || 0);
  }
  return byCourse;
}

/** Idempotently align session_dates.available_seats with paid enrollment counts for one course. */
export async function syncScheduledCourseSessionSeats(courseId, client = null) {
  const q = client ? (sql, params) => client.query(sql, params) : query;
  const { rows } = await q(
    `select id, session_dates
     from public.scheduled_courses
     where id = $1
     limit 1
     for update`,
    [courseId]
  );
  const course = rows[0];
  if (!course) return null;

  const sessionDates = parseSessionDatesField(course.session_dates);
  if (sessionDates.length === 0) return sessionDates;

  const countsByCourse = await loadEnrollmentCountsByDate([courseId], client);
  const counts = countsByCourse.get(String(courseId)) || new Map();
  const next = reconcileSessionDatesWithEnrollmentCounts(sessionDates, counts);

  if (JSON.stringify(next) !== JSON.stringify(sessionDates)) {
    await q(
      `update public.scheduled_courses
       set session_dates = $1::jsonb, updated_at = now()
       where id = $2`,
      [JSON.stringify(next), courseId]
    );
  }

  return next;
}

/** Sync seat inventory for scheduled courses that have enrollments (used on public course lists). */
export async function syncScheduledCoursesSessionSeats(rows) {
  const scheduled = (rows || []).filter((row) => row?.type === "scheduled");
  if (scheduled.length === 0) return rows;

  const courseIds = scheduled.map((row) => row.id);
  const countsByCourse = await loadEnrollmentCountsByDate(courseIds);

  const updates = [];
  const reconciledById = new Map();
  for (const row of scheduled) {
    const counts = countsByCourse.get(String(row.id)) || new Map();
    const sessionDates = parseSessionDatesField(row.session_dates);
    const next = reconcileSessionDatesWithEnrollmentCounts(sessionDates, counts);
    reconciledById.set(String(row.id), next);
    if (JSON.stringify(next) !== JSON.stringify(sessionDates)) {
      updates.push({ id: row.id, session_dates: next });
    }
  }

  for (const update of updates) {
    await query(
      `update public.scheduled_courses
       set session_dates = $1::jsonb, updated_at = now()
       where id = $2`,
      [JSON.stringify(update.session_dates), update.id]
    );
  }

  return (rows || []).map((row) => {
    const nextDates = reconciledById.get(String(row.id));
    return nextDates ? { ...row, session_dates: nextDates } : row;
  });
}
