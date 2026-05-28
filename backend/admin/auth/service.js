import { createClient } from "@supabase/supabase-js";
import { pool } from "../db.js";
import {
  buildProviderMetadataUpdates,
  mapProviderProfileToMeExtras,
  normalizeProviderProfileUpdates,
} from "./providerProfileFields.js";
import { getProviderLaunchChecklist, upsertProviderLaunchChecklist } from "../launch-roadmap/repository.js";
import {
  ensureProviderUserRecord,
  getUserPasswordSetupByAuthUserId,
  isPasswordResetLinkConsumed,
  markPasswordResetCompleted,
  syncUserRecordOnPasswordSetup
} from "../users/passwordSetup.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";

const supabaseFetchTimeoutMs = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS || 45000);

/** Longer request timeout than undici’s default connect window; merges with caller `signal` when supported. */
function supabaseFetch(url, init = {}) {
  const timeoutSignal = AbortSignal.timeout(supabaseFetchTimeoutMs);
  const signal =
    init.signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([init.signal, timeoutSignal])
      : init.signal || timeoutSignal;
  return fetch(url, { ...init, signal });
}

const supabaseClientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: supabaseFetch }
};

const authClient = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, supabaseClientOptions)
  : null;

const adminClient = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, supabaseClientOptions)
  : null;

/**
 * `@supabase/auth-js` logs the raw undici `TypeError: fetch failed` with `console.error` before
 * turning it into `AuthRetryableFetchError`, which duplicates our own 503 handling and clutters dev logs.
 */
let authJsFetchConsoleMuteDepth = 0;
let savedConsoleErrorRef = console.error.bind(console);
let patientProfilesTableEnsured = false;

function muteAuthJsNetworkFetchConsoleError() {
  if (authJsFetchConsoleMuteDepth === 0) {
    savedConsoleErrorRef = console.error.bind(console);
    console.error = (...args) => {
      const first = args[0];
      const isUndiciFetchFailure =
        authJsFetchConsoleMuteDepth > 0 &&
        first &&
        typeof first === "object" &&
        first.name === "TypeError" &&
        String(first.message || "").includes("fetch failed");
      if (isUndiciFetchFailure) return;
      savedConsoleErrorRef(...args);
    };
  }
  authJsFetchConsoleMuteDepth += 1;
}

function unmuteAuthJsNetworkFetchConsoleError() {
  authJsFetchConsoleMuteDepth = Math.max(0, authJsFetchConsoleMuteDepth - 1);
  if (authJsFetchConsoleMuteDepth === 0) {
    console.error = savedConsoleErrorRef;
  }
}

async function withMutedAuthJsFetchConsole(fn) {
  muteAuthJsNetworkFetchConsoleError();
  try {
    return await fn();
  } finally {
    unmuteAuthJsNetworkFetchConsoleError();
  }
}

function ensureAuthClients() {
  if (!authClient) {
    const err = new Error("Supabase publishable auth client is not configured.");
    err.statusCode = 500;
    throw err;
  }
  if (!adminClient) {
    const err = new Error("Supabase admin auth client is not configured.");
    err.statusCode = 500;
    throw err;
  }
}

function normalizeRole(role) {
  const value = String(role || "provider").trim().toLowerCase();
  if (["provider", "patient", "medical_director", "admin", "staff"].includes(value)) return value;
  return "provider";
}

function fullName(firstName, lastName) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || null;
}

