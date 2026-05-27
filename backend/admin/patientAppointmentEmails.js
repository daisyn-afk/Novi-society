import { withCourseEmailShell } from "./courseEmailShell.js";

const resendApiKey = process.env.RESEND_API_KEY || "";
const resendFromEmail = process.env.RESEND_FROM_EMAIL || "NOVI Society Training <hello@novisociety.com>";

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

async function sendResendEmail({ to, subject, html }) {
  if (!resendApiKey) {
    const err = new Error("RESEND_API_KEY is not configured.");
    err.statusCode = 500;
    throw err;
  }
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [to],
      subject,
      html,
    }),
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) {
    const err = new Error(payload?.message || "Email send failed");
    err.statusCode = 500;
    throw err;
  }
  return payload;
}

function summaryTableRows(rows) {
  return rows
    .filter((r) => r[1] != null && String(r[1]).trim() !== "")
    .map(
      ([label, value]) => `
          <tr>
            <td style="padding:8px 0;color:rgba(30,37,53,0.55);font-size:13px;width:40%;">${escapeHtml(label)}</td>
            <td style="padding:8px 0;color:#1e2535;font-size:13px;font-weight:600;">${escapeHtml(String(value))}</td>
          </tr>`
    )
    .join("");
}

const footerQuestions =
  '<p style="color:rgba(30,37,53,0.5);font-size:12px;margin:0;">Questions? Email us at <a href="mailto:hello@novisociety.com" style="color:#2D6B7F;">hello@novisociety.com</a></p>';

