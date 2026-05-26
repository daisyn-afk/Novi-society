const appBaseUrl = String(process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");
const noviEmailLogoUrl = process.env.NOVI_EMAIL_LOGO_URL || `${appBaseUrl}/novi-email-logo.png`;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * NOVI course-confirmation email shell (gradient header + white body card).
 */
export function buildCourseStyleEmailHtml({ greetingName, bodyHtml, includeSignoff = true }) {
  const safeName = escapeHtml(greetingName || "there");
  const logoMarkup = noviEmailLogoUrl
    ? `<img src="${escapeHtml(noviEmailLogoUrl)}" alt="NOVI Society" style="width:160px;height:auto" />`
    : `<div style="font-size:28px;font-weight:700;letter-spacing:0.04em;color:#ffffff">NOVI SOCIETY</div>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'DM Sans',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:36px 40px;text-align:center;border-radius:16px 16px 0 0">
          ${logoMarkup}
        </td></tr>
        <tr><td style="background:#fff;padding:48px 40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Hi ${safeName},</p>
          ${bodyHtml}
          ${includeSignoff ? `
          <div style="border-top:1px solid #e5e7eb;padding-top:28px;margin-top:8px">
            <p style="margin:0 0 4px;font-size:15px;color:#374151">We look forward to seeing you soon.</p>
            <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:17px;color:#1e2535;font-style:italic">Welcome to NOVI.</p>
            <p style="margin:0 0 20px;font-size:14px;color:#6b7280;font-style:italic">A New Way to Be Seen.</p>
            <p style="margin:0;font-size:15px;color:#374151">Best,<br><strong>The NOVI Society Team</strong></p>
          </div>` : ""}
        </td></tr>
        <tr><td style="padding:24px 40px;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">© ${new Date().getFullYear()} NOVI Society LLC · 8109 Meadow Valley Dr, McKinney, TX 75071</p>
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af"><a href="mailto:support@novisociety.com" style="color:#9ca3af">support@novisociety.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Returns the email subject for an account password-setup email.
 * Providers keep their role-specific subject; all other roles get a clean,
 * role-labelled variant so recipients are never confused by "provider" copy.
 *
 * @param {string} [role] - The user's role (e.g. "provider", "staff", "admin", "medical_director", "patient")
 * @returns {string}
 */
export function getPasswordSetupSubject(role) {
  const normalized = String(role || "").trim().toLowerCase();
  const ROLE_LABELS = {
    provider: "provider password",
    staff: "staff account password",
    admin: "admin account password",
    medical_director: "medical director account password",
  };
  const label = ROLE_LABELS[normalized] ?? "account password";
  return `Set your NOVI Society ${label}`;
}

/**
 * Legacy constant kept for flows that intentionally target providers
 * (migrated-users path, checkout path). New callers should use
 * getPasswordSetupSubject(role) instead.
 */
export const PASSWORD_RESET_EMAIL_SUBJECT = getPasswordSetupSubject("provider");

/**
 * Builds the password-setup email HTML.
 *
 * @param {object} params
 * @param {string} params.greetingName
 * @param {string} params.resetLink
 * @param {string} [params.role] - When omitted or unknown, falls back to generic account copy.
 */
export function buildPasswordResetEmailHtml({ greetingName, resetLink, role }) {
  const safeLink = escapeHtml(resetLink);
  const isProvider = String(role || "").trim().toLowerCase() === "provider";
  const introText = isProvider
    ? "Your NOVI Society provider account is ready. Use the secure link below to create your password and access your provider dashboard."
    : "Your NOVI Society account is ready. Use the secure link below to create your password and sign in.";
  const bodyHtml = `
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">${introText}</p>
          <div style="background:#f9f8f6;border-radius:12px;padding:24px;margin-bottom:32px;border:1px solid rgba(0,0,0,0.07)">
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2D6B7F">Password reset</p>
            <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6">This link can be used only once. After you set your password, sign in at the NOVI login page with your email and the password you chose.</p>
            <p style="margin:0">
              <a href="${safeLink}" style="display:inline-block;background:#2D6B7F;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">
                Reset your password
              </a>
            </p>
          </div>`;
  return buildCourseStyleEmailHtml({ greetingName, bodyHtml, includeSignoff: false });
}

export async function sendResendHtmlEmail({ to, subject, html }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL || "NOVI Society <support@novisociety.com>";
  const fallbackFrom = String(process.env.RESEND_FALLBACK_FROM_EMAIL || "").trim();

  if (!to) return { ok: false, error: "missing_recipient" };
  if (!resendApiKey) return { ok: false, error: "missing_resend_key" };

  const sendWithFrom = async (fromAddress) => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: fromAddress, to: [to], subject, html })
  });

  let res = await sendWithFrom(resendFromEmail);
  if (!res.ok && fallbackFrom && fallbackFrom !== resendFromEmail) {
    res = await sendWithFrom(fallbackFrom);
  }
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    return { ok: false, error: bodyText || `resend_${res.status}` };
  }
  return { ok: true };
}