function normalizeNullableText(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

// Extracts YYYY-MM-DD from any date/datetime value, discarding time and timezone.
// Handles JS Date objects (returned by pg driver), ISO strings with timezone
// offsets like "2000-05-13T00:00:00.000+06:00", and plain "YYYY-MM-DD" strings.
function normalizeDateOnly(value) {
  if (value === null || value === undefined) return null;
  // pg driver returns date columns as JS Date objects
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(value).trim();
  if (!str) return null;
  // Matches YYYY-MM-DD at the start of ISO strings
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function readNameFromMetadata(metadata = {}) {
  const firstName = String(
    metadata.first_name ||
    metadata.given_name ||
    metadata.firstName ||
    ""
  ).trim() || null;
  const lastName = String(
    metadata.last_name ||
    metadata.family_name ||
    metadata.lastName ||
    ""
  ).trim() || null;
  const fullNameValue = String(
    metadata.full_name ||
    metadata.name ||
    fullName(firstName, lastName) ||
    ""
  ).trim() || null;
  return { firstName, lastName, fullName: fullNameValue };
}

function readNameFromAuthUser(user = {}) {
  const candidates = [];
  if (user?.user_metadata && typeof user.user_metadata === "object") {
    candidates.push(user.user_metadata);
  }
  if (user?.app_metadata && typeof user.app_metadata === "object") {
    candidates.push(user.app_metadata);
  }
  if (Array.isArray(user?.identities)) {
    for (const identity of user.identities) {
      if (identity?.identity_data && typeof identity.identity_data === "object") {
        candidates.push(identity.identity_data);
      }
    }
  }

  for (const candidate of candidates) {
    const parsed = readNameFromMetadata(candidate);
    if (parsed.fullName || parsed.firstName || parsed.lastName) {
      return parsed;
    }
  }
  return { firstName: null, lastName: null, fullName: null };
}

async function upsertUserRow({
  authUserId,
  email,
  firstName,
  lastName,
  role
}) {
  const normalizedRole = normalizeRole(role);
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `insert into public.users (
         auth_user_id, email, first_name, last_name, full_name, role
       ) values ($1, $2, $3, $4, $5, $6)
       on conflict (auth_user_id)
       do update set
         email = excluded.email,
         first_name = excluded.first_name,
         last_name = excluded.last_name,
         full_name = excluded.full_name,
         role = coalesce(public.users.role, excluded.role),
         updated_at = now()
       returning id, auth_user_id, email, first_name, last_name, full_name, role, is_active, created_at, updated_at`,
      [
        authUserId,
        email,
        firstName || null,
        lastName || null,
        fullName(firstName, lastName),
        normalizedRole
      ]
    );
    return rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function getUserRowByAuthUserId(authUserId) {
  if (!authUserId) return null;
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `select id, auth_user_id, email, first_name, last_name, full_name, role, is_active, permissions, created_at, updated_at
       from public.users
       where auth_user_id = $1
       limit 1`,
      [authUserId]
    );
    return rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function getProviderProfileByUserId(userId) {
  if (!userId) return null;
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `select user_id, dob, address_line1, address_line2, city, state, zip, onboarding_completed, metadata, created_at, updated_at
       from public.provider_profiles
       where user_id = $1
       limit 1`,
      [userId]
    );
    return rows[0] ?? null;
  } finally {
    client.release();
  }
}

let _patientProfilesTableEnsurePromise = null;
async function ensurePatientProfilesTable() {
  if (patientProfilesTableEnsured) return;
  // Singleton promise prevents concurrent initializations within a single
  // runtime. We also take a DB advisory lock to serialize across serverless
  // instances sharing the same Postgres.
  if (!_patientProfilesTableEnsurePromise) {
    _patientProfilesTableEnsurePromise = (async () => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("select pg_advisory_xact_lock(hashtext('ensure_patient_profiles_table_v1'))");
        await client.query(`
          create table if not exists public.patient_profiles (
            id uuid primary key default gen_random_uuid(),
            user_id uuid not null unique references public.users(id) on delete cascade,
            phone text,
            city text,
            state text,
            date_of_birth date,
            gender text,
            allergies text,
            current_medications text,
            medical_conditions text,
            health_notes text,
            emergency_contact_name text,
            emergency_contact_phone text,
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
          );
        `);
        await client.query(`
          create index if not exists idx_patient_profiles_user_id
          on public.patient_profiles(user_id);
        `);
        await client.query(`
          create or replace function public.set_patient_profiles_updated_at()
          returns trigger as $$
          begin
            new.updated_at = now();
            return new;
          end;
          $$ language plpgsql;
        `);
        // Use a single DO block so drop+create are atomic and idempotent
        await client.query(`
          do $$
          begin
            if not exists (
              select 1 from pg_trigger
              where tgname = 'trg_patient_profiles_updated_at'
                and tgrelid = 'public.patient_profiles'::regclass
            ) then
              create trigger trg_patient_profiles_updated_at
              before update on public.patient_profiles
              for each row execute function public.set_patient_profiles_updated_at();
            end if;
          end $$;
        `);
        await client.query("commit");
        patientProfilesTableEnsured = true;
      } catch (error) {
        try {
          await client.query("rollback");
        } catch {
          // no-op: rollback best effort
        }
        throw error;
      } finally {
        client.release();
      }
    })().finally(() => {
      // Allow retries after a failure.
      _patientProfilesTableEnsurePromise = null;
    });
  }
  await _patientProfilesTableEnsurePromise;
}

