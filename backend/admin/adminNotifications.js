/**
 * Shared admin submission notification helpers.
 *
 * Used by licenses/routes.js, certifications/routes.js, and
 * provider-onboarding/service.js so that every provider submission
 * path triggers the same admin alert regardless of which route
 * created the underlying record.
 */

import { pool } from "./db.js";

const resendApiKey = process.env.RESEND_API_KEY || "";
const resendFromEmail = process.env.RESEND_FROM_EMAIL || "NOVI Society <support@novisociety.com>";
const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
const noviEmailLogoUrl = process.env.NOVI_EMAIL_LOGO_URL || `${appBaseUrl}/novi-email-logo.png`;

// ---------------------------------------------------------------------------
// Notification table introspection (cached per process)
// ---------------------------------------------------------------------------

let _notificationTablePromise = null;
let _notificationColumnsByTablePromise = null;

async function getNotificationTableName() {
  if (!_notificationTablePromise) {
    _notificationTablePromise = pool
      .query(
        `select table_name
         from information_schema.tables
         where table_schema = 'public'
           and table_name in ('notification', 'notifications')
         order by case when table_name = 'notification' then 0 else 1 end
         limit 1`
      )
      .then((r) => r.rows?.[0]?.table_name || null)
      .catch(() => null);
  }
  return _notificationTablePromise;
}

async function getNotificationTableColumnsByName() {
  if (!_notificationColumnsByTablePromise) {
    _notificationColumnsByTablePromise = (async () => {
      const tableName = await getNotificationTableName();
      if (!tableName) return { tableName: null, columns: new Set() };
      const result = await pool.query(
        `select column_name
         from information_schema.columns
         where table_schema = 'public'
           and table_name = $1`,
        [tableName]
      );
      return {
        tableName,
        columns: new Set(
          (result.rows || []).map((row) => String(row.column_name || "").toLowerCase())
        )
      };
    })().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[adminNotifications] failed to introspect notification table:", err?.message);
      return { tableName: null, columns: new Set() };
    });
  }
  return _notificationColumnsByTablePromise;
}

// ---------------------------------------------------------------------------
// Admin recipient resolution
// ---------------------------------------------------------------------------

