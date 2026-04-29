import { createClient } from "@supabase/supabase-js";
import { pool } from "../db.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";

const authClient = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

const adminClient = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

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
  if (["provider", "patient", "medical_director", "admin"].includes(value)) return value;
  return "provider";
}

function fullName(firstName, lastName) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || null;
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
      `select id, auth_user_id, email, first_name, last_name, full_name, role, is_active, created_at, updated_at
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

async function upsertProviderProfile({ userId, updates }) {
  if (!userId) return null;
  const hasDob = Object.prototype.hasOwnProperty.call(updates || {}, "dob");
  const hasAddressLine1 = Object.prototype.hasOwnProperty.call(updates || {}, "address_line1");
  const hasAddressLine2 = Object.prototype.hasOwnProperty.call(updates || {}, "address_line2");
  const hasCity = Object.prototype.hasOwnProperty.call(updates || {}, "city");
  const hasState = Object.prototype.hasOwnProperty.call(updates || {}, "state");
  const hasZip = Object.prototype.hasOwnProperty.call(updates || {}, "zip");
  const hasOnboardingCompleted = Object.prototype.hasOwnProperty.call(updates || {}, "onboarding_completed");
  const hasProviderProfileUpdates =
    hasDob || hasAddressLine1 || hasAddressLine2 || hasCity || hasState || hasZip || hasOnboardingCompleted;

  if (!hasProviderProfileUpdates) return null;

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `insert into public.provider_profiles (
         user_id, dob, address_line1, address_line2, city, state, zip, onboarding_completed
       ) values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (user_id)
       do update set
         dob = coalesce(excluded.dob, public.provider_profiles.dob),
         address_line1 = coalesce(excluded.address_line1, public.provider_profiles.address_line1),
         address_line2 = case when $9 then excluded.address_line2 else public.provider_profiles.address_line2 end,
         city = coalesce(excluded.city, public.provider_profiles.city),
         state = coalesce(excluded.state, public.provider_profiles.state),
         zip = coalesce(excluded.zip, public.provider_profiles.zip),
         onboarding_completed = case when $10 then excluded.onboarding_completed else public.provider_profiles.onboarding_completed end,
         updated_at = now()
       returning user_id, dob, address_line1, address_line2, city, state, zip, onboarding_completed, metadata, created_at, updated_at`,
      [
        userId,
        hasDob ? (updates.dob || null) : null,
        hasAddressLine1 ? (updates.address_line1 || null) : null,
        hasAddressLine2 ? (updates.address_line2 || null) : null,
        hasCity ? (updates.city || null) : null,
        hasState ? (updates.state || null) : null,
        hasZip ? (updates.zip || null) : null,
        hasOnboardingCompleted ? Boolean(updates.onboarding_completed) : false,
        hasAddressLine2,
        hasOnboardingCompleted
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

  const { data: loginData, error: loginError } = await authClient.auth.signInWithPassword({
    email,
    password
  });
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

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error) {
    const err = new Error(error.message || "Invalid login credentials.");
    err.statusCode = 401;
    throw err;
  }

  const authUserId = data?.user?.id || null;
  const profile = await getUserRowByAuthUserId(authUserId);

  return {
    session: data.session || null,
    user: {
      id: authUserId,
      email: data?.user?.email || email,
      role: profile?.role || data?.user?.user_metadata?.role || "provider",
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

  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data?.user?.id) {
    const err = new Error(error?.message || "Invalid or expired token.");
    err.statusCode = 401;
    throw err;
  }

  const profile = await getUserRowByAuthUserId(data.user.id);
  const metaName = readNameFromAuthUser(data.user || {});
  const providerProfile = profile?.role === "provider"
    ? await getProviderProfileByUserId(profile?.id)
    : null;
  return {
    id: data.user.id,
    email: data.user.email,
    role: profile?.role || data.user.user_metadata?.role || "provider",
    first_name: profile?.first_name || metaName.firstName || null,
    last_name: profile?.last_name || metaName.lastName || null,
    full_name: profile?.full_name || metaName.fullName || null,
    dob: providerProfile?.dob || null,
    address_line1: providerProfile?.address_line1 || null,
    address_line2: providerProfile?.address_line2 || null,
    city: providerProfile?.city || null,
    state: providerProfile?.state || null,
    zip: providerProfile?.zip || null,
    onboarding_completed: providerProfile?.onboarding_completed || false
  };
}

export async function refreshSession(refreshToken) {
  ensureAuthClients();
  const safeRefreshToken = String(refreshToken || "").trim();
  if (!safeRefreshToken) {
    const err = new Error("refresh_token is required.");
    err.statusCode = 400;
    throw err;
  }

  const { data, error } = await authClient.auth.refreshSession({
    refresh_token: safeRefreshToken
  });
  if (error || !data?.session?.access_token || !data?.user?.id) {
    const err = new Error(error?.message || "Invalid or expired refresh token.");
    err.statusCode = 401;
    throw err;
  }

  const profile = await getUserRowByAuthUserId(data.user.id);
  return {
    session: data.session,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: profile?.role || data.user.user_metadata?.role || "provider",
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

  const { data: sessionData, error: sessionError } = await authClient.auth.setSession({
    access_token: safeToken,
    refresh_token: safeRefreshToken
  });
  if (sessionError || !sessionData?.user?.id) {
    const err = new Error(sessionError?.message || "Invalid or expired recovery session.");
    err.statusCode = 401;
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

  const profile = await getUserRowByAuthUserId(authUserId);
  return {
    user: {
      id: authUserId,
      email: updatedData?.user?.email || sessionData.user.email,
      role: profile?.role || updatedData?.user?.user_metadata?.role || sessionData.user.user_metadata?.role || "provider",
      first_name: profile?.first_name || updatedData?.user?.user_metadata?.first_name || sessionData.user.user_metadata?.first_name || null,
      last_name: profile?.last_name || updatedData?.user?.user_metadata?.last_name || sessionData.user.user_metadata?.last_name || null,
      full_name: profile?.full_name || updatedData?.user?.user_metadata?.full_name || sessionData.user.user_metadata?.full_name || null
    }
  };
}

export async function updateMe({ accessToken, updates }) {
  ensureAuthClients();
  const me = await getMeFromAccessToken(accessToken);
  const userRow = await getUserRowByAuthUserId(me.id);
  const role = updates?.role ? normalizeRole(updates.role) : null;
  const firstName = Object.prototype.hasOwnProperty.call(updates || {}, "first_name")
    ? String(updates.first_name || "").trim() || null
    : me.first_name;
  const lastName = Object.prototype.hasOwnProperty.call(updates || {}, "last_name")
    ? String(updates.last_name || "").trim() || null
    : me.last_name;
  const nextRole = role || me.role || "provider";

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `update public.users
       set first_name = $2,
           last_name = $3,
           full_name = $4,
           role = $5,
           updated_at = now()
       where auth_user_id = $1
       returning id, auth_user_id, email, first_name, last_name, full_name, role, is_active, created_at, updated_at`,
      [me.id, firstName, lastName, fullName(firstName, lastName), nextRole]
    );
    if (!rows[0]) {
      await upsertUserRow({
        authUserId: me.id,
        email: me.email,
        firstName,
        lastName,
        role: nextRole
      });
    }
  } finally {
    client.release();
  }

  if (nextRole === "provider" && userRow?.id) {
    await upsertProviderProfile({ userId: userRow.id, updates });
  }

  return getMeFromAccessToken(accessToken);
}