async function getPatientProfileByUserId(userId) {
  if (!userId) return null;
  await ensurePatientProfilesTable();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `select user_id, phone, city, state, date_of_birth, gender, allergies, current_medications, medical_conditions,
              health_notes, emergency_contact_name, emergency_contact_phone, created_at, updated_at
       from public.patient_profiles
       where user_id = $1
       limit 1`,
      [userId]
    );
    return rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function upsertPatientProfile({ userId, updates }) {
  if (!userId) return null;
  await ensurePatientProfilesTable();

  const allowedFields = [
    "phone",
    "city",
    "state",
    "date_of_birth",
    "gender",
    "allergies",
    "current_medications",
    "medical_conditions",
    "health_notes",
    "emergency_contact_name",
    "emergency_contact_phone"
  ];
  const hasPatientUpdates = allowedFields.some((key) => Object.prototype.hasOwnProperty.call(updates || {}, key));
  if (!hasPatientUpdates) return null;

  const hasDateOfBirth = Object.prototype.hasOwnProperty.call(updates || {}, "date_of_birth");

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `insert into public.patient_profiles (
         user_id, phone, city, state, date_of_birth, gender, allergies, current_medications,
         medical_conditions, health_notes, emergency_contact_name, emergency_contact_phone
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
       )
       on conflict (user_id)
       do update set
         phone = coalesce(excluded.phone, public.patient_profiles.phone),
         city = coalesce(excluded.city, public.patient_profiles.city),
         state = coalesce(excluded.state, public.patient_profiles.state),
         date_of_birth = case when $13 then excluded.date_of_birth else public.patient_profiles.date_of_birth end,
         gender = case when $14 then excluded.gender else public.patient_profiles.gender end,
         allergies = case when $15 then excluded.allergies else public.patient_profiles.allergies end,
         current_medications = case when $16 then excluded.current_medications else public.patient_profiles.current_medications end,
         medical_conditions = case when $17 then excluded.medical_conditions else public.patient_profiles.medical_conditions end,
         health_notes = case when $18 then excluded.health_notes else public.patient_profiles.health_notes end,
         emergency_contact_name = case when $19 then excluded.emergency_contact_name else public.patient_profiles.emergency_contact_name end,
         emergency_contact_phone = case when $20 then excluded.emergency_contact_phone else public.patient_profiles.emergency_contact_phone end,
         updated_at = now()
       returning user_id, phone, city, state, date_of_birth, gender, allergies, current_medications,
                 medical_conditions, health_notes, emergency_contact_name, emergency_contact_phone, created_at, updated_at`,
      [
        userId,
        Object.prototype.hasOwnProperty.call(updates || {}, "phone") ? normalizeNullableText(updates.phone) : null,
        Object.prototype.hasOwnProperty.call(updates || {}, "city") ? normalizeNullableText(updates.city) : null,
        Object.prototype.hasOwnProperty.call(updates || {}, "state") ? normalizeNullableText(updates.state) : null,
        hasDateOfBirth ? normalizeDateOnly(updates.date_of_birth) : null,
        Object.prototype.hasOwnProperty.call(updates || {}, "gender") ? normalizeNullableText(updates.gender) : null,
        Object.prototype.hasOwnProperty.call(updates || {}, "allergies") ? normalizeNullableText(updates.allergies) : null,
        Object.prototype.hasOwnProperty.call(updates || {}, "current_medications") ? normalizeNullableText(updates.current_medications) : null,
        Object.prototype.hasOwnProperty.call(updates || {}, "medical_conditions") ? normalizeNullableText(updates.medical_conditions) : null,
        Object.prototype.hasOwnProperty.call(updates || {}, "health_notes") ? normalizeNullableText(updates.health_notes) : null,
        Object.prototype.hasOwnProperty.call(updates || {}, "emergency_contact_name") ? normalizeNullableText(updates.emergency_contact_name) : null,
        Object.prototype.hasOwnProperty.call(updates || {}, "emergency_contact_phone") ? normalizeNullableText(updates.emergency_contact_phone) : null,
        hasDateOfBirth,
        Object.prototype.hasOwnProperty.call(updates || {}, "gender"),
        Object.prototype.hasOwnProperty.call(updates || {}, "allergies"),
        Object.prototype.hasOwnProperty.call(updates || {}, "current_medications"),
        Object.prototype.hasOwnProperty.call(updates || {}, "medical_conditions"),
        Object.prototype.hasOwnProperty.call(updates || {}, "health_notes"),
        Object.prototype.hasOwnProperty.call(updates || {}, "emergency_contact_name"),
        Object.prototype.hasOwnProperty.call(updates || {}, "emergency_contact_phone")
      ]
    );
    return rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function upsertProviderProfile({ userId, updates }) {
  if (!userId) return null;
  const hasDob = Object.prototype.hasOwnProperty.call(updates || {}, "dob");
  const hasAddressLine1 = Object.prototype.hasOwnProperty.call(updates || {}, "address_line1");
  const hasAddressLine2 = Object.prototype.hasOwnProperty.call(updates || {}, "address_line2");
  const hasCity = Object.prototype.hasOwnProperty.call(updates || {}, "city");
  const hasState = Object.prototype.hasOwnProperty.call(updates || {}, "state");
  const hasZip = Object.prototype.hasOwnProperty.call(updates || {}, "zip");
  const hasOnboardingCompleted = Object.prototype.hasOwnProperty.call(updates || {}, "onboarding_completed");
  const metadataUpdates = buildProviderMetadataUpdates(updates);
  if (Object.prototype.hasOwnProperty.call(updates || {}, "referral_code")) {
    metadataUpdates.referral_code = normalizeNullableText(updates.referral_code);
  }
  if (Object.prototype.hasOwnProperty.call(updates || {}, "referral_discount")) {
    metadataUpdates.referral_discount = updates.referral_discount ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(updates || {}, "referral_program_active")) {
    metadataUpdates.referral_program_active = Boolean(updates.referral_program_active);
  }
  if (Object.prototype.hasOwnProperty.call(updates || {}, "brand_logo_url")) {
    metadataUpdates.brand_logo_url = normalizeNullableText(updates.brand_logo_url);
  }
  if (Object.prototype.hasOwnProperty.call(updates || {}, "years_experience")) {
    metadataUpdates.years_experience = updates.years_experience ?? null;
  }
  const hasMetadataUpdates = Object.keys(metadataUpdates).length > 0;
  const hasProviderProfileUpdates =
    hasDob ||
    hasAddressLine1 ||
    hasAddressLine2 ||
    hasCity ||
    hasState ||
    hasZip ||
    hasOnboardingCompleted ||
    hasMetadataUpdates;

  if (!hasProviderProfileUpdates) return null;

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `insert into public.provider_profiles (
         user_id, dob, address_line1, address_line2, city, state, zip, onboarding_completed, metadata
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (user_id)
       do update set
         dob = coalesce(excluded.dob, public.provider_profiles.dob),
         address_line1 = coalesce(excluded.address_line1, public.provider_profiles.address_line1),
         address_line2 = case when $10 then excluded.address_line2 else public.provider_profiles.address_line2 end,
         city = coalesce(excluded.city, public.provider_profiles.city),
         state = coalesce(excluded.state, public.provider_profiles.state),
         zip = coalesce(excluded.zip, public.provider_profiles.zip),
         onboarding_completed = case when $11 then excluded.onboarding_completed else public.provider_profiles.onboarding_completed end,
         metadata = case
           when $12 then coalesce(public.provider_profiles.metadata, '{}'::jsonb) || excluded.metadata
           else public.provider_profiles.metadata
         end,
         updated_at = now()
       returning user_id, dob, address_line1, address_line2, city, state, zip, onboarding_completed, metadata, created_at, updated_at`,
      [
        userId,
        hasDob ? normalizeDateOnly(updates.dob) : null,
        hasAddressLine1 ? (updates.address_line1 || null) : null,
        hasAddressLine2 ? (updates.address_line2 || null) : null,
        hasCity ? (updates.city || null) : null,
        hasState ? (updates.state || null) : null,
        hasZip ? (updates.zip || null) : null,
        hasOnboardingCompleted ? Boolean(updates.onboarding_completed) : false,
        hasMetadataUpdates ? metadataUpdates : {},
        hasAddressLine2,
        hasOnboardingCompleted,
        hasMetadataUpdates
      ]
    );
    return rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function signup(payload) {
  ensureAuthClients();
  const email = String(payload?.email || "").trim().toLowerCase();
  const password = String(payload?.password || "");
  const confirmPassword = String(payload?.confirm_password || "");
  const firstName = String(payload?.first_name || "").trim();
  const lastName = String(payload?.last_name || "").trim();
  const role = normalizeRole(payload?.role);

  if (!email || !password || !confirmPassword || !firstName || !lastName) {
    const err = new Error("first_name, last_name, email, password, and confirm_password are required.");
    err.statusCode = 400;
    throw err;
  }
  if (password !== confirmPassword) {
    const err = new Error("Password and confirm_password must match.");
    err.statusCode = 400;
    throw err;
  }
  if (password.length < 8) {
    const err = new Error("Password must be at least 8 characters long.");
    err.statusCode = 400;
    throw err;
  }

  const { data: createdData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      full_name: fullName(firstName, lastName),
      role
    }
  });

  if (createError) {
    const err = new Error(createError.message || "Unable to sign up.");
    err.statusCode = 400;
    throw err;
  }

  const authUserId = createdData?.user?.id || null;
  if (!authUserId) {
    const err = new Error("Sign up did not return a user id.");
    err.statusCode = 500;
    throw err;
  }

  const profile = await upsertUserRow({
    authUserId,
    email: createdData.user.email || email,
    firstName,
    lastName,
    role
  });

  const { data: loginData, error: loginError } = await withMutedAuthJsFetchConsole(() =>
    authClient.auth.signInWithPassword({
      email,
      password
    })
  );
  if (loginError) {
    const err = new Error(loginError.message || "Account created, but automatic login failed.");
    err.statusCode = 400;
    throw err;
  }

  return {
    session: loginData.session || null,
    user: {
      id: authUserId,
      email: createdData.user.email || email,
      role: profile?.role || role,
      first_name: profile?.first_name || firstName,
      last_name: profile?.last_name || lastName,
      full_name: profile?.full_name || fullName(firstName, lastName)
    }
  };
}

