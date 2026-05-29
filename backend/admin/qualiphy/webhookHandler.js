import { query } from "../db.js";
import { sendAppointmentGfeApprovedPatientEmail } from "../patientAppointmentEmails.js";
import { resolveQualiphyWebhookUrl } from "./config.js";

export { resolveQualiphyWebhookUrl };

let appointmentColumnsPromise = null;

async function hasAppointmentColumn(name) {
  if (!appointmentColumnsPromise) {
    appointmentColumnsPromise = query(
      `select column_name
         from information_schema.columns
        where table_schema = 'public'
          and table_name = 'appointments'`
    )
      .then((r) => new Set((r.rows || []).map((row) => String(row.column_name || "").toLowerCase())))
      .catch(() => new Set());
  }
  const cols = await appointmentColumnsPromise;
  return cols.has(String(name || "").toLowerCase());
}

function parseAdditionalData(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

/** Map Qualiphy exam_status to app gfe_status values. */
export function mapQualiphyExamStatus(examStatus) {
  const s = String(examStatus || "").trim().toLowerCase();
  if (!s) return "pending";
  if (s === "approved" || s.includes("approv")) return "approved";
  if (s === "deferred" || s.includes("defer")) return "deferred";
  if (s === "n/a" || s === "na" || s.includes("not available")) return "not_available";
  return "pending";
}

function normalizeQuestionsAnswers(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => ({
    no: item?.no ?? item?.position ?? index + 1,
    question: String(item?.question ?? "").trim(),
    answer: String(item?.answer ?? "").trim(),
  }));
}

async function insertNotification({ userId, userEmail, type, message, linkPage }) {
  const pid = String(userId || "").trim();
  const email = String(userEmail || "").trim();
  if (!pid && !email) return;
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
       values ($1, $2, $3, $4, $5)`,
      [pid || null, email || null, type || "general", message, linkPage || null]
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[qualiphyWebhook] notification insert failed:", error?.message || error);
  }
}

async function updateAppointmentFromQualiphy({
  appointmentId,
  gfeStatus,
  examUrl,
  providerName,
  questionsAnswers,
  patientEmail,
  meetingUuid,
  patientExamId,
}) {
  const id = String(appointmentId || "").trim();
  if (!id) return { updated: false, reason: "missing_appointment_id" };

  const { rows: existingRows } = await query(
    `select id, patient_id, patient_email, patient_name, provider_id, provider_email, provider_name, service, appointment_date
       from public.appointments where id = $1 limit 1`,
    [id]
  );
  const existing = existingRows[0];
  if (!existing) return { updated: false, reason: "appointment_not_found" };

  const qaJson = JSON.stringify(normalizeQuestionsAnswers(questionsAnswers));

  const setParts = [
    "gfe_status = $2",
    "gfe_exam_url = coalesce(nullif($3, ''), gfe_exam_url)",
    "gfe_completed_at = case when $2 = 'approved' then coalesce(gfe_completed_at, now()) else gfe_completed_at end",
    "gfe_provider_name = coalesce(nullif($4, ''), gfe_provider_name)",
    "gfe_questions_answers = case when $5::jsonb = '[]'::jsonb then gfe_questions_answers else $5::jsonb end",
    "updated_at = now()",
  ];
  const params = [id, gfeStatus, examUrl || null, providerName || null, qaJson];

  if (meetingUuid && (await hasAppointmentColumn("qualiphy_meeting_uuid"))) {
    params.push(meetingUuid);
    setParts.push(`qualiphy_meeting_uuid = coalesce(nullif($${params.length}, ''), qualiphy_meeting_uuid)`);
  }
  if (patientExamId && (await hasAppointmentColumn("qualiphy_patient_exam_id"))) {
    params.push(patientExamId);
    setParts.push(`qualiphy_patient_exam_id = coalesce(nullif($${params.length}, ''), qualiphy_patient_exam_id)`);
  }

  await query(
    `update public.appointments set ${setParts.join(", ")} where id = $1`,
    params
  );

  const patientLabel = existing.patient_name || patientEmail || "Patient";
  const serviceLabel = existing.service || "appointment";

  if (gfeStatus === "approved") {
    const to = String(existing.patient_email || patientEmail || "").trim();
    if (to) {
      try {
        await sendAppointmentGfeApprovedPatientEmail({
          to,
          patientName: existing.patient_name,
          providerName: providerName || existing.provider_name,
          serviceLabel,
          examUrl,
          reviewerName: providerName,
        });
      } catch (emailErr) {
        // eslint-disable-next-line no-console
        console.warn("[qualiphyWebhook] patient approval email failed:", emailErr?.message || emailErr);
      }
    }

    await insertNotification({
      userId: existing.patient_id,
      userEmail: existing.patient_email || patientEmail,
      type: "gfe_completed",
      message: `Your Good Faith Exam for ${serviceLabel} was approved. You're cleared for your visit.`,
      linkPage: "PatientAppointments",
    });

    await insertNotification({
      userId: existing.provider_id,
      userEmail: existing.provider_email,
      type: "gfe_completed",
      message: `GFE approved for ${patientLabel} (${serviceLabel}).`,
      linkPage: "ProviderPractice?tab=appointments",
    });
  } else if (gfeStatus === "deferred") {
    await insertNotification({
      userId: existing.patient_id,
      userEmail: existing.patient_email || patientEmail,
      type: "general",
      message: `Your Good Faith Exam for ${serviceLabel} needs follow-up. Your provider will contact you.`,
      linkPage: "PatientAppointments",
    });
    await insertNotification({
      userId: existing.provider_id,
      userEmail: existing.provider_email,
      type: "general",
      message: `GFE deferred for ${patientLabel} (${serviceLabel}). Review in Qualiphy.`,
      linkPage: "ProviderPractice?tab=appointments",
    });
  }

  return { updated: true, appointment_id: id, gfe_status: gfeStatus };
}

