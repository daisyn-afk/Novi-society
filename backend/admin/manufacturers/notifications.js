import { pool } from "../db.js";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail =
  process.env.RESEND_FROM_EMAIL || "NOVI Society <support@novisociety.com>";
const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
const noviEmailLogoUrl =
  process.env.NOVI_EMAIL_LOGO_URL || `${appBaseUrl}/novi-email-logo.png`;

let notificationTablePromise = null;
let notificationColumnsByTablePromise = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function getNotificationTableName() {
  if (!notificationTablePromise) {
    notificationTablePromise = pool
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
  return notificationTablePromise;
}

async function getNotificationTableColumnsByName() {
  if (!notificationColumnsByTablePromise) {
    notificationColumnsByTablePromise = (async () => {
      const tableName = await getNotificationTableName();
      if (!tableName) return { tableName: null, columns: new Set() };
      const result = await pool.query(
        `select column_name
         from information_schema.columns
         where table_schema = 'public' and table_name = $1`,
        [tableName]
      );
      return {
        tableName,
        columns: new Set(
          (result.rows || []).map((row) =>
            String(row.column_name || "").toLowerCase()
          )
        ),
      };
    })().catch(() => ({ tableName: null, columns: new Set() }));
  }
  return notificationColumnsByTablePromise;
}

async function listAdminRecipients() {
  try {
    const { rows } = await pool.query(
      `select auth_user_id, email, full_name, first_name
       from public.users
       where lower(coalesce(role, '')) in ('admin', 'super_admin', 'owner')
         and nullif(trim(email), '') is not null`
    );
    return rows || [];
  } catch {
    return [];
  }
}

async function insertNotificationRow({
  userId,
  userEmail,
  type,
  message,
  linkPage,
}) {
  const { tableName, columns } = await getNotificationTableColumnsByName();
  if (!tableName || columns.size === 0) return;

  const valuesByColumn = {
    user_id: userId,
    user_email: userEmail,
    type,
    message,
    link_page: linkPage,
  };
  const insertColumns = Object.keys(valuesByColumn).filter((c) => columns.has(c));
  if (insertColumns.length === 0) return;

  const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(", ");
  const params = insertColumns.map((c) => valuesByColumn[c]);

  await pool
    .query(
      `insert into public.${tableName} (${insertColumns.join(", ")})
       values (${placeholders})`,
      params
    )
    .catch(() => {});
}

async function sendResendEmail({ to, subject, html }) {
  if (!resendApiKey) return false;
  const recipient = String(to || "").trim();
  if (!recipient) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [recipient],
        subject,
        html,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.error(
        "[manufacturer-notifications] email send failed:",
        response.status,
        body
      );
      return false;
    }
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[manufacturer-notifications] email request failed:", error);
    return false;
  }
}

function buildSummaryBullets({ application, manufacturer }) {
  const lines = [
    `Supplier: ${manufacturer?.name || application?.manufacturer_name || "Unknown"}`,
    `Provider: ${application?.provider_name || application?.provider_email || "Unknown"}`,
    application?.provider_email ? `Provider email: ${application.provider_email}` : null,
    application?.practice_name ? `Practice: ${application.practice_name}` : null,
    application?.license_type || application?.license_number
      ? `License: ${[application.license_type, application.license_number, application.license_state].filter(Boolean).join(" / ")}`
      : null,
    application?.supervising_physician_name
      ? `Supervising MD: ${application.supervising_physician_name}${application.supervising_physician_email ? ` (${application.supervising_physician_email})` : ""}`
      : null,
  ].filter(Boolean);

  const additional = application?.additional_fields || {};
  for (const [key, value] of Object.entries(additional)) {
    if (value === null || value === undefined || value === "") continue;
    lines.push(`${key}: ${value}`);
  }
  return lines;
}

function buildEmailHtml({ greetingName, title, intro, summaryLines, ctaLabel, ctaUrl }) {
  const safeGreeting = escapeHtml(greetingName || "Hi there");
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const bullets = summaryLines
    .map((line) => `<li style="margin:0 0 8px">${escapeHtml(line)}</li>`)
    .join("");
  const ctaBlock = ctaUrl
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#1e2535;color:#C8E63C;padding:12px 22px;border-radius:10px;font-weight:700;text-decoration:none">${escapeHtml(ctaLabel || "Open NOVI")}</a></p>`
    : "";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'DM Sans',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:36px 40px;text-align:center;border-radius:16px 16px 0 0">
          <img src="${escapeHtml(noviEmailLogoUrl)}" alt="NOVI Society" style="width:160px;height:auto" />
        </td></tr>
        <tr><td style="background:#fff;padding:40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 18px;font-size:16px;color:#374151">${safeGreeting},</p>
          <p style="margin:0 0 14px;font-size:18px;color:#1e2535;font-weight:700">${safeTitle}</p>
          <p style="margin:0 0 18px;font-size:15px;color:#374151;line-height:1.6">${safeIntro}</p>
          <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.7">${bullets}</ul>
          ${ctaBlock}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function notifyAdminsOfManufacturerApplication({
  application,
  manufacturer,
}) {
  const admins = await listAdminRecipients();
  if (!admins.length) return;

  const summary = buildSummaryBullets({ application, manufacturer });
  const subject = `New supplier application: ${manufacturer?.name || "Unknown"}`;
  const adminCtaUrl = `${appBaseUrl}/AdminManufacturers`;

  for (const admin of admins) {
    const adminUserId = String(admin?.auth_user_id || "").trim() || null;
    const adminEmail = String(admin?.email || "").trim().toLowerCase() || null;
    const greetingName = admin?.first_name || admin?.full_name || "Admin";

    await insertNotificationRow({
      userId: adminUserId,
      userEmail: adminEmail,
      type: "manufacturer_application_submitted",
      message: `${application?.provider_name || application?.provider_email || "A provider"} applied to ${manufacturer?.name || application?.manufacturer_name || "a supplier"}.`,
      linkPage: `AdminManufacturers?focus_application=${encodeURIComponent(application?.id || "")}`,
    });

    if (!adminEmail) continue;
    await sendResendEmail({
      to: adminEmail,
      subject,
      html: buildEmailHtml({
        greetingName: `Hi ${greetingName}`,
        title: subject,
        intro: "A NOVI provider just applied to one of your suppliers. Full details are below — open the admin portal to manage the application.",
        summaryLines: summary,
        ctaLabel: "Open admin portal",
        ctaUrl: adminCtaUrl,
      }),
    });
  }
}

export async function notifyRepOfManufacturerApplication({
  application,
  manufacturer,
}) {
  const repEmail = String(manufacturer?.account_rep_email || "").trim();
  if (!repEmail) return;

  const summary = buildSummaryBullets({ application, manufacturer });
  const subject = `New NOVI provider application for ${manufacturer?.name || "your account"}`;
  const greetingName = manufacturer?.account_rep_name
    ? `Hi ${manufacturer.account_rep_name}`
    : "Hi there";

  await sendResendEmail({
    to: repEmail,
    subject,
    html: buildEmailHtml({
      greetingName,
      title: subject,
      intro: `A verified NOVI provider has applied to open an account with ${manufacturer?.name || "your brand"}. Their credentials, license, and practice details are below — reply directly to follow up.`,
      summaryLines: summary,
    }),
  });
}
