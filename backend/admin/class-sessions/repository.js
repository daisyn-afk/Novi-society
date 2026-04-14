import { query } from "../db.js";

function formatDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
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
  const { rows } = await query(
    `select *
     from public.class_session
     order by created_date desc`
  );
  return rows.map(rowToApi);
}

export async function createClassSession(body) {
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
      enrollment_id,
      course_id,
      course_title ?? null,
      provider_id ?? null,
      provider_name ?? null,
      provider_email ?? null,
      session_date || null,
      session_code,
    ]
  );
  return rowToApi(rows[0]);
}

export async function updateClassSession(id, patch) {
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
