import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";
import { hasAdminAccess, hasStaffModuleAccess } from "../auth/helpers.js";
import { notifyAdminsOfPendingCourseCertIssuance } from "../certificationNotifications.js";
import { sendEmailFromTemplate } from "../emails/renderTemplate.js";
import {
  runModelAutomation,
  runModelGFEReminderBatch,
  runModelPostTrainingBatch,
  runModelReminderBatch,
  sendModelPostTrainingEmailForSignup,
} from "../modelEmailAutomation.js";
import { listEligibleMedicalDirectorsForService } from "../mdEligibleDirectors.js";
import { submitMdBoardCoverageAssignment } from "../mdAssignmentService.js";
import { formatDisplayTime } from "../timeDisplay.js";
import {
  attachCheckoutSessionToMdSubscription,
  createPendingMdSubscriptionForCheckout,
  ensureSignedContractForSubscription,
  finalizeMdBoardCoverage,
} from "../mdBillingService.js";
import {
  buildFilledContractPreviewBytes,
  getProviderAgreementContext,
} from "../mdContractPdfService.js";
import {
  isAllowlistedMdCoverageTestProvider,
  isMdCoverageTestPricingEnabled,
  resolveMdCoverageMonthlyFee,
} from "../mdMembershipPricing.js";
import Stripe from "stripe";
import {
  recordCheckoutInitiated,
  enrichPaymentTransaction,
  markAttemptFailed,
  recordStripeWebhookEvent,
  PAYMENT_FLOW
} from "../payments/service.js";
import {
  createManufacturerApplication,
  getManufacturerById
} from "../manufacturers/repository.js";
import {
  resolveRepContactForProvider,
  getProviderManufacturerRep,
  isValidEmailFormat,
} from "../manufacturers/providerManufacturerRepsRepository.js";
import { createProviderGoogleMeetEvent } from "../manufacturers/googleCalendarService.js";
import { getProviderGoogleConnection } from "../manufacturers/providerGoogleConnectionRepository.js";
import {
  addMinutesToLocalDateTime,
  createProviderRepCall,
  parseScheduledAt,
} from "../manufacturers/providerRepCallsRepository.js";
import { createManufacturerOrderRequest } from "../manufacturers/orderRequestsRepository.js";
import {
  notifyAdminsOfManufacturerApplication,
  notifyRepOfManufacturerApplication,
  notifyRepOfContactRequest,
} from "../manufacturers/notifications.js";
import {
  assertProviderManufacturerCoverage,
  buildManufacturerApplicationPayload,
} from "../manufacturers/providerApplicationContext.js";
import { validateBookingScope } from "../bookingValidation.js";
import { sendAppointmentGfeInviteEmail, notifyPatientGfeInvite } from "../patientAppointmentEmails.js";
import { handleQualiphyExamWebhook, resolveQualiphyWebhookUrl } from "../qualiphy/webhookHandler.js";
import { buildAppointmentGfeRedirectUrls } from "../qualiphy/config.js";
import {
  runCheckExpirations,
  runComplianceChecks,
} from "../compliance-logs/expirationService.js";
import {
  createAppointmentDepositCheckout,
  processAppointmentCheckoutCompletedSession,
} from "../appointments/paymentService.js";
import { resolveAppBaseUrl } from "../lib/frontendBaseUrl.js";

export { processAppointmentCheckoutCompletedSession };

export const functionsRouter = Router();
let certificationColumnsPromise = null;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
const QUALIPHY_API_URL = "https://api.qualiphy.me/api/exam_invite";
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
let preOrderColumnsPromise = null;
let coursePromoColumnsPromise = null;
let appointmentColumnsPromise = null;

async function getAppointmentColumnsSet() {
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
  return appointmentColumnsPromise;
}

async function hasAppointmentColumn(name) {
  const cols = await getAppointmentColumnsSet();
  return cols.has(String(name || "").toLowerCase());
}

async function getPreOrderColumnsSet() {
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
  return preOrderColumnsPromise;
}

async function hasPreOrderColumn(name) {
  const cols = await getPreOrderColumnsSet();
  return cols.has(String(name || "").toLowerCase());
}

async function getCoursePromoColumnsSet() {
  if (!coursePromoColumnsPromise) {
    coursePromoColumnsPromise = query(
      `select column_name
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'course_promo_codes'`
    )
      .then((r) => new Set((r.rows || []).map((row) => String(row.column_name || "").toLowerCase())))
      .catch(() => new Set());
  }
  return coursePromoColumnsPromise;
}

async function hasCoursePromoColumn(name) {
  const cols = await getCoursePromoColumnsSet();
  return cols.has(String(name || "").toLowerCase());
}

function normalizeExamIds(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
}

