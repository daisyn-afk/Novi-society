import { query } from "../db.js";
import {
  buildCourseStyleEmailHtml,
  sendResendHtmlEmail,
} from "../emails/courseStyleEmail.js";
import {
  insertAppNotification,
  resolveNotificationRecipient,
} from "../certificationNotifications.js";

/** Credential holds only — never payment failures (Stripe past_due / cancelled). */
const PAYMENT_BILLING_STATUSES = new Set(["past_due", "unpaid", "cancelled"]);

async function resolveOpenLicenseComplianceLogs(providerId) {
  const { rowCount } = await query(
    `update public.compliance_logs
        set action_required = false,
            action_taken = coalesce(nullif(trim(action_taken), ''), 'License renewed and verified by admin.'),
            resolved_at = now(),
            updated_at = now()
      where provider_id = $1
        and resolved_at is null
        and automated_key like 'license_expired:%'`,
    [String(providerId || "")]
  );
  return rowCount || 0;
}

/**
 * After admin verifies a renewed license.
 * - Does not change billing_status, Stripe IDs, or cancel subscriptions (charges continue).
 * - May set status back to active only for rows suspended for credentials (not payment past_due).
 */
export async function reinstateProviderAfterLicenseVerified({ providerId }) {
  const pid = String(providerId || "").trim();
  if (!pid) {
    return { resolved_logs: 0, access_restored_count: 0 };
  }

  const { rowCount: access_restored_count } = await query(
    `update public.md_subscription
        set status = 'active',
            updated_at = now()
      where provider_id = $1
        and lower(coalesce(status, '')) = 'suspended'
        and lower(coalesce(billing_status, '')) not in ('past_due', 'unpaid', 'cancelled')`,
    [pid]
  );

  const resolved_logs = await resolveOpenLicenseComplianceLogs(pid);
  return { resolved_logs, access_restored_count: access_restored_count || 0 };
}

export function buildLicenseReinstatedEmailBody({ skippedCert = 0 }) {
  const ctaUrl = `${String(process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/+$/, "")}/login?next=${encodeURIComponent("/ProviderCredentialsCoverage")}`;
  const partialNote =
    skippedCert > 0
      ? `<p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6">Some services may still be unavailable until related certifications are renewed.</p>`
      : "";

  return `
          <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">Great news — your renewed professional license has been verified by the NOVI admin team.</p>
          <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">You can receive patients again in the NOVI marketplace. Your MD subscription billing was not interrupted and will continue as scheduled.</p>
          ${partialNote}
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">Open your dashboard to confirm your credentials and availability.</p>
          <p style="margin:0 0 32px">
            <a href="${ctaUrl}" style="display:inline-block;background:#2D6B7F;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;font-size:14px">
              View Credentials &amp; Coverage
            </a>
          </p>`;
}

export async function notifyProviderLicenseReinstated({
  providerId,
  providerEmail,
  providerFirstName,
}) {
  const recipient = await resolveNotificationRecipient({
    providerId,
    providerEmail,
  });
  const name = String(providerFirstName || "Provider").trim().split(/\s+/)[0] || "Provider";

  await insertAppNotification({
    user_id: recipient.userId,
    user_email: recipient.userEmail || providerEmail,
    type: "license_reinstated",
    message:
      "Your renewed license was approved. You can receive patients again. Your MD subscription billing continues unchanged.",
    link_page: "ProviderCredentialsCoverage",
  });

  const html = buildCourseStyleEmailHtml({
    greetingName: name,
    bodyHtml: buildLicenseReinstatedEmailBody({}),
    includeSignoff: true,
  });

  const emailResult = await sendResendHtmlEmail({
    to: recipient.userEmail || providerEmail,
    subject: "Your license is verified — you can receive patients again",
    html,
  });

  return { notified: true, emailSent: emailResult.ok === true };
}
