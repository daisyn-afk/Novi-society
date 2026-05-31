import { query } from "./db.js";
import { sendEmailFromTemplate } from "./emails/renderTemplate.js";

const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";

let notificationColumnsByTablePromise = null;

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

export async function insertAppNotification(valuesByColumn) {
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
    await insertAppNotification({
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
  return insertAppNotification({
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
  const result = await sendEmailFromTemplate("course_certificate_issued", {
    to: providerEmail,
    first_name: resolveProviderFirstName({ providerName, providerEmail }),
    certification_name: certificationName || "your course",
    certificate_number: certificateNumber || "N/A",
    certificate_url: certificateUrl || `${appBaseUrl}/ProviderCredentialsCoverage`,
    details: [
      { label: "Course", value: certificationName || "—" },
      { label: "Certificate #", value: certificateNumber || "N/A" },
    ],
  });
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error("[certifications] course certificate email send failed:", result.error);
    return false;
  }
  return true;
}

async function resolveMedicalDirectorEmail(medicalDirectorId, fallbackEmail) {
  const direct = String(fallbackEmail || "").trim().toLowerCase();
  if (direct) return { email: direct, full_name: null, first_name: null };
  const mdId = String(medicalDirectorId || "").trim();
  if (!mdId) return { email: null, full_name: null, first_name: null };
  try {
    const { rows } = await query(
      `select email, full_name, first_name
       from public.users
       where auth_user_id::text = $1
          or id::text = $1
       limit 1`,
      [mdId]
    );
    return {
      email: String(rows?.[0]?.email || "").trim().toLowerCase() || null,
      full_name: String(rows?.[0]?.full_name || "").trim() || null,
      first_name: String(rows?.[0]?.first_name || "").trim() || null,
    };
  } catch {
    return { email: null, full_name: null, first_name: null };
  }
}

/**
 * In-app notification + email when an MD is auto-assigned to a provider coverage request.
 */
export async function notifyMdOfAutoAssignment({
  medicalDirectorId,
  medicalDirectorEmail,
  medicalDirectorName,
  providerId,
  providerName,
  providerEmail,
  serviceTypeName,
}) {
  const mdId = String(medicalDirectorId || "").trim();
  const resolved = await resolveMedicalDirectorEmail(mdId, medicalDirectorEmail);
  const mdEmail = resolved?.email || String(medicalDirectorEmail || "").trim().toLowerCase() || null;
  const providerLabel = String(providerName || providerEmail || "A provider").trim();
  const serviceLabel = String(serviceTypeName || "a service").trim();
  const mdName = String(medicalDirectorName || resolved?.full_name || "your medical director").trim();
  const msg = `${providerLabel} was assigned to your supervision for ${serviceLabel}. Supervision is active — view them in Provider Supervision.`;

  const notified = await insertAppNotification({
    user_id: mdId || null,
    user_email: mdEmail || null,
    type: "md_relationship_approved",
    message: msg,
    link_page: "MDProviderRelationships",
  });

  const providerIdResolved = String(providerId || "").trim();
  const providerEmailLower = String(providerEmail || "").trim().toLowerCase();
  if (providerIdResolved || providerEmailLower) {
    await insertAppNotification({
      user_id: providerIdResolved || null,
      user_email: providerEmailLower || null,
      type: "md_relationship_approved",
      message: `Dr. ${mdName} is now your supervising medical director for ${serviceLabel}. MD Board coverage is active.`,
      link_page: "ProviderCredentialsCoverage",
    });
  }

  let emailed = false;
  if (mdEmail) {
    const mdFirst =
      resolved?.first_name ||
      String(medicalDirectorName || resolved?.full_name || "")
        .trim()
        .split(/\s+/)[0] ||
      "there";
    const result = await sendEmailFromTemplate("md_auto_assignment", {
      to: mdEmail,
      first_name: `Dr. ${mdFirst}`,
      provider_label: providerLabel,
      service_name: serviceLabel,
      details: [
        { label: "Provider", value: providerLabel },
        { label: "Service", value: serviceLabel },
      ],
    });
    emailed = result.ok;
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.error("[md-assignment] MD notification email failed:", result.error);
    }
  } else if (!mdEmail) {
    // eslint-disable-next-line no-console
    console.warn("[md-assignment] MD notification email skipped: no email for MD", mdId);
  }

  return { notified, emailed, mdEmail };
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