function splitNameParts(fullName) {
  const clean = String(fullName || "").trim();
  if (!clean) return { firstName: "", lastName: "" };
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "Model" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** pg `date` columns often arrive as JS Date objects — never use String(date).slice(0, 10). */
function normalizeDateOnly(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(value).trim();
  if (!str) return null;
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

async function loadPatientGfeContact(patientId, patientEmail) {
  const pid = String(patientId || "").trim();
  const email = String(patientEmail || "").trim().toLowerCase();
  let dob = null;
  let phone = null;
  let state = null;

  if (pid) {
    const { rows } = await query(
      `select pp.date_of_birth, pp.phone, pp.state
         from public.users u
         left join public.patient_profiles pp on pp.user_id = u.id
        where u.auth_user_id::text = $1 or u.id::text = $1
        limit 1`,
      [pid]
    );
    const row = rows[0] || {};
    dob = normalizeDateOnly(row.date_of_birth);
    phone = String(row.phone || "").trim() || null;
    state = String(row.state || "").trim() || null;
  }

  if ((!dob || !phone) && email) {
    const hasPreOrderDob = await hasPreOrderColumn("date_of_birth");
    if (hasPreOrderDob) {
      const { rows: preRows } = await query(
        `select date_of_birth, phone
           from public.pre_orders
          where lower(customer_email) = $1
            and date_of_birth is not null
          order by created_at desc
          limit 1`,
        [email]
      );
      const pre = preRows[0];
      if (pre) {
        if (!dob) dob = normalizeDateOnly(pre.date_of_birth);
        if (!phone) phone = String(pre.phone || "").trim() || null;
      }
    }
  }

  return { dob, phone, state };
}

async function resolveQualiphyExamIdForCourse({ courseId, treatmentType }) {
  if (!courseId) return null;
  const { rows: courseRows } = await query(
    `select linked_service_type_ids, certifications_awarded, category, template_id
     from public.scheduled_courses
     where id = $1
     limit 1`,
    [courseId]
  );
  const course = courseRows?.[0] || {};
  const linkedServiceTypeIds = Array.isArray(course.linked_service_type_ids)
    ? course.linked_service_type_ids.map((id) => String(id ?? "").trim()).filter(Boolean)
    : [];
  let templateLinkedServiceTypeIds = [];
  if (linkedServiceTypeIds.length === 0 && course?.template_id) {
    const { rows: templateRows } = await query(
      `select linked_service_type_ids
       from public.template_courses
       where id = $1
       limit 1`,
      [course.template_id]
    );
    templateLinkedServiceTypeIds = Array.isArray(templateRows?.[0]?.linked_service_type_ids)
      ? templateRows[0].linked_service_type_ids.map((id) => String(id ?? "").trim()).filter(Boolean)
      : [];
  }
  const awardedServiceTypeIds = Array.isArray(course.certifications_awarded)
    ? course.certifications_awarded
      .map((entry) => String(entry?.service_type_id ?? "").trim())
      .filter(Boolean)
    : [];
  const serviceTypeIds = Array.from(new Set([
    ...linkedServiceTypeIds,
    ...templateLinkedServiceTypeIds,
    ...awardedServiceTypeIds
  ]));
  const courseCategory = String(course?.category || "").trim().toLowerCase();
  const preferredCategory =
    treatmentType === "filler" ? "fillers"
      : (treatmentType === "tox" || treatmentType === "both") ? "injectables"
        : null;

  let serviceRows = [];
  if (serviceTypeIds.length > 0) {
    const { rows } = await query(
      `select id, category, requires_gfe, qualiphy_exam_ids
       from public.service_type
       where id = any($1::text[])`,
      [serviceTypeIds]
    );
    serviceRows = rows;
  }
  if ((!Array.isArray(serviceRows) || serviceRows.length === 0) && (preferredCategory || courseCategory)) {
    const categoriesToTry = Array.from(new Set([preferredCategory, courseCategory].filter(Boolean)));
    const { rows } = await query(
      `select id, category, requires_gfe, qualiphy_exam_ids
       from public.service_type
       where category = any($1::text[])
         and requires_gfe = true`,
      [categoriesToTry]
    );
    serviceRows = rows;
  }
  if (!Array.isArray(serviceRows) || serviceRows.length === 0) return null;

  const withExamIds = serviceRows
    .map((row) => ({
      ...row,
      examIds: normalizeExamIds(row.qualiphy_exam_ids)
    }))
    .filter((row) => row.examIds.length > 0);
  if (withExamIds.length === 0) return null;

  const gfeRequiredFirst = withExamIds
    .filter((row) => row.requires_gfe === true);
  const candidates = gfeRequiredFirst.length > 0 ? gfeRequiredFirst : withExamIds;

  if (preferredCategory) {
    const preferred = candidates.find((row) => String(row.category || "").toLowerCase() === preferredCategory);
    if (preferred) return preferred.examIds[0];
  }
  return candidates[0].examIds[0];
}

async function resolveQualiphyExamIdForAppointment({ serviceTypeId, serviceName, qualiphyExamIds }) {
  const fromJoin = normalizeExamIds(qualiphyExamIds);
  if (fromJoin.length > 0) return fromJoin[0];
  const stId = String(serviceTypeId || "").trim();
  if (stId) {
    const { rows } = await query(
      `select qualiphy_exam_ids from public.service_type where id = $1 limit 1`,
      [stId]
    );
    const ids = normalizeExamIds(rows[0]?.qualiphy_exam_ids);
    if (ids.length > 0) return ids[0];
  }
  const service = String(serviceName || "").trim();
  if (service) {
    const { rows } = await query(
      `select qualiphy_exam_ids
         from public.service_type
        where lower(trim(name)) = lower(trim($1))
          and requires_gfe = true
        limit 1`,
      [service]
    );
    const ids = normalizeExamIds(rows[0]?.qualiphy_exam_ids);
    if (ids.length > 0) return ids[0];
  }
  return null;
}

async function resolveTeleStateForAppointment({ appointment, patientState }) {
  const patientAbbr = extractUsStateAbbr(patientState);
  if (patientAbbr) return patientAbbr;
  const rawPatient = String(patientState || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(rawPatient)) return rawPatient;

  const providerId = String(appointment?.provider_id || "").trim();
  if (providerId) {
    const { rows } = await query(
      `select pp.state
         from public.users u
         left join public.provider_profiles pp on pp.user_id = u.id
        where u.auth_user_id::text = $1 or u.id::text = $1
        limit 1`,
      [providerId]
    );
    const providerAbbr = extractUsStateAbbr(rows[0]?.state);
    if (providerAbbr) return providerAbbr;
  }
  return null;
}

function parseQualiphyInviteResponse(invitePayload) {
  const meetingUrl = String(
    invitePayload?.meeting_url ||
    invitePayload?.url ||
    invitePayload?.exam_invite_url ||
    invitePayload?.gfe_url ||
    invitePayload?.data?.meeting_url ||
    invitePayload?.data?.url ||
    invitePayload?.data?.exam_invite_url ||
    ""
  ).trim();
  const meetingUuid = String(invitePayload?.meeting_uuid || invitePayload?.data?.meeting_uuid || "").trim();
  const patientExams = Array.isArray(invitePayload?.patient_exams)
    ? invitePayload.patient_exams
    : Array.isArray(invitePayload?.data?.patient_exams)
      ? invitePayload.data.patient_exams
      : [];
  const patientExamId = patientExams[0]?.patient_exam_id != null
    ? String(patientExams[0].patient_exam_id)
    : "";
  return { meetingUrl, meetingUuid, patientExamId };
}

async function requestQualiphyExamInvite(inviteFields, qualiphyRedirectUrls = null) {
  const qualiphyApiKey = process.env.QUALIPHY_API_KEY || "";
  const qualiphyClinicId = process.env.QUALIPHY_CLINIC_ID || "";
  if (!qualiphyApiKey) {
    const err = new Error("QUALIPHY_API_KEY is not configured.");
    err.statusCode = 500;
    throw err;
  }

  const qualiphyWebhookUrl = resolveQualiphyWebhookUrl();
  const invitePayloadBody = {
    api_key: qualiphyApiKey,
    ...inviteFields,
  };
  if (qualiphyRedirectUrls && typeof qualiphyRedirectUrls === "object") {
    for (const key of ["redirect_approve", "redirect_reject", "redirect_na", "redirect_missed"]) {
      const value = String(qualiphyRedirectUrls[key] || "").trim();
      if (value) invitePayloadBody[key] = value;
    }
  }
  if (qualiphyWebhookUrl) {
    invitePayloadBody.webhook_url = qualiphyWebhookUrl;
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[qualiphy] No webhook URL — exam completion will not update appointments. " +
        "Set QUALIPHY_WEBHOOK_URL or APP_BASE_URL to a public HTTPS origin."
    );
  }
  if (qualiphyClinicId) invitePayloadBody.clinic_id = qualiphyClinicId;

  const sendInvite = async (payload) => {
    const response = await fetch(QUALIPHY_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${qualiphyApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const responsePayload = await response.json().catch(() => ({}));
    return { response, responsePayload };
  };

  let { response: inviteRes, responsePayload: invitePayload } = await sendInvite(invitePayloadBody);
  let upstreamHttpCode = Number(invitePayload?.http_code || 0);
  let upstreamFailed = !inviteRes.ok || (Number.isFinite(upstreamHttpCode) && upstreamHttpCode >= 400);

  const upstreamErrorTextInitial = String(
    invitePayload?.error_message || invitePayload?.message || invitePayload?.error || ""
  ).toLowerCase();
  const looksLikeClinicNotFound =
    upstreamErrorTextInitial.includes("clinic") && upstreamErrorTextInitial.includes("not found");

  if (Boolean(invitePayloadBody?.clinic_id) && (upstreamFailed || looksLikeClinicNotFound)) {
    const fallbackPayload = { ...invitePayloadBody };
    delete fallbackPayload.clinic_id;
    ({ response: inviteRes, responsePayload: invitePayload } = await sendInvite(fallbackPayload));
    upstreamHttpCode = Number(invitePayload?.http_code || 0);
    upstreamFailed = !inviteRes.ok || (Number.isFinite(upstreamHttpCode) && upstreamHttpCode >= 400);
  }

  if (upstreamFailed) {
    const upstreamError =
      invitePayload?.error_message || invitePayload?.message || invitePayload?.error || "Qualiphy invite request failed.";
    const err = new Error(upstreamError);
    err.statusCode = 502;
    throw err;
  }

  const { meetingUrl, meetingUuid, patientExamId } = parseQualiphyInviteResponse(invitePayload);

  if (!meetingUrl) {
    const err = new Error("Qualiphy did not return a GFE link.");
    err.statusCode = 502;
    throw err;
  }
  if (meetingUrl.includes("/ModelBookingLookup")) {
    const err = new Error("Invalid GFE link returned. Qualiphy did not return an exam invite URL.");
    err.statusCode = 502;
    throw err;
  }
  return { meetingUrl, meetingUuid, patientExamId, webhookUrl: qualiphyWebhookUrl || null };
}

function toCurrencyCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function fmtDateLocal(dateString) {
  if (!dateString) return "";
  const [year, month, day] = String(dateString).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function fmtTimeLabel(timeSlot) {
  if (!timeSlot || typeof timeSlot !== "string") return "Waitlisted";
  return formatDisplayTime(timeSlot) || timeSlot;
}

function extractUsStateAbbr(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) return null;
  // Prefer the common "..., TX" pattern.
  const m1 = s.match(/,\s*([A-Z]{2})\b/);
  if (m1?.[1]) return m1[1];
  // Fallback: any two-letter uppercase token.
  const m2 = s.match(/\b([A-Z]{2})\b/);
  if (m2?.[1]) return m2[1];
  return null;
}

async function resolveTeleStateForCourse({ courseId }) {
  if (!courseId) return null;
  const { rows } = await query(
    `select location, session_dates
     from public.scheduled_courses
     where id = $1
     limit 1`,
    [courseId]
  );
  const course = rows?.[0] || {};

  const candidates = [course?.location].filter(Boolean).map((x) => String(x));
  if (course?.session_dates) {
    let parsed = course.session_dates;
    if (typeof parsed === "string") {
      try { parsed = JSON.parse(parsed); } catch { parsed = null; }
    }
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        const loc = entry?.location || entry?.venue_name || entry?.venue;
        if (loc) candidates.push(String(loc));
      }
    }
  }

  for (const c of candidates) {
    const abbr = extractUsStateAbbr(c);
    if (abbr) return abbr;
  }
  return null;
}

function treatmentLabel(treatmentType) {
  if (treatmentType === "tox") return "Botox (TOX)";
  if (treatmentType === "filler") return "Dermal Filler";
  return "Botox + Filler";
}

/**
 * Dispatch a model-training email through the central templateRegistry.
 * Throws on hard failure so route handlers surface a 500 with the resend error.
 */
async function sendModelEmail(templateKey, vars) {
  const result = await sendEmailFromTemplate(templateKey, vars);
  if (!result.ok) {
    const err = new Error(
      typeof result.error === "string" && result.error
        ? result.error
        : "Email send failed"
    );
    err.statusCode = 500;
    throw err;
  }
  return result;
}


export async function processModelCheckoutCompletedSession(session) {
  const metadata = session?.metadata || {};
  const preOrderId = metadata.pre_order_id || null;
  const customerEmail = String(metadata.customer_email || "").trim().toLowerCase();
  if (!preOrderId && !customerEmail) return;
  const paidAmount = toCurrencyCents(session?.amount_total ?? 0) / 100;
  const stripeSessionId = String(session?.id || "");
  const stripePaymentIntentId = String(session?.payment_intent || "");
  const nowIso = new Date().toISOString();

  const whereSql = preOrderId ? "id = $1" : "lower(customer_email) = $1 and stripe_session_id = $2";
  const whereArgs = preOrderId ? [preOrderId] : [customerEmail, stripeSessionId];
  const { rows } = await query(
    `select id, status, order_type, course_id, customer_email, customer_name, course_date, model_time_slot, treatment_type, course_title
     from public.pre_orders
     where ${whereSql}
     limit 1`,
    whereArgs
  );
  const row = rows[0];
  if (!row) return;
  if (String(row.order_type || "").toLowerCase() !== "model") return;

  await query(
    `update public.pre_orders
     set status = 'paid',
         payment_status = 'completed',
         amount_paid = $2,
         stripe_session_id = $3,
         stripe_payment_intent_id = $4,
         paid_at = coalesce(paid_at, $5::timestamptz),
         updated_at = now()
     where id = $1`,
    [row.id, paidAmount, stripeSessionId || null, stripePaymentIntentId || null, nowIso]
  );

  await enrichPaymentTransaction(
    {
      stripe_session_id: stripeSessionId || null,
      stripe_payment_intent_id: stripePaymentIntentId || null,
      pre_order_id: row.id
    },
    {
      payment_status: "succeeded",
      amount_paid: paidAmount,
      amount_total: paidAmount,
      stripe_payment_intent_id: stripePaymentIntentId || null,
      stripe_customer_id: session?.customer ? String(session.customer) : null,
      stripe_checkout_status: session?.status || null,
      stripe_payment_status: session?.payment_status || null,
      billing_name: session?.customer_details?.name || null,
      billing_email: session?.customer_details?.email || row.customer_email,
      billing_phone: session?.customer_details?.phone || null,
      billing_address: session?.customer_details?.address || null
    }
  );

  try {
    const formattedDate = fmtDateLocal(row.course_date);
    await sendModelEmail("model_booking_confirmed", {
      to: row.customer_email,
      first_name: String(row.customer_name || "there").split(/\s+/)[0],
      course_title: row.course_title || "NOVI Training Course",
      course_date_label: formattedDate,
      time_label: row.model_time_slot ? fmtTimeLabel(row.model_time_slot) : "",
      treatment_label: treatmentLabel(row.treatment_type),
      details: [
        row.course_title ? { label: "Course", value: row.course_title } : null,
        { label: "Date", value: formattedDate },
        row.model_time_slot ? { label: "Time", value: fmtTimeLabel(row.model_time_slot) } : null,
        row.treatment_type ? { label: "Treatment", value: treatmentLabel(row.treatment_type) } : null,
      ].filter(Boolean),
      summary_lines: [
        "Good Faith Exam (link sent separately)",
        row.treatment_type === "tox"
          ? "20 Units of Botox"
          : row.treatment_type === "filler"
            ? "1 Syringe of Filler"
            : "20 units of Botox or 1 syringe of Filler",
        "Supervised by a licensed Medical Director",
      ],
    });
    await query(
      `update public.pre_orders
       set confirmation_email_sent = true,
           confirmation_email_sent_at = now(),
           updated_at = now()
       where id = $1`,
      [row.id]
    );
  } catch {
    // best effort
  }
}

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

async function requireAdminOrStaffModelSignups(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    if (hasAdminAccess(me?.role) || hasStaffModuleAccess(me, "AdminModelSignups")) {
      req.me = me;
      return next();
    }
    return res.status(403).json({ error: "Forbidden." });
  } catch (error) {
    return res.status(error?.statusCode || 401).json({ error: error?.message || "Unauthorized." });
  }
}

function isModelPreOrderEligibleForPublicGfe(row) {
  if (!row || String(row.order_type || "").toLowerCase() !== "model") return false;
  const status = String(row.status || "").toLowerCase();
  const paymentStatus = String(row.payment_status || "").toLowerCase();
  if (["cancelled", "rejected"].includes(status)) return false;
  if (["paid", "confirmed", "completed"].includes(status)) return true;
  if (["completed", "succeeded", "paid"].includes(paymentStatus)) return true;
  if (row.paid_at) return true;
  // Stripe success redirect can beat the webhook — allow a short pending window for the matching signup.
  if (status === "pending" && row.created_at) {
    const ageMs = Date.now() - new Date(row.created_at).getTime();
    if (ageMs >= 0 && ageMs < 2 * 60 * 60 * 1000) return true;
  }
  return false;
}

