import { query } from "./db.js";
import { sendEmailFromTemplate } from "./emails/renderTemplate.js";
import { formatDisplayTime } from "./timeDisplay.js";

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

function fmtDateLocal(dateString) {
  if (!dateString) return "";
  const [year, month, day] = String(dateString).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTimeLabel(timeSlot) {
  if (!timeSlot || typeof timeSlot !== "string") return "Waitlisted";
  return formatDisplayTime(timeSlot) || timeSlot;
}

function treatmentLabel(treatmentType) {
  if (treatmentType === "tox") return "Botox (TOX)";
  if (treatmentType === "filler") return "Dermal Filler";
  return "Botox + Filler";
}

export function modelTreatmentDisplayName(treatmentType) {
  if (treatmentType === "tox") return "Botox";
  if (treatmentType === "filler") return "Dermal Fillers";
  return "Botox & Fillers";
}

export function buildModelPostTrainingSummaryLines(treatmentType) {
  const treatmentName = modelTreatmentDisplayName(treatmentType);
  return [
    "Sign up at novisociety.com/patient-signup",
    "Build your aesthetic profile",
    `Book your first ${treatmentName} treatment`,
  ];
}

export function buildModelPostTrainingVars({ customer_email, customer_name, treatment_type, course_title }) {
  return {
    to: customer_email,
    first_name: String(customer_name || "there").split(/\s+/)[0],
    course_title: course_title || "NOVI Training Course",
    treatment_label: modelTreatmentDisplayName(treatment_type),
    summary_lines: buildModelPostTrainingSummaryLines(treatment_type),
  };
}

async function dispatchModelTemplate(templateKey, vars) {
  const result = await sendEmailFromTemplate(templateKey, vars);
  if (!result.ok) {
    const err = new Error(
      typeof result.error === "string" && result.error ? result.error : "Email send failed"
    );
    err.statusCode = 500;
    throw err;
  }
  return result;
}

/** Send model_post_training via Admin Email Templates (HTML shell + Resend). */
export async function sendModelPostTrainingEmailForSignup(row) {
  const vars = buildModelPostTrainingVars(row);
  const result = await dispatchModelTemplate("model_post_training", vars);
  if (row?.id) {
    await query(
      `update public.pre_orders set post_training_email_sent = true, updated_at = now() where id = $1`,
      [row.id]
    );
  }
  return result;
}

export async function runModelPostTrainingBatch() {
  const { rows } = await query(
    `select id, customer_email, customer_name, treatment_type, course_title
     from public.pre_orders
     where order_type = 'model'
       and course_date::date < current_date
       and coalesce(post_training_email_sent, false) = false
       and lower(coalesce(status, '')) in ('paid','confirmed','attended')`
  );
  let sent = 0;
  for (const row of rows) {
    try {
      await sendModelPostTrainingEmailForSignup(row);
      sent += 1;
    } catch {
      // continue next row
    }
  }
  return { total: rows.length, sent };
}

export async function runModelReminderBatch() {
  const { rows } = await query(
    `select id, customer_email, customer_name, course_date, model_time_slot, treatment_type
     from public.pre_orders
     where order_type = 'model'
       and (
         lower(coalesce(status, '')) in ('paid','confirmed')
         or (
           lower(coalesce(status, '')) = 'pending'
           and lower(coalesce(payment_status, '')) = 'completed'
         )
       )
       and course_date::date = (current_date + interval '1 day')::date
       and reminder_email_sent_at is null`
  );
  let sent = 0;
  for (const row of rows) {
    try {
      await dispatchModelTemplate("model_session_reminder", {
        to: row.customer_email,
        first_name: String(row.customer_name || "there").split(/\s+/)[0],
        course_date_label: fmtDateLocal(row.course_date),
        time_label: fmtTimeLabel(row.model_time_slot),
        treatment_label: treatmentLabel(row.treatment_type),
        details: [
          { label: "Date", value: fmtDateLocal(row.course_date) },
          { label: "Time", value: fmtTimeLabel(row.model_time_slot) },
          { label: "Treatment", value: treatmentLabel(row.treatment_type) },
        ],
        summary_lines: [
          "Arrive 15 minutes early",
          "Wear comfortable clothing for treatment areas",
          "Avoid alcohol and blood thinners 24 hours before session",
          "Bring a valid photo ID",
          "Keep your booking confirmation handy",
        ],
      });
      await query(
        `update public.pre_orders set reminder_email_sent_at = now(), updated_at = now() where id = $1`,
        [row.id]
      );
      sent += 1;
    } catch {
      // continue next row
    }
  }
  return { total: rows.length, sent };
}

export async function runModelGFEReminderBatch() {
  const hasMeetingUrl = await hasPreOrderColumn("gfe_meeting_url");
  const hasGfeStatus = await hasPreOrderColumn("gfe_status");
  if (!hasMeetingUrl || !hasGfeStatus) {
    return { total: 0, sent: 0, skipped: "Missing gfe columns (run migration)." };
  }
  const { rows } = await query(
    `select id, customer_email, customer_name, gfe_meeting_url
     from public.pre_orders
     where order_type = 'model'
       and lower(coalesce(status, '')) in ('paid','confirmed')
       and coalesce(gfe_status, 'not_available') = 'pending'
       and gfe_completed_at is null
       and gfe_meeting_url is not null
       and gfe_meeting_url not like '%/ModelBookingLookup%'
       and (
         gfe_reminder_sent_at is null
         or gfe_reminder_sent_at < (now() - interval '24 hours')
       )`
  );
  let sent = 0;
  for (const row of rows) {
    try {
      await dispatchModelTemplate("model_gfe_reminder", {
        to: row.customer_email,
        first_name: String(row.customer_name || "there").split(/\s+/)[0],
        gfe_url: row.gfe_meeting_url,
      });
      await query(
        `update public.pre_orders set gfe_reminder_sent_at = now(), updated_at = now() where id = $1`,
        [row.id]
      );
      sent += 1;
    } catch {
      // continue
    }
  }
  return { total: rows.length, sent };
}

/** Daily cron: session reminders, GFE reminders, post-training follow-ups. */
export async function runModelAutomation() {
  const [reminders, gfeReminders, postTraining] = await Promise.all([
    runModelReminderBatch(),
    runModelGFEReminderBatch(),
    runModelPostTrainingBatch(),
  ]);
  return {
    reminders,
    gfe_reminders: gfeReminders,
    post_training: postTraining,
  };
}
