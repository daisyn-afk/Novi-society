import { query } from "../db.js";

const CATEGORY_ENUM = new Set([
  "injectables",
  "fillers",
  "laser",
  "skincare",
  "body_contouring",
  "prp",
  "other"
]);

function rowToApi(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description ?? "",
    is_active: row.is_active !== false,
    requires_novi_course: row.requires_novi_course !== false,
    allow_external_cert: row.allow_external_cert === true,
    requires_license_types: Array.isArray(row.requires_license_types) ? row.requires_license_types : [],
    requires_supervision_months: row.requires_supervision_months ?? null,
    scope_rules: Array.isArray(row.scope_rules) ? row.scope_rules : [],
    allowed_areas: Array.isArray(row.allowed_areas) ? row.allowed_areas : [],
    max_units_per_session: row.max_units_per_session ?? null,
    protocol_notes: row.protocol_notes ?? "",
    platform_agreement_text: row.platform_agreement_text ?? "",
    md_agreement_text: row.md_agreement_text ?? "",
    md_contract_url: row.md_contract_url ?? "",
    protocol_document_urls: Array.isArray(row.protocol_document_urls) ? row.protocol_document_urls : [],
    monthly_fee: row.monthly_fee ?? null,
    growth_studio_text: row.growth_studio_text ?? "",
    supplier_accounts_text: row.supplier_accounts_text ?? "",
    qualiphy_exam_ids: Array.isArray(row.qualiphy_exam_ids) ? row.qualiphy_exam_ids : [],
    requires_gfe: row.requires_gfe === true,
    coverage_tiers: Array.isArray(row.coverage_tiers) ? row.coverage_tiers : [],
    certification_name: row.certification_name ?? ""
  };
}

