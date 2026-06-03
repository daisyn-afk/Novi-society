import {
  buildCourseStyleEmailHtml,
  sendResendHtmlEmail,
} from "../emails/courseStyleEmail.js";
import {
  insertAppNotification,
  resolveNotificationRecipient,
} from "../certificationNotifications.js";
import { query } from "../db.js";

export const CREDENTIAL_SUSPENDED_MESSAGES = {
  license:
    "Your license is suspended. Please review and re-activate. Charges for MD coverage will still apply.",
  certification:
    "Your certification is suspended. Please review and re-activate. Charges for MD coverage will still apply.",
};

async function hasRecentExactNotification({ userId, userEmail, type, message, withinDays = 30 }) {
  const { rows } = await query(
    `select 1
       from public.notifications n
      where lower(coalesce(n.type, '')) = lower($1)
        and n.message = $4
        and n.created_at > now() - ($5::int || ' days')::interval
        and (
          ($2::text <> '' and n.user_id = $2)
          or ($3::text <> '' and lower(coalesce(n.user_email, '')) = lower($3))
        )
      limit 1`,
    [type, String(userId || ""), String(userEmail || ""), message, withinDays]
  );
  return Boolean(rows[0]);
}

function buildSuspendedEmailBody(kind) {
  const line =
    kind === "license"
      ? CREDENTIAL_SUSPENDED_MESSAGES.license
      : CREDENTIAL_SUSPENDED_MESSAGES.certification;
  const ctaUrl = `${String(process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/+$/, "")}/login?next=${encodeURIComponent("/ProviderCredentialsCoverage")}`;
  return `
          <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">${line}</p>
          <p style="margin:0 0 32px">
            <a href="${ctaUrl}" style="display:inline-block;background:#2D6B7F;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;font-size:14px">
              Review Credentials &amp; Coverage
            </a>
          </p>`;
}

/**
 * In-app + course-style email when license or certification expiry suspends MD access.
 */
export async function notifyProviderCredentialSuspended({
  providerId,
  providerEmail,
  kind,
  providerFirstName = null,
}) {
  const message =
    kind === "license"
      ? CREDENTIAL_SUSPENDED_MESSAGES.license
      : CREDENTIAL_SUSPENDED_MESSAGES.certification;
  const notificationType = kind === "license" ? "license_suspended" : "certification_suspended";

  const recipient = await resolveNotificationRecipient({ providerId, providerEmail });
  if (
    await hasRecentExactNotification({
      userId: recipient.userId,
      userEmail: recipient.userEmail,
      type: notificationType,
      message,
    })
  ) {
    return { sent: false, skipped: true };
  }

  await insertAppNotification({
    user_id: recipient.userId,
    user_email: recipient.userEmail || providerEmail,
    type: notificationType,
    message,
    link_page: "ProviderCredentialsCoverage",
  });

  const name =
    String(providerFirstName || "")
      .trim()
      .split(/\s+/)[0] ||
    (String(providerEmail || "").includes("@") ? providerEmail.split("@")[0] : "Provider");

  const html = buildCourseStyleEmailHtml({
    greetingName: name,
    bodyHtml: buildSuspendedEmailBody(kind),
    includeSignoff: true,
  });

  await sendResendHtmlEmail({
    to: recipient.userEmail || providerEmail,
    subject:
      kind === "license"
        ? "Your license is suspended — action required"
        : "Your certification is suspended — action required",
    html,
  });

  return { sent: true, skipped: false };
}
