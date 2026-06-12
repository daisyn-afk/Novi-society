import { pool, query } from "../db.js";
import {
  awardsMatchStored,
  buildCertAwardsFromLinkedServices,
  dedupeCertAwards,
  resolveCourseCompletionCertificateName,
} from "../lib/courseCertAwards.js";

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
    trainer_prep_supply_list_id: row.trainer_prep_supply_list_id ?? null,
    trainer_prep_supply_item_ids: row.trainer_prep_supply_item_ids ?? [],
    certification_name: row.certification_name,
    certifications_awarded: certifications,
    created_date: row.created_at,
    updated_date: row.updated_at,
    created_by: row.created_by
  };
}

function normalizeAwardsForApi(awards = []) {
  return dedupeCertAwards(
    (awards || [])
      .filter((c) => c?.service_type_id)
      .map((c) => ({
        service_type_id: c.service_type_id,
        service_type_name: c.service_type_name ?? null,
        cert_name: c.cert_name ?? null,
      }))
  );
}

let serviceTypesForCertsCache = null;
let serviceTypesForCertsLoadedAt = 0;
const SERVICE_TYPES_CACHE_MS = 60_000;

async function loadServiceTypesForCertDerivation() {
  const now = Date.now();
  if (serviceTypesForCertsCache && now - serviceTypesForCertsLoadedAt < SERVICE_TYPES_CACHE_MS) {
    return serviceTypesForCertsCache;
  }
  const { rows } = await query(
    `select id, name, is_membership, included_service_ids, legacy_parent_membership_id
     from public.service_type
     where is_active is distinct from false`
  );
  serviceTypesForCertsCache = rows.map((row) => ({
    id: row.id,
    name: row.name,
    is_membership: row.is_membership === true,
    included_service_ids: Array.isArray(row.included_service_ids) ? row.included_service_ids : [],
    legacy_parent_membership_id: row.legacy_parent_membership_id ?? null,
  }));
  serviceTypesForCertsLoadedAt = now;
  return serviceTypesForCertsCache;
}

async function repairTemplateCertificationsIfNeeded(client, templateRow, storedAwards) {
  const linkedServiceTypeIds = templateRow?.linked_service_type_ids ?? [];
  const serviceTypes = await loadServiceTypesForCertDerivation();
  const derived = buildCertAwardsFromLinkedServices(linkedServiceTypeIds, serviceTypes);
  const resolvedCertificationName = resolveCourseCompletionCertificateName(templateRow, serviceTypes);
  const needsAwardRepair = !awardsMatchStored(derived, storedAwards);
  const needsNameRepair = !String(templateRow?.certification_name || "").trim() && resolvedCertificationName;

  if (!needsAwardRepair && !needsNameRepair) return derived;

  if (needsAwardRepair) {
    await replaceCertifications(client, templateRow.id, derived);
  }
  if (needsNameRepair) {
    await client.query(
      `update public.template_courses
       set certification_name = $2, updated_at = now()
       where id = $1`,
      [templateRow.id, resolvedCertificationName]
    );
    templateRow.certification_name = resolvedCertificationName;
  }
  return derived;
}

/** Template award rows only — exclude provider-issued certifications in the same table. */
const TEMPLATE_AWARD_WHERE = `template_course_id = $1
  and provider_id is null
  and coalesce(nullif(trim(enrollment_id), ''), null) is null`;

async function fetchCertificationsForTemplate(client, templateId) {
  const { rows } = await client.query(
    `select service_type_id, service_type_name, cert_name, sort_order
     from public.certification
     where ${TEMPLATE_AWARD_WHERE}
     order by sort_order asc, id asc`,
    [templateId]
  );
  return rows.map((r) => ({
    service_type_id: r.service_type_id,
    service_type_name: r.service_type_name,
    cert_name: r.cert_name,
  }));
}

async function fetchCertificationsForTemplateIds(templateIds = []) {
  if (!templateIds.length) return new Map();
  const { rows } = await query(
    `select template_course_id, service_type_id, service_type_name, cert_name, sort_order
     from public.certification
     where template_course_id = any($1::uuid[])
       and provider_id is null
       and coalesce(nullif(trim(enrollment_id), ''), null) is null
     order by sort_order asc, id asc`,
    [templateIds]
  );
  const byTemplateId = new Map();
  for (const row of rows) {
    const key = String(row.template_course_id);
    if (!byTemplateId.has(key)) byTemplateId.set(key, []);
    byTemplateId.get(key).push({
      service_type_id: row.service_type_id,
      service_type_name: row.service_type_name,
      cert_name: row.cert_name,
    });
  }
  return byTemplateId;
}

function runDb(client, text, params = []) {
  return client ? client.query(text, params) : query(text, params);
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

  await runDb(
    client,
    `insert into public.service_type (id, name, category, updated_at)
     values ${tuples.join(", ")}
     on conflict (id) do update set
       name = coalesce(excluded.name, public.service_type.name),
       updated_at = now()`,
    values
  );
}

