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

/** `scheduled_courses.template_id` → `public.template_courses.id` (not scheduled_courses rows). */
const TEMPLATE_COURSE_COLUMNS = `
  id,
  title,
  description,
  category::text as category,
  level::text as level,
  price,
  duration_hours,
  location,
  cover_image_url,
  instructor_name,
  instructor_bio,
  syllabus,
  requirements,
  what_to_bring,
  getting_ready_info,
  pre_course_materials,
  tags,
  linked_service_type_ids
`;

function serializeValueForColumn(column, value) {
  if (!JSONB_COLUMNS.has(column)) return value;
  return JSON.stringify(Array.isArray(value) ? value : []);
}

function nonempty(v) {
  return v != null && String(v).trim() !== "";
}

/**
 * Scheduled instances copy template fields at creation time; merge so template edits
 * (image, description, etc.) show on the landing page and public lists.
 *
 * Title priority: the scheduled course's own title always wins — it is the admin-entered
 * value. Fall back to the template title only when the scheduled row has no title stored.
 * This mirrors the price/location logic below.
 */
function mergeScheduledWithTemplate(scheduled, template) {
  return {
    ...scheduled,
    title: nonempty(scheduled.title) ? scheduled.title : template.title,
    template_title: template.title,
    description: nonempty(template.description) ? template.description : scheduled.description,
    category: nonempty(template.category) ? template.category : scheduled.category,
    level: nonempty(template.level) ? template.level : scheduled.level,
    cover_image_url: nonempty(template.cover_image_url)
      ? template.cover_image_url
      : nonempty(scheduled.cover_image_url)
        ? scheduled.cover_image_url
        : null,
    syllabus: template.syllabus != null ? template.syllabus : scheduled.syllabus,
    requirements: template.requirements != null ? template.requirements : scheduled.requirements,
    what_to_bring: template.what_to_bring != null ? template.what_to_bring : scheduled.what_to_bring,
    getting_ready_info: template.getting_ready_info != null ? template.getting_ready_info : scheduled.getting_ready_info,
    pre_course_materials: template.pre_course_materials != null ? template.pre_course_materials : scheduled.pre_course_materials,
    tags: template.tags != null ? template.tags : scheduled.tags,
    instructor_name: nonempty(template.instructor_name) ? template.instructor_name : scheduled.instructor_name,
    instructor_bio: nonempty(template.instructor_bio) ? template.instructor_bio : scheduled.instructor_bio,
    duration_hours: template.duration_hours != null ? template.duration_hours : scheduled.duration_hours,
    linked_service_type_ids:
      template.linked_service_type_ids != null ? template.linked_service_type_ids : scheduled.linked_service_type_ids,
    price: scheduled.price != null ? scheduled.price : template.price,
    location: nonempty(scheduled.location) ? scheduled.location : template.location,
  };
}

async function applyTemplateMergeToRows(rows) {
  const scheduled = rows.filter((r) => r?.type === "scheduled" && r?.template_id);
  const ids = [...new Set(scheduled.map((r) => String(r.template_id)))];
  if (ids.length === 0) return rows;

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  const { rows: templates } = await query(
    `select ${TEMPLATE_COURSE_COLUMNS} from public.template_courses where id in (${placeholders})`,
    ids
  );
  const tmplMap = new Map(templates.map((t) => [String(t.id), t]));

  return rows.map((row) => {
    if (row?.type !== "scheduled" || !row.template_id) return row;
    const tmpl = tmplMap.get(String(row.template_id));
    return tmpl ? mergeScheduledWithTemplate(row, tmpl) : row;
  });
}

async function mergeScheduledRowWithItsTemplate(course) {
  if (!course || course.type !== "scheduled" || !course.template_id) return course;
  const { rows } = await query(
    `select ${TEMPLATE_COURSE_COLUMNS} from public.template_courses where id = $1 limit 1`,
    [course.template_id]
  );
  const tmpl = rows[0];
  return tmpl ? mergeScheduledWithTemplate(course, tmpl) : course;
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
  return applyTemplateMergeToRows(rows);
}

export async function getCourseById(id) {
  const { rows } = await query(
    `select ${COLUMNS} from public.scheduled_courses where id = $1 limit 1`,
    [id]
  );
  const course = rows[0] ?? null;
  if (!course) return null;
  return mergeScheduledRowWithItsTemplate(course);
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

  return mergeScheduledRowWithItsTemplate(rows[0]);
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

  return mergeScheduledRowWithItsTemplate(rows[0] ?? null);
}

export async function deleteCourse(id) {
  const { rowCount } = await query(`delete from public.scheduled_courses where id = $1`, [id]);
  return rowCount > 0;
}

