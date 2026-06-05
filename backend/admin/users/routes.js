import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  updateUser
} from "./repository.js";
import {
  hasAdminAccess,
  hasStaffModuleAccess,
  requireAuth,
  requireAdminOrStaffWithModule,
} from "../auth/helpers.js";
import { markUserSetupEmailSent } from "./passwordSetup.js";
import { sendEmailFromTemplate } from "../emails/renderTemplate.js";
import { resolveSetPasswordUrl } from "../lib/frontendBaseUrl.js";

const ROLE_PASSWORD_LABELS = {
  provider: "provider password",
  staff: "staff account password",
  admin: "admin account password",
  medical_director: "medical director account password",
};

function resolveRoleLabel(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return ROLE_PASSWORD_LABELS[normalized] || "account password";
}

const _supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const _supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const _supabaseAdmin =
  _supabaseUrl && _supabaseServiceRoleKey
    ? createClient(_supabaseUrl, _supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

/**
 * Sends the standard "set up your account" email to a newly admin-created user.
 * Generates a Supabase invite link (falls back to recovery) pointing to /set-password,
 * then dispatches via the shared Resend helper. Errors are swallowed so they never
 * block the user-creation response.
 */
async function sendAdminUserSetupEmail(createdUser, req, { linkTypes = ["invite", "recovery"] } = {}) {
  const { auth_user_id: authUserId, email, first_name: firstName, last_name: lastName, role } = createdUser;
  if (!email) {
    // eslint-disable-next-line no-console
    console.warn("[admin-users] invite email skipped: missing email on created user");
    return { attempted: false, sent: false, reason: "missing_email" };
  }
  if (!_supabaseAdmin) {
    // eslint-disable-next-line no-console
    console.warn("[admin-users] invite email skipped: Supabase admin client not configured");
    return { attempted: false, sent: false, reason: "missing_supabase_admin_client" };
  }
  try {
    const redirectTo = resolveSetPasswordUrl(req);
    // eslint-disable-next-line no-console
    console.info("[admin-users] ABOUT TO GENERATE EMAIL LINK", {
      email,
      authUserId,
      redirectTo
    });

    let link = "";
    for (const type of linkTypes) {
      const { data, error } = await _supabaseAdmin.auth.admin.generateLink({
        type,
        email,
        options: {
          redirectTo,
          data: { first_name: firstName || null, last_name: lastName || null }
        }
      });
      if (error) {
        // eslint-disable-next-line no-console
        console.warn(`[admin-users] generateLink(${type}) failed for ${email}:`, error.message || error);
      }
      if (!error) {
        link = data?.properties?.action_link || data?.action_link || "";
        if (link) break;
      }
    }

    if (!link) {
      // eslint-disable-next-line no-console
      console.warn("[admin-users] invite email skipped: could not generate setup link for", email);
      return { attempted: true, sent: false, reason: "missing_link" };
    }

    // eslint-disable-next-line no-console
    console.info("[admin-users] ABOUT TO SEND EMAIL", {
      email,
      authUserId,
      hasLink: Boolean(link)
    });

    const greetingName = firstName || email;
    const result = await sendEmailFromTemplate("account_password_setup", {
      to: email,
      first_name: greetingName,
      reset_link: link,
      role_label: resolveRoleLabel(role),
    });

    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.warn("[admin-users] invite email delivery failed for", email, result.error);
      return { attempted: true, sent: false, reason: result.error || "resend_failed" };
    }
    await markUserSetupEmailSent(authUserId);
    // eslint-disable-next-line no-console
    console.info("[admin-users] EMAIL SENT", { email, authUserId });
    return { attempted: true, sent: true, reason: null };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[admin-users] invite email error for", email, err);
    return { attempted: true, sent: false, reason: err?.message || "unknown_error" };
  }
}

export const usersRouter = Router();

// Staff-accessible read-only provider directory.
// Registered BEFORE requireAdminAuth so it bypasses the admin-only guard.
// Returns limited fields only — no passwords, no role management data.
usersRouter.get("/providers", requireAdminOrStaffWithModule("AdminProviders"), async (req, res, next) => {
  try {
    const result = await listUsers({
      page: req.query.page,
      pageSize: req.query.page_size ?? req.query.pageSize,
      q: req.query.q ?? req.query.search,
      role: "provider",
      isActive: req.query.is_active ?? req.query.isActive,
    });
    const safeData = (result.data || []).map(u => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      full_name: u.full_name,
      email: u.email,
      is_active: u.is_active,
      created_at: u.created_at,
    }));
    res.json({ ...result, data: safeData });
  } catch (error) {
    next(error);
  }
});

async function requireUsersRouteAccess(req, res, next) {
  const me = req.me || {};
  if (hasAdminAccess(me.role) || hasStaffModuleAccess(me, "AdminUsers") || hasStaffModuleAccess(me, "AdminProviders")) {
    return next();
  }
  return res.status(403).json({ error: "Forbidden." });
}