async function replaceCertifications(client, templateCourseId, awards) {
  await runDb(
    client,
    `delete from public.certification
      where template_course_id = $1
        and provider_id is null
        and coalesce(nullif(trim(enrollment_id), ''), null) is null`,
    [templateCourseId]
  );
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

  await runDb(
    client,
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

  const certMap = await fetchCertificationsForTemplateIds(rows.map((row) => row.id));
  const serviceTypes = await loadServiceTypesForCertDerivation();

  return rows.map((row) => {
    const stored = certMap.get(String(row.id)) || [];
    const certifications = stored.length
      ? stored
      : normalizeAwardsForApi(
          buildCertAwardsFromLinkedServices(row.linked_service_type_ids ?? [], serviceTypes)
        );
    return rowToApi(row, certifications);
  });
}

export async function getTemplateCourseById(id) {
  const { rows } = await query(`select * from public.template_courses where id = $1 limit 1`, [id]);
  const row = rows[0];
  if (!row) return null;
  const client = await pool.connect();
  try {
    const stored = await fetchCertificationsForTemplate(client, id);
    const derived = await repairTemplateCertificationsIfNeeded(client, row, stored);
    return rowToApi(row, derived);
  } finally {
    client.release();
  }
}

export async function createTemplateCourse(payload, createdByEmail, serviceTypeNameLookup) {
  const lookup =
    serviceTypeNameLookup instanceof Map
      ? serviceTypeNameLookup
      : new Map(Object.entries(serviceTypeNameLookup || {}));

  // No explicit BEGIN/COMMIT — Supabase transaction pooler (port 6543) used on
  // Vercel does not reliably support multi-statement transactions. Each
  // statement auto-commits via runDb(null, …) → pool.query().
  await upsertServiceTypes(null, payload, lookup);

  const { rows } = await query(
    `insert into public.template_courses (
      created_by, title, description, category, level,
      price, duration_hours, location, max_seats, available_seats,
      instructor_name, instructor_bio, cover_image_url,
      syllabus, requirements, what_to_bring, getting_ready_info,
      pre_course_materials, session_dates, tags, is_active, is_featured,
      platform_coverage, linked_service_type_ids, trainer_prep_supply_list_id, trainer_prep_supply_item_ids, certification_name
    ) values (
      $1,$2,$3,$4::course_category_enum,$5::course_level_enum,
      $6,$7,$8,$9,$10,
      $11,$12,$13,
      $14,$15,$16,$17,
      $18::jsonb,$19::jsonb,$20,$21,$22,
      $23,$24,$25,$26,$27
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
      payload.trainer_prep_supply_list_id,
      payload.trainer_prep_supply_item_ids || [],
      payload.certification_name
    ]
  );

  const row = rows[0];
  const serviceTypes = await loadServiceTypesForCertDerivation();
  const derivedAwards = buildCertAwardsFromLinkedServices(payload.linked_service_type_ids || [], serviceTypes);
  const normalizedAwards = normalizeAwardsForApi(derivedAwards);
  const certificationName =
    String(payload.certification_name || "").trim() ||
    resolveCourseCompletionCertificateName({ ...row, ...payload }, serviceTypes);
  await replaceCertifications(null, row.id, normalizedAwards);
  if (certificationName) {
    await query(`update public.template_courses set certification_name = $2 where id = $1`, [
      row.id,
      certificationName
    ]);
    row.certification_name = certificationName;
  }
  return rowToApi(row, normalizedAwards);
}

export async function updateTemplateCourse(id, payload, serviceTypeNameLookup) {
  const lookup =
    serviceTypeNameLookup instanceof Map
      ? serviceTypeNameLookup
      : new Map(Object.entries(serviceTypeNameLookup || {}));

  await upsertServiceTypes(null, payload, lookup);

  const { rows } = await query(
    `update public.template_courses set
      title = $2, description = $3, category = $4::course_category_enum, level = $5::course_level_enum,
      price = $6, duration_hours = $7, location = $8, max_seats = $9, available_seats = $10,
      instructor_name = $11, instructor_bio = $12, cover_image_url = $13,
      syllabus = $14, requirements = $15, what_to_bring = $16, getting_ready_info = $17,
      pre_course_materials = $18::jsonb, session_dates = $19::jsonb, tags = $20,
      is_active = $21, is_featured = $22,
      platform_coverage = $23, linked_service_type_ids = $24, trainer_prep_supply_list_id = $25, trainer_prep_supply_item_ids = $26, certification_name = $27
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
      payload.trainer_prep_supply_list_id,
      payload.trainer_prep_supply_item_ids || [],
      payload.certification_name
    ]
  );
  const row = rows[0];
  if (!row) return null;

  const serviceTypes = await loadServiceTypesForCertDerivation();
  const derivedAwards = buildCertAwardsFromLinkedServices(payload.linked_service_type_ids || [], serviceTypes);
  const normalizedAwards = normalizeAwardsForApi(derivedAwards);
  const certificationName =
    String(payload.certification_name || "").trim() ||
    resolveCourseCompletionCertificateName({ ...row, ...payload }, serviceTypes);
  await replaceCertifications(null, id, normalizedAwards);
  if (certificationName) {
    await query(`update public.template_courses set certification_name = $2 where id = $1`, [
      id,
      certificationName
    ]);
    row.certification_name = certificationName;
  }
  await query(
    `update public.scheduled_courses
     set pre_course_materials = $2::jsonb
     where template_id = $1`,
    [id, JSON.stringify(payload.pre_course_materials || [])]
  );
  return rowToApi(row, normalizedAwards);
}

export async function deleteTemplateCourse(id) {
  // Remove scheduled courses linked to this template first so template delete
  // cannot violate scheduled_courses_template_id_fkey.
  await query(`delete from public.scheduled_courses where template_id = $1`, [id]);

  const { rowCount } = await query(`delete from public.template_courses where id = $1`, [id]);
  return rowCount > 0;
}