/**
 * Good Faith Exam invite for a marketplace / practice appointment (same shell as course confirmation).
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
  if (!to || !meetingUrl) return { skipped: true };
  const firstName = escapeHtml(String(patientName || "there").split(" ")[0]);
  const safeUrl = escapeHtml(meetingUrl);
  const dateStr = fmtAppointmentDateLocal(appointmentDate);
  const timeStr = fmtAppointmentTimeLabel(appointmentTime);
  const rows = summaryTableRows([
    ["Service", serviceLabel || "—"],
    ["Provider", providerName || "—"],
    ["Visit date", dateStr || "—"],
    ["Visit time", appointmentTime ? timeStr : "—"],
  ]);

  const htmlBody = withCourseEmailShell({
    title: "Complete Your Good Faith Exam",
    contentHtml: `
      <p style="color:#1e2535;font-size:15px;margin:0 0 24px;">Hi <strong>${firstName}</strong>,</p>
      <p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 24px;">Your provider has sent you a <strong>Good Faith Exam (GFE)</strong> — a quick virtual screening with a licensed medical provider before your visit. Please complete it as soon as you can.</p>
      <div style="background:#f9f8f6;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </div>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${safeUrl}" style="display:inline-block;background:#C8E63C;color:#1a2540;font-weight:700;font-size:15px;padding:14px 32px;border-radius:50px;text-decoration:none;">Complete My GFE</a>
      </div>
      <div style="background:rgba(200,230,60,0.1);border:1px solid rgba(200,230,60,0.3);border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#5a7a20;margin:0 0 8px;">What to expect</p>
        <ul style="margin:0;padding-left:18px;color:rgba(30,37,53,0.7);font-size:13px;line-height:1.8;">
          <li>Brief video visit with a licensed provider</li>
          <li>Review of your health history</li>
          <li>Medical clearance for your treatment</li>
          <li>Usually about 5–10 minutes</li>
        </ul>
      </div>
      <p style="color:rgba(30,37,53,0.6);font-size:13px;line-height:1.7;margin:0 0 24px;"><strong>Important:</strong> You may also receive a separate message from our exam partner with the same link. Either way, use the button above when you're ready.</p>
      ${footerQuestions}`,
  });

  const subjectSuffix = String(serviceLabel || "your visit").replace(/\s+/g, " ").trim().slice(0, 80);
  await sendResendEmail({
    to: String(to).trim(),
    subject: `Complete Your Good Faith Exam — ${subjectSuffix}`,
    html: htmlBody,
  });
  return { sent: true };
}

/**
 * Appointment confirmed (same visual format as model/course confirmation).
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
  const name = escapeHtml(String(patientName || "there"));
  const formattedDate = fmtAppointmentDateLocal(appointmentDate);
  const timeLabel = fmtAppointmentTimeLabel(appointmentTime);
  const rows = summaryTableRows([
    ["Service", serviceLabel || "—"],
    ["Provider", providerName || "—"],
    ["Date", formattedDate || "—"],
    ["Time", appointmentTime ? timeLabel : "—"],
  ]);

  const htmlBody = withCourseEmailShell({
    title: "You're Booked!",
    contentHtml: `
      <p style="color:#1e2535;font-size:15px;margin:0 0 24px;">Hi <strong>${name}</strong>,</p>
      <p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 24px;">Your appointment has been confirmed. Here's a summary:</p>
      <div style="background:#f9f8f6;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </div>
      <div style="background:rgba(200,230,60,0.1);border:1px solid rgba(200,230,60,0.3);border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#5a7a20;margin:0 0 8px;">Next steps</p>
        <ul style="margin:0;padding-left:18px;color:rgba(30,37,53,0.7);font-size:13px;line-height:1.8;">
          <li>Add this visit to your calendar</li>
          <li>If your service requires a GFE, complete it before your appointment</li>
          <li>Contact your provider if you need to reschedule</li>
        </ul>
      </div>
      ${footerQuestions}`,
  });

  await sendResendEmail({
    to: String(to).trim(),
    subject: `Your appointment is confirmed — ${formattedDate || "NOVI Society"}`,
    html: htmlBody,
  });
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
  const name = escapeHtml(String(patientName || "there"));
  const formattedDate = fmtAppointmentDateLocal(appointmentDate);
  const rows = summaryTableRows([
    ["Service", serviceLabel || "—"],
    ["Provider", providerName || "—"],
    ["Was scheduled for", formattedDate || "—"],
  ]);
  const headline = wasRequest ? "Update on your request" : "Appointment cancelled";
  const lead = wasRequest
    ? "Your appointment request was not confirmed at this time."
    : "Your appointment has been cancelled.";

  const reasonBlock =
    reason && String(reason).trim()
      ? `<p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 16px;"><strong>Note from the practice:</strong> ${escapeHtml(String(reason).trim())}</p>`
      : "";

  const htmlBody = withCourseEmailShell({
    title: headline,
    contentHtml: `
      <p style="color:#1e2535;font-size:15px;margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
      <p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 24px;">${lead}</p>
      <div style="background:#f9f8f6;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </div>
      ${reasonBlock}
      <p style="color:rgba(30,37,53,0.6);font-size:13px;line-height:1.7;margin:0 0 24px;">You can book another visit anytime from your NOVI patient account.</p>
      ${footerQuestions}`,
  });

  await sendResendEmail({
    to: String(to).trim(),
    subject: wasRequest ? "Your appointment request was declined" : "Your appointment was cancelled",
    html: htmlBody,
  });
  return { sent: true };
}

/**
 * GFE completed / approved (Qualiphy webhook) — same shell as course-style emails.
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
  const name = escapeHtml(String(patientName || "there"));
  const rows = summaryTableRows([
    ["Service", serviceLabel || "—"],
    ["Provider", providerName || "—"],
    ["Reviewed by", reviewerName || "Licensed provider"],
  ]);
  const link = examUrl ? escapeHtml(examUrl) : "";
  const cta = link
    ? `<div style="text-align:center;margin:0 0 24px;"><a href="${link}" style="display:inline-block;background:#C8E63C;color:#1a2540;font-weight:700;font-size:15px;padding:14px 32px;border-radius:50px;text-decoration:none;">View exam summary</a></div>`
    : "";

  const htmlBody = withCourseEmailShell({
    title: "GFE Complete",
    contentHtml: `
      <p style="color:#1e2535;font-size:15px;margin:0 0 24px;">Hi <strong>${name}</strong>,</p>
      <p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 24px;">Good news — your <strong>Good Faith Exam</strong> for this visit is <strong>approved</strong>. You're cleared to proceed with scheduling details from your provider.</p>
      <div style="background:#f9f8f6;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </div>
      ${cta}
      ${footerQuestions}`,
  });

  const subSuffix = String(serviceLabel || "your visit").replace(/\s+/g, " ").trim().slice(0, 80);
  await sendResendEmail({
    to: String(to).trim(),
    subject: `Your Good Faith Exam is approved — ${subSuffix}`,
    html: htmlBody,
  });
  return { sent: true };
}