async function updatePreOrderFromQualiphy({
  preOrderId,
  gfeStatus,
  examUrl,
  providerName,
  patientEmail,
}) {
  const id = String(preOrderId || "").trim();
  if (!id) return { updated: false, reason: "missing_pre_order_id" };

  const setParts = ["updated_at = now()"];
  const params = [id];
  const add = (col, val) => {
    params.push(val);
    setParts.push(`${col} = $${params.length}`);
  };

  add("gfe_status", gfeStatus);
  if (examUrl) add("gfe_meeting_url", examUrl);
  if (gfeStatus === "approved") add("gfe_completed_at", new Date().toISOString());
  if (providerName) add("gfe_provider_name", providerName);

  await query(
    `update public.pre_orders set ${setParts.join(", ")} where id = $1`,
    params
  );

  if (gfeStatus === "approved" && patientEmail) {
    await insertNotification({
      userEmail: patientEmail,
      type: "gfe_completed",
      message: "Your Good Faith Exam was approved. You're cleared for your training session.",
      linkPage: "ModelBookingLookup",
    });
  }

  return { updated: true, pre_order_id: id, gfe_status: gfeStatus };
}

async function findAppointmentIdByQualiphyIds({ meetingUuid, patientExamId }) {
  const uuid = String(meetingUuid || "").trim();
  const examId = String(patientExamId || "").trim();
  if (uuid) {
    const { rows } = await query(
      `select id from public.appointments
        where qualiphy_meeting_uuid = $1
        order by gfe_sent_at desc nulls last, created_at desc
        limit 1`,
      [uuid]
    );
    if (rows[0]?.id) return rows[0].id;
  }
  if (examId) {
    const { rows } = await query(
      `select id from public.appointments
        where qualiphy_patient_exam_id = $1
        order by gfe_sent_at desc nulls last, created_at desc
        limit 1`,
      [examId]
    );
    if (rows[0]?.id) return rows[0].id;
  }
  return null;
}

async function findPendingAppointmentByEmail(patientEmail) {
  const email = String(patientEmail || "").trim().toLowerCase();
  if (!email) return null;
  const { rows } = await query(
    `select id from public.appointments
      where lower(coalesce(patient_email, '')) = $1
        and coalesce(gfe_status, 'not_sent') in ('pending', 'not_sent')
      order by gfe_sent_at desc nulls last, created_at desc
      limit 1`,
    [email]
  );
  return rows[0]?.id || null;
}

/**
 * Qualiphy POST callback when a patient completes (or updates) an exam.
 * @see https://api-docs.qualiphy.me/docs/api/exam-webhook
 */
export async function handleQualiphyExamWebhook(req, res, next) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const additional = parseAdditionalData(body.additional_data);
    const gfeStatus = mapQualiphyExamStatus(body.exam_status);
    const examUrl = String(body.exam_url || body.exam_invite_url || "").trim();
    const providerName = String(body.provider_name || "").trim();
    const patientEmail = String(body.patient_email || "").trim();
    const questionsAnswers = body.questions_answers;

    // eslint-disable-next-line no-console
    console.log("[qualiphyWebhook] received", {
      event: body.event,
      exam_status: body.exam_status,
      mapped_status: gfeStatus,
      source: additional.source,
      appointment_id: additional.appointment_id,
      pre_order_id: additional.pre_order_id,
    });

    let result = { received: true, handled: false };

    let appointmentId = String(additional.appointment_id || "").trim() || null;
    const meetingUuid = String(body.meeting_uuid || "").trim();
    const patientExamId = String(body.patient_exam_id || "").trim();

    if (!appointmentId) {
      appointmentId = await findAppointmentIdByQualiphyIds({ meetingUuid, patientExamId });
    }

    if (appointmentId) {
      result = {
        ...result,
        ...(await updateAppointmentFromQualiphy({
          appointmentId,
          gfeStatus,
          examUrl,
          providerName,
          questionsAnswers,
          patientEmail,
          meetingUuid,
          patientExamId,
        })),
        handled: true,
      };
    } else if (additional.pre_order_id || additional.source === "novi_model_signup") {
      result = {
        ...result,
        ...(await updatePreOrderFromQualiphy({
          preOrderId: additional.pre_order_id,
          gfeStatus,
          examUrl,
          providerName,
          patientEmail,
        })),
        handled: true,
      };
    } else if (patientEmail) {
      const fallbackId = await findPendingAppointmentByEmail(patientEmail);
      if (fallbackId) {
        result = {
          ...result,
          ...(await updateAppointmentFromQualiphy({
            appointmentId: fallbackId,
            gfeStatus,
            examUrl,
            providerName,
            questionsAnswers,
            patientEmail,
            meetingUuid,
            patientExamId,
          })),
          handled: true,
          matched_by: "patient_email",
        };
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}
