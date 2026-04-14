import { pool, query } from "../db.js";

function rowToApi(row, certifications = []) {
  if (!row) return null;
  return {
    id: row.id,
    type: "template",
    template_id: null,
    title: row.title,
    description: row.description,
    category: row.category,
    level: row.level,
    price: row.price != null ? Number(row.price) : null,
    duration_hours: row.duration_hours != null ? Number(row.duration_hours) : null,
    location: row.location,
    max_seats: row.max_seats,
    available_seats: row.available_seats,
    instructor_name: row.instructor_name,
    instructor_bio: row.instructor_bio,
    cover_image_url: row.cover_image_url,
    syllabus: row.syllabus,
    requirements: row.requirements,
    what_to_bring: row.what_to_bring,
    getting_ready_info: row.getting_ready_info,
    pre_course_materials: row.pre_course_materials ?? [],
    session_dates: row.session_dates ?? [],
    tags: row.tags ?? [],
    is_active: row.is_active,
    is_featured: row.is_featured,
    platform_coverage: row.platform_coverage ?? [],
    linked_service_type_ids: row.linked_service_type_ids ?? [],
    certification_name: row.certification_name,
    certifications_awarded: certifications,
    created_date: row.created_at,
    updated_date: row.updated_at,
    created_by: row.created_by
  };
}

function normalizeAwardsForApi(awards = []) {
  return (awards || [])
    .filter((c) => c?.service_type_id)
    .map((c) => ({
      service_type_id: c.service_type_id,
      service_type_name: c.service_type_name ?? null,
      cert_name: c.cert_name ?? null
    }));
}

async function fetchCertificationsForTemplate(client, templateId) {
  const { rows } = await client.query(
    `select service_type_id, service_type_name, cert_name, sort_order
     from public.certification
     where template_course_id = $1
     order by sort_order asc, id asc`,
    [templateId]
  );
  return rows.map((r) => ({
    service_type_id: r.service_type_id,
    service_type_name: r.service_type_name,
    cert_name: r.cert_name
  }));
}

async function upsertServiceTypes(client, payload, serviceTypeNameLookup) {
  const ids = new Set([
    ...(payload.linked_service_type_ids || []),
    ...(payload.certifications_awarded || []).map((c) => c.service_type_id).filter(Boolean)
  ]);
  const entries = [];
  for (const id of ids) {
    if (!id) continue;
    const fromCert = (payload.certifications_awarded || []).find((c) => c.service_type_id === id);
    const name =
      serviceTypeNameLookup.get(id) ||
      fromCert?.service_type_name ||
      fromCert?.cert_name ||
      id;
    entries.push([id, name, null]);
  }
  if (!entries.length) return;

  const values = [];
  const tuples = entries.map(([id, name, category], i) => {
    const base = i * 3;
    values.push(id, name, category);
    return `($${base + 1}, $${base + 2}, $${base + 3}, now())`;
  });

  await client.query(
    `insert into public.service_type (id, name, category, updated_at)
     values ${tuples.join(", ")}
     on conflict (id) do update set
       name = coalesce(excluded.name, public.service_type.name),
       updated_at = now()`,
    values
  );
}

