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
  return {
    id: data.user.id,
    email: data.user.email,
    role: profile?.role || data.user.user_metadata?.role || "provider",
    first_name: profile?.first_name || data.user.user_metadata?.first_name || null,
    last_name: profile?.last_name || data.user.user_metadata?.last_name || null,
    full_name: profile?.full_name || data.user.user_metadata?.full_name || null
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

export async function updateMe({ accessToken, updates }) {
  ensureAuthClients();
  const me = await getMeFromAccessToken(accessToken);
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

  return getMeFromAccessToken(accessToken);
}