function sanitizePayload(payload = {}) {
  const next = { ...payload };
  delete next.id;
  delete next.created_at;
  delete next.updated_at;
  return next;
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRule(rule = {}) {
  return {
    rule_name: asString(rule.rule_name, ""),
    rule_value: asString(rule.rule_value, ""),
    unit: asString(rule.unit, ""),
    description: asString(rule.description, "")
  };
}

function normalizeProtocolDocument(doc = {}) {
  return {
    name: asString(doc.name, ""),
    url: asString(doc.url, "")
  };
}

function normalizeCoverageTier(tier = {}) {
  return {
    tier_number: asNumber(tier.tier_number, null),
    tier_name: asString(tier.tier_name, ""),
    description: asString(tier.description, ""),
    linked_course_ids: Array.isArray(tier.linked_course_ids)
      ? tier.linked_course_ids.filter((x) => typeof x === "string")
      : [],
    allowed_areas: Array.isArray(tier.allowed_areas)
      ? tier.allowed_areas.filter((x) => typeof x === "string")
      : [],
    max_units_per_session: asNumber(tier.max_units_per_session, null),
    scope_rules: Array.isArray(tier.scope_rules)
      ? tier.scope_rules.map(normalizeRule)
      : [],
    protocol_document_urls: Array.isArray(tier.protocol_document_urls)
      ? tier.protocol_document_urls.map(normalizeProtocolDocument)
      : []
  };
}

function normalizeServiceTypePayload(payload = {}) {
  const input = sanitizePayload(payload);
  const normalized = {
    name: asString(input.name, "").trim(),
    category: asString(input.category, "").trim(),
    description: asString(input.description, ""),
    is_active: input.is_active !== false,
    requires_novi_course: input.requires_novi_course !== false,
    allow_external_cert: input.allow_external_cert === true,
    requires_license_types: Array.isArray(input.requires_license_types)
      ? input.requires_license_types.filter((x) => typeof x === "string")
      : [],
    requires_supervision_months: asNumber(input.requires_supervision_months, null),
    scope_rules: Array.isArray(input.scope_rules)
      ? input.scope_rules.map(normalizeRule)
      : [],
    allowed_areas: Array.isArray(input.allowed_areas)
      ? input.allowed_areas.filter((x) => typeof x === "string")
      : [],
    max_units_per_session: asNumber(input.max_units_per_session, null),
    protocol_notes: asString(input.protocol_notes, ""),
    platform_agreement_text: asString(input.platform_agreement_text, ""),
    md_agreement_text: asString(input.md_agreement_text, ""),
    md_contract_url: asString(input.md_contract_url, ""),
    protocol_document_urls: Array.isArray(input.protocol_document_urls)
      ? input.protocol_document_urls.map(normalizeProtocolDocument)
      : [],
    monthly_fee: asNumber(input.monthly_fee, null),
    growth_studio_text: asString(input.growth_studio_text, ""),
    supplier_accounts_text: asString(input.supplier_accounts_text, ""),
    qualiphy_exam_ids: Array.isArray(input.qualiphy_exam_ids)
      ? input.qualiphy_exam_ids
          .map((x) => Number(x))
          .filter((x) => Number.isFinite(x))
      : [],
    requires_gfe: input.requires_gfe === true,
    coverage_tiers: Array.isArray(input.coverage_tiers)
      ? input.coverage_tiers.map(normalizeCoverageTier)
      : [],
    certification_name: asString(input.certification_name, "")
  };

  if (!normalized.name) {
    const err = new Error("name is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!normalized.category) {
    const err = new Error("category is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!CATEGORY_ENUM.has(normalized.category)) {
    const err = new Error(
      "category must be one of: injectables, fillers, laser, skincare, body_contouring, prp, other."
    );
    err.statusCode = 400;
    throw err;
  }

  return normalized;
}

function splitRootAndMetadata(payload = {}) {
  const data = normalizeServiceTypePayload(payload);
  const { name, category, ...metadata } = data;
  return {
    name,
    category,
    metadata
  };
}

export async function listServiceTypesForAdmin({ isActive } = {}) {
  const values = [];
  let where = "";
  if (typeof isActive === "boolean") {
    values.push(isActive);
    where = `where is_active = $${values.length}`;
  }
  const { rows } = await query(
    `select
      id,
      name,
      category,
      description,
      is_active,
      requires_novi_course,
      allow_external_cert,
      requires_license_types,
      requires_supervision_months,
      scope_rules,
      allowed_areas,
      max_units_per_session,
      protocol_notes,
      platform_agreement_text,
      md_agreement_text,
      md_contract_url,
      protocol_document_urls,
      monthly_fee,
      growth_studio_text,
      supplier_accounts_text,
      qualiphy_exam_ids,
      requires_gfe,
      coverage_tiers,
      certification_name
     from public.service_type
     ${where}
     order by name asc`,
    values
  );
  return rows.map(rowToApi);
}

export async function getServiceTypeById(id) {
  const { rows } = await query(
    `select
      id,
      name,
      category,
      description,
      is_active,
      requires_novi_course,
      allow_external_cert,
      requires_license_types,
      requires_supervision_months,
      scope_rules,
      allowed_areas,
      max_units_per_session,
      protocol_notes,
      platform_agreement_text,
      md_agreement_text,
      md_contract_url,
      protocol_document_urls,
      monthly_fee,
      growth_studio_text,
      supplier_accounts_text,
      qualiphy_exam_ids,
      requires_gfe,
      coverage_tiers,
      certification_name
     from public.service_type
     where id = $1
     limit 1`,
    [id]
  );
  return rows[0] ? rowToApi(rows[0]) : null;
}

export async function createServiceType(payload) {
  const { name, category, metadata } = splitRootAndMetadata(payload);
  const {
    description,
    is_active,
    requires_novi_course,
    allow_external_cert,
    requires_license_types,
    requires_supervision_months,
    scope_rules,
    allowed_areas,
    max_units_per_session,
    protocol_notes,
    platform_agreement_text,
    md_agreement_text,
    md_contract_url,
    protocol_document_urls,
    monthly_fee,
    growth_studio_text,
    supplier_accounts_text,
    qualiphy_exam_ids,
    requires_gfe,
    coverage_tiers,
    certification_name
  } = metadata;
  const { rows } = await query(
    `insert into public.service_type (
      id,
      name,
      category,
      description,
      is_active,
      requires_novi_course,
      allow_external_cert,
      requires_license_types,
      requires_supervision_months,
      scope_rules,
      allowed_areas,
      max_units_per_session,
      protocol_notes,
      platform_agreement_text,
      md_agreement_text,
      md_contract_url,
      protocol_document_urls,
      monthly_fee,
      growth_studio_text,
      supplier_accounts_text,
      qualiphy_exam_ids,
      requires_gfe,
      coverage_tiers,
      certification_name,
      metadata
    )
    values (
      gen_random_uuid()::text,
      $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20::jsonb,$21,$22::jsonb,$23,$24::jsonb
    )
    returning
      id,
      name,
      category,
      description,
      is_active,
      requires_novi_course,
      allow_external_cert,
      requires_license_types,
      requires_supervision_months,
      scope_rules,
      allowed_areas,
      max_units_per_session,
      protocol_notes,
      platform_agreement_text,
      md_agreement_text,
      md_contract_url,
      protocol_document_urls,
      monthly_fee,
      growth_studio_text,
      supplier_accounts_text,
      qualiphy_exam_ids,
      requires_gfe,
      coverage_tiers,
      certification_name`,
    [
      name,
      category,
      description,
      is_active,
      requires_novi_course,
      allow_external_cert,
      requires_license_types,
      requires_supervision_months,
      JSON.stringify(scope_rules || []),
      allowed_areas,
      max_units_per_session,
      protocol_notes,
      platform_agreement_text,
      md_agreement_text,
      md_contract_url,
      JSON.stringify(protocol_document_urls || []),
      monthly_fee,
      growth_studio_text,
      supplier_accounts_text,
      JSON.stringify(qualiphy_exam_ids || []),
      requires_gfe,
      JSON.stringify(coverage_tiers || []),
      certification_name,
      JSON.stringify(metadata || {})
    ]
  );
  return rowToApi(rows[0]);
}

export async function updateServiceType(id, payload) {
  const current = await getServiceTypeById(id);
  if (!current) return null;

  const merged = {
    ...current,
    ...sanitizePayload(payload),
    id
  };
  const { name, category, metadata } = splitRootAndMetadata(merged);
  const {
    description,
    is_active,
    requires_novi_course,
    allow_external_cert,
    requires_license_types,
    requires_supervision_months,
    scope_rules,
    allowed_areas,
    max_units_per_session,
    protocol_notes,
    platform_agreement_text,
    md_agreement_text,
    md_contract_url,
    protocol_document_urls,
    monthly_fee,
    growth_studio_text,
    supplier_accounts_text,
    qualiphy_exam_ids,
    requires_gfe,
    coverage_tiers,
    certification_name
  } = metadata;
  const { rows } = await query(
    `update public.service_type
     set name = $2,
         category = $3,
         description = $4,
         is_active = $5,
         requires_novi_course = $6,
         allow_external_cert = $7,
         requires_license_types = $8,
         requires_supervision_months = $9,
         scope_rules = $10::jsonb,
         allowed_areas = $11,
         max_units_per_session = $12,
         protocol_notes = $13,
         platform_agreement_text = $14,
         md_agreement_text = $15,
         md_contract_url = $16,
         protocol_document_urls = $17::jsonb,
         monthly_fee = $18,
         growth_studio_text = $19,
         supplier_accounts_text = $20,
         qualiphy_exam_ids = $21::jsonb,
         requires_gfe = $22,
         coverage_tiers = $23::jsonb,
         certification_name = $24,
         metadata = $25::jsonb
     where id = $1
     returning
      id,
      name,
      category,
      description,
      is_active,
      requires_novi_course,
      allow_external_cert,
      requires_license_types,
      requires_supervision_months,
      scope_rules,
      allowed_areas,
      max_units_per_session,
      protocol_notes,
      platform_agreement_text,
      md_agreement_text,
      md_contract_url,
      protocol_document_urls,
      monthly_fee,
      growth_studio_text,
      supplier_accounts_text,
      qualiphy_exam_ids,
      requires_gfe,
      coverage_tiers,
      certification_name`,
    [
      id,
      name,
      category,
      description,
      is_active,
      requires_novi_course,
      allow_external_cert,
      requires_license_types,
      requires_supervision_months,
      JSON.stringify(scope_rules || []),
      allowed_areas,
      max_units_per_session,
      protocol_notes,
      platform_agreement_text,
      md_agreement_text,
      md_contract_url,
      JSON.stringify(protocol_document_urls || []),
      monthly_fee,
      growth_studio_text,
      supplier_accounts_text,
      JSON.stringify(qualiphy_exam_ids || []),
      requires_gfe,
      JSON.stringify(coverage_tiers || []),
      certification_name,
      JSON.stringify(metadata || {})
    ]
  );
  return rows[0] ? rowToApi(rows[0]) : null;
}

export async function deleteServiceType(id) {
  const { rowCount } = await query(`delete from public.service_type where id = $1`, [id]);
  return rowCount > 0;
}