export async function login(payload) {
  ensureAuthClients();
  const email = String(payload?.email || "").trim().toLowerCase();
  const password = String(payload?.password || "");
  if (!email || !password) {
    const err = new Error("email and password are required.");
    err.statusCode = 400;
    throw err;
  }

  const { data, error } = await withMutedAuthJsFetchConsole(() =>
    authClient.auth.signInWithPassword({ email, password })
  );
  if (error) {
    const err = new Error(error.message || "Invalid login credentials.");
    err.statusCode = 401;
    throw err;
  }

  const authUserId = data?.user?.id || null;
  const profile = await getUserRowByAuthUserId(authUserId);
  const resolvedRole = profile?.role || data?.user?.user_metadata?.role || "provider";

  return {
    session: data.session || null,
    user: {
      id: authUserId,
      email: data?.user?.email || email,
      role: resolvedRole,
      permissions: resolvedRole === "staff" && profile?.permissions
        ? (typeof profile.permissions === "object" ? profile.permissions : null)
        : null,
      first_name: profile?.first_name || data?.user?.user_metadata?.first_name || null,
      last_name: profile?.last_name || data?.user?.user_metadata?.last_name || null,
      full_name: profile?.full_name || data?.user?.user_metadata?.full_name || null
    }
  };
}

export async function getMeFromAccessToken(accessToken) {
  ensureAuthClients();
  if (!accessToken) {
    const err = new Error("Missing bearer token.");
    err.statusCode = 401;
    throw err;
  }

  try {
    let data;
    let error;
    try {
      const result = await withMutedAuthJsFetchConsole(() => authClient.auth.getUser(accessToken));
      data = result?.data;
      error = result?.error;
    } catch (fetchErr) {
      const err = new Error("Auth service unavailable. Please try again.");
      err.statusCode = 503;
      err.isOperational = true;
      throw err;
    }
    if (error || !data?.user?.id) {
      const message = String(error?.message || "Invalid or expired token.");
      const lowered = message.toLowerCase();
      const isTimeout =
        lowered.includes("timeout") ||
        lowered.includes("fetch failed") ||
        lowered.includes("network") ||
        lowered.includes("eai_again");
      const err = new Error(isTimeout ? "Auth service unavailable. Please try again." : message);
      err.statusCode = isTimeout ? 503 : 401;
      err.isOperational = Boolean(isTimeout);
      throw err;
    }

    const profile = await getUserRowByAuthUserId(data.user.id);
    const resolvedRole = profile?.role || data.user.user_metadata?.role || "provider";
    const metaName = readNameFromAuthUser(data.user || {});
    const providerProfile = resolvedRole === "provider"
      ? await getProviderProfileByUserId(profile?.id)
      : null;
    const patientProfile = resolvedRole === "patient"
      ? await getPatientProfileByUserId(profile?.id)
      : null;
    const providerMetadata = providerProfile?.metadata && typeof providerProfile.metadata === "object"
      ? providerProfile.metadata
      : {};
    const staffPermissions = resolvedRole === "staff" && profile?.permissions
      ? (typeof profile.permissions === "object" ? profile.permissions : null)
      : null;
    return {
      id: data.user.id,
      email: data.user.email,
      role: resolvedRole,
      permissions: staffPermissions,
      first_name: profile?.first_name || metaName.firstName || null,
      last_name: profile?.last_name || metaName.lastName || null,
      full_name: profile?.full_name || metaName.fullName || null,
      dob: normalizeDateOnly(providerProfile?.dob),
      address_line1: providerProfile?.address_line1 || null,
      address_line2: providerProfile?.address_line2 || null,
      city: resolvedRole === "patient" ? (patientProfile?.city || null) : (providerProfile?.city || null),
      state: resolvedRole === "patient" ? (patientProfile?.state || null) : (providerProfile?.state || null),
      zip: providerProfile?.zip || null,
      onboarding_completed: providerProfile?.onboarding_completed || false,
      bio: normalizeNullableText(providerMetadata.bio),
      phone: resolvedRole === "patient"
        ? normalizeNullableText(patientProfile?.phone)
        : normalizeNullableText(providerMetadata.phone),
      specialty: normalizeNullableText(providerMetadata.specialty),
      avatar_url: normalizeNullableText(providerMetadata.avatar_url),
      website_url: normalizeNullableText(providerMetadata.website_url),
      instagram_handle: normalizeNullableText(providerMetadata.instagram_handle),
      ...(resolvedRole === "provider" ? mapProviderProfileToMeExtras(providerProfile) : {}),
      ...(resolvedRole === "provider"
        ? {
            years_experience: providerMetadata.years_experience ?? null,
            referral_program_active: Boolean(providerMetadata.referral_program_active),
            referral_code: normalizeNullableText(providerMetadata.referral_code),
            referral_discount: providerMetadata.referral_discount ?? null,
            brand_logo_url: normalizeNullableText(providerMetadata.brand_logo_url),
          }
        : {}),
      launch_checklist: resolvedRole === "provider"
        ? await getProviderLaunchChecklist(data.user.id)
        : {},
      date_of_birth: normalizeDateOnly(patientProfile?.date_of_birth),
      gender: normalizeNullableText(patientProfile?.gender),
      allergies: normalizeNullableText(patientProfile?.allergies),
      current_medications: normalizeNullableText(patientProfile?.current_medications),
      medical_conditions: normalizeNullableText(patientProfile?.medical_conditions),
      health_notes: normalizeNullableText(patientProfile?.health_notes),
      emergency_contact_name: normalizeNullableText(patientProfile?.emergency_contact_name),
      emergency_contact_phone: normalizeNullableText(patientProfile?.emergency_contact_phone)
    };
  } catch (e) {
    if (e?.isOperational && e.statusCode === 503) throw e;
    const code = e?.cause?.code || e?.code;
    const msg = String(e?.message || "");
    if (
      code === "UND_ERR_CONNECT_TIMEOUT" ||
      code === "UND_ERR_SOCKET" ||
      code === "EAI_AGAIN" ||
      code === "ETIMEDOUT" ||
      code === "EHOSTUNREACH" ||
      code === "ECONNRESET" ||
      code === "ECONNREFUSED" ||
      msg === "fetch failed" ||
      msg.includes("fetch failed")
    ) {
      const err = new Error("Auth service unavailable. Please try again.");
      err.statusCode = 503;
      err.isOperational = true;
      throw err;
    }
    throw e;
  }
}

