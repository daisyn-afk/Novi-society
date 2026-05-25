import { query } from "../db.js";

const REP_COLUMNS = `
  id,
  provider_id,
  manufacturer_id,
  manufacturer_application_id,
  rep_name,
  rep_email,
  rep_phone,
  created_at,
  updated_at
`;

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asTrimmedString(value, fallback = "") {
  const s = asString(value, fallback);
  return typeof s === "string" ? s.trim() : fallback;
}

export function isValidEmailFormat(email) {
  const value = String(email || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function rowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider_id: row.provider_id,
    manufacturer_id: row.manufacturer_id,
    manufacturer_application_id: row.manufacturer_application_id,
    rep_name: row.rep_name ?? "",
    rep_email: row.rep_email ?? "",
    rep_phone: row.rep_phone ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

export async function getProviderManufacturerRep({ providerId, manufacturerId }) {
  const pid = asTrimmedString(providerId);
  const mid = asTrimmedString(manufacturerId);
  if (!pid || !mid) return null;

  const { rows } = await query(
    `select ${REP_COLUMNS}
     from public.provider_manufacturer_reps
     where provider_id::text = $1
       and manufacturer_id::text = $2
     limit 1`,
    [pid, mid]
  );
  return rows[0] ? rowToApi(rows[0]) : null;
}

export async function listProviderManufacturerReps({
  providerId,
  manufacturerId,
} = {}) {
  const values = [];
  const where = [];

  if (providerId) {
    values.push(String(providerId));
    where.push(`provider_id::text = $${values.length}`);
  }
  if (manufacturerId) {
    values.push(String(manufacturerId));
    where.push(`manufacturer_id::text = $${values.length}`);
  }

  const { rows } = await query(
    `select ${REP_COLUMNS}
     from public.provider_manufacturer_reps
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by updated_at desc`,
    values
  );
  return rows.map(rowToApi);
}

export async function upsertProviderManufacturerRep(payload = {}) {
  const providerId = asTrimmedString(payload.provider_id);
  const manufacturerId = asTrimmedString(payload.manufacturer_id);
  const repEmail = asTrimmedString(payload.rep_email).toLowerCase();

  if (!providerId) {
    const err = new Error("provider_id is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!manufacturerId) {
    const err = new Error("manufacturer_id is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!repEmail || !isValidEmailFormat(repEmail)) {
    const err = new Error("A valid rep_email is required.");
    err.statusCode = 400;
    throw err;
  }

  const repName = asTrimmedString(payload.rep_name);
  const repPhone = asTrimmedString(payload.rep_phone);
  const applicationId = asTrimmedString(payload.manufacturer_application_id) || null;

  const { rows } = await query(
    `insert into public.provider_manufacturer_reps (
       provider_id,
       manufacturer_id,
       manufacturer_application_id,
       rep_name,
       rep_email,
       rep_phone
     )
     values ($1, $2, $3, $4, $5, $6)
     on conflict (provider_id, manufacturer_id)
     do update set
       manufacturer_application_id = coalesce(excluded.manufacturer_application_id, public.provider_manufacturer_reps.manufacturer_application_id),
       rep_name = excluded.rep_name,
       rep_email = excluded.rep_email,
       rep_phone = excluded.rep_phone,
       updated_at = now()
     returning ${REP_COLUMNS}`,
    [providerId, manufacturerId, applicationId, repName || null, repEmail, repPhone || null]
  );

  return rowToApi(rows[0]);
}

/**
 * Saved provider rep first; fall back to manufacturer application routing rep.
 */
export async function resolveRepContactForProvider({
  providerId,
  manufacturerId,
  manufacturer,
}) {
  const saved = await getProviderManufacturerRep({ providerId, manufacturerId });
  if (saved?.rep_email) {
    return {
      source: "provider_saved",
      rep_name: saved.rep_name || "",
      rep_email: saved.rep_email,
      rep_phone: saved.rep_phone || "",
      saved_rep: saved,
    };
  }

  return {
    source: "manufacturer_routing",
    rep_name: manufacturer?.account_rep_name || "",
    rep_email: manufacturer?.account_rep_email || "",
    rep_phone: "",
    saved_rep: null,
  };
}
