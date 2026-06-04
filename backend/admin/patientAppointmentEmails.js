import { sendEmailFromTemplate } from "./emails/renderTemplate.js";
import { query } from "./db.js";

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

function buildAppointmentDetailRows({ serviceLabel, providerName, appointmentDate, appointmentTime }) {
  const dateStr = fmtAppointmentDateLocal(appointmentDate);
  const timeStr = fmtAppointmentTimeLabel(appointmentTime);
  return [
    { label: "Service", value: serviceLabel || "" },
    { label: "Provider", value: providerName || "" },
    { label: "Date", value: dateStr },
    { label: "Time", value: appointmentTime ? timeStr : "" },
  ].filter((row) => row.value != null && String(row.value).trim() !== "");
}

function firstName(name) {
  return String(name || "there").trim().split(/\s+/)[0] || "there";
}

function throwSendError(result, fallbackMessage) {
  const err = new Error(
    typeof result?.error === "string" && result.error ? result.error : fallbackMessage
  );
  err.statusCode = 500;
  throw err;
}

/**
 * Good Faith Exam invite — uses the central "appointment_gfe_invite" template.
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

  const result = await sendEmailFromTemplate("appointment_gfe_invite", {
    to: recipient,
    first_name: firstName(patientName),
    service_label: String(serviceLabel || "your visit").trim(),
    gfe_url: link,
    details: buildAppointmentDetailRows({
      serviceLabel: serviceLabel || "—",
      providerName: providerName || "—",
      appointmentDate,
      appointmentTime,
    }),
    details_title: "Appointment Details",
    summary_lines: [
      "Brief video visit with a licensed provider",
      "Review of your health history",
      "Medical clearance for your treatment",
      "Usually about 5–10 minutes",
    ],
  });

  if (!result.ok) {
    throwSendError(result, "Failed to send GFE invite email. Check RESEND_API_KEY and sender domain.");
  }
  return { sent: true };
}

/**
 * In-app notification for the patient (bell icon).
 */
async function ensureNotificationsTable() {
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
}

async function insertInAppNotification({ userId, userEmail, type, message, linkPage }) {
  const uid = String(userId || "").trim();
  const email = String(userEmail || "").trim();
  if (!uid && !email) return { sent: false };

  try {
    await ensureNotificationsTable();
    await query(
      `insert into public.notifications (user_id, user_email, type, message, link_page)
       values ($1, $2, $3, $4, $5)`,
      [uid || null, email || null, type || "general", message, linkPage || null]
    );
    return { sent: true };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[insertInAppNotification] failed:", error?.message || error);
    return { sent: false, error: error?.message };
  }
}

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
  const message = `${provider} sent you a Good Faith Exam for ${service}. Open Appointments in NOVI to complete it.`;

  return insertInAppNotification({
    userId: pid,
    userEmail: email,
    type: "gfe_invite",
    message,
    linkPage: "PatientAppointments",
  });
}

export async function sendAppointmentConfirmedPatientEmail({
  to,
  patientName,
  providerName,
  serviceLabel,
  appointmentDate,
  appointmentTime,
}) {
  if (!to) return { skipped: true };
  const result = await sendEmailFromTemplate("appointment_confirmed", {
    to: String(to).trim(),
    first_name: firstName(patientName),
    appointment_date_label: fmtAppointmentDateLocal(appointmentDate) || "NOVI Society",
    details: buildAppointmentDetailRows({
      serviceLabel,
      providerName,
      appointmentDate,
      appointmentTime,
    }),
    details_title: "Appointment Details",
    summary_lines: [
      "Add this visit to your calendar",
      "If your service requires a GFE, complete it before your appointment",
      "Contact your provider if you need to reschedule",
    ],
  });
  if (!result.ok) {
    throwSendError(result, "Email send failed");
  }
  return { sent: true };
}

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
  const templateKey = wasRequest ? "appointment_request_declined" : "appointment_cancelled";
  const result = await sendEmailFromTemplate(templateKey, {
    to: String(to).trim(),
    first_name: firstName(patientName),
    rejection_reason: reason && String(reason).trim() ? String(reason).trim() : "",
    rejection_title: "Note from the practice",
    rejection_tone: "neutral",
    details: buildAppointmentDetailRows({
      serviceLabel,
      providerName,
      appointmentDate,
      appointmentTime: null,
    }),
  });
  if (!result.ok) {
    throwSendError(result, "Email send failed");
  }
  return { sent: true };
}

