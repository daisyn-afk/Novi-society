import { query } from "../db.js";

const CATEGORY_ENUM = new Set([
  "injectables",
  "fillers",
  "devices",
  "skincare",
  "consumables",
  "prp",
  "laser",
  "body_contouring",
  "other",
]);

const PRICE_TIER_ENUM = new Set(["low", "mid", "premium", "luxury"]);

const APPLICATION_STATUSES = new Set([
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "more_info_needed",
]);

// ─── helpers ──────────────────────────────────────────────────────────────────

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asTrimmedString(value, fallback = "") {
  const s = asString(value, fallback);
  return typeof s === "string" ? s.trim() : fallback;
}

function asBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function asNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asIntOrZero(value) {
  const n = asNumberOrNull(value);
  return n === null ? 0 : Math.trunc(n);
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v, "").trim()).filter(Boolean);
}

function asJsonbArray(value) {
  return Array.isArray(value) ? value : [];
}

// Custom fields shape: { label, input_type, placeholder, required }
function normalizeCustomField(field = {}) {
  return {
    label: asString(field.label, "").trim(),
    input_type: asString(field.input_type, "text"),
    placeholder: asString(field.placeholder, ""),
    required: asBoolean(field.required, false),
  };
}

// Network tier shape: { name, states, min_order_amount, contract_url, notes, ... }
function normalizeNetworkTier(tier = {}) {
  const statesRaw = tier.states;
  const statesStr = Array.isArray(statesRaw)
    ? statesRaw.map((s) => asString(s, "").trim()).filter(Boolean).join(", ")
    : asString(statesRaw, "").trim();
  return {
    name: asString(tier.name, "").trim(),
    states: statesStr,
    min_order_amount: asString(tier.min_order_amount, "").trim(),
    contract_url: asString(tier.contract_url, "").trim(),
    contract_file_name: asString(tier.contract_file_name, "").trim(),
    notes: asString(tier.notes, "").trim(),
    requires_contract_signature: asBoolean(tier.requires_contract_signature, false),
  };
}

// Pricing row shape: { product, retail, novi }
function normalizePricingRow(row = {}) {
  return {
    product: asString(row.product, "").trim(),
    retail: asString(row.retail, "").trim(),
    novi: asString(row.novi, "").trim(),
  };
}

// ROI stat shape: { value, label }
function normalizeRoiStat(stat = {}) {
  return {
    value: asString(stat.value, "").trim(),
    label: asString(stat.label, "").trim(),
  };
}

// ─── manufacturer ─────────────────────────────────────────────────────────────

function rowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description ?? "",
    logo_url: row.logo_url ?? "",
    cover_image_url: row.cover_image_url ?? "",
    website_url: row.website_url ?? "",
    products: asJsonbArray(row.products),
    benefits: asJsonbArray(row.benefits),
    fda_approved_us_products: row.fda_approved_us_products === true,

    sales_headline: row.sales_headline ?? "",
    promo_badge: row.promo_badge ?? "",
    sales_pitch: row.sales_pitch ?? "",
    social_proof: row.social_proof ?? "",
    selling_points: asJsonbArray(row.selling_points),
    pricing_highlights: asJsonbArray(row.pricing_highlights),
    roi_stats: asJsonbArray(row.roi_stats),

    standalone_pricing_note: row.standalone_pricing_note ?? "",
    standalone_access: asJsonbArray(row.standalone_access),
    novi_pricing_note: row.novi_pricing_note ?? "",
    novi_access: asJsonbArray(row.novi_access),

    training_approved: row.training_approved === true,
    is_featured: row.is_featured === true,
    price_tier: row.price_tier ?? "mid",
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,

    account_rep_name: row.account_rep_name ?? "",
    account_rep_email: row.account_rep_email ?? "",

    uses_network_tiers: row.uses_network_tiers === true,
    network_tiers: asJsonbArray(row.network_tiers),

    custom_fields: asJsonbArray(row.custom_fields),
    required_fields: asJsonbArray(row.required_fields),

    min_order_amount: row.min_order_amount === null || row.min_order_amount === undefined
      ? null
      : Number(row.min_order_amount),
    ships_to_states: row.ships_to_states ?? "",
    is_active: row.is_active !== false,

    created_at: row.created_at,
    updated_at: row.updated_at,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

