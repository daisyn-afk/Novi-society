import { query } from "./db.js";

const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
const noviEmailLogoUrl = process.env.NOVI_EMAIL_LOGO_URL || `${appBaseUrl}/novi-email-logo.png`;
const resendApiKey = process.env.RESEND_API_KEY || "";
const resendFromEmail = process.env.RESEND_FROM_EMAIL || "NOVI Society <support@novisociety.com>";

let notificationColumnsByTablePromise = null;

function escapeHtml(rawValue) {
  return String(rawValue ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveProviderFirstName({ providerName, providerEmail }) {
  const fromName = String(providerName || "").trim();
  if (fromName) return fromName.split(/\s+/)[0];
  const email = String(providerEmail || "").trim();
  if (email.includes("@")) return email.split("@")[0];
  return "Provider";
}

function resolveCertificationDocumentUrl(cert) {
  const directUrl = String(cert?.certificate_url || "").trim();
  if (directUrl && directUrl !== "/N/A" && directUrl.toUpperCase() !== "N/A") return directUrl;
  const fallbackFields = [
    cert?.certification_url,
    cert?.certification_file_url,
    cert?.document_url,
    cert?.file_url,
    cert?.attachment_url,
  ];
  for (const value of fallbackFields) {
    const url = String(value || "").trim();
    if (url && url !== "/N/A" && url.toUpperCase() !== "N/A") return url;
  }
  return null;
}

async function getNotificationTableColumnsByName() {
  if (!notificationColumnsByTablePromise) {
    notificationColumnsByTablePromise = (async () => {
      const tableResult = await query(
        `select table_name
         from information_schema.tables
         where table_schema = 'public'
           and table_name in ('notification', 'notifications')
         order by case when table_name = 'notification' then 0 else 1 end
         limit 1`
      ).catch(() => ({ rows: [] }));
      const tableName = tableResult.rows?.[0]?.table_name || null;
      if (!tableName) return { tableName: null, columns: new Set() };
      const result = await query(
        `select column_name
         from information_schema.columns
         where table_schema = 'public'
           and table_name = $1`,
        [tableName]
      );
      return {
        tableName,
        columns: new Set((result.rows || []).map((row) => String(row.column_name || "").toLowerCase()))
      };
    })().catch(() => ({ tableName: null, columns: new Set() }));
  }
  return notificationColumnsByTablePromise;
}

async function listAdminRecipients() {
  const { rows } = await query(
    `select auth_user_id, email, full_name, first_name
     from public.users
     where lower(coalesce(role, '')) in ('admin', 'super_admin', 'owner')
       and nullif(trim(email), '') is not null`
  );
  return rows || [];
}

async function resolveNotificationRecipient({ providerId, providerEmail }) {
  const id = String(providerId || "").trim();
  const email = String(providerEmail || "").trim().toLowerCase();
  if (!id && !email) return { userId: null, userEmail: null };
  try {
    const { rows } = await query(
      `select auth_user_id, email
       from public.users
       where ($1::text <> '' and (auth_user_id::text = $1 or id::text = $1))
          or ($2::text <> '' and lower(email) = $2)
       order by updated_at desc nulls last
       limit 1`,
      [id, email]
    );
    const row = rows?.[0] || null;
    return {
      userId: String(row?.auth_user_id || id || "").trim() || null,
      userEmail: String(row?.email || email || "").trim().toLowerCase() || null
    };
  } catch {
    return {
      userId: id || null,
      userEmail: email || null
    };
  }
}

async function insertNotification(valuesByColumn) {
  const { tableName, columns } = await getNotificationTableColumnsByName();
  if (!tableName || !columns || columns.size === 0) return false;
  const insertColumns = Object.keys(valuesByColumn).filter((col) => columns.has(col));
  if (insertColumns.length === 0) return false;
  const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(", ");
  const params = insertColumns.map((col) => valuesByColumn[col]);
  try {
    await query(
      `insert into public.${tableName} (${insertColumns.join(", ")})
       values (${placeholders})`,
      params
    );
    return true;
  } catch {
    return false;
  }
}

function buildCourseCertificateIssuedEmailHtml({
  providerFirstName,
  certificationName,
  certificateNumber,
  certificateUrl
}) {
  const safeName = escapeHtml(providerFirstName || "Provider");
  const safeCertificationName = escapeHtml(certificationName || "course certification");
  const safeCertificateNumber = escapeHtml(certificateNumber || "N/A");
  const safeCertificateUrl = escapeHtml(certificateUrl);

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
        <tr><td style="background:#fff;padding:48px 40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Hi ${safeName},</p>
          <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">Welcome to NOVI Society - we're excited to have you with us.</p>
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Your certificate for <strong>${safeCertificationName}</strong> has been successfully issued.</p>
          <div style="background:#f9f8f6;border-radius:12px;padding:24px;margin-bottom:32px;border:1px solid rgba(0,0,0,0.07)">
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2D6B7F">Certificate Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:140px"><strong>Course</strong></td><td style="padding:6px 0;font-size:14px;color:#111827">${safeCertificationName}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;font-size:14px"><strong>Certificate #</strong></td><td style="padding:6px 0;font-size:14px;color:#111827">${safeCertificateNumber}</td></tr>
            </table>
          </div>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">Your certificate is ready to download. Use the button below to open your PDF.</p>
          <p style="margin:0 0 32px">
            <a href="${safeCertificateUrl}" style="display:inline-block;background:#2D6B7F;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;font-size:14px">
              View Certificate
            </a>
          </p>
          <div style="border-top:1px solid #e5e7eb;padding-top:28px;margin-top:8px">
            <p style="margin:0 0 4px;font-size:15px;color:#374151">We look forward to seeing you soon.</p>
            <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:17px;color:#1e2535;font-style:italic">Welcome to NOVI.</p>
            <p style="margin:0 0 20px;font-size:14px;color:#6b7280;font-style:italic">A New Way to Be Seen.</p>
            <p style="margin:0;font-size:15px;color:#374151">Best,<br><strong>The NOVI Society Team</strong></p>
          </div>
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

export async function notifyAdminsOfPendingCourseCertIssuance({
  enrollmentId,
  providerName,
  providerEmail,
  courseTitle,
  courseId
}) {
  const admins = await listAdminRecipients();
  if (!admins.length) return;
  const enrollmentParam = encodeURIComponent(String(enrollmentId || ""));
  const courseParam = encodeURIComponent(String(courseId || ""));
  const linkPage = `AdminLicenses?tab=certifications&focus_type=awaiting_issue&enrollment_id=${enrollmentParam}&course_id=${courseParam}`;
  const message = `${providerName || providerEmail || "A provider"} completed ${courseTitle || "a course"} and is ready for certificate issuance.`;
  for (const admin of admins) {
    await insertNotification({
      user_id: String(admin?.auth_user_id || "").trim() || null,
      user_email: String(admin?.email || "").trim().toLowerCase() || null,
      type: "cert_issue_pending",
      message,
      link_page: linkPage
    });
  }
}

export async function createCourseCertificateIssuedNotification({
  providerId,
  providerEmail,
  certificationName
}) {
  const recipient = await resolveNotificationRecipient({ providerId, providerEmail });
  return insertNotification({
    user_id: recipient.userId || null,
    user_email: recipient.userEmail || null,
    type: "cert_awarded",
    message: `Your ${certificationName || "course"} certificate has been issued.`,
    link_page: "ProviderCredentialsCoverage"
  });
}

export async function sendCourseCertificateIssuedEmail({
  providerEmail,
  providerName,
  certificationName,
  certificateNumber,
  certificateUrl
}) {
  if (!providerEmail) return false;
  if (!resendApiKey) {
    // eslint-disable-next-line no-console
    console.warn("[certifications] course certificate email skipped: RESEND_API_KEY missing");
    return false;
  }
  const html = buildCourseCertificateIssuedEmailHtml({
    providerFirstName: resolveProviderFirstName({ providerName, providerEmail }),
    certificationName,
    certificateNumber,
    certificateUrl: certificateUrl || `${appBaseUrl}/ProviderCredentialsCoverage`
  });
  try {
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [providerEmail],
        subject: `Your NOVI Society certificate for ${certificationName || "your course"} is ready`,
        html
      })
    });
    if (!result.ok) {
      const bodyText = await result.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.error("[certifications] course certificate email send failed:", result.status, bodyText);
    }
    return result.ok;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[certifications] course certificate email request failed:", error);
    return false;
  }
}

export async function notifyProviderOfCourseCertificateIssuance(cert) {
  const providerEmail = String(
    cert?.provider_email || cert?.provider_email_resolved || cert?.user_email || ""
  ).trim().toLowerCase();
  const providerId = String(cert?.provider_id || cert?.user_id || "").trim() || null;
  const providerName = String(cert?.provider_name || cert?.provider_name_resolved || "").trim() || null;
  const certificationName = String(cert?.certification_name || cert?.cert_name || "course certification").trim();
  const certificateNumber = String(cert?.certificate_number || cert?.cert_number || "").trim();
  const certificateUrl = resolveCertificationDocumentUrl(cert);
  if (!providerEmail) return;
  await createCourseCertificateIssuedNotification({
    providerId,
    providerEmail,
    certificationName
  });
  await sendCourseCertificateIssuedEmail({
    providerEmail,
    providerName,
    certificationName,
    certificateNumber,
    certificateUrl
  });
}
