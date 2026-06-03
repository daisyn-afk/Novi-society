import {
  buildCourseStyleEmailHtml,
  sendResendHtmlEmail,
} from "../emails/courseStyleEmail.js";
import {
  insertAppNotification,
  resolveNotificationRecipient,
} from "../certificationNotifications.js";
import { resolveActiveMdForProvider } from "../compliance-logs/automationHelpers.js";
import { query } from "../db.js";

const appBaseUrl = String(process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function providerPracticeUrl() {
  return `${appBaseUrl}/ProviderPractice`;
}

function mdTreatmentRecordsUrl() {
  return `${appBaseUrl}/MDTreatmentRecords`;
}

function recordServiceLabel(record) {
  return String(record?.service || "treatment").trim();
}

function recordPatientLabel(record) {
  return String(record?.patient_name || record?.patient_email || "patient").trim();
}

function buildCtaBodyHtml(message, ctaLabel, ctaUrl) {
  const safeUrl = escapeHtml(ctaUrl);
  return `
          <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">${message}</p>
          <p style="margin:0 0 32px">
            <a href="${safeUrl}" style="display:inline-block;background:#2D6B7F;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;font-size:14px">
              ${escapeHtml(ctaLabel)}
            </a>
          </p>`;
}

async function sendCourseStyleEmail({ to, subject, greetingName, bodyHtml }) {
  const recipient = String(to || "").trim();
  if (!recipient) return { ok: false, error: "missing_recipient" };
  const html = buildCourseStyleEmailHtml({ greetingName, bodyHtml, includeSignoff: true });
  return sendResendHtmlEmail({ to: recipient, subject, html });
}

async function resolveMdRecipient(mdAuthUserId) {
  const id = String(mdAuthUserId || "").trim();
  if (!id) return { userId: null, userEmail: null, greetingName: "Doctor" };
  const { rows } = await query(
    `select auth_user_id::text as auth_user_id, email, full_name, first_name
       from public.users
      where auth_user_id::text = $1 or id::text = $1
      limit 1`,
    [id]
  );
  const row = rows?.[0];
  const greetingName =
    String(row?.first_name || row?.full_name || "Doctor").trim() || "Doctor";
  return {
    userId: String(row?.auth_user_id || id),
    userEmail: String(row?.email || "").trim().toLowerCase() || null,
    greetingName,
  };
}

/**
 * In-app notification + course-style email when MD reviews a provider's treatment record.
 */
export async function notifyProviderOfTreatmentRecordReview(record) {
  const status = String(record?.status || "").trim();
  const service = recordServiceLabel(record);
  const patient = recordPatientLabel(record);
  const notes = String(record?.md_review_notes || "").trim();
  const notesSuffix = notes ? ` Notes: ${notes}` : "";

  const messages = {
    approved: `Your treatment record for ${service} (${patient}) has been approved by your MD.`,
    flagged: `Your treatment record for ${service} (${patient}) has been flagged by your MD.${notesSuffix}`,
    changes_requested: `Your MD has requested changes to your treatment record for ${service} (${patient}).${notesSuffix}`,
  };
  const subjects = {
    approved: "Your treatment record was approved",
    flagged: "Your treatment record was flagged",
    changes_requested: "Changes requested on your treatment record",
  };
  const types = {
    approved: "treatment_record_approved",
    flagged: "treatment_record_flagged",
    changes_requested: "treatment_record_changes_requested",
  };

  const message = messages[status];
  const type = types[status];
  if (!message || !type || !record?.provider_id) return;

  const recipient = await resolveNotificationRecipient({
    providerId: record.provider_id,
    providerEmail: record.provider_email,
  });

  await insertAppNotification({
    user_id: recipient.userId || record.provider_id,
    user_email: recipient.userEmail || record.provider_email || null,
    type,
    message,
    link_page: "ProviderPractice",
  });

  const emailTo = recipient.userEmail || String(record.provider_email || "").trim().toLowerCase();
  if (!emailTo) return;

  const greetingName =
    String(record.provider_name || recipient.userEmail || "there").split(" ")[0] || "there";
  const bodyHtml = buildCtaBodyHtml(
    escapeHtml(message),
    "Open Practice Hub",
    providerPracticeUrl()
  );

  await sendCourseStyleEmail({
    to: emailTo,
    subject: subjects[status] || "Treatment record update",
    greetingName,
    bodyHtml,
  }).catch(() => {});
}

/**
 * In-app notification + course-style email when a provider resubmits a flagged/changes-requested record.
 */
export async function notifyMdOfTreatmentRecordResubmit(record) {
  const service = recordServiceLabel(record);
  const patient = recordPatientLabel(record);
  const providerName = String(record?.provider_name || record?.provider_email || "A provider").trim();
  const message = `${providerName} resubmitted a treatment record for ${service} (${patient}) for your review.`;

  const mdId = await resolveActiveMdForProvider(record.provider_id);
  if (!mdId) return;

  const md = await resolveMdRecipient(mdId);

  await insertAppNotification({
    user_id: md.userId || mdId,
    user_email: md.userEmail,
    type: "treatment_record_resubmitted",
    message,
    link_page: "MDTreatmentRecords",
  });

  if (!md.userEmail) return;

  const bodyHtml = buildCtaBodyHtml(
    escapeHtml(message),
    "Review Treatment Records",
    mdTreatmentRecordsUrl()
  );

  await sendCourseStyleEmail({
    to: md.userEmail,
    subject: "Treatment record resubmitted for your review",
    greetingName: md.greetingName,
    bodyHtml,
  }).catch(() => {});
}