function normalizeManufacturerPayload(payload = {}) {
  const name = asTrimmedString(payload.name);
  if (!name) {
    const err = new Error("name is required.");
    err.statusCode = 400;
    throw err;
  }

  const category = asTrimmedString(payload.category, "other") || "other";
  if (!CATEGORY_ENUM.has(category)) {
    const err = new Error(
      `category must be one of: ${[...CATEGORY_ENUM].join(", ")}.`
    );
    err.statusCode = 400;
    throw err;
  }

  const priceTier = asTrimmedString(payload.price_tier, "mid") || "mid";
  if (!PRICE_TIER_ENUM.has(priceTier)) {
    const err = new Error(
      `price_tier must be one of: ${[...PRICE_TIER_ENUM].join(", ")}.`
    );
    err.statusCode = 400;
    throw err;
  }

  const customFields = Array.isArray(payload.custom_fields)
    ? payload.custom_fields.map(normalizeCustomField).filter((f) => f.label)
    : [];

  // Derive required_fields from custom_fields so reads stay consistent
  // regardless of what the client sent.
  const requiredFields = customFields.filter((f) => f.required).map((f) => f.label);

  return {
    name,
    category,
    description: asString(payload.description, ""),
    logo_url: asString(payload.logo_url, ""),
    cover_image_url: asString(payload.cover_image_url, ""),
    website_url: asString(payload.website_url, ""),
    products: asStringArray(payload.products),
    benefits: asStringArray(payload.benefits),
    fda_approved_us_products: asBoolean(payload.fda_approved_us_products, false),

    sales_headline: asString(payload.sales_headline, ""),
    promo_badge: asString(payload.promo_badge, ""),
    sales_pitch: asString(payload.sales_pitch, ""),
    social_proof: asString(payload.social_proof, ""),
    selling_points: asStringArray(payload.selling_points),
    pricing_highlights: Array.isArray(payload.pricing_highlights)
      ? payload.pricing_highlights.map(normalizePricingRow).filter((r) => r.product || r.retail || r.novi)
      : [],
    roi_stats: Array.isArray(payload.roi_stats)
      ? payload.roi_stats.map(normalizeRoiStat).filter((s) => s.value || s.label)
      : [],

    standalone_pricing_note: asString(payload.standalone_pricing_note, ""),
    standalone_access: asStringArray(payload.standalone_access),
    novi_pricing_note: asString(payload.novi_pricing_note, ""),
    novi_access: asStringArray(payload.novi_access),

    training_approved: asBoolean(payload.training_approved, false),
    is_featured: asBoolean(payload.is_featured, false),
    price_tier: priceTier,
    sort_order: asIntOrZero(payload.sort_order),

    account_rep_name: asString(payload.account_rep_name, ""),
    account_rep_email: asString(payload.account_rep_email, "").trim(),

    uses_network_tiers: asBoolean(payload.uses_network_tiers, false),
    network_tiers: Array.isArray(payload.network_tiers)
      ? payload.network_tiers.map(normalizeNetworkTier).filter((t) => t.name || t.states)
      : [],

    custom_fields: customFields,
    required_fields: requiredFields,

    min_order_amount: asNumberOrNull(payload.min_order_amount),
    ships_to_states: asString(payload.ships_to_states, ""),
    is_active: asBoolean(payload.is_active, true),
  };
}

const MANUFACTURER_COLUMNS = `
  id,
  name,
  category,
  description,
  logo_url,
  cover_image_url,
  website_url,
  products,
  benefits,
  fda_approved_us_products,
  sales_headline,
  promo_badge,
  sales_pitch,
  social_proof,
  selling_points,
  pricing_highlights,
  roi_stats,
  standalone_pricing_note,
  standalone_access,
  novi_pricing_note,
  novi_access,
  training_approved,
  is_featured,
  price_tier,
  sort_order,
  account_rep_name,
  account_rep_email,
  uses_network_tiers,
  network_tiers,
  custom_fields,
  required_fields,
  min_order_amount,
  ships_to_states,
  is_active,
  created_at,
  updated_at
`;

