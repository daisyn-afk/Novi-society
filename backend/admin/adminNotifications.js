/**
 * Shared admin submission notification helpers.
 *
 * Used by licenses/routes.js, certifications/routes.js, and
 * provider-onboarding/service.js so that every provider submission
 * path triggers the same admin alert regardless of which route
 * created the underlying record.
 */

import { pool } from "./db.js";
import { sendEmailFromTemplate } from "./emails/renderTemplate.js";

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

    await sendEmailFromTemplate("admin_license_submission", {
      to: adminEmail,
      first_name: admin?.first_name || admin?.full_name || "Admin",
      summary_lines: [
        `Provider: ${providerName || "Unknown Provider"}`,
        `Email: ${providerEmail || "Not provided"}`,
        `License: ${licenseType || "N/A"}${licenseNumber ? ` (${licenseNumber})` : ""}`,
      ],
    });
  }
}

// ---------------------------------------------------------------------------
// Public: notify admins of certification submission
// ---------------------------------------------------------------------------

/**
 * Provider requested MD coverage cancel — in-app + email. Does not call Stripe.
 */
export async function notifyAdminsOfProviderMdCancellation({
  providerName,
  providerEmail,
  serviceTypeName,
  mdSubscriptionId,
  stripeSubscriptionId,
  reason,
  notes,
}) {
  const admins = await listAdminRecipients();
  if (!admins.length) return;

  const stripeLabel = String(stripeSubscriptionId || "").trim() || "(none on file)";
  const summaryLines = [
    `Provider: ${providerName || providerEmail || "Unknown"}`,
    `Email: ${providerEmail || "Not provided"}`,
    `Service: ${serviceTypeName || "N/A"}`,
    `Reason: ${reason || "Not provided"}`,
    notes ? `Notes: ${notes}` : null,
    `NOVI subscription id: ${mdSubscriptionId || "N/A"}`,
    `Stripe subscription id: ${stripeLabel}`,
    "Action required: cancel or deactivate this subscription in the Stripe dashboard if billing should stop.",
    "NOVI marked coverage as cancelled in the database only — Stripe was not modified by the app.",
  ].filter(Boolean);

  for (const admin of admins) {
    const adminUserId = String(admin?.auth_user_id || "").trim() || null;
    const adminEmail = String(admin?.email || "").trim().toLowerCase() || null;
    if (!adminEmail) continue;

    await insertAdminNotification({
      adminUserId,
      adminEmail,
      type: "md_subscription_cancel_requested",
      message: `${providerName || providerEmail || "A provider"} requested cancellation of MD coverage for ${serviceTypeName || "a service"}. Deactivate in Stripe manually.`,
      linkPage: "AdminLicenses",
    });

    await sendEmailFromTemplate("admin_md_coverage_cancellation", {
      to: adminEmail,
      first_name: admin?.first_name || admin?.full_name || "Admin",
      summary_lines: summaryLines,
    });
  }
}

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

    await sendEmailFromTemplate("admin_certification_submission", {
      to: adminEmail,
      first_name: admin?.first_name || admin?.full_name || "Admin",
      summary_lines: [
        `Provider: ${providerName || "Unknown Provider"}`,
        `Email: ${providerEmail || "Not provided"}`,
        `Certification: ${certificationName || "N/A"}`,
        `Service: ${serviceTypeName || "N/A"}`,
      ],
    });
  }
}
