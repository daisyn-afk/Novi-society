import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  updateUser
} from "./repository.js";
import { markUserSetupEmailSent } from "./passwordSetup.js";
import {
  buildPasswordResetEmailHtml,
  PASSWORD_RESET_EMAIL_SUBJECT,
  sendResendHtmlEmail
} from "../emails/courseStyleEmail.js";
import { resolveSetPasswordUrl } from "../lib/frontendBaseUrl.js";

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
async function sendAdminUserSetupEmail(createdUser, req) {
  const { auth_user_id: authUserId, email, first_name: firstName, last_name: lastName } = createdUser;
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
    for (const type of ["invite", "recovery"]) {
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
    const html = buildPasswordResetEmailHtml({ greetingName, resetLink: link });
    const result = await sendResendHtmlEmail({
      to: email,
      subject: PASSWORD_RESET_EMAIL_SUBJECT,
      html
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

usersRouter.get("/", async (req, res, next) => {
  try {
    const result = await listUsers({
      page: req.query.page,
      pageSize: req.query.page_size ?? req.query.pageSize,
      q: req.query.q ?? req.query.search,
      role: req.query.role,
      isActive: req.query.is_active ?? req.query.isActive
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/:id", async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json(user);
  } catch (error) {
    return next(error);
  }
});

usersRouter.post("/", async (req, res, next) => {
  try {
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
    res.status(201).json({ ...created, invite_email_sent: Boolean(emailResult?.sent) });
  } catch (error) {
    next(error);
  }
});

usersRouter.put("/:id", async (req, res, next) => {
  try {
    const updated = await updateUser(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: "User not found." });
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

usersRouter.delete("/:id", async (req, res, next) => {
  try {
    const ok = await deleteUser(req.params.id);
    if (!ok) return res.status(404).json({ error: "User not found." });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});