export async function listManufacturers({ isActive, category, isFeatured } = {}) {
  const values = [];
  const where = [];
  if (typeof isActive === "boolean") {
    values.push(isActive);
    where.push(`is_active = $${values.length}`);
  }
  if (typeof isFeatured === "boolean") {
    values.push(isFeatured);
    where.push(`is_featured = $${values.length}`);
  }
  if (category) {
    values.push(String(category));
    where.push(`category = $${values.length}`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const { rows } = await query(
    `select ${MANUFACTURER_COLUMNS}
     from public.manufacturers
     ${whereSql}
     order by is_featured desc, sort_order asc, lower(name) asc`,
    values
  );
  return rows.map(rowToApi);
}

export async function getManufacturerById(id) {
  if (!id) return null;
  const { rows } = await query(
    `select ${MANUFACTURER_COLUMNS}
     from public.manufacturers
     where id = $1
     limit 1`,
    [id]
  );
  return rows[0] ? rowToApi(rows[0]) : null;
}

export async function createManufacturer(payload) {
  const data = normalizeManufacturerPayload(payload);
  const { rows } = await query(
    `insert into public.manufacturers (
       name, category, description, logo_url, cover_image_url, website_url,
       products, benefits, fda_approved_us_products,
       sales_headline, promo_badge, sales_pitch, social_proof,
       selling_points, pricing_highlights, roi_stats,
       standalone_pricing_note, standalone_access,
       novi_pricing_note, novi_access,
       training_approved, is_featured, price_tier, sort_order,
       account_rep_name, account_rep_email,
       uses_network_tiers, network_tiers,
       custom_fields, required_fields,
       min_order_amount, ships_to_states, is_active
     )
     values (
       $1, $2, $3, $4, $5, $6,
       $7::jsonb, $8::jsonb, $9,
       $10, $11, $12, $13,
       $14::jsonb, $15::jsonb, $16::jsonb,
       $17, $18::jsonb,
       $19, $20::jsonb,
       $21, $22, $23, $24,
       $25, $26,
       $27, $28::jsonb,
       $29::jsonb, $30::jsonb,
       $31, $32, $33
     )
     returning ${MANUFACTURER_COLUMNS}`,
    [
      data.name,
      data.category,
      data.description,
      data.logo_url,
      data.cover_image_url,
      data.website_url,
      JSON.stringify(data.products),
      JSON.stringify(data.benefits),
      data.fda_approved_us_products,
      data.sales_headline,
      data.promo_badge,
      data.sales_pitch,
      data.social_proof,
      JSON.stringify(data.selling_points),
      JSON.stringify(data.pricing_highlights),
      JSON.stringify(data.roi_stats),
      data.standalone_pricing_note,
      JSON.stringify(data.standalone_access),
      data.novi_pricing_note,
      JSON.stringify(data.novi_access),
      data.training_approved,
      data.is_featured,
      data.price_tier,
      data.sort_order,
      data.account_rep_name,
      data.account_rep_email,
      data.uses_network_tiers,
      JSON.stringify(data.network_tiers),
      JSON.stringify(data.custom_fields),
      JSON.stringify(data.required_fields),
      data.min_order_amount,
      data.ships_to_states,
      data.is_active,
    ]
  );
  return rowToApi(rows[0]);
}

export async function updateManufacturer(id, payload) {
  const current = await getManufacturerById(id);
  if (!current) return null;
  const merged = { ...current, ...payload, id };
  const data = normalizeManufacturerPayload(merged);
  const { rows } = await query(
    `update public.manufacturers
     set name = $2,
         category = $3,
         description = $4,
         logo_url = $5,
         cover_image_url = $6,
         website_url = $7,
         products = $8::jsonb,
         benefits = $9::jsonb,
         fda_approved_us_products = $10,
         sales_headline = $11,
         promo_badge = $12,
         sales_pitch = $13,
         social_proof = $14,
         selling_points = $15::jsonb,
         pricing_highlights = $16::jsonb,
         roi_stats = $17::jsonb,
         standalone_pricing_note = $18,
         standalone_access = $19::jsonb,
         novi_pricing_note = $20,
         novi_access = $21::jsonb,
         training_approved = $22,
         is_featured = $23,
         price_tier = $24,
         sort_order = $25,
         account_rep_name = $26,
         account_rep_email = $27,
         uses_network_tiers = $28,
         network_tiers = $29::jsonb,
         custom_fields = $30::jsonb,
         required_fields = $31::jsonb,
         min_order_amount = $32,
         ships_to_states = $33,
         is_active = $34,
         updated_at = now()
     where id = $1
     returning ${MANUFACTURER_COLUMNS}`,
    [
      id,
      data.name,
      data.category,
      data.description,
      data.logo_url,
      data.cover_image_url,
      data.website_url,
      JSON.stringify(data.products),
      JSON.stringify(data.benefits),
      data.fda_approved_us_products,
      data.sales_headline,
      data.promo_badge,
      data.sales_pitch,
      data.social_proof,
      JSON.stringify(data.selling_points),
      JSON.stringify(data.pricing_highlights),
      JSON.stringify(data.roi_stats),
      data.standalone_pricing_note,
      JSON.stringify(data.standalone_access),
      data.novi_pricing_note,
      JSON.stringify(data.novi_access),
      data.training_approved,
      data.is_featured,
      data.price_tier,
      data.sort_order,
      data.account_rep_name,
      data.account_rep_email,
      data.uses_network_tiers,
      JSON.stringify(data.network_tiers),
      JSON.stringify(data.custom_fields),
      JSON.stringify(data.required_fields),
      data.min_order_amount,
      data.ships_to_states,
      data.is_active,
    ]
  );
  return rows[0] ? rowToApi(rows[0]) : null;
}

export async function patchManufacturerActive(id, isActive) {
  const { rows } = await query(
    `update public.manufacturers
     set is_active = $2, updated_at = now()
     where id = $1
     returning ${MANUFACTURER_COLUMNS}`,
    [id, asBoolean(isActive, true)]
  );
  return rows[0] ? rowToApi(rows[0]) : null;
}

export async function deleteManufacturer(id) {
  const { rowCount } = await query(
    `delete from public.manufacturers where id = $1`,
    [id]
  );
  return rowCount > 0;
}

// ─── manufacturer_applications ────────────────────────────────────────────────

const APPLICATION_COLUMNS = `
  id,
  manufacturer_id,
  manufacturer_name,
  provider_id,
  provider_email,
  provider_name,
  practice_name,
  practice_address,
  practice_phone,
  license_type,
  license_number,
  license_state,
  supervising_physician_name,
  supervising_physician_email,
  additional_fields,
  status,
  admin_notes,
  submitted_at,
  reviewed_at,
  reviewed_by,
  created_at,
  updated_at
`;

function applicationRowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    manufacturer_id: row.manufacturer_id,
    manufacturer_name: row.manufacturer_name ?? "",
    provider_id: row.provider_id,
    provider_email: row.provider_email ?? "",
    provider_name: row.provider_name ?? "",
    practice_name: row.practice_name ?? "",
    practice_address: row.practice_address ?? "",
    practice_phone: row.practice_phone ?? "",
    license_type: row.license_type ?? "",
    license_number: row.license_number ?? "",
    license_state: row.license_state ?? "",
    supervising_physician_name: row.supervising_physician_name ?? "",
    supervising_physician_email: row.supervising_physician_email ?? "",
    additional_fields:
      row.additional_fields && typeof row.additional_fields === "object"
        ? row.additional_fields
        : {},
    status: row.status ?? "submitted",
    admin_notes: row.admin_notes ?? "",
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at,
    reviewed_by: row.reviewed_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

function normalizeApplicationCreate(payload = {}) {
  const manufacturerId = asTrimmedString(payload.manufacturer_id);
  if (!manufacturerId) {
    const err = new Error("manufacturer_id is required.");
    err.statusCode = 400;
    throw err;
  }
  const additional = payload.additional_fields && typeof payload.additional_fields === "object"
    ? payload.additional_fields
    : {};
  return {
    manufacturer_id: manufacturerId,
    manufacturer_name: asString(payload.manufacturer_name, ""),
    provider_id: asString(payload.provider_id, "") || null,
    provider_email: asString(payload.provider_email, ""),
    provider_name: asString(payload.provider_name, ""),
    practice_name: asString(payload.practice_name, ""),
    practice_address: asString(payload.practice_address, ""),
    practice_phone: asString(payload.practice_phone, ""),
    license_type: asString(payload.license_type, ""),
    license_number: asString(payload.license_number, ""),
    license_state: asString(payload.license_state, ""),
    supervising_physician_name: asString(payload.supervising_physician_name, ""),
    supervising_physician_email: asString(payload.supervising_physician_email, ""),
    additional_fields: additional,
  };
}

export async function listManufacturerApplications({
  providerId,
  manufacturerId,
  status,
  sort = "-submitted_at",
} = {}) {
  const values = [];
  const where = [];
  if (providerId) {
    values.push(String(providerId));
    where.push(`provider_id = $${values.length}`);
  }
  if (manufacturerId) {
    values.push(String(manufacturerId));
    where.push(`manufacturer_id = $${values.length}`);
  }
  if (status) {
    values.push(String(status));
    where.push(`status = $${values.length}`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const orderSql = sort === "submitted_at"
    ? "order by submitted_at asc"
    : "order by submitted_at desc";
  const { rows } = await query(
    `select ${APPLICATION_COLUMNS}
     from public.manufacturer_applications
     ${whereSql}
     ${orderSql}`,
    values
  );
  return rows.map(applicationRowToApi);
}

export async function getManufacturerApplicationById(id) {
  if (!id) return null;
  const { rows } = await query(
    `select ${APPLICATION_COLUMNS}
     from public.manufacturer_applications
     where id = $1
     limit 1`,
    [id]
  );
  return rows[0] ? applicationRowToApi(rows[0]) : null;
}

export async function createManufacturerApplication(payload) {
  const data = normalizeApplicationCreate(payload);
  const { rows } = await query(
    `insert into public.manufacturer_applications (
       manufacturer_id, manufacturer_name,
       provider_id, provider_email, provider_name,
       practice_name, practice_address, practice_phone,
       license_type, license_number, license_state,
       supervising_physician_name, supervising_physician_email,
       additional_fields
     )
     values (
       $1, $2,
       $3, $4, $5,
       $6, $7, $8,
       $9, $10, $11,
       $12, $13,
       $14::jsonb
     )
     returning ${APPLICATION_COLUMNS}`,
    [
      data.manufacturer_id,
      data.manufacturer_name,
      data.provider_id,
      data.provider_email,
      data.provider_name,
      data.practice_name,
      data.practice_address,
      data.practice_phone,
      data.license_type,
      data.license_number,
      data.license_state,
      data.supervising_physician_name,
      data.supervising_physician_email,
      JSON.stringify(data.additional_fields),
    ]
  );
  return applicationRowToApi(rows[0]);
}

export async function updateManufacturerApplication(id, patch = {}) {
  const current = await getManufacturerApplicationById(id);
  if (!current) return null;

  const nextStatus = patch.status !== undefined
    ? asTrimmedString(patch.status, current.status) || current.status
    : current.status;
  if (!APPLICATION_STATUSES.has(nextStatus)) {
    const err = new Error(
      `status must be one of: ${[...APPLICATION_STATUSES].join(", ")}.`
    );
    err.statusCode = 400;
    throw err;
  }

  const adminNotes = patch.admin_notes !== undefined
    ? asString(patch.admin_notes, current.admin_notes || "")
    : current.admin_notes || "";

  const reviewedBy = patch.reviewed_by !== undefined
    ? (patch.reviewed_by || null)
    : current.reviewed_by || null;

  const reviewedAt = nextStatus !== current.status && nextStatus !== "submitted"
    ? new Date()
    : current.reviewed_at;

  const { rows } = await query(
    `update public.manufacturer_applications
     set status = $2,
         admin_notes = $3,
         reviewed_at = $4,
         reviewed_by = $5,
         updated_at = now()
     where id = $1
     returning ${APPLICATION_COLUMNS}`,
    [id, nextStatus, adminNotes, reviewedAt, reviewedBy]
  );
  return rows[0] ? applicationRowToApi(rows[0]) : null;
}
