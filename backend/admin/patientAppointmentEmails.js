import { buildCourseStyleEmailHtml } from "./emails/courseStyleEmail.js";
import { sendResendHtmlEmail } from "./emails/courseStyleEmail.js";
import { query } from "./db.js";

const appBaseUrl = String(process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtAppointmentDateLocal(dateString) {
  if (!dateString) return "";
  const [year, month, day] = String(dateString).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function fmtAppointmentTimeLabel(timeSlot) {
  if (!timeSlot || typeof timeSlot !== "string") return "—";
  const [hRaw, mRaw] = timeSlot.slice(0, 5).split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return String(timeSlot);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function appointmentDetailRows({ serviceLabel, providerName, appointmentDate, appointmentTime }) {
  const dateStr = fmtAppointmentDateLocal(appointmentDate);
  const timeStr = fmtAppointmentTimeLabel(appointmentTime);
  const rows = [
    ["Service", serviceLabel],
    ["Provider", providerName],
    ["Date", dateStr],
    ["Time", appointmentTime ? timeStr : ""],
  ].filter(([, value]) => value != null && String(value).trim() !== "");

  return rows
    .map(
      ([label, value]) => `
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;width:100px"><strong>${escapeHtml(label)}</strong></td>
            <td style="padding:6px 0;font-size:14px;color:#111827">${escapeHtml(String(value))}</td>
          </tr>`
    )
    .join("");
}

/**
 * Good Faith Exam invite — same shell and layout as course confirmation emails.
 */
export async function sendAppointmentGfeInviteEmail({
  to,
  patientName,
  providerName,
  serviceLabel,
  appointmentDate,
  appointmentTime,
  meetingUrl,
}) {
  const recipient = String(to || "").trim();
  const link = String(meetingUrl || "").trim();
  if (!recipient) {
    const err = new Error("Patient email is required to send the GFE invite.");
    err.statusCode = 400;
    throw err;
  }
  if (!link) {
    const err = new Error("GFE link is missing.");
    err.statusCode = 500;
    throw err;
  }

  const firstName = String(patientName || "there").split(" ")[0];
  const safeUrl = escapeHtml(link);
  const detailsHtml = appointmentDetailRows({
    serviceLabel: serviceLabel || "—",
    providerName: providerName || "—",
    appointmentDate,
    appointmentTime,
  });

  const bodyHtml = `
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Your provider has requested a <strong>Good Faith Exam (GFE)</strong> before your visit — a quick virtual screening with a licensed medical provider.</p>
          <div style="background:#f9f8f6;border-radius:12px;padding:24px;margin-bottom:32px;border:1px solid rgba(0,0,0,0.07)">
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2D6B7F">Appointment Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              ${detailsHtml}
            </table>
          </div>
          <div style="text-align:center;margin:0 0 32px;">
            <a href="${safeUrl}" style="display:inline-block;background:#C8E63C;color:#1a2540;font-weight:700;font-size:15px;padding:14px 32px;border-radius:50px;text-decoration:none;">Complete My GFE</a>
          </div>
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111827">What to Expect</p>
          <ul style="margin:0 0 32px;padding-left:20px;color:#374151;font-size:15px;line-height:1.9">
            <li>Brief video visit with a licensed provider</li>
            <li>Review of your health history</li>
            <li>Medical clearance for your treatment</li>
            <li>Usually about 5–10 minutes</li>
          </ul>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6"><strong>Please complete your GFE before your appointment date.</strong> You may also receive a message from our exam partner with the same link.</p>
          <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6">Questions? Email us at <a href="mailto:hello@novisociety.com" style="color:#2D6B7F;">hello@novisociety.com</a></p>`;

  const html = buildCourseStyleEmailHtml({
    greetingName: firstName,
    bodyHtml,
    includeSignoff: true,
  });

  const serviceSuffix = String(serviceLabel || "your visit").replace(/\s+/g, " ").trim().slice(0, 80);
  const sendResult = await sendResendHtmlEmail({
    to: recipient,
    subject: `Complete Your Good Faith Exam — ${serviceSuffix}`,
    html,
  });

  if (!sendResult.ok) {
    const err = new Error(
      typeof sendResult.error === "string" && sendResult.error
        ? sendResult.error
        : "Failed to send GFE invite email. Check RESEND_API_KEY and sender domain."
    );
    err.statusCode = 500;
    throw err;
  }

  return { sent: true };
}

/**
 * In-app notification for the patient (bell icon).
 */
export async function notifyPatientGfeInvite({
  patientId,
  patientEmail,
  providerName,
  serviceLabel,
}) {
  const pid = String(patientId || "").trim();
  const email = String(patientEmail || "").trim();
  if (!pid && !email) return { sent: false };

  const provider = String(providerName || "Your provider").trim();
  const service = String(serviceLabel || "your appointment").trim();
  const message = `${provider} sent you a Good Faith Exam link for ${service}. Complete it before your visit.`;

  try {
    await query(
      `create table if not exists public.notifications (
         id text primary key default ('notif_' || md5(random()::text || clock_timestamp()::text)),
         user_id text null,
         user_email text null,
         type text null,
         message text not null,
         link_page text null,
         read_at timestamptz null,
         created_at timestamptz not null default now(),
         updated_at timestamptz not null default now()
       )`
    );
    await query(
      `insert into public.notifications (user_id, user_email, type, message, link_page)
       values ($1, $2, 'general', $3, 'PatientAppointments')`,
      [pid || null, email || null, message]
    );
    return { sent: true };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[notifyPatientGfeInvite] failed:", error?.message || error);
    return { sent: false, error: error?.message };
  }
}

/**
 * Appointment confirmed (course-style shell).
 */
export async function sendAppointmentConfirmedPatientEmail({
  to,
  patientName,
  providerName,
  serviceLabel,
  appointmentDate,
  appointmentTime,
}) {
  if (!to) return { skipped: true };
  const firstName = String(patientName || "there").split(" ")[0];
  const detailsHtml = appointmentDetailRows({
    serviceLabel,
    providerName,
    appointmentDate,
    appointmentTime,
  });
  const formattedDate = fmtAppointmentDateLocal(appointmentDate);

  const bodyHtml = `
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Your appointment has been confirmed. Here's a summary:</p>
          <div style="background:#f9f8f6;border-radius:12px;padding:24px;margin-bottom:32px;border:1px solid rgba(0,0,0,0.07)">
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2D6B7F">Appointment Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${detailsHtml}</table>
          </div>
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111827">Next steps</p>
          <ul style="margin:0 0 24px;padding-left:20px;color:#374151;font-size:15px;line-height:1.9">
            <li>Add this visit to your calendar</li>
            <li>If your service requires a GFE, complete it before your appointment</li>
            <li>Contact your provider if you need to reschedule</li>
          </ul>`;

  const html = buildCourseStyleEmailHtml({ greetingName: firstName, bodyHtml });
  const sendResult = await sendResendHtmlEmail({
    to: String(to).trim(),
    subject: `Your appointment is confirmed — ${formattedDate || "NOVI Society"}`,
    html,
  });
  if (!sendResult.ok) {
    const err = new Error(sendResult.error || "Email send failed");
    err.statusCode = 500;
    throw err;
  }
  return { sent: true };
}

/**
 * Appointment cancelled or request declined (patient-facing).
 */
export async function sendAppointmentCancelledPatientEmail({
  to,
  patientName,
  providerName,
  serviceLabel,
  appointmentDate,
  reason,
  wasRequest,
}) {
  if (!to) return { skipped: true };
  const firstName = String(patientName || "there").split(" ")[0];
  const detailsHtml = appointmentDetailRows({
    serviceLabel,
    providerName,
    appointmentDate,
    appointmentTime: null,
  });
  const lead = wasRequest
    ? "Your appointment request was not confirmed at this time."
    : "Your appointment has been cancelled.";
  const reasonBlock =
    reason && String(reason).trim()
      ? `<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;"><strong>Note from the practice:</strong> ${escapeHtml(String(reason).trim())}</p>`
      : "";

  const bodyHtml = `
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">${lead}</p>
          <div style="background:#f9f8f6;border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid rgba(0,0,0,0.07)">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${detailsHtml}</table>
          </div>
          ${reasonBlock}
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.6">You can book another visit anytime from your NOVI patient account.</p>`;

  const html = buildCourseStyleEmailHtml({ greetingName: firstName, bodyHtml, includeSignoff: false });
  const sendResult = await sendResendHtmlEmail({
    to: String(to).trim(),
    subject: wasRequest ? "Your appointment request was declined" : "Your appointment was cancelled",
    html,
  });
  if (!sendResult.ok) {
    const err = new Error(sendResult.error || "Email send failed");
    err.statusCode = 500;
    throw err;
  }
  return { sent: true };
}

/**
 * Patient marked no-show by provider — course-style shell; prompt to rebook.
 */
export async function sendAppointmentNoShowPatientEmail({
  to,
  patientName,
  providerName,
  serviceLabel,
  appointmentDate,
  appointmentTime,
  providerId,
}) {
  if (!to) return { skipped: true };
  const firstName = String(patientName || "there").split(" ")[0];
  const detailsHtml = appointmentDetailRows({
    serviceLabel,
    providerName,
    appointmentDate,
    appointmentTime,
  });
  const formattedDate = fmtAppointmentDateLocal(appointmentDate);
  const pid = String(providerId || "").trim();
  const bookUrl = pid
    ? `${appBaseUrl}/PatientMarketplace?provider=${encodeURIComponent(pid)}`
    : `${appBaseUrl}/PatientMarketplace`;
  const safeBookUrl = escapeHtml(bookUrl);

  const bodyHtml = `
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">We missed you at your scheduled visit. Our records show you <strong>did not attend</strong> this appointment.</p>
          <div style="background:#f9f8f6;border-radius:12px;padding:24px;margin-bottom:32px;border:1px solid rgba(0,0,0,0.07)">
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2D6B7F">Missed Appointment</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${detailsHtml}</table>
          </div>
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111827">What to do next</p>
          <ul style="margin:0 0 32px;padding-left:20px;color:#374151;font-size:15px;line-height:1.9">
            <li>Book a new appointment at a time that works for you</li>
            <li>If your service requires a GFE, complete it before your new visit</li>
            <li>Contact your provider if you had an emergency or need help rescheduling</li>
          </ul>
          <div style="text-align:center;margin:0 0 32px;">
            <a href="${safeBookUrl}" style="display:inline-block;background:#C8E63C;color:#1a2540;font-weight:700;font-size:15px;padding:14px 32px;border-radius:50px;text-decoration:none;">Book Another Appointment</a>
          </div>
          <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6">Questions? Email us at <a href="mailto:hello@novisociety.com" style="color:#2D6B7F;">hello@novisociety.com</a></p>`;

  const html = buildCourseStyleEmailHtml({ greetingName: firstName, bodyHtml });
  const dateSuffix = formattedDate ? ` — ${formattedDate}` : "";
  const sendResult = await sendResendHtmlEmail({
    to: String(to).trim(),
    subject: `We missed you at your appointment${dateSuffix}`,
    html,
  });
  if (!sendResult.ok) {
    const err = new Error(sendResult.error || "Email send failed");
    err.statusCode = 500;
    throw err;
  }
  return { sent: true };
}

/**
 * In-app notification when appointment is marked no-show.
 */
export async function notifyPatientAppointmentNoShow({
  patientId,
  patientEmail,
  providerName,
  serviceLabel,
  appointmentDate,
}) {
  const pid = String(patientId || "").trim();
  const email = String(patientEmail || "").trim();
  if (!pid && !email) return { sent: false };

  const provider = String(providerName || "Your provider").trim();
  const service = String(serviceLabel || "your appointment").trim();
  const when = fmtAppointmentDateLocal(appointmentDate);
  const message = when
    ? `You were marked as absent for ${service} with ${provider} on ${when}. Book a new appointment when you're ready.`
    : `You were marked as absent for ${service} with ${provider}. Book a new appointment when you're ready.`;

  try {
    await query(
      `create table if not exists public.notifications (
         id text primary key default ('notif_' || md5(random()::text || clock_timestamp()::text)),
         user_id text null,
         user_email text null,
         type text null,
         message text not null,
         link_page text null,
         read_at timestamptz null,
         created_at timestamptz not null default now(),
         updated_at timestamptz not null default now()
       )`
    );
    await query(
      `insert into public.notifications (user_id, user_email, type, message, link_page)
       values ($1, $2, 'general', $3, 'PatientMarketplace')`,
      [pid || null, email || null, message]
    );
    return { sent: true };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[notifyPatientAppointmentNoShow] failed:", error?.message || error);
    return { sent: false, error: error?.message };
  }
}

/**
 * GFE completed / approved — course-style shell.
 */
export async function sendAppointmentGfeApprovedPatientEmail({
  to,
  patientName,
  providerName,
  serviceLabel,
  examUrl,
  reviewerName,
}) {
  if (!to) return { skipped: true };
  const firstName = String(patientName || "there").split(" ")[0];
  const detailsHtml = appointmentDetailRows({
    serviceLabel,
    providerName,
    appointmentDate: null,
    appointmentTime: null,
  });
  const link = examUrl ? escapeHtml(examUrl) : "";
  const cta = link
    ? `<div style="text-align:center;margin:0 0 32px;"><a href="${link}" style="display:inline-block;background:#C8E63C;color:#1a2540;font-weight:700;font-size:15px;padding:14px 32px;border-radius:50px;text-decoration:none;">View exam summary</a></div>`
    : "";

  const bodyHtml = `
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Good news — your <strong>Good Faith Exam</strong> for this visit is <strong>approved</strong>. You're cleared to proceed with your provider.</p>
          <div style="background:#f9f8f6;border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid rgba(0,0,0,0.07)">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              ${detailsHtml}
              <tr><td style="padding:6px 0;color:#6b7280;font-size:14px"><strong>Reviewed by</strong></td><td style="padding:6px 0;font-size:14px;color:#111827">${escapeHtml(reviewerName || "Licensed provider")}</td></tr>
            </table>
          </div>
          ${cta}`;

  const html = buildCourseStyleEmailHtml({ greetingName: firstName, bodyHtml });
  const subSuffix = String(serviceLabel || "your visit").replace(/\s+/g, " ").trim().slice(0, 80);
  const sendResult = await sendResendHtmlEmail({
    to: String(to).trim(),
    subject: `Your Good Faith Exam is approved — ${subSuffix}`,
    html,
  });
  if (!sendResult.ok) {
    const err = new Error(sendResult.error || "Email send failed");
    err.statusCode = 500;
    throw err;
  }
  return { sent: true };
}
