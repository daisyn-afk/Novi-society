import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";
import { notifyAdminsOfPendingCourseCertIssuance } from "../certificationNotifications.js";
import { withCourseEmailShell } from "../courseEmailShell.js";
import { listEligibleMedicalDirectorsForService } from "../mdEligibleDirectors.js";
import { submitMdBoardCoverageAssignment } from "../mdAssignmentService.js";
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
import { buildManufacturerApplicationPayload } from "../manufacturers/providerApplicationContext.js";

export const functionsRouter = Router();
let certificationColumnsPromise = null;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
const resendApiKey = process.env.RESEND_API_KEY || "";
const resendFromEmail = process.env.RESEND_FROM_EMAIL || "NOVI Society Training <hello@novisociety.com>";
const QUALIPHY_API_URL = "https://api.qualiphy.me/api/exam_invite";
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
let preOrderColumnsPromise = null;
let coursePromoColumnsPromise = null;

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
  const [hRaw, mRaw] = timeSlot.slice(0, 5).split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return timeSlot;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
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
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [to],
      subject,
      html
    })
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) {
    const err = new Error(payload?.message || "Email send failed");
    err.statusCode = 500;
    throw err;
  }
  return payload;
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
    const htmlBody = withCourseEmailShell({
      title: "You're Booked!",
      contentHtml: `<p style="color:#1e2535;font-size:15px;margin:0 0 16px;">Hi <strong>${row.customer_name || "there"}</strong>,</p><p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0;">Your model training booking has been confirmed for ${fmtDateLocal(row.course_date)}${row.model_time_slot ? ` at ${fmtTimeLabel(row.model_time_slot)}` : ""}.</p>`
    });
    await sendResendEmail({
      to: row.customer_email,
      subject: `Your Model Training Booking is Confirmed - ${fmtDateLocal(row.course_date)}`,
      html: htmlBody
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
functionsRouter.post("/createMDSubscriptionCheckout", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const body = req.body || {};
    const serviceTypeId = String(body.service_type_id || "").trim();
    const serviceTypeName = String(body.service_type_name || "MD Board Coverage").trim() || "MD Board Coverage";
    const enrollmentId = body.enrollment_id != null ? String(body.enrollment_id).trim() : "";
    const amountPrimary = body.amount;
    const amountAlt = body.prorated_amount;
    const amountRaw =
      amountPrimary !== undefined && amountPrimary !== null && String(amountPrimary) !== ""
        ? amountPrimary
        : amountAlt;
    const amountUsd = Number(amountRaw);
    const safeUsd = Number.isFinite(amountUsd) && amountUsd >= 0 ? amountUsd : 0;
    const amountCents = Math.round(safeUsd * 100);

    if (!serviceTypeId) {
      return res.status(400).json({ success: false, error: "service_type_id is required." });
    }

    if (amountCents <= 0) {
      return res.json({ success: true });
    }

    if (!stripe) {
      return res.status(500).json({
        success: false,
        error: "Stripe is not configured. Set STRIPE_SECRET_KEY or use $0 activation."
      });
    }

    const base = String(appBaseUrl || "http://localhost:5173").replace(/\/$/, "");
    const successParams = new URLSearchParams({
      md_payment_status: "success",
      service_type_id: serviceTypeId
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
        provider_auth_user_id: String(me.id || ""),
        service_type_id: serviceTypeId,
        enrollment_id: enrollmentId || ""
      },
      subscription_data: {
        metadata: {
          checkout_type: "md_board_coverage",
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

    const url = checkoutSession?.url;
    if (!url) {
      return res.status(500).json({ success: false, error: "Checkout session did not return a URL." });
    }
    return res.json({ success: true, url });
  } catch (error) {
    return next(error);
  }
});

/** Placeholder: cancel flow can extend to Stripe + DB when subscription ids are stored. */
functionsRouter.post("/cancelMDSubscription", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, error: "Missing bearer token." });
    await getMeFromAccessToken(token);
    const subscriptionId = String(req.body?.subscription_id || "").trim();
    if (!subscriptionId) {
      return res.status(400).json({ success: false, error: "subscription_id is required." });
    }
    return res.json({ success: true });
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
    const baseCents = 5000;
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

    const baseCents = 5000;
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
      await sendResendEmail({
        to: customerEmail,
        subject: `Your Model Training Booking is Confirmed - ${fmtDateLocal(courseDate)}`,
        html: withCourseEmailShell({
          title: "You're Booked!",
          contentHtml: `<p style="color:#1e2535;font-size:15px;margin:0 0 24px;">Hi <strong>${customerName}</strong>,</p><p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0;">Your model training booking has been confirmed.</p>`
        })
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

functionsRouter.post("/sendModelConfirmationEmail", async (req, res, next) => {
  try {
    const { customer_email, customer_name, course_date, time_slot, treatment_type, course_title } = req.body || {};
    if (!customer_email || !customer_name || !course_date) return res.status(400).json({ error: "Missing required fields" });
    const formattedDate = fmtDateLocal(course_date);
    const subject = `Your Model Training Booking is Confirmed - ${formattedDate}`;
    const htmlBody = withCourseEmailShell({
      title: "You're Booked!",
      contentHtml: `
      <p style="color:#1e2535;font-size:15px;margin:0 0 24px;">Hi <strong>${customer_name}</strong>,</p>
      <p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 24px;">Your model training booking has been confirmed! Here's a summary of your session:</p>
      <div style="background:#f9f8f6;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:rgba(30,37,53,0.55);font-size:13px;width:40%;">Course</td><td style="padding:8px 0;color:#1e2535;font-size:13px;font-weight:600;">${course_title || "NOVI Training Course"}</td></tr>
          <tr><td style="padding:8px 0;color:rgba(30,37,53,0.55);font-size:13px;">Date</td><td style="padding:8px 0;color:#1e2535;font-size:13px;font-weight:600;">${formattedDate}</td></tr>
          <tr><td style="padding:8px 0;color:rgba(30,37,53,0.55);font-size:13px;">Time</td><td style="padding:8px 0;color:#1e2535;font-size:13px;font-weight:600;">${fmtTimeLabel(time_slot)}</td></tr>
          <tr><td style="padding:8px 0;color:rgba(30,37,53,0.55);font-size:13px;">Treatment</td><td style="padding:8px 0;color:#1e2535;font-size:13px;font-weight:600;">${treatmentLabel(treatment_type)}</td></tr>
        </table>
      </div>
      <div style="background:rgba(200,230,60,0.1);border:1px solid rgba(200,230,60,0.3);border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#5a7a20;margin:0 0 8px;">What's Included</p>
        <ul style="margin:0;padding-left:18px;color:rgba(30,37,53,0.7);font-size:13px;line-height:1.8;">
          <li>Good Faith Exam (link sent separately)</li>
          <li>${treatment_type === "tox" ? "20 Units of Botox" : treatment_type === "filler" ? "1 Syringe of Filler" : "20 units of Botox or 1 syringe of Filler"}</li>
          <li>Supervised by a licensed Medical Director</li>
        </ul>
      </div>
      <p style="color:rgba(30,37,53,0.6);font-size:13px;line-height:1.7;margin:0 0 24px;"><strong>Important:</strong> You'll receive your Good Faith Exam (GFE) link via a separate email. Please complete it before your session date.</p>
      <p style="color:rgba(30,37,53,0.5);font-size:12px;margin:0;">Questions? Email us at <a href="mailto:hello@novisociety.com" style="color:#2D6B7F;">hello@novisociety.com</a></p>`
    });
    await sendResendEmail({ to: customer_email, subject, html: htmlBody });
    await query(`update public.pre_orders set confirmation_email_sent = true, confirmation_email_sent_at = now(), updated_at = now() where lower(customer_email) = lower($1) and course_date::date = $2::date and order_type = 'model'`, [customer_email, String(course_date).slice(0, 10)]);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendModelGFEEmail", async (req, res, next) => {
  try {
    const { customer_email, customer_name, gfe_url } = req.body || {};
    if (!customer_email || !gfe_url) return res.status(400).json({ error: "customer_email and gfe_url required" });
    const firstName = String(customer_name || "there").split(" ")[0];
    const htmlBody = withCourseEmailShell({
      title: "Complete Your GFE",
      contentHtml: `
      <p style="color:#1e2535;font-size:15px;margin:0 0 16px;">Hi <strong>${firstName}</strong>,</p>
      <p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 24px;">You're almost set! Before your training session, you need to complete a <strong>Good Faith Exam (GFE)</strong> - a quick virtual screening with a licensed medical provider. It takes about 5-10 minutes.</p>
      <div style="text-align:center;margin:0 0 24px;"><a href="${gfe_url}" style="display:inline-block;background:#C8E63C;color:#1a2540;font-weight:700;font-size:15px;padding:14px 32px;border-radius:50px;text-decoration:none;">Complete My GFE -></a></div>
      <div style="background:rgba(45,107,127,0.06);border:1px solid rgba(45,107,127,0.15);border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#2D6B7F;margin:0 0 8px;">What to Expect</p>
        <ul style="margin:0;padding-left:18px;color:rgba(30,37,53,0.7);font-size:13px;line-height:1.8;">
          <li>Brief video call with a licensed provider</li><li>Review of your health history</li><li>Medical clearance for your treatment</li><li>Takes approximately 5-10 minutes</li>
        </ul>
      </div>
      <p style="color:rgba(30,37,53,0.6);font-size:13px;line-height:1.7;margin:0 0 16px;"><strong>Please complete this before your session date.</strong> If you have any questions, reply to this email or contact us at <a href="mailto:hello@novisociety.com" style="color:#2D6B7F;">hello@novisociety.com</a>.</p>`
    });
    await sendResendEmail({ to: customer_email, subject: "Complete Your Good Faith Exam - NOVI Society", html: htmlBody });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendModelReminderEmail", async (req, res, next) => {
  try {
    const { customer_email, customer_name, course_date, time_slot, treatment_type } = req.body || {};
    if (!customer_email || !customer_name || !course_date || !time_slot) return res.status(400).json({ error: "Missing required fields" });
    const formattedDate = fmtDateLocal(course_date);
    const html = withCourseEmailShell({
      title: "Session Reminder",
      contentHtml: `
      <p style="color:#1e2535;font-size:15px;margin:0 0 16px;">Hello <strong>${customer_name}</strong>,</p>
      <p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 20px;">Just a friendly reminder that your model training session is tomorrow.</p>
      <div style="background:#f9f8f6;border-radius:12px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 8px;font-size:13px;color:#1e2535;"><strong>Date:</strong> ${formattedDate}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#1e2535;"><strong>Time:</strong> ${fmtTimeLabel(time_slot)}</p>
        <p style="margin:0;font-size:13px;color:#1e2535;"><strong>Treatment:</strong> ${treatmentLabel(treatment_type)}</p>
      </div>
      <p style="color:rgba(30,37,53,0.7);font-size:13px;line-height:1.8;margin:0 0 16px;"><strong>Pre-Training Instructions:</strong><br>Arrive 15 minutes early<br>Wear comfortable clothing for treatment areas<br>Avoid alcohol and blood thinners 24 hours before session<br>Bring a valid photo ID<br>Keep your booking confirmation email handy</p>
      <p style="color:rgba(30,37,53,0.7);font-size:13px;line-height:1.8;margin:0 0 16px;"><strong>What to Bring:</strong><br>Phone or camera (optional)<br>Water bottle and snacks</p>
      <p style="color:rgba(30,37,53,0.6);font-size:13px;line-height:1.7;margin:0;">Questions or need to reschedule? Contact <a href="mailto:hello@novisociety.com" style="color:#2D6B7F;">hello@novisociety.com</a>.</p>`
    });
    await sendResendEmail({ to: customer_email, subject: `Reminder: Your Model Training Session is Tomorrow at ${fmtTimeLabel(time_slot)}`, html });
    await query(`update public.pre_orders set reminder_email_sent_at = now(), updated_at = now() where lower(customer_email) = lower($1) and course_date::date = $2::date and order_type='model'`, [customer_email, String(course_date).slice(0, 10)]);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendModelPostTrainingEmail", async (req, res, next) => {
  try {
    const { customer_email, customer_name, treatment_type, course_title, pre_order_id } = req.body || {};
    if (!customer_email || !customer_name) return res.status(400).json({ error: "Missing required fields" });
    const treatmentName = treatment_type === "tox" ? "Botox" : treatment_type === "filler" ? "Dermal Fillers" : "Botox & Fillers";
    const html = withCourseEmailShell({
      title: "Continue Your Journey",
      contentHtml: `
      <p style="color:#1e2535;font-size:15px;margin:0 0 16px;">Hello <strong>${customer_name}</strong>,</p>
      <p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 16px;">Thank you for being part of the ${course_title || "NOVI Training Course"}! We hope you had an amazing experience.</p>
      <p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 16px;">Now it's your turn to experience professional aesthetic treatments as a patient.</p>
      <p style="color:rgba(30,37,53,0.7);font-size:13px;line-height:1.8;margin:0 0 16px;"><strong>Next Steps:</strong><br>1) Sign up at <a href="https://www.novisociety.com/patient-signup" style="color:#2D6B7F;">novisociety.com/patient-signup</a><br>2) Build your aesthetic profile<br>3) Book your first ${treatmentName} treatment</p>
      <p style="color:rgba(30,37,53,0.7);font-size:13px;line-height:1.8;margin:0 0 16px;"><strong>Special Perks for Training Models:</strong><br>15% off first treatment (code <strong>NOVIMODEL15</strong>)<br>Priority booking with instructors<br>Premium recovery tracking for 30 days</p>
      <p style="color:rgba(30,37,53,0.6);font-size:13px;line-height:1.7;margin:0;">Have questions? Reply to this email or contact <a href="mailto:hello@novisociety.com" style="color:#2D6B7F;">hello@novisociety.com</a>.</p>`
    });
    await sendResendEmail({ to: customer_email, subject: "Become a Real Patient: Continue Your Journey with NOVI Society", html });
    if (pre_order_id) {
      await query(`update public.pre_orders set post_training_email_sent = true, updated_at = now() where id = $1`, [pre_order_id]);
    }
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendModelReminderBatch", async (_req, res, next) => {
  try {
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
        await sendResendEmail({
          to: row.customer_email,
          subject: `Reminder: Your Model Training Session is Tomorrow at ${fmtTimeLabel(row.model_time_slot)}`,
          html: withCourseEmailShell({ title: "Session Reminder", contentHtml: `<p style="color:#1e2535;font-size:14px;">Hi <strong>${row.customer_name}</strong>, your session is tomorrow (${fmtDateLocal(row.course_date)} at ${fmtTimeLabel(row.model_time_slot)}).</p>` })
        });
        await query(`update public.pre_orders set reminder_email_sent_at = now(), updated_at = now() where id = $1`, [row.id]);
        sent += 1;
      } catch {
        // continue next row
      }
    }
    return res.json({ success: true, total: rows.length, sent });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendModelGFEReminderBatch", async (_req, res, next) => {
  try {
    const hasMeetingUrl = await hasPreOrderColumn("gfe_meeting_url");
    const hasGfeStatus = await hasPreOrderColumn("gfe_status");
    if (!hasMeetingUrl || !hasGfeStatus) {
      return res.json({ success: true, total: 0, sent: 0, skipped: "Missing gfe columns (run migration)." });
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
        const html = withCourseEmailShell({
          title: "GFE Reminder",
          contentHtml: `<p style="color:#1e2535;font-size:15px;margin:0 0 12px;">Hi <strong>${row.customer_name || "there"}</strong>,</p><p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 18px;">Friendly reminder to complete your Good Faith Exam before class.</p><p style="margin:0;"><a href="${row.gfe_meeting_url}" style="display:inline-block;background:#C8E63C;color:#1a2540;font-weight:700;font-size:14px;padding:12px 24px;border-radius:999px;text-decoration:none;">Complete GFE</a></p>`
        });
        await sendResendEmail({
          to: row.customer_email,
          subject: "Reminder: Complete Your Good Faith Exam - NOVI Society",
          html
        });
        await query(`update public.pre_orders set gfe_reminder_sent_at = now(), updated_at = now() where id = $1`, [row.id]);
        sent += 1;
      } catch {
        // continue
      }
    }
    return res.json({ success: true, total: rows.length, sent });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendModelPostTrainingBatch", async (_req, res, next) => {
  try {
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
        await sendResendEmail({
          to: row.customer_email,
          subject: "Become a Real Patient: Continue Your Journey with NOVI Society",
          html: withCourseEmailShell({ title: "Continue Your Journey", contentHtml: `<p style="color:#1e2535;font-size:14px;">Hi <strong>${row.customer_name}</strong>, thanks for being part of ${row.course_title || "NOVI Training Course"}.</p>` })
        });
        await query(`update public.pre_orders set post_training_email_sent = true, updated_at = now() where id = $1`, [row.id]);
        sent += 1;
      } catch {
        // continue
      }
    }
    return res.json({ success: true, total: rows.length, sent });
  } catch (error) {
    return next(error);
  }
});

functionsRouter.post("/sendModelGFE", async (req, res, next) => {
  try {
    const { customer_name, customer_email, phone, pre_order_id, course_id, treatment_type, date_of_birth } = req.body || {};
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
    const qualiphyWebhookUrl = String(process.env.QUALIPHY_WEBHOOK_URL || "").trim();
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
    if (pre_order_id) {
      const hasGfeStatus = await hasPreOrderColumn("gfe_status");
      const hasMeetingUrl = await hasPreOrderColumn("gfe_meeting_url");
      const setClauses = ["gfe_initiated_at = now()", "updated_at = now()"];
      const args = [pre_order_id];
      if (hasGfeStatus) setClauses.push("gfe_status = 'pending'");
      if (hasMeetingUrl) {
        args.push(meetingUrl);
        setClauses.push(`gfe_meeting_url = $${args.length}`);
      }
      await query(
        `update public.pre_orders
         set ${setClauses.join(", ")}
         where id = $1`,
        args
      );
    }
    return res.json({ success: true, meeting_url: meetingUrl });
  } catch (error) {
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

functionsRouter.post("/promoteFromWaitlist", async (req, res, next) => {
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
      const htmlBody = withCourseEmailShell({
        title: "You're Booked!",
        contentHtml: `
        <p style="color:#1e2535;font-size:15px;margin:0 0 24px;">Hi <strong>${booking.customer_name || "there"}</strong>,</p>
        <p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 20px;">
          Great news - a slot opened up and your waitlist booking is now confirmed.
        </p>
        <div style="background:#f9f8f6;border-radius:12px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 8px;font-size:13px;color:#1e2535;"><strong>Date:</strong> ${formattedDate}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#1e2535;"><strong>Time:</strong> ${fmtTimeLabel(booking.model_time_slot)}</p>
          <p style="margin:0;font-size:13px;color:#1e2535;"><strong>Treatment:</strong> ${treatmentLabel(booking.treatment_type)}</p>
        </div>
        <p style="color:rgba(30,37,53,0.6);font-size:13px;line-height:1.7;margin:0;">
          Please complete your Good Faith Exam before the session if you have not done so.
        </p>`
      });
      await sendResendEmail({
        to: booking.customer_email,
        subject: `Your Model Training Booking is Confirmed - ${formattedDate}`,
        html: htmlBody
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
        orderRequest,
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
