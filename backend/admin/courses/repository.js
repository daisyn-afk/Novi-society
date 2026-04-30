import { query } from "../db.js";

const COLUMNS = `
  id,
  created_at as created_date,
  updated_at as updated_date,
  created_by,
  title,
  type,
  template_id,
  description,
  category,
  level,
  price,
  duration_hours,
  location,
  max_seats,
  available_seats,
  instructor_name,
  instructor_bio,
  cover_image_url,
  syllabus,
  requirements,
  what_to_bring,
  getting_ready_info,
  is_active,
  is_featured,
  session_dates,
  certifications_awarded,
  linked_service_type_ids,
  pre_course_materials,
  tags
`;

const WRITABLE_COLUMNS = [
  "title",
  "type",
  "template_id",
  "category",
  "level",
  "tags",
  "is_active",
  "is_featured",
  "description",
  "syllabus",
  "requirements",
  "what_to_bring",
  "getting_ready_info",
  "pre_course_materials",
  "price",
  "duration_hours",
  "location",
  "max_seats",
  "available_seats",
  "session_dates",
  "cover_image_url",
  "instructor_name",
  "instructor_bio",
  "certifications_awarded",
  "linked_service_type_ids"
];

const JSONB_COLUMNS = new Set([
  "pre_course_materials",
  "session_dates",
  "certifications_awarded"
]);

function serializeValueForColumn(column, value) {
  if (!JSONB_COLUMNS.has(column)) return value;
  return JSON.stringify(Array.isArray(value) ? value : []);
}

export async function listCourses({ type } = {}) {
  const where = [];
  const values = [];
  if (type) {
    values.push(type);
    where.push(`type = $${values.length}`);
  }

  const sql = `
    select ${COLUMNS}
    from public.scheduled_courses
    ${where.length ? `where ${where.join(" and ")}` : ""}
    order by created_date desc
  `;
  const { rows } = await query(sql, values);
  return rows;
}

export async function getCourseById(id) {
  const { rows } = await query(
    `select ${COLUMNS} from public.scheduled_courses where id = $1 limit 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createCourse(payload, createdByEmail) {
  const columns = [...WRITABLE_COLUMNS, "created_by"];
  const values = [
    ...WRITABLE_COLUMNS.map((k) => serializeValueForColumn(k, payload[k])),
    createdByEmail ?? null
  ];
  const placeholders = columns
    .map((column, i) => `$${i + 1}${JSONB_COLUMNS.has(column) ? "::jsonb" : ""}`)
    .join(", ");

  const { rows } = await query(
    `
      insert into public.scheduled_courses (${columns.join(", ")})
      values (${placeholders})
      returning ${COLUMNS}
    `,
    values
  );

  return rows[0];
}

export async function updateCourse(id, payload) {
  const setClauses = [];
  const values = [];

  for (const key of WRITABLE_COLUMNS) {
    if (Object.hasOwn(payload, key)) {
      values.push(serializeValueForColumn(key, payload[key]));
      setClauses.push(`${key} = $${values.length}${JSONB_COLUMNS.has(key) ? "::jsonb" : ""}`);
    }
  }

  if (setClauses.length === 0) {
    return getCourseById(id);
  }

  values.push(id);
  const { rows } = await query(
    `
      update public.scheduled_courses
      set ${setClauses.join(", ")}
      where id = $${values.length}
      returning ${COLUMNS}
    `,
    values
  );

  return rows[0] ?? null;
}

export async function deleteCourse(id) {
  const { rowCount } = await query(`delete from public.scheduled_courses where id = $1`, [id]);
  return rowCount > 0;
}

