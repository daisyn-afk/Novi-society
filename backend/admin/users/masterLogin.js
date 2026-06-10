import { createClient } from "@supabase/supabase-js";

const MASTER_LOGIN_DURATION_MS = 5 * 60 * 1000;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseClientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
};

const authClient =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, supabaseClientOptions)
    : null;

const adminClient =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, supabaseClientOptions)
    : null;

const PROTECTED_ROLES = new Set(["admin", "staff", "super_admin", "owner"]);

function ensureClients() {
  if (!authClient || !adminClient) {
    const err = new Error("Supabase auth is not configured.");
    err.statusCode = 500;
    throw err;
  }
}

/**
 * Mints a short-lived Supabase session for the target user via admin magic link.
 * Does not read or change the user's password.
 */
export async function createMasterLoginSession(targetUser) {
  ensureClients();

  const email = String(targetUser?.email || "").trim().toLowerCase();
  if (!email) {
    const err = new Error("Target user has no email address.");
    err.statusCode = 400;
    throw err;
  }
  if (targetUser.is_active === false) {
    const err = new Error("Cannot open an inactive user account.");
    err.statusCode = 400;
    throw err;
  }

  const targetRole = String(targetUser.role || "").trim().toLowerCase();
  if (PROTECTED_ROLES.has(targetRole)) {
    const err = new Error("Master login is not allowed for admin or staff accounts.");
    err.statusCode = 403;
    throw err;
  }

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) {
    const err = new Error(linkError.message || "Unable to create master login session.");
    err.statusCode = 502;
    throw err;
  }

  const tokenHash = linkData?.properties?.hashed_token || linkData?.hashed_token || "";
  if (!tokenHash) {
    const err = new Error("Supabase did not return a login token.");
    err.statusCode = 502;
    throw err;
  }

  let otpData = null;
  let otpError = null;
  ({ data: otpData, error: otpError } = await authClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  }));
  if (otpError || !otpData?.session?.access_token) {
    ({ data: otpData, error: otpError } = await authClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    }));
  }
  if (otpError || !otpData?.session?.access_token) {
    const err = new Error(otpError?.message || "Unable to verify master login session.");
    err.statusCode = 502;
    throw err;
  }

  const expiresAt = new Date(Date.now() + MASTER_LOGIN_DURATION_MS).toISOString();

  return {
    session: {
      access_token: otpData.session.access_token,
      refresh_token: otpData.session.refresh_token,
      expires_in: otpData.session.expires_in,
      expires_at: otpData.session.expires_at,
    },
    expires_at: expiresAt,
    duration_seconds: MASTER_LOGIN_DURATION_MS / 1000,
    user: {
      id: targetUser.auth_user_id,
      public_user_id: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      first_name: targetUser.first_name,
      last_name: targetUser.last_name,
      full_name: targetUser.full_name,
    },
  };
}