async function listAdminRecipients() {
  try {
    const { rows } = await pool.query(
      `select auth_user_id, email, full_name, first_name
       from public.users
       where lower(coalesce(role, '')) in ('admin', 'super_admin', 'owner')
         and nullif(trim(email), '') is not null`
    );
    if (!rows?.length) {
      // eslint-disable-next-line no-console
      console.warn("[adminNotifications] no admin recipients found in public.users");
    }
    return rows || [];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[adminNotifications] listAdminRecipients query failed:", err?.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Email HTML builder
// ---------------------------------------------------------------------------

function escapeHtml(rawValue) {
  return String(rawValue ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildAdminSubmissionEmailHtml({ adminName, title, summaryLines = [] }) {
  const safeName = escapeHtml(adminName || "Admin");
  const safeTitle = escapeHtml(title || "New provider submission");
  const lines = summaryLines
    .map((line) => `<li style="margin:0 0 8px">${escapeHtml(line)}</li>`)
    .join("");
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'DM Sans',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:36px 40px;text-align:center;border-radius:16px 16px 0 0">
          <img src="${noviEmailLogoUrl}" alt="NOVI Society" style="width:160px;height:auto" />
        </td></tr>
        <tr><td style="background:#fff;padding:40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 18px;font-size:16px;color:#374151">Hi ${safeName},</p>
          <p style="margin:0 0 16px;font-size:16px;color:#374151"><strong>${safeTitle}</strong></p>
          <ul style="margin:0 0 18px;padding-left:20px;color:#374151;font-size:14px;line-height:1.7">${lines}</ul>
          <p style="margin:0;font-size:14px;color:#374151">Please review it in the admin portal.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Helpers shared by both notify functions
// ---------------------------------------------------------------------------

async function insertAdminNotification({ adminUserId, adminEmail, type, message, linkPage }) {
  const { tableName, columns } = await getNotificationTableColumnsByName();
  if (!tableName || !columns.size) return;
  const valuesByColumn = {
    user_id: adminUserId,
    user_email: adminEmail,
    type,
    message,
    link_page: linkPage
  };
  const insertColumns = Object.keys(valuesByColumn).filter((col) => columns.has(col));
  if (!insertColumns.length) return;
  const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(", ");
  const params = insertColumns.map((col) => valuesByColumn[col]);
  await pool
    .query(
      `insert into public.${tableName} (${insertColumns.join(", ")}) values (${placeholders})`,
      params
    )
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(
        `[adminNotifications] in-app notification insert failed (type=${type}):`,
        err?.message
      );
    });
}

async function sendAdminEmail({ adminEmail, subject, html }) {
  if (!resendApiKey) {
    // eslint-disable-next-line no-console
    console.warn("[adminNotifications] admin email skipped: RESEND_API_KEY not set");
    return;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from: resendFromEmail, to: [adminEmail], subject, html })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.error(
        `[adminNotifications] Resend rejected email to ${adminEmail}: ${response.status}`,
        body
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[adminNotifications] Resend request failed for ${adminEmail}:`, err?.message);
  }
}

// ---------------------------------------------------------------------------
// Public: notify admins of license submission
// ---------------------------------------------------------------------------

export async function notifyAdminsOfLicenseSubmission({
  providerName,
  providerEmail,
  licenseType,
  licenseNumber,
  licenseId
}) {
  // eslint-disable-next-line no-console
  console.log(
    "[adminNotifications] notifyAdminsOfLicenseSubmission triggered",
    { providerEmail, licenseType, licenseId }
  );
  const admins = await listAdminRecipients();
  if (!admins.length) return;

  for (const admin of admins) {
    const adminUserId = String(admin?.auth_user_id || "").trim() || null;
    const adminEmail = String(admin?.email || "").trim().toLowerCase() || null;
    if (!adminEmail) continue;

    await insertAdminNotification({
      adminUserId,
      adminEmail,
      type: "license_submitted",
      message: `New license submitted by ${providerName || providerEmail || "a provider"} (${licenseType || "license"}).`,
      linkPage: `AdminLicenses?tab=licenses&focus_type=license&focus_id=${encodeURIComponent(
        String(licenseId || "")
      )}`
    });

    await sendAdminEmail({
      adminEmail,
      subject: "New license submission pending review",
      html: buildAdminSubmissionEmailHtml({
        adminName: admin?.first_name || admin?.full_name || "Admin",
        title: "New license submission pending review",
        summaryLines: [
          `Provider: ${providerName || "Unknown Provider"}`,
          `Email: ${providerEmail || "Not provided"}`,
          `License: ${licenseType || "N/A"}${licenseNumber ? ` (${licenseNumber})` : ""}`
        ]
      })
    });
  }
}

// ---------------------------------------------------------------------------
// Public: notify admins of certification submission
// ---------------------------------------------------------------------------

export async function notifyAdminsOfCertificationSubmission({
  providerName,
  providerEmail,
  certificationName,
  serviceTypeName,
  certificationId
}) {
  // eslint-disable-next-line no-console
  console.log(
    "[adminNotifications] notifyAdminsOfCertificationSubmission triggered",
    { providerEmail, certificationName, certificationId }
  );
  const admins = await listAdminRecipients();
  if (!admins.length) return;

  for (const admin of admins) {
    const adminUserId = String(admin?.auth_user_id || "").trim() || null;
    const adminEmail = String(admin?.email || "").trim().toLowerCase() || null;
    if (!adminEmail) continue;

    await insertAdminNotification({
      adminUserId,
      adminEmail,
      type: "cert_submitted",
      message: `New certification submitted by ${providerName || providerEmail || "a provider"} (${certificationName || "certification"}).`,
      linkPage: `AdminLicenses?tab=certifications&focus_type=certification&focus_id=${encodeURIComponent(
        String(certificationId || "")
      )}`
    });

    await sendAdminEmail({
      adminEmail,
      subject: "New certification submission pending review",
      html: buildAdminSubmissionEmailHtml({
        adminName: admin?.first_name || admin?.full_name || "Admin",
        title: "New certification submission pending review",
        summaryLines: [
          `Provider: ${providerName || "Unknown Provider"}`,
          `Email: ${providerEmail || "Not provided"}`,
          `Certification: ${certificationName || "N/A"}`,
          `Service: ${serviceTypeName || "N/A"}`
        ]
      })
    });
  }
}
