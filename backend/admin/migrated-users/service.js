import { createClient } from "@supabase/supabase-js";
import { query } from "../db.js";
import { sendEmailFromTemplate } from "../emails/renderTemplate.js";
import {
  resolveAppBaseUrl,
  resolveSetPasswordUrl
} from "../lib/frontendBaseUrl.js";
import {
  ensureProviderUserRecord,
  getUserPasswordSetupByEmail,
  markPasswordResetPending,
  PASSWORD_SETUP_STATUS
} from "../users/passwordSetup.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

function splitCustomerName(customerName) {
  const parts = String(customerName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

async function generatePasswordSetupLink(email, redirectBaseUrl, { firstName, lastName }) {
  if (!supabaseAdmin?.auth?.admin?.generateLink) {
    const err = new Error("Supabase admin auth is not configured.");
    err.statusCode = 500;
    throw err;
  }
  const normalized = String(email || "").trim().toLowerCase();
  // redirectBaseUrl is already a validated base URL string passed from sendPaidUserPasswordResetEmail.
  const redirectTo = resolveSetPasswordUrl({ origin: redirectBaseUrl });
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

  // Invite creates new auth users; recovery works for existing accounts.
  let result = await tryLink("invite");
  if (!result.link) {
    result = await tryLink("recovery");
  }
  if (!result.link) {
    const err = new Error(result.error?.message || "Unable to generate password reset link.");
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

export async function sendPaidUserPasswordResetEmail({
  email,
  customerName,
  requestOrigin,
  frontendOrigin
}) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) {
    const err = new Error("email is required.");
    err.statusCode = 400;
    throw err;
  }

  const existingSetup = await getUserPasswordSetupByEmail(normalized);
  if (existingSetup?.password_setup_status === PASSWORD_SETUP_STATUS.COMPLETED) {
    const err = new Error("This user has already set their password. A new reset email cannot be sent.");
    err.statusCode = 409;
    throw err;
  }

  const signupBaseUrl = resolveAppBaseUrl({ origin: frontendOrigin || requestOrigin, referer: requestOrigin });
  const { firstName, lastName } = splitCustomerName(customerName);
  const greetingName = firstName || customerName || "there";

  const { link, authUserId } = await generatePasswordSetupLink(normalized, signupBaseUrl, {
    firstName,
    lastName
  });

  await ensureProviderUserRecord({
    authUserId,
    email: normalized,
    firstName,
    lastName
  });

  const sendResult = await sendEmailFromTemplate("account_password_setup", {
    to: normalized,
    first_name: greetingName,
    reset_link: link,
    role_label: "provider password",
  });
  if (!sendResult.ok) {
    const err = new Error(
      sendResult.error === "missing_resend_key"
        ? "Email service is not configured (RESEND_API_KEY)."
        : "Failed to send password reset email."
    );
    err.statusCode = sendResult.error === "missing_resend_key" ? 500 : 502;
    throw err;
  }

  const tracking = await markPasswordResetPending({
    email: normalized,
    authUserId,
    firstName,
    lastName
  });

  return {
    email: normalized,
    email_sent: true,
    password_setup_status: tracking?.password_setup_status || PASSWORD_SETUP_STATUS.PENDING,
    password_reset_email_sent_at: tracking?.password_reset_email_sent_at || new Date().toISOString()
  };
}

export async function getPasswordSetupStatusForEmail(email) {
  const row = await getUserPasswordSetupByEmail(email);
  if (!row) {
    return {
      email: String(email || "").trim().toLowerCase(),
      password_setup_status: null,
      password_reset_email_sent_at: null,
      password_reset_completed_at: null
    };
  }
  return {
    email: row.email,
    password_setup_status: row.password_setup_status,
    password_reset_email_sent_at: row.password_reset_email_sent_at,
    password_reset_completed_at: row.password_reset_completed_at
  };
}

const PAID_PRE_ORDER_STATUSES = ["paid", "confirmed", "completed"];

export async function getPasswordSetupTrackingSummary() {
  const { rows } = await query(
    `select
       count(*)::int as total_paid,
       count(*) filter (where u.password_setup_status is null)::int as reset_not_sent,
       count(*) filter (where u.password_setup_status = $1)::int as reset_pending,
       count(*) filter (where u.password_setup_status = $2)::int as password_created
     from public.course_payments cp
     left join public.users u on lower(u.email) = lower(cp.customer_email)`,
    [PASSWORD_SETUP_STATUS.PENDING, PASSWORD_SETUP_STATUS.COMPLETED]
  );
  return rows[0] || {
    total_paid: 0,
    reset_not_sent: 0,
    reset_pending: 0,
    password_created: 0
  };
}

export async function listPaidPreOrdersNeedingPasswordReset({ limit = 200 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const { rows } = await query(
    `select
       p.id,
       p.customer_name,
       p.customer_email,
       p.course_title,
       p.service_name,
       p.order_type,
       p.status,
       p.amount_paid,
       p.created_at as created_date,
       u.password_setup_status,
       u.password_reset_email_sent_at,
       u.password_reset_completed_at
     from public.pre_orders p
     left join public.users u on lower(u.email) = lower(p.customer_email)
     where p.status = any($1::text[])
       and coalesce(nullif(trim(p.customer_email), ''), '') <> ''
     order by p.created_at desc
     limit $2`,
    [PAID_PRE_ORDER_STATUSES, safeLimit]
  );
  return rows;
}