export async function refreshSession(refreshToken) {
  ensureAuthClients();
  const safeRefreshToken = String(refreshToken || "").trim();
  if (!safeRefreshToken) {
    const err = new Error("refresh_token is required.");
    err.statusCode = 400;
    throw err;
  }

  const { data, error } = await withMutedAuthJsFetchConsole(() =>
    authClient.auth.refreshSession({
      refresh_token: safeRefreshToken
    })
  );
  if (error || !data?.session?.access_token || !data?.user?.id) {
    const err = new Error(error?.message || "Invalid or expired refresh token.");
    err.statusCode = 401;
    throw err;
  }

  const profile = await getUserRowByAuthUserId(data.user.id);
  const resolvedRole = profile?.role || data.user.user_metadata?.role || "provider";
  return {
    session: data.session,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: resolvedRole,
      permissions: resolvedRole === "staff" && profile?.permissions
        ? (typeof profile.permissions === "object" ? profile.permissions : null)
        : null,
      first_name: profile?.first_name || data.user.user_metadata?.first_name || null,
      last_name: profile?.last_name || data.user.user_metadata?.last_name || null,
      full_name: profile?.full_name || data.user.user_metadata?.full_name || null
    }
  };
}

export async function setPasswordWithAccessToken({ accessToken, refreshToken, password, confirmPassword }) {
  ensureAuthClients();
  const safeToken = String(accessToken || "").trim();
  const safePassword = String(password || "");
  const safeConfirm = String(confirmPassword || "");
  const safeRefreshToken = String(refreshToken || "").trim();

  if (!safeToken) {
    const err = new Error("access_token is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!safePassword || !safeConfirm) {
    const err = new Error("password and confirm_password are required.");
    err.statusCode = 400;
    throw err;
  }
  if (!safeRefreshToken) {
    const err = new Error("refresh_token is required.");
    err.statusCode = 400;
    throw err;
  }
  if (safePassword !== safeConfirm) {
    const err = new Error("Password and confirm_password must match.");
    err.statusCode = 400;
    throw err;
  }
  if (safePassword.length < 8) {
    const err = new Error("Password must be at least 8 characters long.");
    err.statusCode = 400;
    throw err;
  }

  let authUserIdFromToken = null;
  try {
    const peek = await withMutedAuthJsFetchConsole(() => authClient.auth.getUser(safeToken));
    authUserIdFromToken = peek?.data?.user?.id || null;
  } catch {
    authUserIdFromToken = null;
  }

  if (authUserIdFromToken) {
    const setupRow = await getUserPasswordSetupByAuthUserId(authUserIdFromToken);
    if (isPasswordResetLinkConsumed(setupRow)) {
      const err = new Error(
        "You have already created your password. Sign in with your email and password, or ask the NOVI team for a new reset email."
      );
      err.statusCode = 410;
      err.code = "PASSWORD_RESET_LINK_USED";
      throw err;
    }
  }

  const { data: sessionData, error: sessionError } = await authClient.auth.setSession({
    access_token: safeToken,
    refresh_token: safeRefreshToken
  });
  if (sessionError || !sessionData?.user?.id) {
    const message = String(sessionError?.message || "");
    const lowered = message.toLowerCase();
    const isExpired =
      lowered.includes("expired") ||
      lowered.includes("invalid") ||
      lowered.includes("refresh");
    const err = new Error(
      isExpired
        ? "This password reset link has expired or is invalid. Please request a new reset email from the NOVI team."
        : message || "Invalid or expired recovery session."
    );
    err.statusCode = isExpired ? 410 : 401;
    err.code = isExpired ? "PASSWORD_RESET_LINK_EXPIRED" : undefined;
    throw err;
  }

  const authUserId = sessionData.user.id;
  const { data: updatedData, error: updateError } = await authClient.auth.updateUser({
    password: safePassword
  });
  if (updateError) {
    const err = new Error(updateError.message || "Unable to set password.");
    err.statusCode = 400;
    throw err;
  }

  const userEmail = updatedData?.user?.email || sessionData.user.email;
  const metaName = readNameFromAuthUser(sessionData.user || {});

  await syncUserRecordOnPasswordSetup({
    authUserId,
    email: userEmail,
    firstName: metaName.firstName,
    lastName: metaName.lastName
  });

  await markPasswordResetCompleted(authUserId, userEmail);

  const profile = await getUserRowByAuthUserId(authUserId);
  const resolvedRole =
    profile?.role ||
    updatedData?.user?.user_metadata?.role ||
    sessionData.user.user_metadata?.role ||
    "provider";
  return {
    user: {
      id: authUserId,
      email: updatedData?.user?.email || sessionData.user.email,
      role: resolvedRole,
      permissions: resolvedRole === "staff" && profile?.permissions
        ? (typeof profile.permissions === "object" ? profile.permissions : null)
        : null,
      first_name: profile?.first_name || updatedData?.user?.user_metadata?.first_name || sessionData.user.user_metadata?.first_name || null,
      last_name: profile?.last_name || updatedData?.user?.user_metadata?.last_name || sessionData.user.user_metadata?.last_name || null,
      full_name: profile?.full_name || updatedData?.user?.user_metadata?.full_name || sessionData.user.user_metadata?.full_name || null
    }
  };
}

export async function updateMe({ accessToken, updates }) {
  ensureAuthClients();
  const me = await getMeFromAccessToken(accessToken);
  let userRow = await getUserRowByAuthUserId(me.id);
  // Strip `role` — role changes must go through /admin/users (admin-only endpoint).
  // Accepting a caller-supplied role here would allow any user to self-escalate.
  const { role: _droppedRole, ...safeUpdates } = updates || {};
  const sessionRole = String(me.role || "").trim().toLowerCase();
  const firstName = Object.prototype.hasOwnProperty.call(safeUpdates, "first_name")
    ? String(safeUpdates.first_name || "").trim() || null
    : me.first_name;
  const lastName = Object.prototype.hasOwnProperty.call(safeUpdates, "last_name")
    ? String(safeUpdates.last_name || "").trim() || null
    : me.last_name;

  const client = await pool.connect();
  try {
    // Role is intentionally excluded from this UPDATE — it is read-only through
    // the self-service endpoint. Role changes go through POST/PUT /admin/users only.
    const { rows } = await client.query(
      `update public.users
       set first_name = $2,
           last_name = $3,
           full_name = $4,
           updated_at = now()
       where auth_user_id = $1
       returning id, auth_user_id, email, first_name, last_name, full_name, role, is_active, created_at, updated_at`,
      [me.id, firstName, lastName, fullName(firstName, lastName)]
    );
    if (!rows[0]) {
      // Brand-new users without a DB row (edge case): upsert preserves any existing
      // role via coalesce, defaulting to the session role only on first insert.
      userRow = await upsertUserRow({
        authUserId: me.id,
        email: me.email,
        firstName,
        lastName,
        role: me.role || "provider"
      });
    } else {
      userRow = rows[0];
    }
  } finally {
    client.release();
  }

  if (sessionRole === "provider" && userRow?.id) {
    await upsertProviderProfile({
      userId: userRow.id,
      updates: normalizeProviderProfileUpdates(updates),
    });
  }
  if (userRow?.id) {
    const patientProfileFields = [
      "phone",
      "city",
      "state",
      "date_of_birth",
      "gender",
      "allergies",
      "current_medications",
      "medical_conditions",
      "health_notes",
      "emergency_contact_name",
      "emergency_contact_phone",
    ];
    const hasPatientProfileUpdates = patientProfileFields.some((key) =>
      Object.prototype.hasOwnProperty.call(updates || {}, key)
    );
    if (sessionRole === "patient" || hasPatientProfileUpdates) {
      await upsertPatientProfile({ userId: userRow.id, updates: safeUpdates });
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates || {}, "launch_checklist")) {
    await upsertProviderLaunchChecklist(me.id, updates.launch_checklist);
  }

  return getMeFromAccessToken(accessToken);
}