async function loadModelPreOrderForPublicGfe({ pre_order_id, customer_email }) {
  const id = String(pre_order_id || "").trim();
  const email = String(customer_email || "").trim().toLowerCase();
  if (!id || !email) return null;
  const { rows } = await query(
    `select id, order_type, status, payment_status, paid_at, created_at,
            customer_email, customer_name, phone, course_id, treatment_type, date_of_birth
     from public.pre_orders
     where id = $1
     limit 1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  if (String(row.customer_email || "").trim().toLowerCase() !== email) return null;
  if (!isModelPreOrderEligibleForPublicGfe(row)) return null;
  return row;
}

/** Admin/staff, or model who just paid (pre_order_id + email on the booking). */
async function requireAdminOrStaffModelSignupsOrPaidModel(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (token) {
      try {
        const me = await getMeFromAccessToken(token);
        if (hasAdminAccess(me?.role) || hasStaffModuleAccess(me, "AdminModelSignups")) {
          req.me = me;
          return next();
        }
      } catch {
        /* fall through to paid-model check */
      }
    }
    const body = req.body || {};
    const preOrder = await loadModelPreOrderForPublicGfe({
      pre_order_id: body.pre_order_id,
      customer_email: body.customer_email,
    });
    if (!preOrder) {
      return res.status(403).json({
        error: "Unable to verify this booking. Use the same email you paid with and try again in a moment.",
      });
    }
    req.modelPreOrder = preOrder;
    return next();
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ error: error?.message || "Request failed." });
  }
}

async function requireAdminOrStaffCompliance(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    if (hasAdminAccess(me?.role) || hasStaffModuleAccess(me, "AdminCompliance")) {
      req.me = me;
      return next();
    }
    return res.status(403).json({ error: "Forbidden." });
  } catch (error) {
    return res.status(error?.statusCode || 401).json({ error: error?.message || "Unauthorized." });
  }
}

async function requireCronOrAdminCompliance(req, res, next) {
  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  if (cronSecret) {
    const auth = String(req.headers.authorization || "").trim();
    if (auth === `Bearer ${cronSecret}`) return next();
  }
  return requireAdminOrStaffCompliance(req, res, next);
}

async function requireCronOrAdminModelSignups(req, res, next) {
  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  if (cronSecret) {
    const auth = String(req.headers.authorization || "").trim();
    if (auth === `Bearer ${cronSecret}`) return next();
  }
  return requireAdminOrStaffModelSignups(req, res, next);
}

functionsRouter.post("/validateBookingScope", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ eligible: false, reason: "Missing bearer token." });
    await getMeFromAccessToken(token);

    const body = req.body || {};
    const providerId = String(body.provider_id || body.providerId || "").trim();
    const service = String(body.service || "").trim();
    const referralCode = String(body.referral_code || body.referralCode || "").trim();
    const validation = await validateBookingScope({
      providerId,
      service,
      referral_code: referralCode || undefined,
    });
    return res.json(validation);
  } catch (error) {
    return next(error);
  }
});

// Backward-compatible alias used by some older clients.
functionsRouter.post("/validateScopeEligibility", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ eligible: false, reason: "Missing bearer token." });
    await getMeFromAccessToken(token);

    const body = req.body || {};
    const providerId = String(body.provider_id || body.providerId || "").trim();
    const service = String(body.service || "").trim();
    const referralCode = String(body.referral_code || body.referralCode || "").trim();
    const validation = await validateBookingScope({
      providerId,
      service,
      referral_code: referralCode || undefined,
    });
    return res.json(validation);
  } catch (error) {
    return next(error);
  }
});

function parseClassDateTime(dateValue, timeValue, fallbackHour, fallbackMinute) {
  if (!dateValue) return null;
  const date = String(dateValue).slice(0, 10);
  const time = String(timeValue || "").trim();
  const [hhRaw, mmRaw] = time.split(":");
  const hh = Number.isFinite(Number(hhRaw)) ? Number(hhRaw) : fallbackHour;
  const mm = Number.isFinite(Number(mmRaw)) ? Number(mmRaw) : fallbackMinute;
  return zonedDateTimeToUtc(date, hh, mm, "Etc/GMT+5");
}

function getPartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second)
  };
}

function zonedDateTimeToUtc(dateString, hour, minute, timeZone) {
  const [yearRaw, monthRaw, dayRaw] = String(dateString || "").slice(0, 10).split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!year || !month || !day) return null;

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const tzParts = getPartsInTimeZone(utcGuess, timeZone);
  const asIfUtc = Date.UTC(
    tzParts.year,
    tzParts.month - 1,
    tzParts.day,
    tzParts.hour,
    tzParts.minute,
    tzParts.second
  );
  const offsetMs = asIfUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

function toDateOnly(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return raw.slice(0, 10);
}

function isWithinRedeemWindow(sessionDate, sessionDates) {
  const dateOnly = toDateOnly(sessionDate);
  if (!dateOnly) return false;
  const config = Array.isArray(sessionDates)
    ? sessionDates.find((entry) => toDateOnly(entry?.date) === dateOnly)
    : null;
  const startAt = parseClassDateTime(dateOnly, config?.start_time, 0, 0);
  const endAt = parseClassDateTime(dateOnly, config?.end_time, 23, 59);
  if (!startAt || !endAt) return { ok: false, startAt: null, endAt: null, expiresAt: null, now: new Date() };
  const expiresAt = new Date(endAt.getTime() + (24 * 60 * 60 * 1000));
  const now = new Date();
  return { ok: now >= startAt && now <= expiresAt, startAt, endAt, expiresAt, now };
}

async function createCertificationsForEnrollment(enrollment, course, me) {
  const awarded = Array.isArray(course?.certifications_awarded) ? course.certifications_awarded : [];
  if (!awarded.length) return [];
  if (!certificationColumnsPromise) {
    certificationColumnsPromise = query(
      `select column_name
       from information_schema.columns
       where table_schema = 'public' and table_name = 'certification'`
    )
      .then((r) => new Set((r.rows || []).map((row) => String(row.column_name || "").toLowerCase())))
      .catch(() => new Set());
  }
  const certificationColumns = await certificationColumnsPromise;
  const hasColumn = (name) => certificationColumns.has(String(name || "").toLowerCase());
  // If certification table is still template-only schema, skip runtime issuance
  // instead of failing class-code redemption.
  if (!hasColumn("provider_id") && hasColumn("template_course_id")) return [];

  const created = [];
  for (const cert of awarded) {
    const certificationName =
      String(cert?.cert_name || cert?.service_type_name || course?.certification_name || course?.title || "Course Certification").trim();
    if (!certificationName) continue;
    try {
      const valuesByColumn = {
        provider_id: String(me.id || "") || null,
        provider_email: String(me.email || "").toLowerCase() || null,
        provider_name: String(me.full_name || "").trim() || null,
        enrollment_id: enrollment?.id || null,
        course_id: course?.id || null,
        certification_name: certificationName,
        cert_name: certificationName,
        issued_by: course?.title || "NOVI Class",
        category: cert?.category || course?.category || "class_completion",
        status: "active",
        issued_at: new Date().toISOString(),
        service_type_id: cert?.service_type_id || null,
        service_type_name: cert?.service_type_name || null
      };
      if (hasColumn("certificate_number")) {
        valuesByColumn.certificate_number = `NOVI-${Date.now()}`;
      }
      const insertColumns = Object.keys(valuesByColumn).filter((col) => hasColumn(col));
      if (insertColumns.length === 0) continue;
      const insertValues = insertColumns.map((col) => valuesByColumn[col]);
      const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(", ");
      const returningNameColumn = hasColumn("certification_name") ? "certification_name" : (hasColumn("cert_name") ? "cert_name" : null);
      const sql = `insert into public.certification (${insertColumns.join(", ")}) values (${placeholders})${returningNameColumn ? ` returning ${returningNameColumn}` : ""}`;
      const { rows } = await query(sql, insertValues);
      if (returningNameColumn && rows?.[0]?.[returningNameColumn]) {
        created.push(rows[0][returningNameColumn]);
      }
    } catch {
      // Do not fail code redemption because optional certification write failed.
    }
  }

  return created;
}

/**
 * Stripe Checkout for recurring MD Board coverage, or immediate success when amount is $0.
 * Success return URL must match ProviderCredentialsCoverage Stripe handler (?md_payment_status=success&service_type_id=...).
 */
functionsRouter.post("/previewMdBoardContract", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    if (String(me.role || "").trim().toLowerCase() !== "provider") {
      return res.status(403).json({ success: false, error: "Only providers can preview MD coverage contracts." });
    }

    const serviceTypeId = String(req.body?.service_type_id || "").trim();
    if (!serviceTypeId) {
      return res.status(400).json({ success: false, error: "service_type_id is required." });
    }

    const bytes = await buildFilledContractPreviewBytes({
      serviceTypeId,
      providerId: me.id,
      providerName: me.full_name,
      serviceTypeName: String(req.body?.service_type_name || "").trim(),
    });
    if (!bytes) {
      return res.json({ success: false, error: "No MD contract is available for this service yet." });
    }

    return res.json({
      success: true,
      pdf_base64: Buffer.from(bytes).toString("base64"),
      content_type: "application/pdf",
    });
  } catch (error) {
    return next(error);
  }
});

/** Provider token context (name/practice/state/address) for the rendered MD agreement. */
functionsRouter.post("/mdAgreementContext", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    if (String(me.role || "").trim().toLowerCase() !== "provider") {
      return res.status(403).json({ success: false, error: "Only providers can load MD coverage agreements." });
    }
    const context = await getProviderAgreementContext(me.id, {
      providerNameOverride: me.full_name,
      profileSnapshot: me,
    });
    return res.json({ success: true, context });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/createMDSubscriptionCheckout", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const body = req.body || {};
    const serviceTypeId = String(body.service_type_id || "").trim();
    const serviceTypeName = String(body.service_type_name || "MD Board Coverage").trim() || "MD Board Coverage";
    const enrollmentId = body.enrollment_id != null ? String(body.enrollment_id).trim() : "";

    if (!serviceTypeId) {
      return res.status(400).json({ success: false, error: "service_type_id is required." });
    }

    const signatureData = body.signature_data != null ? String(body.signature_data) : null;

    if (String(me.role || "").trim().toLowerCase() !== "provider") {
      return res.status(403).json({ success: false, error: "Only providers can activate MD coverage." });
    }

    if (!signatureData || !/^data:image\/(png|jpeg|jpg);base64,/i.test(signatureData)) {
      return res.status(400).json({
        success: false,
        error: "Please sign the MD agreement on the signature pad before continuing.",
      });
    }

    const { rows: activeOtherRows } = await query(
      `select id from public.md_subscription
       where provider_id = $1
         and lower(coalesce(status, '')) = 'active'
         and coalesce(service_type_id::text, '') <> $2`,
      [me.id, serviceTypeId]
    );
    const activeOtherCount = activeOtherRows?.length || 0;
    const monthlyFeeUsd = resolveMdCoverageMonthlyFee({
      providerId: me.id,
      providerEmail: me.email,
      activeServiceCountBeforeAdd: activeOtherCount,
    });
    const amountCents = Math.round(monthlyFeeUsd * 100);

    if (
      isMdCoverageTestPricingEnabled() &&
      isAllowlistedMdCoverageTestProvider(me.id, me.email)
    ) {
      // eslint-disable-next-line no-console
      console.info(
        `[md-coverage] test pricing applied for ${me.email}: $${monthlyFeeUsd}/mo (client sent amount=${body.amount})`
      );
    }

    if (amountCents <= 0) {
      const result = await finalizeMdBoardCoverage({
        providerId: me.id,
        providerEmail: me.email,
        providerName: me.full_name,
        serviceTypeId,
        serviceTypeName,
        enrollmentId: enrollmentId || null,
        signatureData,
        signedByName: me.full_name,
      });
      if (!result.ok) {
        return res.status(400).json({ success: false, error: result.error || "Unable to activate MD coverage." });
      }
      return res.json({ success: true, ...result });
    }

    if (!stripe) {
      return res.status(500).json({
        success: false,
        error: "Stripe is not configured. Set STRIPE_SECRET_KEY or use $0 activation."
      });
    }

    const pending = await createPendingMdSubscriptionForCheckout({
      providerId: me.id,
      providerEmail: me.email,
      providerName: me.full_name,
      serviceTypeId,
      serviceTypeName,
      enrollmentId: enrollmentId || null,
      signatureData,
      signedByName: me.full_name,
      monthlyFee: monthlyFeeUsd,
    });

    const signedContractUrl = await ensureSignedContractForSubscription(pending, {
      signatureData,
      signedByName: me.full_name,
    });

    const base = resolveAppBaseUrl(req).replace(/\/$/, "");
    const successParams = new URLSearchParams({
      md_payment_status: "success",
      service_type_id: serviceTypeId,
      tab: "documents",
    });
    if (enrollmentId) successParams.set("enrollment_id", enrollmentId);
    const successUrl = `${base}/ProviderCredentialsCoverage?${successParams.toString()}`;
    const cancelUrl = `${base}/ProviderCredentialsCoverage?md_payment_status=cancel&service_type_id=${encodeURIComponent(serviceTypeId)}`;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: me.email || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        checkout_type: "md_board_coverage",
        md_subscription_id: String(pending.id || ""),
        provider_auth_user_id: String(me.id || ""),
        service_type_id: serviceTypeId,
        enrollment_id: enrollmentId || ""
      },
      subscription_data: {
        metadata: {
          checkout_type: "md_board_coverage",
          md_subscription_id: String(pending.id || ""),
          provider_auth_user_id: String(me.id || ""),
          service_type_id: serviceTypeId,
          enrollment_id: enrollmentId || ""
        }
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            recurring: { interval: "month" },
            product_data: {
              name: `NOVI MD Board Coverage — ${serviceTypeName}`,
              description: "Monthly NOVI Board medical director supervision membership"
            }
          }
        }
      ]
    });

    await attachCheckoutSessionToMdSubscription(pending.id, checkoutSession.id);

    const url = checkoutSession?.url;
    if (!url) {
      return res.status(500).json({ success: false, error: "Checkout session did not return a URL." });
    }
    return res.json({
      success: true,
      url,
      signed_contract_url: signedContractUrl || pending.signed_contract_url || null,
      md_subscription_id: pending.id,
      service_type_id: serviceTypeId,
      service_type_name: serviceTypeName,
      checkout_amount_usd: monthlyFeeUsd,
    });
  } catch (error) {
    return next(error);
  }
});

/** Provider cancel: DB + admin email only. Stripe must be cancelled manually in dashboard. */
functionsRouter.post("/cancelMDSubscription", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const role = String(me.role || "").toLowerCase();
    if (role !== "provider" && !hasAdminAccess(me.role)) {
      return res.status(403).json({ success: false, error: "Forbidden." });
    }
    const subscriptionId = String(req.body?.subscription_id || "").trim();
    if (!subscriptionId) {
      return res.status(400).json({ success: false, error: "subscription_id is required." });
    }
    const { requestProviderMdSubscriptionCancel } = await import(
      "../mdSubscriptionProviderCancel.js"
    );
    const result = await requestProviderMdSubscriptionCancel({
      subscriptionId,
      providerId: me.id,
      reason: req.body?.reason || null,
      notes: req.body?.notes || null,
    });
    if (!result.success) {
      return res.status(result.error === "Forbidden." ? 403 : 400).json(result);
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

/**
 * Read-only preview: who would be chosen next for `service_type_id` (does **not** advance round-robin).
 * Assignment + pointer advance happens only in `submitMdBoardCoverageAssignment`.
 */
functionsRouter.post("/pickMedicalDirectorForService", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing bearer token." });
    await getMeFromAccessToken(token);
    const serviceTypeId = String(req.body?.service_type_id || "").trim();
    if (!serviceTypeId) {
      return res.status(400).json({ ok: false, error: "service_type_id is required." });
    }

    const eligible = await listEligibleMedicalDirectorsForService(serviceTypeId);
    const n = eligible.length;
    if (n === 0) {
      return res.json({
        ok: false,
        error:
          "No medical director is eligible for this service. Each Board MD must list supported services (MD dashboard → Services I cover). For local dev only, set MD_ASSIGNMENT_POOL_FALLBACK=1.",
      });
    }

    const { rows: curRows } = await query(
      `select seq from public.md_assignment_round_robin where service_type_id = $1 limit 1`,
      [serviceTypeId]
    );
    const s = curRows?.[0] ? Number(curRows[0].seq) : 0;
    const idx = s % n;
    const chosen = eligible[idx];
    return res.json({
      ok: true,
      preview: true,
      medical_director_id: chosen.id,
      medical_director_email: chosen.email || "",
      medical_director_name: chosen.full_name || chosen.email || "",
      assignment_index: idx,
      eligible_count: n,
      service_type_id: serviceTypeId,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Provider-only: activate MD subscription + run assignment (Stripe return backup or paid webhook gap).
 */
functionsRouter.post("/finalizeMdBoardCoverage", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    if (String(me.role || "").trim().toLowerCase() !== "provider") {
      return res.status(403).json({ success: false, error: "Only providers can finalize MD coverage." });
    }
    const body = req.body || {};
    const serviceTypeId = String(body.service_type_id || "").trim();
    if (!serviceTypeId) {
      return res.status(400).json({ success: false, error: "service_type_id is required." });
    }
    const result = await finalizeMdBoardCoverage({
      providerId: me.id,
      providerEmail: me.email,
      providerName: me.full_name,
      serviceTypeId,
      serviceTypeName: String(body.service_type_name || "").trim(),
      enrollmentId: body.enrollment_id != null ? String(body.enrollment_id).trim() : null,
      signatureData: body.signature_data != null ? String(body.signature_data) : null,
      signedByName: me.full_name,
    });
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error || "Unable to activate MD coverage." });
    }
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
});

/**
 * Provider-only: after MD coverage agreement + subscription, run assignment engine (service match →
 * optional state filter → round-robin), create pending relationship + coverage request, notify MD.
 */
functionsRouter.post("/submitMdBoardCoverageAssignment", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const role = String(me.role || "").trim().toLowerCase();
    if (role !== "provider") {
      return res.status(403).json({ ok: false, error: "Only providers can submit MD coverage assignment." });
    }
    const serviceTypeId = String(req.body?.service_type_id || "").trim();
    if (!serviceTypeId) {
      return res.status(400).json({ ok: false, error: "service_type_id is required." });
    }
    const serviceTypeName = String(req.body?.service_type_name || "").trim();
    const result = await submitMdBoardCoverageAssignment({
      providerId: me.id,
      providerEmail: me.email,
      providerName: me.full_name,
      providerState: me.state || null,
      serviceTypeId,
      serviceTypeName,
    });
    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/redeemClassCode", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    const sessionCode = String(req.body?.session_code || "").trim().toUpperCase();
    const selectedCourseId = String(req.body?.selected_course_id || "").trim();
    const selectedSessionDate = String(req.body?.selected_session_date || "").trim().slice(0, 10);
    if (sessionCode.length !== 6) {
      return res.status(400).json({ success: false, error: "Class code must be 6 characters." });
    }

    const sessionQueryParts = [
      `select *`,
      `from public.class_session`,
      `where upper(session_code) = $1`
    ];
    const params = [sessionCode];
    if (selectedCourseId) {
      params.push(selectedCourseId);
      sessionQueryParts.push(`and course_id::text = $${params.length}`);
    }
    if (selectedSessionDate) {
      params.push(selectedSessionDate);
      sessionQueryParts.push(`and session_date::date = $${params.length}::date`);
    }
    sessionQueryParts.push(`order by created_date desc limit 1`);
    const { rows: sessionRows } = await query(sessionQueryParts.join("\n"), params);
    const session = sessionRows[0];
    if (!session) return res.status(404).json({ success: false, error: "Invalid class code." });
    if (session.code_used) return res.status(400).json({ success: false, error: "This class code was already redeemed." });

    const normalizedSessionDate = selectedSessionDate || toDateOnly(session.session_date);
    const { rows: userRows } = await query(
      `select id, email
       from public.users
       where auth_user_id = $1
       limit 1`,
      [me.id]
    );
    const appUserId = String(userRows?.[0]?.id || "");
    const appUserEmail = String(userRows?.[0]?.email || "").toLowerCase();
    let enrollment = null;
    let preorder = null;
    if (session.enrollment_id && !String(session.enrollment_id).startsWith("class_date:")) {
      const { rows } = await query(
        `select *
         from public.enrollments
         where id = $1
         limit 1`,
        [session.enrollment_id]
      );
      enrollment = rows[0] || null;
    } else {
      const { rows } = await query(
        `select *
         from public.enrollments
         where course_id = $1
           and (
             ($2::date is not null and (session_date::date = $2::date or session_date is null))
             or ($2::date is null)
           )
           and (
             provider_id::text = $3
             or provider_id::text = $4
             or lower(coalesce(provider_email, '')) = lower($5)
             or lower(coalesce(provider_email, '')) = lower($6)
           )
         order by created_at desc nulls last
         limit 1`,
        [
          session.course_id,
          normalizedSessionDate,
          String(me.id || ""),
          appUserId || "__no_app_user__",
          me.email || "",
          appUserEmail || "__no_app_email__",
        ]
      );
      enrollment = rows[0] || null;
    }

    if (!enrollment) {
      const { rows: preorderRows } = await query(
        `select *
         from public.pre_orders
         where (
             lower(coalesce(order_type, '')) = 'course'
             or lower(coalesce(type, '')) = 'course'
           )
           and course_id = $1
           and (
             lower(coalesce(customer_email, '')) = lower($2)
             or lower(coalesce(customer_email, '')) = lower($3)
           )
           and status in ('paid', 'confirmed', 'completed')
           and (
             ($4::date is not null and (course_date::date = $4::date or course_date is null))
             or ($4::date is null)
           )
         order by created_at desc nulls last
         limit 1`,
        [session.course_id, me.email || "", appUserEmail || "", normalizedSessionDate || null]
      );
      preorder = preorderRows[0] || null;
    }

    // Fallback: some historical records have mismatched/missing session_date linkage.
    // In that case, accept course-level ownership for this provider.
    if (!enrollment) {
      const { rows: looseEnrollmentRows } = await query(
        `select *
         from public.enrollments
         where course_id = $1
           and (
             provider_id::text = $2
             or provider_id::text = $3
             or lower(coalesce(provider_email, '')) = lower($4)
             or lower(coalesce(provider_email, '')) = lower($5)
           )
           and lower(coalesce(status, '')) in ('paid', 'confirmed', 'completed', 'attended')
         order by created_at desc nulls last
         limit 1`,
        [
          session.course_id,
          String(me.id || ""),
          appUserId || "__no_app_user__",
          me.email || "",
          appUserEmail || "__no_app_email__",
        ]
      );
      enrollment = looseEnrollmentRows[0] || null;
    }
    if (!preorder) {
      const { rows: loosePreorderRows } = await query(
        `select *
         from public.pre_orders
         where (
             lower(coalesce(order_type, '')) = 'course'
             or lower(coalesce(type, '')) = 'course'
           )
           and course_id = $1
           and (
             lower(coalesce(customer_email, '')) = lower($2)
             or lower(coalesce(customer_email, '')) = lower($3)
           )
           and status in ('paid', 'confirmed', 'completed')
         order by created_at desc nulls last
         limit 1`,
        [session.course_id, me.email || "", appUserEmail || ""]
      );
      preorder = loosePreorderRows[0] || null;
    }
    const meId = String(me.id || "");
    const meAppId = String(appUserId || "");
    const meEmail = String(me.email || "").toLowerCase();
    const meEmails = new Set([meEmail, appUserEmail].filter(Boolean));
    const sessionProviderId = String(session.provider_id || "");
    const sessionProviderEmail = String(session.provider_email || "").toLowerCase();
    const sessionOwnershipMatch =
      (sessionProviderId && (sessionProviderId === meId || sessionProviderId === meAppId)) ||
      (sessionProviderEmail && meEmails.has(sessionProviderEmail));

    if (!enrollment && !preorder && !sessionOwnershipMatch) {
      return res.status(403).json({ success: false, error: "This code is not assigned to your enrollment." });
    }
    if (!enrollment && preorder) {
      enrollment = {
        id: `preorder:${preorder.id}`,
        provider_id: me.id || null,
        provider_email: me.email || preorder.customer_email || null,
        provider_name: me.full_name || preorder.customer_name || null,
        course_id: preorder.course_id,
        session_date: preorder.course_date || normalizedSessionDate || null,
        status: preorder.status
      };
    }

    const enrollmentProviderId = String(enrollment?.provider_id || "");
    const enrollmentProviderEmail = String(enrollment?.provider_email || "").toLowerCase();
    const enrollmentOwnershipMatch =
      (enrollmentProviderId && (enrollmentProviderId === meId || enrollmentProviderId === meAppId)) ||
      (enrollmentProviderEmail && meEmails.has(enrollmentProviderEmail));
    const preorderOwnershipMatch = Boolean(preorder);
    if (!sessionOwnershipMatch && !enrollmentOwnershipMatch && !preorderOwnershipMatch) {
      return res.status(403).json({ success: false, error: "This code is not assigned to your enrollment." });
    }

    const { rows: courseRows } = await query(
      `select id, title, category, certifications_awarded, session_dates
       from public.scheduled_courses
       where id = $1
       limit 1`,
      [session.course_id]
    );
    const course = courseRows[0] || null;
    if (!course) return res.status(404).json({ success: false, error: "Course not found for this class code." });
    const effectiveSessionDate = normalizedSessionDate || toDateOnly(enrollment?.session_date);
    const windowCheck = isWithinRedeemWindow(effectiveSessionDate, course.session_dates);
    if (!windowCheck.ok) {
      return res.status(400).json({
        success: false,
        error: "This code is only valid from class start time until 24 hours after class end.",
        debug_window: {
          now: windowCheck.now?.toISOString?.() || null,
          start_at: windowCheck.startAt?.toISOString?.() || null,
          end_at: windowCheck.endAt?.toISOString?.() || null,
          expires_at: windowCheck.expiresAt?.toISOString?.() || null,
          selected_course_id: selectedCourseId || null,
          selected_session_date: selectedSessionDate || null,
          matched_course_id: session?.course_id || null,
          matched_session_date: toDateOnly(session?.session_date) || null,
          effective_session_date: effectiveSessionDate || null
        }
      });
    }

    await query(
      `update public.class_session
       set code_used = true, code_used_at = now()
       where id = $1`,
      [session.id]
    );

    if (!String(enrollment.id || "").startsWith("preorder:")) {
      await query(
        `update public.enrollments
         set status = 'attended'
         where id = $1`,
        [enrollment.id]
      );
      try {
        const { rows: issuedCertRows } = await query(
          `select id
           from public.certification
           where enrollment_id::text = $1
             and lower(coalesce(status, '')) = 'active'
           limit 1`,
          [String(enrollment.id)]
        );
        if (!issuedCertRows[0]) {
          void notifyAdminsOfPendingCourseCertIssuance({
            enrollmentId: enrollment.id,
            providerName: enrollment.provider_name || me.full_name || null,
            providerEmail: enrollment.provider_email || me.email || null,
            courseTitle: course.title || session.course_title || null,
            courseId: session.course_id || enrollment.course_id || null,
          });
        }
      } catch {
        // best effort
      }
    }

    return res.json({
      success: true,
      session_id: session.id,
      enrollment_id: String(enrollment.id || ""),
      course_title: session.course_title || course.title,
      session_date: effectiveSessionDate || String(session.session_date || "").slice(0, 10),
      certifications: []
    });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/validateModelPromo", async (req, res, next) => {
  try {
    const promoCode = String(req.body?.promo_code || "").trim().toUpperCase();
    if (!promoCode) return res.status(400).json({ valid: false, error: "Promo code is required." });
    const hasAppliesTo = await hasCoursePromoColumn("applies_to");
    const hasMaxUses = await hasCoursePromoColumn("max_uses");
    const hasTimesUsed = await hasCoursePromoColumn("times_used");
    const hasMaxRedemptions = await hasCoursePromoColumn("max_redemptions");
    const hasRedemptionCount = await hasCoursePromoColumn("redemption_count");
    const maxUsesSql = hasMaxUses ? "max_uses" : (hasMaxRedemptions ? "max_redemptions" : "null");
    const timesUsedSql = hasTimesUsed ? "times_used" : (hasRedemptionCount ? "redemption_count" : "0");
    const appliesWhere = hasAppliesTo ? "and coalesce(applies_to, 'course') = 'model'" : "";
    const { rows } = await query(
      `select id, code, discount_type, discount_value, active,
              starts_at, ends_at,
              ${maxUsesSql} as max_uses,
              ${timesUsedSql} as times_used
       from public.course_promo_codes
       where upper(code) = $1
         ${appliesWhere}
       limit 1`,
      [promoCode]
    );
    const promo = rows[0];
    if (!promo || !promo.active) return res.json({ valid: false, error: "Invalid promo code." });
    const now = new Date();
    if (promo.starts_at && new Date(promo.starts_at) > now) return res.json({ valid: false, error: "Promo is not active yet." });
    if (promo.ends_at && new Date(promo.ends_at) < now) return res.json({ valid: false, error: "Promo code has expired." });
    const hasPromoLimit =
      promo.max_uses !== null &&
      promo.max_uses !== undefined &&
      String(promo.max_uses).trim() !== "";
    if (hasPromoLimit && Number(promo.times_used || 0) >= Number(promo.max_uses)) {
      return res.json({ valid: false, error: "Promo code has reached its limit." });
    }
    const baseCents = 5000; // model signup price in cents ($50).
    let discountCents = 0;
    if (["percentage", "percent"].includes(String(promo.discount_type || "").toLowerCase())) {
      discountCents = Math.round((baseCents * Number(promo.discount_value || 0)) / 100);
    } else {
      discountCents = Math.round(Number(promo.discount_value || 0) * 100);
    }
    const finalCents = Math.max(0, baseCents - discountCents);
    return res.json({
      valid: true,
      promo_code_id: promo.id,
      discount_type: promo.discount_type,
      discount_value: Number(promo.discount_value || 0),
      discount_cents: discountCents,
      final_cents: finalCents
    });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/createModelCheckout", async (req, res, next) => {
  const body = req.body || {};
  const serverReceivedAt = new Date().toISOString();
  const clientTimestamp =
    req.get("x-novi-client-timestamp") ||
    body.client_timestamp ||
    null;
  const trackingSourceOrigin = req.get("origin") || req.get("referer") || null;
  const trackingRequestIp = (() => {
    const forwarded = req.get("x-forwarded-for");
    if (forwarded) return String(forwarded).split(",")[0].trim();
    return req.ip || req.socket?.remoteAddress || null;
  })();
  const trackingUserAgent = req.get("user-agent") || null;
  const trackingSourceContext =
    req.get("x-novi-source-context") || body.source_context || "model_signup";

  const customerEmail = String(body.customer_email || "").trim().toLowerCase();
  const customerName = String(body.customer_name || "").trim();
  const phone = String(body.phone || "").trim();
  const courseId = String(body.course_id || "").trim();
  const courseDate = String(body.course_date || "").slice(0, 10);
  const timeSlot = String(body.time_slot || "").trim();
  let isWaitlist = Boolean(body.is_waitlist);
  const treatmentType = String(body.treatment_type || "").trim();

  // STEP 1 — Always log the attempt with the exact payload, before any
  // validation. This guarantees a row exists in payment_transactions even if
  // the request is rejected due to bad input, sold-out slots, etc.
  const attemptId = await recordCheckoutInitiated({
    payment_flow: PAYMENT_FLOW.MODEL,
    payment_type: "model",
    selected_item_id: body.course_id != null ? String(body.course_id) : null,
    customer_email: customerEmail || (body.customer_email ? String(body.customer_email) : null),
    customer_name: customerName || null,
    customer_phone: phone || null,
    source_context: trackingSourceContext,
    source_origin: trackingSourceOrigin,
    request_ip: trackingRequestIp,
    user_agent: trackingUserAgent,
    client_timestamp: clientTimestamp,
    server_received_timestamp: serverReceivedAt,
    request_payload_snapshot: body,
    metadata: {
      treatment_type: treatmentType || null,
      time_slot: timeSlot || null,
      course_date: courseDate || null,
      is_waitlist: isWaitlist
    }
  });

  try {
    if (!stripe) {
      const e = new Error("Stripe is not configured.");
      e.statusCode = 500;
      throw e;
    }
    if (!customerEmail || !customerName || !phone || !courseId || !courseDate || !treatmentType) {
      const e = new Error("Missing required fields.");
      e.statusCode = 400;
      throw e;
    }
    if (!isWaitlist && !timeSlot) {
      const e = new Error("time_slot is required unless waitlisted.");
      e.statusCode = 400;
      throw e;
    }

    const { rows: courseRows } = await query(
      `select id, title, session_dates, location, is_active
       from public.scheduled_courses
       where id = $1
       limit 1`,
      [courseId]
    );
    const course = courseRows[0];
    if (!course || course.is_active === false) {
      const e = new Error("Course not found.");
      e.statusCode = 404;
      throw e;
    }

    if (!isWaitlist) {
      const { rows: capRows } = await query(
        `select
           count(*) filter (
             where lower(coalesce(status,'')) not in ('cancelled', 'rejected')
           ) as total_count,
           count(*) filter (
             where model_time_slot = $3 and lower(coalesce(status,'')) not in ('cancelled', 'rejected')
           ) as slot_count
         from public.pre_orders
         where order_type = 'model'
           and course_id = $1
           and course_date::date = $2::date`,
        [courseId, courseDate, timeSlot]
      );
      const totalCount = Number(capRows?.[0]?.total_count || 0);
      const slotCount = Number(capRows?.[0]?.slot_count || 0);
      // Auto-push to waitlist when full so user flow is never blocked.
      if (totalCount >= 8 || slotCount >= 2) {
        isWaitlist = true;
      }
    }

    let promo = null;
    if (body.promo_code) {
      const code = String(body.promo_code).trim().toUpperCase();
      const hasAppliesTo = await hasCoursePromoColumn("applies_to");
      const hasMaxUses = await hasCoursePromoColumn("max_uses");
      const hasTimesUsed = await hasCoursePromoColumn("times_used");
      const hasMaxRedemptions = await hasCoursePromoColumn("max_redemptions");
      const hasRedemptionCount = await hasCoursePromoColumn("redemption_count");
      const maxUsesSql = hasMaxUses ? "max_uses" : (hasMaxRedemptions ? "max_redemptions" : "null");
      const timesUsedSql = hasTimesUsed ? "times_used" : (hasRedemptionCount ? "redemption_count" : "0");
      const appliesWhere = hasAppliesTo ? "and coalesce(applies_to, 'course') = 'model'" : "";
      const { rows: promoRows } = await query(
        `select id, code, discount_type, discount_value, active, starts_at, ends_at,
                ${maxUsesSql} as max_uses,
                ${timesUsedSql} as times_used
         from public.course_promo_codes
         where upper(code) = $1
           ${appliesWhere}
         limit 1`,
        [code]
      );
      promo = promoRows[0] || null;
      if (promo && (!promo.active || (promo.starts_at && new Date(promo.starts_at) > new Date()) || (promo.ends_at && new Date(promo.ends_at) < new Date()))) {
        promo = null;
      }
      const hasPromoLimit =
        promo &&
        promo.max_uses !== null &&
        promo.max_uses !== undefined &&
        String(promo.max_uses).trim() !== "";
      if (hasPromoLimit && Number(promo.times_used || 0) >= Number(promo.max_uses)) {
        promo = null;
      }
    }

    const baseCents = 5000; // model signup price in cents ($50).
    let discountCents = 0;
    if (promo) {
      discountCents = String(promo.discount_type || "").toLowerCase() === "percentage"
        ? Math.round((baseCents * Number(promo.discount_value || 0)) / 100)
        : Math.round(Number(promo.discount_value || 0) * 100);
    }
    const finalCents = Math.max(0, baseCents - discountCents);

    const { rows: insertedRows } = await query(
      `insert into public.pre_orders (
         order_type, type, status, payment_status, course_id, course_title, course_date,
         customer_name, customer_email, phone, treatment_type, model_time_slot,
         is_waitlist, notes, date_of_birth, health_questions, promo_code_id, amount, amount_paid, created_at, updated_at
       ) values (
         'model', 'model', 'pending', 'pending', $1, $2, $3::date,
         $4, $5, $6, $7, $8, $9, $10, $11::date, $12::jsonb, $13, $14, 0, now(), now()
       ) returning id`,
      [
        courseId,
        course.title || "NOVI Training Course",
        courseDate,
        customerName,
        customerEmail,
        phone,
        treatmentType,
        isWaitlist ? null : (timeSlot || null),
        isWaitlist,
        String(body.notes || ""),
        body.date_of_birth ? String(body.date_of_birth).slice(0, 10) : null,
        JSON.stringify(body.health_questions && typeof body.health_questions === "object" ? body.health_questions : {}),
        promo?.id || null,
        finalCents / 100
      ]
    );
    const preOrderId = insertedRows[0]?.id;

    if (finalCents === 0) {
      await query(
        `update public.pre_orders
         set status = 'paid', payment_status = 'completed', amount_paid = $2, paid_at = now(), updated_at = now()
         where id = $1`,
        [preOrderId, 0]
      );
      await enrichPaymentTransaction(
        { id: attemptId },
        {
          pre_order_id: preOrderId,
          course_id: courseId,
          item_id: courseId,
          item_name: `${course.title || "NOVI Training Course"} - Model Signup`,
          amount_subtotal: 50,
          amount_discount: 50,
          amount_total: 0,
          amount_paid: 0,
          payment_status: "succeeded"
        }
      );
      await sendModelEmail("model_booking_confirmed", {
        to: customerEmail,
        first_name: String(customerName || "there").split(/\s+/)[0],
        course_title: course.title || "NOVI Training Course",
        course_date_label: fmtDateLocal(courseDate),
        time_label: timeSlot ? fmtTimeLabel(timeSlot) : "",
        treatment_label: treatmentLabel(treatmentType),
        details: [
          { label: "Course", value: course.title || "NOVI Training Course" },
          { label: "Date", value: fmtDateLocal(courseDate) },
          timeSlot ? { label: "Time", value: fmtTimeLabel(timeSlot) } : null,
          { label: "Treatment", value: treatmentLabel(treatmentType) },
        ].filter(Boolean),
        summary_lines: [
          "Good Faith Exam (link sent separately)",
          treatmentType === "tox"
            ? "20 Units of Botox"
            : treatmentType === "filler"
              ? "1 Syringe of Filler"
              : "20 units of Botox or 1 syringe of Filler",
          "Supervised by a licensed Medical Director",
        ],
      });
      return res.status(201).json({ free: true, pre_order_id: preOrderId, waitlist_auto: isWaitlist });
    }

    const successUrl = `${appBaseUrl || "http://localhost:5173"}/ModelSignup?success=true&pre_order_id=${encodeURIComponent(preOrderId)}&course_id=${encodeURIComponent(courseId)}&customer_email=${encodeURIComponent(customerEmail)}&customer_name=${encodeURIComponent(customerName)}&phone=${encodeURIComponent(phone)}&date_of_birth=${encodeURIComponent(body.date_of_birth ? String(body.date_of_birth).slice(0, 10) : "")}&treatment_type=${encodeURIComponent(treatmentType)}`;
    const cancelUrl = `${appBaseUrl || "http://localhost:5173"}/ModelSignup?cancelled=true`;
    const checkoutMetadata = {
      checkout_type: "model",
      pre_order_id: String(preOrderId || ""),
      course_id: courseId,
      course_date: courseDate,
      customer_email: customerEmail,
      customer_name: customerName,
      phone,
      time_slot: timeSlot || "",
      treatment_type: treatmentType,
      is_waitlist: String(isWaitlist)
    };
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customerEmail,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: finalCents,
          product_data: {
            name: `${course.title || "NOVI Training Course"} - Model Signup`,
            description: `${fmtDateLocal(courseDate)}${timeSlot ? ` at ${fmtTimeLabel(timeSlot)}` : ""}`
          }
        }
      }],
      metadata: checkoutMetadata,
      // Mirror metadata to the PaymentIntent so payment_intent.* and charge.*
      // webhook events carry enough context to be correlated.
      payment_intent_data: {
        metadata: checkoutMetadata
      }
    });
    await query(`update public.pre_orders set stripe_session_id = $2, updated_at = now() where id = $1`, [preOrderId, checkoutSession.id]);

    await enrichPaymentTransaction(
      { id: attemptId },
      {
        pre_order_id: preOrderId,
        course_id: courseId,
        item_id: courseId,
        item_name: `${course.title || "NOVI Training Course"} - Model Signup`,
        amount_subtotal: 50,
        amount_discount: (50 - finalCents / 100),
        amount_total: finalCents / 100,
        stripe_session_id: checkoutSession.id,
        stripe_payment_intent_id: checkoutSession.payment_intent ? String(checkoutSession.payment_intent) : null,
        stripe_checkout_url: checkoutSession.url,
        receipt_email: customerEmail,
        stripe_metadata: checkoutMetadata
      }
    );

    return res.status(201).json({ url: checkoutSession.url, pre_order_id: preOrderId, waitlist_auto: isWaitlist });
  } catch (error) {
    await markAttemptFailed(attemptId, {
      failure_reason: error?.code || error?.statusCode ? String(error.code || error.statusCode) : "validation_or_processing_error",
      failure_message: error?.message || null,
      failure_code: error?.code || null,
      http_status_code: error?.statusCode || null
    });
    return next(error);
  }
});

const MODEL_WEBHOOK_TRACKED_EVENTS = new Set([
  "checkout.session.created",
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "payment_intent.created",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "payment_intent.processing",
  "payment_intent.requires_action",
  "charge.succeeded",
  "charge.failed",
  "charge.refunded",
  "charge.captured",
  "charge.dispute.created"
]);

functionsRouter.post("/modelCheckoutWebhook", async (req, res, next) => {
  try {
    if (!stripe || !stripeWebhookSecret) {
      // eslint-disable-next-line no-console
      console.error("[webhook/modelCheckoutWebhook] rejected: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not set");
      return res.status(500).json({ error: "Stripe webhook is not configured." });
    }
    const signatureHeader = req.headers["stripe-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) {
      // eslint-disable-next-line no-console
      console.warn("[webhook/modelCheckoutWebhook] rejected: missing stripe-signature header");
      return res.status(400).json({ error: "Missing stripe-signature." });
    }
    if (!Buffer.isBuffer(req.body)) {
      // eslint-disable-next-line no-console
      console.error(
        "[webhook/modelCheckoutWebhook] rejected: req.body is not a Buffer (got %s). " +
          "Ensure express.raw() is mounted on this path BEFORE express.json(), and on Vercel that `api.bodyParser = false`.",
        typeof req.body
      );
      return res.status(400).json({ error: "Webhook body was pre-parsed; raw bytes required for signature verification." });
    }
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
    } catch (verifyError) {
      // eslint-disable-next-line no-console
      console.error("[webhook/modelCheckoutWebhook] signature verification FAILED:", verifyError?.message || verifyError);
      return res.status(400).json({ error: `Signature verification failed: ${verifyError?.message || "unknown"}` });
    }
    if (MODEL_WEBHOOK_TRACKED_EVENTS.has(event.type)) {
      await recordStripeWebhookEvent(event);
    }
    // eslint-disable-next-line no-console
    console.log("[webhook/modelCheckoutWebhook] processed", event.type, event.id);
    if (event.type === "checkout.session.completed") {
      const session = event.data?.object || {};
      if (String(session?.metadata?.checkout_type || "") === "model") {
        await processModelCheckoutCompletedSession(session);
      }
    }
    return res.json({ received: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[webhook/modelCheckoutWebhook] handler threw:", error?.message || error);
    return next(error);
  }
});

functionsRouter.post("/sendModelConfirmationEmail", requireAdminOrStaffModelSignups, async (req, res, next) => {
  try {
    const { customer_email, customer_name, course_date, time_slot, treatment_type, course_title } = req.body || {};
    if (!customer_email || !customer_name || !course_date) return res.status(400).json({ error: "Missing required fields" });
    const formattedDate = fmtDateLocal(course_date);
    await sendModelEmail("model_booking_confirmed", {
      to: customer_email,
      first_name: String(customer_name || "there").split(/\s+/)[0],
      course_title: course_title || "NOVI Training Course",
      course_date_label: formattedDate,
      time_label: time_slot ? fmtTimeLabel(time_slot) : "",
      treatment_label: treatmentLabel(treatment_type),
      details: [
        { label: "Course", value: course_title || "NOVI Training Course" },
        { label: "Date", value: formattedDate },
        time_slot ? { label: "Time", value: fmtTimeLabel(time_slot) } : null,
        { label: "Treatment", value: treatmentLabel(treatment_type) },
      ].filter(Boolean),
      summary_lines: [
        "Good Faith Exam (link sent separately)",
        treatment_type === "tox"
          ? "20 Units of Botox"
          : treatment_type === "filler"
            ? "1 Syringe of Filler"
            : "20 units of Botox or 1 syringe of Filler",
        "Supervised by a licensed Medical Director",
      ],
    });
    await query(`update public.pre_orders set confirmation_email_sent = true, confirmation_email_sent_at = now(), updated_at = now() where lower(customer_email) = lower($1) and course_date::date = $2::date and order_type = 'model'`, [customer_email, String(course_date).slice(0, 10)]);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendModelGFEEmail", requireAdminOrStaffModelSignupsOrPaidModel, async (req, res, next) => {
  try {
    const { customer_email, customer_name, gfe_url } = req.body || {};
    if (!customer_email || !gfe_url) return res.status(400).json({ error: "customer_email and gfe_url required" });
    const firstName = String(customer_name || "there").split(" ")[0];
    await sendModelEmail("model_gfe_invite", {
      to: customer_email,
      first_name: firstName,
      gfe_url,
      summary_lines: [
        "Brief video call with a licensed provider",
        "Review of your health history",
        "Medical clearance for your treatment",
        "Takes approximately 5-10 minutes",
      ],
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendModelReminderEmail", requireAdminOrStaffModelSignups, async (req, res, next) => {
  try {
    const { customer_email, customer_name, course_date, time_slot, treatment_type } = req.body || {};
    if (!customer_email || !customer_name || !course_date || !time_slot) return res.status(400).json({ error: "Missing required fields" });
    const formattedDate = fmtDateLocal(course_date);
    await sendModelEmail("model_session_reminder", {
      to: customer_email,
      first_name: String(customer_name || "there").split(/\s+/)[0],
      course_date_label: formattedDate,
      time_label: fmtTimeLabel(time_slot),
      treatment_label: treatmentLabel(treatment_type),
      details: [
        { label: "Date", value: formattedDate },
        { label: "Time", value: fmtTimeLabel(time_slot) },
        { label: "Treatment", value: treatmentLabel(treatment_type) },
      ],
      summary_lines: [
        "Arrive 15 minutes early",
        "Wear comfortable clothing for treatment areas",
        "Avoid alcohol and blood thinners 24 hours before session",
        "Bring a valid photo ID",
        "Keep your booking confirmation handy",
      ],
    });
    await query(`update public.pre_orders set reminder_email_sent_at = now(), updated_at = now() where lower(customer_email) = lower($1) and course_date::date = $2::date and order_type='model'`, [customer_email, String(course_date).slice(0, 10)]);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendModelPostTrainingEmail", requireAdminOrStaffModelSignups, async (req, res, next) => {
  try {
    const { customer_email, customer_name, treatment_type, course_title, pre_order_id } = req.body || {};
    if (!customer_email || !customer_name) return res.status(400).json({ error: "Missing required fields" });
    await sendModelPostTrainingEmailForSignup({
      id: pre_order_id || null,
      customer_email,
      customer_name,
      treatment_type,
      course_title,
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendModelReminderBatch", requireCronOrAdminModelSignups, async (_req, res, next) => {
  try {
    const result = await runModelReminderBatch();
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendModelGFEReminderBatch", requireCronOrAdminModelSignups, async (_req, res, next) => {
  try {
    const result = await runModelGFEReminderBatch();
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendModelPostTrainingBatch", requireCronOrAdminModelSignups, async (_req, res, next) => {
  try {
    const result = await runModelPostTrainingBatch();
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendModelGFE", requireAdminOrStaffModelSignupsOrPaidModel, async (req, res, next) => {
  try {
    const { customer_name, customer_email, phone, pre_order_id, course_id, treatment_type, date_of_birth, send_email } =
      req.body || {};
    if (!customer_email) return res.status(400).json({ error: "customer_email is required" });
    const qualiphyApiKey = process.env.QUALIPHY_API_KEY || "";
    const qualiphyClinicId = process.env.QUALIPHY_CLINIC_ID || "";
    if (!qualiphyApiKey) {
      return res.status(500).json({ error: "QUALIPHY_API_KEY is not configured." });
    }
    const qualiphyExamId = await resolveQualiphyExamIdForCourse({
      courseId: course_id,
      treatmentType: treatment_type
    });
    if (!qualiphyExamId) {
      return res.status(400).json({
        error: "No Qualiphy exam ID found for this course. Add qualiphy_exam_ids on the course's linked service type."
      });
    }
    let dob = String(date_of_birth || "").slice(0, 10);
    const hasDobColumn = await hasPreOrderColumn("date_of_birth");
    if (!dob && hasDobColumn && pre_order_id) {
      const { rows: preRows } = await query(
        `select date_of_birth
         from public.pre_orders
         where id = $1
         limit 1`,
        [pre_order_id]
      );
      dob = String(preRows?.[0]?.date_of_birth || "").slice(0, 10);
    }
    if (!dob && hasDobColumn) {
      const { rows: fallbackDobRows } = await query(
        `select date_of_birth
         from public.pre_orders
         where order_type = 'model'
           and lower(customer_email) = lower($1)
           and ($2::text is null or course_id::text = $2::text)
           and date_of_birth is not null
         order by created_at desc
         limit 1`,
        [customer_email, course_id || null]
      );
      dob = String(fallbackDobRows?.[0]?.date_of_birth || "").slice(0, 10);
    }
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return res.status(400).json({
        error: hasDobColumn
          ? "Date of birth is required to generate GFE invite."
          : "Date of birth column is missing in database. Run migration 20260505131500_model_signup_gfe_fields.sql."
      });
    }

    // Qualiphy requires `tele_state` (two-letter uppercase US state) to resolve a clinic for the exam invite.
    const teleStateResolved = await resolveTeleStateForCourse({ courseId: course_id });
    const tele_state = teleStateResolved || "TX";
    const digitsPhone = String(phone || "").replace(/\D/g, "");
    if (digitsPhone.length < 10) {
      return res.status(400).json({ error: "A valid phone number is required to generate GFE invite." });
    }
    const normalizedPhone = digitsPhone.length === 10 ? `+1${digitsPhone}` : `+${digitsPhone}`;
    const { firstName, lastName } = splitNameParts(customer_name);
    if (!firstName || !lastName) {
      return res.status(400).json({ error: "Customer first and last name are required to generate GFE invite." });
    }
    const qualiphyWebhookUrl = resolveQualiphyWebhookUrl();
    const invitePayloadBody = {
      api_key: qualiphyApiKey,
      exams: [Number(qualiphyExamId)],
      first_name: firstName,
      last_name: lastName,
      email: customer_email,
      dob,
      phone_number: normalizedPhone,
      tele_state,
      additional_data: JSON.stringify({ source: "novi_model_signup", pre_order_id: pre_order_id || null })
    };
    if (qualiphyWebhookUrl) {
      invitePayloadBody.webhook_url = qualiphyWebhookUrl;
    } else {
      // eslint-disable-next-line no-console
      console.warn("[sendModelGFE] No Qualiphy webhook URL configured; GFE completion will not auto-update.");
    }
    if (qualiphyClinicId) {
      invitePayloadBody.clinic_id = qualiphyClinicId;
    }
    const sendInvite = async (payload) => {
      const response = await fetch(QUALIPHY_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${qualiphyApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const responsePayload = await response.json().catch(() => ({}));
      return { response, responsePayload };
    };

    const summarizeInvite = (payload) => ({
      clinic_id_present: Boolean(payload?.clinic_id),
      has_dob: Boolean(payload?.dob),
      exams: Array.isArray(payload?.exams) ? payload.exams : [],
      tele_state: payload?.tele_state ?? null
    });

    let { response: inviteRes, responsePayload: invitePayload } = await sendInvite(invitePayloadBody);
    let upstreamHttpCode = Number(invitePayload?.http_code || 0);
    let upstreamFailed = !inviteRes.ok || (Number.isFinite(upstreamHttpCode) && upstreamHttpCode >= 400);

    const upstreamErrorTextInitial = String(
      invitePayload?.error_message || invitePayload?.message || invitePayload?.error || ""
    ).toLowerCase();
    const looksLikeClinicNotFound =
      upstreamErrorTextInitial.includes("clinic") && upstreamErrorTextInitial.includes("not found");

    const shouldRetryWithoutClinic = Boolean(invitePayloadBody?.clinic_id) && (upstreamFailed || looksLikeClinicNotFound);
    let retriedWithoutClinic = false;
    if (shouldRetryWithoutClinic) {
      retriedWithoutClinic = true;
      const fallbackPayload = { ...invitePayloadBody };
      delete fallbackPayload.clinic_id;
      ({ response: inviteRes, responsePayload: invitePayload } = await sendInvite(fallbackPayload));
      upstreamHttpCode = Number(invitePayload?.http_code || 0);
      upstreamFailed = !inviteRes.ok || (Number.isFinite(upstreamHttpCode) && upstreamHttpCode >= 400);
    }
    if (upstreamFailed) {
      const upstreamError = invitePayload?.error_message || invitePayload?.message || invitePayload?.error || "Qualiphy invite request failed.";
      // eslint-disable-next-line no-console
      console.error("[sendModelGFE] Qualiphy invite failed", {
        upstream_status: inviteRes.status,
        upstream_error: upstreamError,
        retried_without_clinic: retriedWithoutClinic,
        sent_payload_summary: summarizeInvite(invitePayloadBody),
        upstream_payload: invitePayload
      });
      return res.status(502).json({
        error: upstreamError,
        upstream_status: inviteRes.status,
        retried_without_clinic: retriedWithoutClinic
      });
    }
    const { meetingUrl, meetingUuid, patientExamId } = parseQualiphyInviteResponse(invitePayload);
    if (!meetingUrl) {
      return res.status(502).json({
        error: "Qualiphy did not return a GFE link.",
        upstream_status: inviteRes.status,
        upstream_payload: invitePayload
      });
    }
    if (meetingUrl.includes("/ModelBookingLookup")) {
      return res.status(502).json({
        error: "Invalid GFE link returned. Qualiphy did not return an exam invite URL.",
        upstream_status: inviteRes.status,
        upstream_payload: invitePayload
      });
    }
    const resolvedPreOrderId = pre_order_id || req.modelPreOrder?.id || null;
    if (resolvedPreOrderId) {
      const hasGfeStatus = await hasPreOrderColumn("gfe_status");
      const hasMeetingUrl = await hasPreOrderColumn("gfe_meeting_url");
      const hasQualiphyUuid = await hasPreOrderColumn("qualiphy_meeting_uuid");
      const hasQualiphyExamId = await hasPreOrderColumn("qualiphy_patient_exam_id");
      const setClauses = ["gfe_initiated_at = now()", "updated_at = now()"];
      const args = [resolvedPreOrderId];
      if (hasGfeStatus) setClauses.push("gfe_status = 'pending'");
      if (hasMeetingUrl) {
        args.push(meetingUrl);
        setClauses.push(`gfe_meeting_url = $${args.length}`);
      }
      if (hasQualiphyUuid && meetingUuid) {
        args.push(meetingUuid);
        setClauses.push(`qualiphy_meeting_uuid = $${args.length}`);
      }
      if (hasQualiphyExamId && patientExamId) {
        args.push(patientExamId);
        setClauses.push(`qualiphy_patient_exam_id = $${args.length}`);
      }
      await query(
        `update public.pre_orders
         set ${setClauses.join(", ")}
         where id = $1`,
        args
      );
    }

    let email_sent = false;
    if (send_email !== false && customer_email) {
      const firstName = String(customer_name || "there").split(" ")[0];
      await sendModelEmail("model_gfe_invite", {
        to: customer_email,
        first_name: firstName,
        gfe_url: meetingUrl,
        summary_lines: [
          "Brief video call with a licensed provider",
          "Review of your health history",
          "Medical clearance for your treatment",
          "Takes approximately 5-10 minutes",
        ],
      });
      email_sent = true;
    }

    return res.json({ success: true, meeting_url: meetingUrl, email_sent });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/createAppointmentPayment", async (req, res, next) => {
  try {
    const body = req.body || {};
    const appointmentId = String(body.appointment_id || "").trim();
    const clientTimestamp =
      req.get("x-novi-client-timestamp") || body.client_timestamp || null;
    const result = await createAppointmentDepositCheckout({
      token: getBearerToken(req),
      appointmentId,
      body,
      tracking: {
        clientTimestamp,
        sourceOrigin: req.get("origin") || req.get("referer") || null,
        requestIp: (() => {
          const forwarded = req.get("x-forwarded-for");
          if (forwarded) return String(forwarded).split(",")[0].trim();
          return req.ip || req.socket?.remoteAddress || null;
        })(),
        userAgent: req.get("user-agent") || null,
      },
    });
    return res.json(result);
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, sessionUrl: null });
    }
    return next(error);
  }
});

/** Qualiphy exam completion callback (set QUALIPHY_WEBHOOK_URL to your public URL + /functions/qualiphyWebhook). */
functionsRouter.post("/qualiphyWebhook", handleQualiphyExamWebhook);

functionsRouter.post("/sendQualiphyGFE", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const appointmentId = String(req.body?.appointment_id || "").trim();
    if (!appointmentId) {
      return res.status(400).json({ success: false, error: "appointment_id is required." });
    }

    const { rows: apptRows } = await query(
      `select a.*,
              st.name as service_type_name,
              st.qualiphy_exam_ids,
              coalesce(st.requires_gfe, false) as requires_gfe,
              coalesce(nullif(trim(a.patient_email), ''), u.email) as resolved_patient_email,
              coalesce(nullif(trim(a.patient_name), ''), u.full_name) as resolved_patient_name,
              pp.phone as patient_phone,
              pp.state as patient_state,
              pp.date_of_birth as patient_dob
         from public.appointments a
         left join public.service_type st on st.id::text = a.service_type_id::text
         left join public.users u on u.auth_user_id::text = a.patient_id or u.id::text = a.patient_id
         left join public.patient_profiles pp on pp.user_id = u.id
        where a.id = $1
        limit 1`,
      [appointmentId]
    );
    const appt = apptRows[0];
    if (!appt) return res.status(404).json({ success: false, error: "Appointment not found." });

    const isOwner = String(appt.provider_id || "") === String(me.id || "");
    if (!isOwner && !hasAdminAccess(me.role)) {
      return res.status(403).json({ success: false, error: "Forbidden." });
    }
    if (appt.requires_gfe !== true) {
      return res.status(400).json({ success: false, error: "This service does not require a Good Faith Exam." });
    }

    const qualiphyExamId = await resolveQualiphyExamIdForAppointment({
      serviceTypeId: appt.service_type_id,
      serviceName: appt.service || appt.service_type_name,
      qualiphyExamIds: appt.qualiphy_exam_ids,
    });
    if (!qualiphyExamId) {
      return res.status(400).json({
        success: false,
        error: "No Qualiphy exam ID found for this service. Add qualiphy_exam_ids on the service type in admin.",
      });
    }

    const patientEmail = String(appt.resolved_patient_email || "").trim();
    if (!patientEmail) {
      return res.status(400).json({ success: false, error: "Patient email is required to send a GFE invite." });
    }

    const { firstName, lastName } = splitNameParts(appt.resolved_patient_name);
    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, error: "Patient name is required to send a GFE invite." });
    }

    let dob = normalizeDateOnly(appt.patient_dob);
    let patientPhone = String(appt.patient_phone || "").trim();
    let patientState = appt.patient_state;

    if (!dob || patientPhone.replace(/\D/g, "").length < 10) {
      const contact = await loadPatientGfeContact(appt.patient_id, patientEmail);
      if (!dob) dob = contact.dob;
      if (!patientPhone && contact.phone) patientPhone = contact.phone;
      if (!patientState && contact.state) patientState = contact.state;
    }

    if (!dob) {
      return res.status(400).json({
        success: false,
        error: "Patient date of birth is required. Ask the patient to complete their profile before sending GFE.",
      });
    }

    const digitsPhone = String(patientPhone || "").replace(/\D/g, "");
    if (digitsPhone.length < 10) {
      return res.status(400).json({
        success: false,
        error: "Patient phone number is required. Ask the patient to complete their profile before sending GFE.",
      });
    }
    const normalizedPhone = digitsPhone.length === 10 ? `+1${digitsPhone}` : `+${digitsPhone}`;
    const tele_state = (await resolveTeleStateForAppointment({ appointment: appt, patientState })) || "TX";

    const invite = await requestQualiphyExamInvite(
      {
        exams: [Number(qualiphyExamId)],
        first_name: firstName,
        last_name: lastName,
        email: patientEmail,
        dob,
        phone_number: normalizedPhone,
        tele_state,
        additional_data: JSON.stringify({ source: "novi_appointment", appointment_id: appt.id }),
      },
      buildAppointmentGfeRedirectUrls(appt.id)
    );

    const setParts = [
      "gfe_status = 'pending'",
      "gfe_meeting_url = $2",
      "gfe_exam_url = null",
      "gfe_sent_at = now()",
      "gfe_initiated_at = coalesce(gfe_initiated_at, now())",
      "updated_at = now()",
    ];
    const updateParams = [appointmentId, invite.meetingUrl];
    if (invite.meetingUuid && (await hasAppointmentColumn("qualiphy_meeting_uuid"))) {
      updateParams.push(invite.meetingUuid);
      setParts.push(`qualiphy_meeting_uuid = $${updateParams.length}`);
    }
    if (invite.patientExamId && (await hasAppointmentColumn("qualiphy_patient_exam_id"))) {
      updateParams.push(invite.patientExamId);
      setParts.push(`qualiphy_patient_exam_id = $${updateParams.length}`);
    }
    await query(
      `update public.appointments set ${setParts.join(", ")} where id = $1`,
      updateParams
    );

    await sendAppointmentGfeInviteEmail({
      to: patientEmail,
      patientName: appt.resolved_patient_name,
      providerName: appt.provider_name,
      serviceLabel: appt.service || appt.service_type_name,
      appointmentDate: appt.appointment_date,
      appointmentTime: appt.appointment_time,
      meetingUrl: invite.meetingUrl,
    });

    const notificationResult = await notifyPatientGfeInvite({
      patientId: appt.patient_id,
      patientEmail,
      providerName: appt.provider_name,
      serviceLabel: appt.service || appt.service_type_name,
    });

    return res.json({
      success: true,
      meeting_url: invite.meetingUrl,
      webhook_configured: Boolean(invite.webhookUrl),
      email_sent: true,
      notification_sent: notificationResult.sent === true,
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    return next(error);
  }
});

functionsRouter.post("/lookupModelBookings", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phone = String(req.body?.phone || "").replace(/\D/g, "");
    if (!email || !phone) return res.status(400).json({ error: "Email and phone are required." });
    const { rows } = await query(
      `select *
       from public.pre_orders
       where order_type = 'model'
         and lower(customer_email) = $1
         and regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $2
       order by created_at desc`,
      [email, phone]
    );
    return res.json({ bookings: rows || [] });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/cancelModelBooking", async (req, res, next) => {
  try {
    const bookingId = String(req.body?.booking_id || "").trim();
    if (!bookingId) return res.status(400).json({ error: "booking_id is required." });
    const { rows: bookingRows } = await query(
      `select id, status, stripe_payment_intent_id, amount_paid
       from public.pre_orders
       where id = $1 and order_type = 'model'
       limit 1`,
      [bookingId]
    );
    const booking = bookingRows[0];
    if (!booking) return res.status(404).json({ error: "Booking not found." });

    let refundId = null;
    let refundStatus = null;
    if (stripe && booking.stripe_payment_intent_id && Number(booking.amount_paid || 0) > 0) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: String(booking.stripe_payment_intent_id)
        });
        refundId = refund.id || null;
        refundStatus = refund.status || "submitted";
      } catch (refundErr) {
        const msg = String(refundErr?.message || "");
        if (!/already refunded|charge has already been refunded/i.test(msg)) {
          return res.status(502).json({ error: `Refund failed: ${msg || "Unknown Stripe refund error"}` });
        }
        refundStatus = "already_refunded";
      }
    }

    const { rows } = await query(
      `update public.pre_orders
       set status = 'cancelled',
           payment_status = case when $2::text is null then payment_status else 'refunded' end,
           updated_at = now()
       where id = $1 and order_type = 'model'
       returning id, status, payment_status`,
      [bookingId, refundStatus]
    );
    return res.json({ success: true, booking: rows[0], refund: refundStatus ? { status: refundStatus, id: refundId } : null });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/promoteFromWaitlist", requireAdminOrStaffModelSignups, async (req, res, next) => {
  try {
    const preOrderId = String(req.body?.pre_order_id || "").trim();
    const timeSlot = String(req.body?.time_slot || "").trim();
    if (!preOrderId || !timeSlot) return res.status(400).json({ error: "pre_order_id and time_slot are required." });
    const { rows } = await query(
      `update public.pre_orders
       set is_waitlist = false,
           model_time_slot = $2,
           status = 'confirmed',
           updated_at = now()
       where id = $1 and order_type = 'model'
       returning *`,
      [preOrderId, timeSlot]
    );
    if (!rows[0]) return res.status(404).json({ error: "Booking not found." });
    const booking = rows[0];
    try {
      const formattedDate = fmtDateLocal(booking.course_date);
      await sendModelEmail("model_booking_confirmed", {
        to: booking.customer_email,
        first_name: String(booking.customer_name || "there").split(/\s+/)[0],
        course_title: booking.course_title || "NOVI Training Course",
        course_date_label: formattedDate,
        time_label: booking.model_time_slot ? fmtTimeLabel(booking.model_time_slot) : "",
        treatment_label: treatmentLabel(booking.treatment_type),
        details: [
          { label: "Date", value: formattedDate },
          booking.model_time_slot ? { label: "Time", value: fmtTimeLabel(booking.model_time_slot) } : null,
          { label: "Treatment", value: treatmentLabel(booking.treatment_type) },
        ].filter(Boolean),
        summary_lines: [
          "Slot opened up — your waitlist booking is now confirmed",
          "Complete your Good Faith Exam before the session if you have not done so",
        ],
      });
      await query(
        `update public.pre_orders
         set confirmation_email_sent = true,
             confirmation_email_sent_at = now(),
             updated_at = now()
         where id = $1`,
        [booking.id]
      );
    } catch {
      // best effort: promotion should still succeed even if email delivery fails
    }
    return res.json({ success: true, booking });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendManufacturerInquiry", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    const body = req.body || {};
    const manufacturerId = String(body.manufacturer_id || "").trim();
    if (!manufacturerId) {
      return res.status(400).json({ ok: false, error: "manufacturer_id is required." });
    }

    const manufacturer = await getManufacturerById(manufacturerId);
    if (!manufacturer) {
      return res.status(404).json({ ok: false, error: "Manufacturer not found." });
    }

    try {
      await assertProviderManufacturerCoverage({ providerId: me?.id, manufacturer });
    } catch (coverageError) {
      const status = coverageError?.statusCode || 403;
      return res.status(status).json({ ok: false, error: coverageError?.message || "MD coverage required." });
    }

    const formData = body.form_data && typeof body.form_data === "object" ? body.form_data : {};
    const enriched = await buildManufacturerApplicationPayload({ me, formData });

    const application = await createManufacturerApplication({
      manufacturer_id: manufacturerId,
      manufacturer_name: manufacturer.name,
      provider_id: me?.id || null,
      provider_email: enriched.provider_email,
      provider_name: enriched.provider_name,
      practice_name: enriched.practice_name,
      practice_address: enriched.practice_address,
      practice_phone: enriched.practice_phone,
      license_type: enriched.license_type,
      license_number: enriched.license_number,
      license_state: enriched.license_state,
      supervising_physician_name: enriched.supervising_physician_name,
      supervising_physician_email: enriched.supervising_physician_email,
      additional_fields: enriched.additional_fields,
    });

    // Fire-and-forget notifications. Failures are logged inside the helpers
    // and never block the submission flow.
    Promise.allSettled([
      notifyAdminsOfManufacturerApplication({ application, manufacturer }),
      notifyRepOfManufacturerApplication({ application, manufacturer }),
    ]).catch(() => {});

    return res.status(201).json({ ok: true, application });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendRepContactEmail", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    const body = req.body || {};
    const manufacturerId = String(body.manufacturer_id || "").trim();
    if (!manufacturerId) {
      return res.status(400).json({ ok: false, error: "manufacturer_id is required." });
    }

    const manufacturer = await getManufacturerById(manufacturerId);
    if (!manufacturer) {
      return res.status(404).json({ ok: false, error: "Manufacturer not found." });
    }

    const contactType = String(body.type || body.contact_type || "message").trim();
    const repContact = await resolveRepContactForProvider({
      providerId: me?.id,
      manufacturerId,
      manufacturer,
    });

    if (!repContact.rep_email) {
      return res.status(400).json({
        ok: false,
        error: "No rep email on file. Save your rep contact info or ask admin to configure application routing.",
      });
    }

    const orderRequest = await createManufacturerOrderRequest({
      manufacturer_id: manufacturerId,
      manufacturer_name: manufacturer.name,
      provider_id: me?.id || null,
      provider_email: me?.email || "",
      provider_name: me?.full_name || "",
      practice_name: body.practice_name || me?.full_name || "",
      contact_type: contactType,
      subject: body.subject || "",
      message: body.message || "",
      order_items: body.order_items || [],
      rep_email: repContact.rep_email,
    });

    Promise.resolve(
      notifyRepOfContactRequest({
        orderRequest: {
          ...orderRequest,
          order_items: orderRequest.order_items?.length
            ? orderRequest.order_items
            : (body.order_items || []),
        },
        manufacturer,
        providerEmail: me?.email || orderRequest.provider_email,
        providerPhone: me?.phone || "",
        savedRep: repContact,
      })
    ).catch((err) => {
      console.error("[email] contact_request_notify_threw", {
        order_request_id: orderRequest.id,
        error_message: err?.message || String(err),
      });
    });

    return res.status(201).json({ ok: true, order_request: orderRequest });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/scheduleRepCall", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    const body = req.body || {};
    const manufacturerId = String(body.manufacturer_id || "").trim();
    const date = String(body.scheduled_date || body.date || "").trim();
    const time = String(body.scheduled_time || body.time || "").trim();
    const timezone = String(body.timezone || "").trim();
    const durationMinutes = Number(body.duration_minutes) || 30;
    const topic = String(body.topic || "").trim();
    const notes = String(body.notes || "").trim();

    if (!manufacturerId) {
      return res.status(400).json({ ok: false, error: "manufacturer_id is required." });
    }
    if (!date || !time || !timezone) {
      return res.status(400).json({ ok: false, error: "scheduled_date, scheduled_time, and timezone are required." });
    }
    if (![15, 30, 45, 60].includes(durationMinutes)) {
      return res.status(400).json({ ok: false, error: "duration_minutes must be 15, 30, 45, or 60." });
    }

    const manufacturer = await getManufacturerById(manufacturerId);
    if (!manufacturer) {
      return res.status(404).json({ ok: false, error: "Manufacturer not found." });
    }

    const savedRep = await getProviderManufacturerRep({
      providerId: me?.id,
      manufacturerId,
    });

    if (!savedRep?.rep_email) {
      return res.status(400).json({
        ok: false,
        error: "Your rep email is not set. Add your rep's contact info before scheduling a call.",
        code: "REP_EMAIL_NOT_SET",
      });
    }

    const repEmail = String(savedRep.rep_email).trim().toLowerCase();
    if (!isValidEmailFormat(repEmail)) {
      return res.status(400).json({
        ok: false,
        error: "Rep email appears invalid. Please update your rep contact info.",
        code: "REP_EMAIL_INVALID",
      });
    }

    const providerEmail = String(me?.email || "").trim().toLowerCase();
    if (!isValidEmailFormat(providerEmail)) {
      return res.status(400).json({
        ok: false,
        error: "Your account email is invalid. Update your profile before scheduling.",
        code: "PROVIDER_EMAIL_INVALID",
      });
    }

    const calendarConnection = await getProviderGoogleConnection(me?.id);
    if (!calendarConnection?.access_token) {
      return res.status(400).json({
        ok: false,
        error: "Connect Google Calendar in your Profile settings before scheduling a call.",
        code: "GOOGLE_CALENDAR_NOT_CONNECTED",
      });
    }
    if (calendarConnection.google_email?.toLowerCase() !== providerEmail) {
      return res.status(400).json({
        ok: false,
        error: "Connected Google account must match your NOVI email. Reconnect in Profile settings.",
        code: "GOOGLE_EMAIL_MISMATCH",
      });
    }

    const { scheduledAt, isFuture } = await parseScheduledAt({ date, time, timezone });
    if (!isFuture) {
      return res.status(400).json({ ok: false, error: "Scheduled time must be in the future." });
    }

    const startDateTime = `${date}T${time}:00`;
    const endDateTime = addMinutesToLocalDateTime(date, time, durationMinutes);
    const mfrName = manufacturer.name || "Supplier";
    const providerName = me?.full_name || "NOVI Provider";
    const repName = savedRep.rep_name || "Account Rep";
    const summary = topic
      ? `${mfrName} call: ${topic}`
      : `NOVI Provider call — ${providerName} & ${mfrName}`;

    const description = [
      `Supplier: ${mfrName}`,
      `Provider: ${providerName}`,
      `Rep: ${repName}`,
      topic ? `Topic: ${topic}` : null,
      notes ? `Notes: ${notes}` : null,
      "",
      "Scheduled via NOVI Supplier Network.",
    ]
      .filter((line) => line !== null)
      .join("\n");

    const { eventId, meetLink } = await createProviderGoogleMeetEvent({
      providerId: me?.id,
      summary,
      description,
      startDateTime,
      endDateTime,
      timeZone: timezone,
      attendeeEmails: [repEmail],
    });

    const call = await createProviderRepCall({
      provider_id: me?.id,
      manufacturer_id: manufacturerId,
      manufacturer_name: mfrName,
      rep_name: repName,
      rep_email: repEmail,
      provider_email: providerEmail,
      provider_name: providerName,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      timezone,
      topic: topic || null,
      notes: notes || null,
      google_event_id: eventId,
      meet_link: meetLink,
      status: "scheduled",
    });

    return res.status(201).json({ ok: true, call, meet_link: meetLink });
  } catch (error) {
    return next(error);
  }
});

async function handleCheckExpirations(_req, res, next) {
  try {
    const result = await runCheckExpirations();
    return res.json({ ok: true, ...result });
  } catch (error) {
    return next(error);
  }
}

async function handleComplianceChecks(_req, res, next) {
  try {
    const result = await runComplianceChecks();
    return res.json({ ok: true, ...result });
  } catch (error) {
    return next(error);
  }
}

/** Patient Journey Premium — $19/mo Stripe subscription */
functionsRouter.post("/createPatientSubscription", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const role = String(me.role || "").toLowerCase();
    if (role !== "patient" && !hasAdminAccess(me.role)) {
      return res.status(403).json({ error: "Only patients can subscribe to Journey Premium." });
    }
    const { createPatientSubscriptionCheckout } = await import("../patient-journey/subscriptionService.js");
    const result = await createPatientSubscriptionCheckout({
      patientId: me.id,
      patientEmail: me.email,
      req,
    });
    return res.json({ url: result.url, session_id: result.session_id });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/cancelPatientSubscription", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const { cancelPatientSubscriptionForUser } = await import("../patient-journey/subscriptionService.js");
    const result = await cancelPatientSubscriptionForUser({ patientId: me.id });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/adverseReactionEscalation", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    await getMeFromAccessToken(token);
    const treatmentRecordId = String(req.body?.treatment_record_id || "").trim();
    if (!treatmentRecordId) {
      return res.status(400).json({ error: "treatment_record_id is required." });
    }
    const { processAdverseReactionEscalation } = await import(
      "../patient-journey/adverseReactionEscalationService.js"
    );
    const result = await processAdverseReactionEscalation({ treatmentRecordId });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/patientCheckinEscalation", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    await getMeFromAccessToken(token);
    const body = req.body || {};
    const journeyId = String(body.journey_id || "").trim();
    const checkin = body.checkin || {};
    if (!journeyId) {
      return res.status(400).json({ error: "journey_id is required." });
    }
    const { processPatientCheckinEscalation } = await import("../patient-journey/escalationService.js");
    const result = await processPatientCheckinEscalation({
      journeyId,
      checkin,
      treatmentRecordId: body.treatment_record_id || null,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

async function handleModelAutomation(_req, res, next) {
  try {
    const result = await runModelAutomation();
    return res.json({ ok: true, ...result });
  } catch (error) {
    return next(error);
  }
}

functionsRouter.post("/modelAutomation", requireCronOrAdminModelSignups, handleModelAutomation);
functionsRouter.get("/modelAutomation", requireCronOrAdminModelSignups, handleModelAutomation);
functionsRouter.post("/checkExpirations", requireCronOrAdminCompliance, handleCheckExpirations);
functionsRouter.get("/checkExpirations", requireCronOrAdminCompliance, handleCheckExpirations);
functionsRouter.post("/complianceChecks", requireCronOrAdminCompliance, handleComplianceChecks);
functionsRouter.get("/complianceChecks", requireCronOrAdminCompliance, handleComplianceChecks);
