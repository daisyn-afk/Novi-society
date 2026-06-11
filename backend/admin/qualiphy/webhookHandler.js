import { query } from "../db.js";
import { sendAppointmentGfeApprovedPatientEmail } from "../patientAppointmentEmails.js";
import { recordPatientGfeFromAppointment } from "../gfe/patientGfeService.js";
import { resolveQualiphyWebhookUrl } from "./config.js";

export { resolveQualiphyWebhookUrl };

let appointmentColumnsPromise = null;
let preOrderColumnsPromise = null;

async function hasPreOrderColumn(name) {
  if (!preOrderColumnsPromise) {
    preOrderColumnsPromise = query(
      `select column_name
         from information_schema.columns
        where table_schema = 'public'
          and table_name = 'pre_orders'`
    )
      .then((r) => new Set((r.rows || []).map((row) => String(row.column_name || "").toLowerCase())))
      .catch(() => new Set());
  }
  const cols = await preOrderColumnsPromise;
  return cols.has(String(name || "").toLowerCase());
}

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
    `select a.id,
            a.patient_id,
            a.patient_email,
            a.patient_name,
            a.provider_id,
            a.provider_email,
            a.provider_name,
            a.service,
            a.appointment_date,
            a.service_type_id,
            coalesce(st.category, st_by_name.category) as service_type_category
       from public.appointments a
       left join public.service_type st on st.id::text = a.service_type_id::text
       left join public.service_type st_by_name on a.service_type_id is null
         and lower(trim(coalesce(st_by_name.name, ''))) = lower(trim(coalesce(a.service, '')))
      where a.id = $1
      limit 1`,
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

    try {
      await recordPatientGfeFromAppointment({
        appointmentId: id,
        patientId: existing.patient_id,
        gfeCategory: existing.service_type_category,
        status: gfeStatus,
        completedAt: new Date().toISOString(),
        qualiphyPatientExamId: patientExamId,
      });
    } catch (recordErr) {
      // eslint-disable-next-line no-console
      console.warn("[qualiphyWebhook] patient GFE validation record failed:", recordErr?.message || recordErr);
    }
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
  meetingUuid,
  patientExamId,
}) {
  const id = String(preOrderId || "").trim();
  if (!id) return { updated: false, reason: "missing_pre_order_id" };

  const setParts = ["updated_at = now()"];
  const params = [id];
  const add = (col, val) => {
    params.push(val);
    setParts.push(`${col} = $${params.length}`);
  };

  if (await hasPreOrderColumn("gfe_status")) add("gfe_status", gfeStatus);
  if (examUrl && (await hasPreOrderColumn("gfe_meeting_url"))) add("gfe_meeting_url", examUrl);
  if (gfeStatus === "approved" && (await hasPreOrderColumn("gfe_completed_at"))) {
    add("gfe_completed_at", new Date().toISOString());
  }
  if (providerName && (await hasPreOrderColumn("gfe_provider_name"))) {
    add("gfe_provider_name", providerName);
  }
  if (meetingUuid && (await hasPreOrderColumn("qualiphy_meeting_uuid"))) {
    add("qualiphy_meeting_uuid", meetingUuid);
  }
  if (patientExamId && (await hasPreOrderColumn("qualiphy_patient_exam_id"))) {
    add("qualiphy_patient_exam_id", patientExamId);
  }

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

async function findPreOrderIdByQualiphyIds({ meetingUuid, patientExamId }) {
  const uuid = String(meetingUuid || "").trim();
  const examId = String(patientExamId || "").trim();
  if (uuid && (await hasPreOrderColumn("qualiphy_meeting_uuid"))) {
    const { rows } = await query(
      `select id from public.pre_orders
        where qualiphy_meeting_uuid = $1
        order by gfe_initiated_at desc nulls last, created_at desc
        limit 1`,
      [uuid]
    );
    if (rows[0]?.id) return rows[0].id;
  }
  if (examId && (await hasPreOrderColumn("qualiphy_patient_exam_id"))) {
    const { rows } = await query(
      `select id from public.pre_orders
        where qualiphy_patient_exam_id = $1
        order by gfe_initiated_at desc nulls last, created_at desc
        limit 1`,
      [examId]
    );
    if (rows[0]?.id) return rows[0].id;
  }
  return null;
}

async function findPendingPreOrderByEmail(patientEmail) {
  const email = String(patientEmail || "").trim().toLowerCase();
  if (!email) return null;
  const { rows } = await query(
    `select id from public.pre_orders
      where lower(coalesce(customer_email, '')) = $1
        and lower(coalesce(order_type, '')) = 'model'
        and coalesce(gfe_status, 'not_available') in ('pending', 'not_sent', 'not_available')
        and gfe_completed_at is null
      order by gfe_initiated_at desc nulls last, created_at desc
      limit 1`,
    [email]
  );
  return rows[0]?.id || null;
}

async function resolveModelPreOrderId({ additional, meetingUuid, patientExamId, patientEmail }) {
  const fromAdditional = String(additional?.pre_order_id || "").trim();
  if (fromAdditional) return fromAdditional;

  const fromIds = await findPreOrderIdByQualiphyIds({ meetingUuid, patientExamId });
  if (fromIds) return fromIds;

  if (additional?.source === "novi_model_signup" || additional?.source === "model_signup") {
    return findPendingPreOrderByEmail(patientEmail);
  }

  return findPendingPreOrderByEmail(patientEmail);
}

/**
 * Process a Qualiphy exam webhook payload (production callback or local simulation).
 * @see https://api-docs.qualiphy.me/docs/api/exam-webhook
 */
export async function processQualiphyExamWebhookBody(body) {
  const payload = body && typeof body === "object" ? body : {};
  const additional = parseAdditionalData(payload.additional_data);
  const gfeStatus = mapQualiphyExamStatus(payload.exam_status);
  const examUrl = String(payload.exam_url || payload.exam_invite_url || "").trim();
  const providerName = String(payload.provider_name || "").trim();
  const patientEmail = String(payload.patient_email || "").trim();
  const questionsAnswers = payload.questions_answers;

  // eslint-disable-next-line no-console
  console.log("[qualiphyWebhook] received", {
    event: payload.event,
    exam_status: payload.exam_status,
    mapped_status: gfeStatus,
    source: additional.source,
    appointment_id: additional.appointment_id,
    pre_order_id: additional.pre_order_id,
    gfe_simulation: additional.gfe_simulation === true,
  });

  let result = { received: true, handled: false };

  const meetingUuid = String(payload.meeting_uuid || "").trim();
  const patientExamId = String(payload.patient_exam_id || "").trim();
  const isModelSignup =
    additional.source === "novi_model_signup" || additional.source === "model_signup";

  // Model signups: update pre_orders first (do not route to a patient appointment by email).
  if (isModelSignup || additional.pre_order_id) {
    const preOrderId = await resolveModelPreOrderId({
      additional,
      meetingUuid,
      patientExamId,
      patientEmail,
    });
    if (preOrderId) {
      return {
        ...result,
        ...(await updatePreOrderFromQualiphy({
          preOrderId,
          gfeStatus,
          examUrl,
          providerName,
          patientEmail,
          meetingUuid,
          patientExamId,
        })),
        handled: true,
        matched_by: "model_pre_order",
      };
    }
  }

  let appointmentId = String(additional.appointment_id || "").trim() || null;
  if (!appointmentId) {
    appointmentId = await findAppointmentIdByQualiphyIds({ meetingUuid, patientExamId });
  }

  if (appointmentId) {
    return {
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
      matched_by: "appointment",
    };
  }

  const preOrderId = await resolveModelPreOrderId({
    additional,
    meetingUuid,
    patientExamId,
    patientEmail,
  });
  if (preOrderId) {
    return {
      ...result,
      ...(await updatePreOrderFromQualiphy({
        preOrderId,
        gfeStatus,
        examUrl,
        providerName,
        patientEmail,
        meetingUuid,
        patientExamId,
      })),
      handled: true,
      matched_by: "pre_order_fallback",
    };
  }

  if (patientEmail) {
    const fallbackId = await findPendingAppointmentByEmail(patientEmail);
    if (fallbackId) {
      return {
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

  return result;
}

/**
 * Qualiphy POST callback when a patient completes (or updates) an exam.
 */
export async function handleQualiphyExamWebhook(req, res, next) {
  try {
    const result = await processQualiphyExamWebhookBody(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}
