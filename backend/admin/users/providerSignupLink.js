import { createClient } from "@supabase/supabase-js";
import { resolveSetPasswordUrl } from "../lib/frontendBaseUrl.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

export function splitCustomerName(customerName) {
  const parts = String(customerName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * Generates a one-time Supabase invite/recovery link that redirects to /set-password.
 */
export async function generateProviderSignupLink(email, req, { firstName, lastName } = {}) {
  if (!supabaseAdmin?.auth?.admin?.generateLink) {
    const err = new Error("Supabase admin auth is not configured.");
    err.statusCode = 500;
    throw err;
  }
  const normalized = String(email || "").trim().toLowerCase();
  const redirectTo = resolveSetPasswordUrl(req);
  const linkData = {
    first_name: firstName || "",
    last_name: lastName || "",
    role: "provider"
  };

  const tryLink = async (type) => {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type,
      email: normalized,
      options: { redirectTo, data: linkData }
    });
    if (error) return { link: "", authUserId: null, error };
    const link = data?.properties?.action_link || data?.action_link || "";
    const authUserId = data?.user?.id || null;
    return { link, authUserId, error: null };
  };

  let result = await tryLink("invite");
  if (!result.link) {
    result = await tryLink("recovery");
  }
  if (!result.link) {
    const err = new Error(result.error?.message || "Unable to generate signup link.");
    err.statusCode = 400;
    throw err;
  }

  if (result.authUserId) {
    try {
      await supabaseAdmin.auth.admin.updateUserById(result.authUserId, {
        user_metadata: {
          first_name: firstName || null,
          last_name: lastName || null,
          role: "provider"
        }
      });
    } catch {
      // Non-fatal; profile row still enforces provider role.
    }
  }

  return result;
}
