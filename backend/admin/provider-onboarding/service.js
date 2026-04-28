import { pool } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";

let tableEnsured = false;

async function ensureProviderOnboardingTable() {
  if (tableEnsured) return;
  const client = await pool.connect();
  try {
    await client.query(`
      create table if not exists public.provider_basic_onboarding (
        id uuid primary key default gen_random_uuid(),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        auth_user_id uuid not null unique,
        provider_email text,
        dob date not null,
        address_line1 text not null,
        address_line2 text,
        city text not null,
        state text not null,
        zip text not null,
        license_type text not null,
        license_number text not null,
        issuing_state text,
        expiration_date date,
        document_url text,
        onboarding_status text not null default 'submitted'
      );
    `);
    await client.query(`
      create index if not exists idx_provider_basic_onboarding_auth_user_id
      on public.provider_basic_onboarding(auth_user_id);
    `);
    await client.query(`
      create or replace function public.set_provider_basic_onboarding_updated_at()
      returns trigger as $$
      begin
        new.updated_at = now();
        return new;
      end;
      $$ language plpgsql;
    `);
    await client.query(`
      drop trigger if exists trg_provider_basic_onboarding_updated_at on public.provider_basic_onboarding;
    `);
    await client.query(`
      create trigger trg_provider_basic_onboarding_updated_at
      before update on public.provider_basic_onboarding
      for each row execute function public.set_provider_basic_onboarding_updated_at();
    `);
    tableEnsured = true;
  } finally {
    client.release();
  }
}

function assertRequired(payload, key, label = key) {
  const value = String(payload?.[key] || "").trim();
  if (!value) {
    const err = new Error(`${label} is required.`);
    err.statusCode = 400;
    throw err;
  }
  return value;
}

function validateAdult(dobValue) {
  const dob = new Date(dobValue);
  if (Number.isNaN(dob.getTime())) {
    const err = new Error("Invalid date of birth.");
    err.statusCode = 400;
    throw err;
  }
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  if (age < 18) {
    const err = new Error("You must be 18 or older to register as a provider.");
    err.statusCode = 400;
    throw err;
  }
}

export async function submitProviderBasicOnboarding({ accessToken, payload }) {
  if (!accessToken) {
    const err = new Error("Missing bearer token.");
    err.statusCode = 401;
    throw err;
  }

  await ensureProviderOnboardingTable();

  const me = await getMeFromAccessToken(accessToken);
  if (me?.role !== "provider") {
    const err = new Error("Only provider users can submit provider onboarding.");
    err.statusCode = 403;
    throw err;
  }

  const dob = assertRequired(payload, "dob", "Date of birth");
  validateAdult(dob);

  const addressLine1 = assertRequired(payload, "address_line1", "Street address");
  const city = assertRequired(payload, "city", "City");
  const state = assertRequired(payload, "state", "State");
  const zip = assertRequired(payload, "zip", "ZIP");
  const licenseType = assertRequired(payload, "license_type", "License type");
  const licenseNumber = assertRequired(payload, "license_number", "License number");
  const documentUrl = assertRequired(payload, "document_url", "License document");

  const issuingState = String(payload?.issuing_state || "").trim() || null;
  const expirationDate = String(payload?.expiration_date || "").trim() || null;
  const addressLine2 = String(payload?.address_line2 || "").trim() || null;

  const client = await pool.connect();
  try {
    await client.query("begin");

    const { rows } = await client.query(
      `insert into public.provider_basic_onboarding (
         auth_user_id,
         provider_email,
         dob,
         address_line1,
         address_line2,
         city,
         state,
         zip,
         license_type,
         license_number,
         issuing_state,
         expiration_date,
         document_url,
         onboarding_status
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'submitted'
       )
       on conflict (auth_user_id)
       do update set
         provider_email = excluded.provider_email,
         dob = excluded.dob,
         address_line1 = excluded.address_line1,
         address_line2 = excluded.address_line2,
         city = excluded.city,
         state = excluded.state,
         zip = excluded.zip,
         license_type = excluded.license_type,
         license_number = excluded.license_number,
         issuing_state = excluded.issuing_state,
         expiration_date = excluded.expiration_date,
         document_url = excluded.document_url,
         onboarding_status = 'submitted',
         updated_at = now()
       returning *`,
      [
        me.id,
        me.email || null,
        dob,
        addressLine1,
        addressLine2,
        city,
        state,
        zip,
        licenseType,
        licenseNumber,
        issuingState,
        expirationDate,
        documentUrl
      ]
    );

    // Ensure provider exists in public.users so license FK (provider_id -> users.auth_user_id) succeeds.
    await client.query(
      `insert into public.users (auth_user_id, email, role)
       values ($1, $2, 'provider')
       on conflict (auth_user_id)
       do update set
         email = excluded.email,
         updated_at = now()`,
      [me.id, me.email || null]
    );

    const { rows: existingLicenseRows } = await client.query(
      `select id
       from public.licenses
       where provider_id = $1
         and license_type = $2
         and license_number = $3
       order by created_at desc
       limit 1`,
      [me.id, licenseType, licenseNumber]
    );

    const existingLicenseId = existingLicenseRows[0]?.id || null;
    if (existingLicenseId) {
      await client.query(
        `update public.licenses
         set provider_email = $2,
             issuing_state = $3,
             expiration_date = $4,
             document_url = $5,
             status = 'pending_review',
             rejection_reason = null,
             verified_at = null,
             verified_by = null,
             notes = null,
             updated_at = now()
         where id = $1`,
        [
          existingLicenseId,
          me.email || null,
          issuingState,
          expirationDate,
          documentUrl
        ]
      );
    } else {
      await client.query(
        `insert into public.licenses (
           provider_id,
           provider_email,
           license_type,
           license_number,
           issuing_state,
           expiration_date,
           document_url,
           status
         ) values ($1,$2,$3,$4,$5,$6,$7,'pending_review')`,
        [
          me.id,
          me.email || null,
          licenseType,
          licenseNumber,
          issuingState,
          expirationDate,
          documentUrl
        ]
      );
    }

    await client.query("commit");
    return rows[0];
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Ignore rollback failures.
    }
    throw error;
  } finally {
    client.release();
  }
}