function isProviderOnlyStaff(me) {
  return hasStaffModuleAccess(me, "AdminProviders") && !hasStaffModuleAccess(me, "AdminUsers");
}

usersRouter.use(requireAuth);

usersRouter.get("/", async (req, res, next) => {
  try {
    await requireUsersRouteAccess(req, res, async () => {
      const me = req.me || {};
      const roleFilter = String(req.query.role || "").trim().toLowerCase();
      if (isProviderOnlyStaff(me) && roleFilter && roleFilter !== "provider") {
        return res.status(403).json({ error: "Forbidden." });
      }
      const effectiveRole = isProviderOnlyStaff(me) ? "provider" : req.query.role;
      const result = await listUsers({
        page: req.query.page,
        pageSize: req.query.page_size ?? req.query.pageSize,
        q: req.query.q ?? req.query.search,
        role: effectiveRole,
        isActive: req.query.is_active ?? req.query.isActive
      });
      return res.json(result);
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/:id/send-password-reset", async (req, res, next) => {
  try {
    await requireUsersRouteAccess(req, res, async () => {
      const me = req.me || {};
      const user = await getUserById(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found." });
      if (isProviderOnlyStaff(me) && String(user.role || "").toLowerCase() !== "provider") {
        return res.status(403).json({ error: "Forbidden." });
      }
      if (!user.email) {
        return res.status(400).json({ error: "User has no email address." });
      }

      const emailResult = await sendAdminUserSetupEmail(user, req, {
        linkTypes: ["recovery", "invite"]
      });
      if (!emailResult?.sent) {
        const statusCode =
          emailResult?.reason === "missing_supabase_admin_client" ? 500 : 502;
        return res.status(statusCode).json({
          error: "Failed to send password reset email.",
          reason: emailResult?.reason || "unknown_error"
        });
      }

      return res.json({
        ok: true,
        email: user.email,
        password_reset_email_sent_at: new Date().toISOString()
      });
    });
  } catch (error) {
    return next(error);
  }
});

usersRouter.get("/:id", async (req, res, next) => {
  try {
    await requireUsersRouteAccess(req, res, async () => {
      const me = req.me || {};
      const user = await getUserById(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found." });
      if (isProviderOnlyStaff(me) && String(user.role || "").toLowerCase() !== "provider") {
        return res.status(403).json({ error: "Forbidden." });
      }
      return res.json(user);
    });
  } catch (error) {
    return next(error);
  }
});

usersRouter.post("/", async (req, res, next) => {
  try {
    await requireUsersRouteAccess(req, res, async () => {
      const me = req.me || {};
      const requestedRole = String(req.body?.role || "provider").trim().toLowerCase();
      if (isProviderOnlyStaff(me) && requestedRole !== "provider") {
        return res.status(403).json({ error: "Forbidden." });
      }
      const created = await createUser(req.body || {});
      // eslint-disable-next-line no-console
      console.info("[admin-users] USER CREATED", {
        id: created?.id,
        authUserId: created?.auth_user_id,
        email: created?.email,
        role: created?.role
      });
      const emailResult = await sendAdminUserSetupEmail(created, req);
      // eslint-disable-next-line no-console
      console.info("[admin-users] EMAIL FLOW RESULT", {
        email: created?.email,
        result: emailResult
      });
      return res.status(201).json({ ...created, invite_email_sent: Boolean(emailResult?.sent) });
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.put("/:id", async (req, res, next) => {
  try {
    await requireUsersRouteAccess(req, res, async () => {
      const me = req.me || {};
      if (isProviderOnlyStaff(me)) {
        const target = await getUserById(req.params.id);
        if (!target) return res.status(404).json({ error: "User not found." });
        const nextRole = Object.prototype.hasOwnProperty.call(req.body || {}, "role")
          ? String(req.body.role || "").trim().toLowerCase()
          : String(target.role || "").trim().toLowerCase();
        if (String(target.role || "").toLowerCase() !== "provider" || nextRole !== "provider") {
          return res.status(403).json({ error: "Forbidden." });
        }
      }
      const updated = await updateUser(req.params.id, req.body || {});
      if (!updated) return res.status(404).json({ error: "User not found." });
      return res.json(updated);
    });
  } catch (error) {
    return next(error);
  }
});

usersRouter.delete("/:id", async (req, res, next) => {
  try {
    await requireUsersRouteAccess(req, res, async () => {
      const me = req.me || {};
      if (isProviderOnlyStaff(me)) {
        const target = await getUserById(req.params.id);
        if (!target) return res.status(404).json({ error: "User not found." });
        if (String(target.role || "").toLowerCase() !== "provider") {
          return res.status(403).json({ error: "Forbidden." });
        }
      }
      const ok = await deleteUser(req.params.id);
      if (!ok) return res.status(404).json({ error: "User not found." });
      return res.status(204).send();
    });
  } catch (error) {
    return next(error);
  }
});