async function replaceCertifications(client, templateCourseId, awards) {
  await client.query(`delete from public.certification where template_course_id = $1`, [
    templateCourseId
  ]);
  const normalized = (awards || []).filter((c) => c?.service_type_id);
  if (!normalized.length) return;

  const values = [];
  const tuples = normalized.map((c, i) => {
    const base = i * 5;
    values.push(
      templateCourseId,
      c.service_type_id,
      c.service_type_name ?? null,
      c.cert_name ?? null,
      i
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
  });

  await client.query(
    `insert into public.certification
      (template_course_id, service_type_id, service_type_name, cert_name, sort_order)
     values ${tuples.join(", ")}`,
    values
  );
}

export async function listTemplateCourses() {
  const { rows } = await query(
    `select * from public.template_courses order by created_at desc`
  );
  if (!rows.length) return [];

  const templateIds = rows.map((r) => r.id);
  const { rows: certRows } = await query(
    `select template_course_id, service_type_id, service_type_name, cert_name
     from public.certification
     where template_course_id = any($1::uuid[])
     order by template_course_id, sort_order asc, id asc`,
    [templateIds]
  );

  const certsByTemplate = new Map();
  for (const cert of certRows) {
    const arr = certsByTemplate.get(cert.template_course_id) || [];
    arr.push({
      service_type_id: cert.service_type_id,
      service_type_name: cert.service_type_name,
      cert_name: cert.cert_name
    });
    certsByTemplate.set(cert.template_course_id, arr);
  }

  return rows.map((row) => rowToApi(row, certsByTemplate.get(row.id) || []));
}

export async function getTemplateCourseById(id) {
  const { rows } = await query(`select * from public.template_courses where id = $1 limit 1`, [id]);
  const row = rows[0];
  if (!row) return null;
  const certs = await fetchCertificationsForTemplate(pool, id);
  return rowToApi(row, certs);
}

export async function createTemplateCourse(payload, createdByEmail, serviceTypeNameLookup) {
  const client = await pool.connect();
  const lookup =
    serviceTypeNameLookup instanceof Map
      ? serviceTypeNameLookup
      : new Map(Object.entries(serviceTypeNameLookup || {}));

  try {
    await client.query("begin");
    await upsertServiceTypes(client, payload, lookup);

    const { rows } = await client.query(
      `insert into public.template_courses (
        created_by, title, description, category, level,
        price, duration_hours, location, max_seats, available_seats,
        instructor_name, instructor_bio, cover_image_url,
        syllabus, requirements, what_to_bring, getting_ready_info,
        pre_course_materials, session_dates, tags, is_active, is_featured,
        platform_coverage, linked_service_type_ids, certification_name
      ) values (
        $1,$2,$3,$4::course_category_enum,$5::course_level_enum,
        $6,$7,$8,$9,$10,
        $11,$12,$13,
        $14,$15,$16,$17,
        $18::jsonb,$19::jsonb,$20,$21,$22,
        $23,$24,$25
      )
      returning *`,
      [
        createdByEmail ?? null,
        payload.title,
        payload.description,
        payload.category,
        payload.level,
        payload.price,
        payload.duration_hours,
        payload.location,
        payload.max_seats,
        payload.available_seats,
        payload.instructor_name,
        payload.instructor_bio,
        payload.cover_image_url,
        payload.syllabus,
        payload.requirements,
        payload.what_to_bring,
        payload.getting_ready_info,
        JSON.stringify(payload.pre_course_materials || []),
        JSON.stringify(payload.session_dates || []),
        payload.tags || [],
        payload.is_active,
        payload.is_featured,
        payload.platform_coverage || [],
        payload.linked_service_type_ids || [],
        payload.certification_name
      ]
    );

    const row = rows[0];
    const normalizedAwards = normalizeAwardsForApi(payload.certifications_awarded);
    await replaceCertifications(client, row.id, normalizedAwards);
    await client.query("commit");
    return rowToApi(row, normalizedAwards);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function updateTemplateCourse(id, payload, serviceTypeNameLookup) {
  const client = await pool.connect();
  const lookup =
    serviceTypeNameLookup instanceof Map
      ? serviceTypeNameLookup
      : new Map(Object.entries(serviceTypeNameLookup || {}));

  try {
    await client.query("begin");
    await upsertServiceTypes(client, payload, lookup);

    const { rows } = await client.query(
      `update public.template_courses set
        title = $2, description = $3, category = $4::course_category_enum, level = $5::course_level_enum,
        price = $6, duration_hours = $7, location = $8, max_seats = $9, available_seats = $10,
        instructor_name = $11, instructor_bio = $12, cover_image_url = $13,
        syllabus = $14, requirements = $15, what_to_bring = $16, getting_ready_info = $17,
        pre_course_materials = $18::jsonb, session_dates = $19::jsonb, tags = $20,
        is_active = $21, is_featured = $22,
        platform_coverage = $23, linked_service_type_ids = $24, certification_name = $25
      where id = $1
      returning *`,
      [
        id,
        payload.title,
        payload.description,
        payload.category,
        payload.level,
        payload.price,
        payload.duration_hours,
        payload.location,
        payload.max_seats,
        payload.available_seats,
        payload.instructor_name,
        payload.instructor_bio,
        payload.cover_image_url,
        payload.syllabus,
        payload.requirements,
        payload.what_to_bring,
        payload.getting_ready_info,
        JSON.stringify(payload.pre_course_materials || []),
        JSON.stringify(payload.session_dates || []),
        payload.tags || [],
        payload.is_active,
        payload.is_featured,
        payload.platform_coverage || [],
        payload.linked_service_type_ids || [],
        payload.certification_name
      ]
    );
    const row = rows[0];
    if (!row) {
      await client.query("rollback");
      return null;
    }

    const normalizedAwards = normalizeAwardsForApi(payload.certifications_awarded);
    await replaceCertifications(client, id, normalizedAwards);
    await client.query("commit");
    return rowToApi(row, normalizedAwards);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteTemplateCourse(id) {
  const { rowCount } = await query(`delete from public.template_courses where id = $1`, [id]);
  return rowCount > 0;
}
