import { query } from "../db.js";
import { randomUUID } from "node:crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IMPORT_ROWS = 500;

export function validateEmail(email) {
  return EMAIL_RE.test(String(email || "").trim());
}

/** Look up the public.users row id for a given auth_user_id. */
export async function getUserDbIdByAuthUserId(authUserId) {
  const { rows } = await query(
    `select id from public.users where auth_user_id = $1 limit 1`,
    [authUserId]
  );
  return rows[0]?.id || null;
}

/** Return all provider_patients rows for a given provider (by DB users.id). */
export async function listProviderPatients(providerDbId) {
  const { rows } = await query(
    `select id, provider_id, patient_user_id, email, first_name, last_name, full_name,
            phone, date_of_birth, gender, is_default_provider, source, import_batch_id,
            created_at, updated_at
     from public.provider_patients
     where provider_id = $1
     order by created_at desc`,
    [providerDbId]
  );
  return rows;
}

/**
 * Bulk upsert a batch of validated patient rows for a provider.
 * Returns { imported, skipped, failed, errors }.
 *
 * @param {string} providerDbId  - public.users.id of the uploading provider
 * @param {Array}  rows          - already-validated mapped rows
 * @param {string} batchId       - uuid grouping this import session
 */
export async function bulkUpsertProviderPatients(providerDbId, rows, batchId) {
  if (!rows || rows.length === 0) {
    return { imported: 0, skipped: 0, failed: 0, errors: [] };
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    const err = new Error(`CSV exceeds the ${MAX_IMPORT_ROWS}-row limit for a single import.`);
    err.statusCode = 422;
    throw err;
  }

  // Pre-deduplicate within this batch (keep last occurrence per email)
  const deduped = new Map();
  for (const row of rows) {
    deduped.set(String(row.email).toLowerCase().trim(), row);
  }
  const uniqueRows = Array.from(deduped.values());
  const inBatchDuplicates = rows.length - uniqueRows.length;

  // Pre-resolve patient_user_id by looking up emails in users table
  const emails = uniqueRows.map(r => String(r.email).toLowerCase().trim());
  const { rows: userRows } = await query(
    `select id, email from public.users where lower(trim(email)) = any($1::text[])`,
    [emails]
  );
  const emailToUserId = new Map(userRows.map(u => [u.email.toLowerCase().trim(), u.id]));

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < uniqueRows.length; i++) {
    const row = uniqueRows[i];
    const normalizedEmail = String(row.email).toLowerCase().trim();
    const patientUserId = emailToUserId.get(normalizedEmail) || null;

    const firstName = String(row.first_name || "").trim() || null;
    const lastName = String(row.last_name || "").trim() || null;
    const fullName = row.full_name
      ? String(row.full_name).trim() || null
      : [firstName, lastName].filter(Boolean).join(" ") || null;
    const phone = String(row.phone || "").trim() || null;
    const dob = String(row.date_of_birth || "").trim() || null;
    const gender = String(row.gender || "").trim() || null;

    try {
      const { rows: result } = await query(
        `insert into public.provider_patients
           (provider_id, patient_user_id, email, first_name, last_name, full_name,
            phone, date_of_birth, gender, is_default_provider, source, import_batch_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, true, 'csv_import', $10)
         on conflict (provider_id, email) do update
           set patient_user_id   = coalesce(excluded.patient_user_id, provider_patients.patient_user_id),
               first_name        = excluded.first_name,
               last_name         = excluded.last_name,
               full_name         = excluded.full_name,
               phone             = excluded.phone,
               date_of_birth     = excluded.date_of_birth,
               gender            = excluded.gender,
               import_batch_id   = excluded.import_batch_id,
               updated_at        = now()
         returning id, (xmax = 0) as was_inserted`,
        [
          providerDbId,
          patientUserId,
          normalizedEmail,
          firstName,
          lastName,
          fullName,
          phone,
          dob || null,
          gender,
          batchId
        ]
      );

      if (result[0]?.was_inserted) {
        imported++;
      } else {
        skipped++;
      }
    } catch (e) {
      failed++;
      errors.push({ row: i + 1, email: normalizedEmail, reason: e.message });
    }
  }

  return { imported, skipped: skipped + inBatchDuplicates, failed, errors };
}