/** In-app notification when a provider cancels or declines an appointment. */
export async function notifyPatientAppointmentCancelled({
  patientId,
  patientEmail,
  providerName,
  serviceLabel,
  appointmentDate,
  wasRequest,
}) {
  const provider = String(providerName || "Your provider").trim();
  const service = String(serviceLabel || "your appointment").trim();
  const when = fmtAppointmentDateLocal(appointmentDate);
  const message = wasRequest
    ? `${provider} declined your request for ${service}${when ? ` on ${when}` : ""}.`
    : `${provider} cancelled your ${service} appointment${when ? ` on ${when}` : ""}.`;

  return insertInAppNotification({
    userId: patientId,
    userEmail: patientEmail,
    type: "appointment_cancelled",
    message,
    linkPage: "PatientAppointments",
  });
}

/** In-app notification when a patient cancels an appointment. */
export async function notifyProviderAppointmentCancelled({
  providerId,
  providerEmail,
  patientName,
  serviceLabel,
  appointmentDate,
}) {
  const patient = String(patientName || "A patient").trim();
  const service = String(serviceLabel || "an appointment").trim();
  const when = fmtAppointmentDateLocal(appointmentDate);
  const message = when
    ? `${patient} cancelled their ${service} appointment scheduled for ${when}.`
    : `${patient} cancelled their ${service} appointment.`;

  return insertInAppNotification({
    userId: providerId,
    userEmail: providerEmail,
    type: "appointment_cancelled",
    message,
    linkPage: "ProviderPractice",
  });
}

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
  const formattedDate = fmtAppointmentDateLocal(appointmentDate);
  const dateSuffix = formattedDate ? ` — ${formattedDate}` : "";
  const pid = String(providerId || "").trim();
  const ctaPath = pid
    ? `/PatientMarketplace?provider=${encodeURIComponent(pid)}`
    : "/PatientMarketplace";

  const result = await sendEmailFromTemplate("appointment_no_show", {
    to: String(to).trim(),
    first_name: firstName(patientName),
    date_suffix: dateSuffix,
    cta_url_path: ctaPath,
    details: buildAppointmentDetailRows({
      serviceLabel,
      providerName,
      appointmentDate,
      appointmentTime,
    }),
    details_title: "Missed Appointment",
    summary_lines: [
      "Book a new appointment at a time that works for you",
      "If your service requires a GFE, complete it before your new visit",
      "Contact your provider if you had an emergency or need help rescheduling",
    ],
  });
  if (!result.ok) {
    throwSendError(result, "Email send failed");
  }
  return { sent: true };
}

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

  return insertInAppNotification({
    userId: pid,
    userEmail: email,
    type: "general",
    message,
    linkPage: "PatientMarketplace",
  });
}

export async function sendAppointmentGfeApprovedPatientEmail({
  to,
  patientName,
  providerName,
  serviceLabel,
  examUrl,
  reviewerName,
}) {
  if (!to) return { skipped: true };
  const details = buildAppointmentDetailRows({
    serviceLabel,
    providerName,
    appointmentDate: null,
    appointmentTime: null,
  });
  details.push({ label: "Reviewed by", value: reviewerName || "Licensed provider" });

  const result = await sendEmailFromTemplate("appointment_gfe_approved", {
    to: String(to).trim(),
    first_name: firstName(patientName),
    service_label: String(serviceLabel || "your visit").trim(),
    exam_url: String(examUrl || "").trim(),
    details,
  });
  if (!result.ok) {
    throwSendError(result, "Email send failed");
  }
  return { sent: true };
}
