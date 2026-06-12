import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { pool, query } from "../db.js";
import {
  canDecrementSessionDateSeat,
  decrementSessionDateSeatInArray,
  findSessionEntryByDate,
  findSessionEntryForSelection,
  getUpcomingSessionEntries,
  legacyCourseLevelSoldOut,
  normalizeCourseDateInput,
  resolveDecrementTargetForPaidCourse,
  sessionEntryCalendarKeys,
  toSessionDateKey
} from "../lib/sessionDateSeats.js";
import { syncScheduledCourseSessionSeats } from "../courses/sessionSeatsSync.js";
import { getMeFromAccessToken } from "../auth/service.js";
import { ensureProviderOnboardingTable } from "../provider-onboarding/service.js";
import {
  recordCheckoutInitiated,
  recordPreOrderInitiated,
  enrichPaymentTransaction,
  markAttemptFailed,
  PAYMENT_FLOW
} from "../payments/service.js";
import { resolveAppBaseUrl } from "../lib/frontendBaseUrl.js";
import { sendEmailFromTemplate } from "../emails/renderTemplate.js";
import { splitCustomerName } from "../users/providerSignupLink.js";
import { markPasswordResetPending, PASSWORD_SETUP_STATUS } from "../users/passwordSetup.js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;
const preorderFallbackTimeoutMs = Number(process.env.PREORDER_FALLBACK_TIMEOUT_MS || 4000);
let coursePromoColumnsPromise = null;
let usersAuthUserIdNullablePromise = null;

function normalizeRole(role) {
  const value = String(role || "provider").trim().toLowerCase();
  if (["provider", "patient", "medical_director", "admin"].includes(value)) return value;
  return "provider";
}

function fullName(firstName, lastName) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || null;
}

function resolveCheckoutCustomerNames({ first_name, last_name, customer_name } = {}) {
  const firstName = String(first_name || "").trim() || null;
  const lastName = String(last_name || "").trim() || null;
  if (firstName || lastName) {
    return { firstName, lastName };
  }
  return splitCustomerName(customer_name);
}

function normalizePromoCode(code) {
  return String(code || "").trim().toUpperCase();
}

async function hasCoursePromoColumn(client, columnName) {
  if (!coursePromoColumnsPromise) {
    coursePromoColumnsPromise = client.query(
      `select column_name
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'course_promo_codes'`
    )
      .then((res) => new Set((res.rows || []).map((row) => String(row.column_name || "").toLowerCase())))
      .catch(() => new Set());
  }
  const cols = await coursePromoColumnsPromise;
  return cols.has(String(columnName || "").toLowerCase());
}

async function isUsersAuthUserIdNullable(client) {
  if (!usersAuthUserIdNullablePromise) {
    usersAuthUserIdNullablePromise = client.query(
      `select is_nullable
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'users'
         and column_name = 'auth_user_id'
       limit 1`
    )
      .then((res) => String(res.rows?.[0]?.is_nullable || "YES").toUpperCase() === "YES")
      .catch(() => true);
  }
  return usersAuthUserIdNullablePromise;
}

function computeDiscount({ discountType, discountValue, subtotal }) {
  if (!discountType || !discountValue || subtotal <= 0) return 0;
  if (discountType === "percent" || discountType === "percentage") {
    return Math.min(subtotal, (subtotal * Number(discountValue)) / 100);
  }
  if (discountType === "fixed") return Math.min(subtotal, Number(discountValue));
  return 0;
}

function normalizePaidEnrollmentStatus(value) {
  return String(value || "").trim().toLowerCase();
}

/** landing = public home (/); provider = provider dashboard after portal checkout */
function normalizeCheckoutReturnTo(value, fallback = "landing") {
  const raw = String(value ?? fallback).trim().toLowerCase();
  if (raw === "provider" || raw === "provider_dashboard") return "provider";
  return "landing";
}

async function enrichPreOrderWithAccountContext(preOrder, client = null) {
  if (!preOrder?.customer_email) {
    return {
      ...preOrder,
      password_setup_status: null,
      has_provider_account: false,
      needs_account_setup: Boolean(preOrder?.order_type === "course" && preOrder?.status === "paid")
    };
  }

  const runQuery = async (sql, params = []) => (client ? client.query(sql, params) : query(sql, params));
  const { rows } = await runQuery(
    `select password_setup_status, auth_user_id
     from public.users
     where lower(email) = lower($1)
     limit 1`,
    [preOrder.customer_email]
  );
  const userRow = rows[0] ?? null;
  const passwordSetupStatus = userRow?.password_setup_status ?? null;
  const hasProviderAccount = passwordSetupStatus === PASSWORD_SETUP_STATUS.COMPLETED;
  const isPaidCourse = preOrder.order_type === "course" && preOrder.status === "paid";

  return {
    ...preOrder,
    password_setup_status: passwordSetupStatus,
    has_provider_account: hasProviderAccount,
    needs_account_setup: isPaidCourse && !hasProviderAccount
  };
}

export async function enrichPreOrderWithReturnContext(preOrder, sessionId = null) {
  if (!preOrder) return null;
  const sid = sessionId || preOrder.stripe_session_id || null;
  let checkout_return_to = "landing";
  if (sid && stripe) {
    try {
      const session = await stripe.checkout.sessions.retrieve(String(sid));
      checkout_return_to = normalizeCheckoutReturnTo(session?.metadata?.checkout_return_to);
    } catch {
      // keep default
    }
  }
  const withAccount = await enrichPreOrderWithAccountContext({ ...preOrder, checkout_return_to });
  return withAccount;
}

export async function createCourseCheckout(payload, options = {}) {
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  const frontendBaseUrl = resolveAppBaseUrl({ origin: options?.requestOrigin });

  const {
    course_id,
    course_date,
    course_session_id,
    course_start_time,
    course_end_time,
    customer_email,
    customer_name,
    first_name,
    last_name,
    phone,
    license_type,
    license_number,
    license_image_url,
    promo_code,
    terms_confirmed,
    refund_policy_confirmed
  } = payload || {};
  const normalizedCustomerEmail = String(customer_email || "").trim().toLowerCase();
  const normalizedCustomerName = String(customer_name || fullName(first_name, last_name) || "").trim();
  const courseDateNorm = normalizeCourseDateInput(course_date);
  const normalizedCourseDate = courseDateNorm ? (toSessionDateKey(courseDateNorm) || courseDateNorm) : null;

  // STEP 1 — Log the attempt before any validation. This guarantees that every
  // click of "Pay" creates a new row in payment_transactions with the EXACT
  // request body, even if the user sent an invalid course_id, a bad email, or
  // forgot to tick the terms checkbox. The raw payload is preserved so support
  // can see exactly what the user submitted.
  // NOTE: this insert is intentionally OUTSIDE the business transaction below.
  // If the business transaction rolls back, the attempt row is preserved (and
  // marked failed in the catch).
  const trackingCtx = options?.trackingContext || {};
  const attemptId = await recordCheckoutInitiated({
    payment_flow: PAYMENT_FLOW.COURSE,
    payment_type: "course",
    selected_item_id: course_id != null ? String(course_id) : null,
    customer_email: normalizedCustomerEmail || (customer_email ? String(customer_email) : null),
    customer_name: normalizedCustomerName || null,
    customer_phone: phone || null,
    source_context: trackingCtx.source_context || "course_checkout",
    source_origin: trackingCtx.source_origin || options?.requestOrigin || null,
    request_ip: trackingCtx.request_ip || null,
    user_agent: trackingCtx.user_agent || null,
    client_timestamp: trackingCtx.client_timestamp || null,
    server_received_timestamp: trackingCtx.server_received_timestamp || new Date().toISOString(),
    request_payload_snapshot: payload || null
  });

  try {
    if (!course_id || !normalizedCustomerEmail || !normalizedCustomerName) {
      const err = new Error("Missing required checkout fields: course_id, customer_email, customer_name.");
      err.statusCode = 400;
      throw err;
    }

    if (!terms_confirmed || !refund_policy_confirmed) {
      const err = new Error("Terms and refund policy confirmations are required.");
      err.statusCode = 400;
      throw err;
    }

    return await runCourseCheckoutBusiness({
      attemptId,
      payload,
      options,
      frontendBaseUrl,
      normalizedCustomerEmail,
      normalizedCustomerName,
      normalizedCourseDate
    });
  } catch (err) {
    // Persist the failure on the attempt row (status -> failed, failure_*
    // captured). Never lets the tracker mask the original error.
    await markAttemptFailed(attemptId, {
      failure_reason: err?.code || err?.statusCode ? String(err.code || err.statusCode) : "validation_or_processing_error",
      failure_message: err?.message || null,
      failure_code: err?.code || null,
      http_status_code: err?.statusCode || null
    });
    throw err;
  }
}

async function runCourseCheckoutBusiness({
  attemptId,
  payload,
  options,
  frontendBaseUrl,
  normalizedCustomerEmail,
  normalizedCustomerName,
  normalizedCourseDate
}) {
  const {
    course_id,
    course_session_id,
    course_start_time,
    course_end_time,
    customer_name,
    first_name,
    last_name,
    phone,
    license_type,
    license_number,
    license_image_url,
    promo_code,
    terms_confirmed,
    refund_policy_confirmed,
    course_date,
    checkout_return_to: checkoutReturnToRaw
  } = payload || {};
  const checkoutReturnTo = normalizeCheckoutReturnTo(checkoutReturnToRaw, "landing");

  const client = await pool.connect();
  try {
    await client.query("begin");
    // Fail fast on row locks / long queries in serverless environments.
    await client.query("set local lock_timeout = '8s'");
    await client.query("set local statement_timeout = '20s'");

    const authHeader = String(options?.authorization || "").trim();
    const bearer =
      authHeader.length > 6 && authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : "";
    if (bearer && normalizedCustomerEmail) {
      try {
        await ensureProviderOnboardingTable();
        const me = await getMeFromAccessToken(bearer);
        const meEmail = String(me?.email || "").trim().toLowerCase();
        if (normalizeRole(me?.role) === "provider" && meEmail && meEmail === normalizedCustomerEmail) {
          const obRes = await client.query(
            `select 1 from public.provider_basic_onboarding where auth_user_id = $1 limit 1`,
            [me.id]
          );
          if (!obRes.rows?.length) {
            const err = new Error(
              "Complete your provider profile and license upload before purchasing a course. You can finish this from your dashboard (Onboarding pending), or log out to pay as a guest with a different email."
            );
            err.statusCode = 403;
            throw err;
          }
        }
      } catch (e) {
        if (e?.statusCode === 403) throw e;
      }
    }

    const courseRes = await client.query(
      `select id, title, price, available_seats, is_active, session_dates
       from public.scheduled_courses
       where id = $1
       limit 1
       for update`,
      [course_id]
    );
    const course = courseRes.rows[0];
    if (!course || !course.is_active) {
      const err = new Error("Course not found or inactive.");
      err.statusCode = 404;
      throw err;
    }

    let sessionDates = course.session_dates;
    if (typeof sessionDates === "string") {
      try {
        sessionDates = JSON.parse(sessionDates);
      } catch {
        sessionDates = [];
      }
    }
    if (!Array.isArray(sessionDates)) sessionDates = [];

    const upcoming = getUpcomingSessionEntries(sessionDates);
    if (upcoming.length > 0 && !normalizedCourseDate) {
      const err = new Error("Please select a session date.");
      err.statusCode = 400;
      throw err;
    }

    if (normalizedCourseDate) {
      const entry = findSessionEntryForSelection(sessionDates, {
        courseDate: normalizedCourseDate,
        sessionId: course_session_id,
        startTime: course_start_time,
        endTime: course_end_time
      });
      if (!entry) {
        const err = new Error("Invalid session date.");
        err.statusCode = 400;
        throw err;
      }
      if (!canDecrementSessionDateSeat(entry)) {
        const err = new Error("This session date is sold out.");
        err.statusCode = 409;
        throw err;
      }
    } else if (upcoming.length === 0 && legacyCourseLevelSoldOut(course)) {
      const err = new Error("This course is sold out.");
      err.statusCode = 409;
      throw err;
    }

    const duplicatePurchaseRes = await client.query(
      `select 1
       from public.pre_orders po
       where po.order_type = 'course'
         and po.status = 'paid'
         and po.course_id = $1
         and lower(po.customer_email) = $2
         and (
           ($3::date is null and po.course_date is null)
           or po.course_date::date = $3::date
         )
       limit 1`,
      [course.id, normalizedCustomerEmail, normalizedCourseDate]
    );
    if (duplicatePurchaseRes.rows.length > 0) {
      const err = new Error("Course already purchased for this date.");
      err.statusCode = 409;
      throw err;
    }

    const subtotal = Number(course.price || 0);
    let promoRecord = null;
    if (promo_code) {
      const normalizedCode = normalizePromoCode(promo_code);
      const hasAppliesTo = await hasCoursePromoColumn(client, "applies_to");
      const appliesWhere = hasAppliesTo ? "and coalesce(applies_to, 'course') = 'course'" : "";
      const promoRes = await client.query(
        `select id, code, discount_type, discount_value, max_uses, times_used, active, starts_at, ends_at, ${hasAppliesTo ? "coalesce(applies_to, 'course')" : "'course'"} as applies_to
         from public.course_promo_codes
         where upper(code) = $1
           ${appliesWhere}
         limit 1
         for update`,
        [normalizedCode]
      );
      promoRecord = promoRes.rows[0] ?? null;
      if (!promoRecord || !promoRecord.active) {
        const err = new Error("Promo code is invalid.");
        err.statusCode = 400;
        throw err;
      }
      const now = Date.now();
      if (promoRecord.starts_at && new Date(promoRecord.starts_at).getTime() > now) {
        const err = new Error("Promo code is not active yet.");
        err.statusCode = 400;
        throw err;
      }
      if (promoRecord.ends_at && new Date(promoRecord.ends_at).getTime() < now) {
        const err = new Error("Promo code has expired.");
        err.statusCode = 400;
        throw err;
      }
      if (promoRecord.max_uses !== null && Number(promoRecord.times_used) >= Number(promoRecord.max_uses)) {
        const err = new Error("Promo code usage limit reached.");
        err.statusCode = 400;
        throw err;
      }
    }

    const discount = computeDiscount({
      discountType: promoRecord?.discount_type,
      discountValue: promoRecord?.discount_value,
      subtotal
    });
    const total = Math.max(0, subtotal - discount);
    const amountInCents = Math.round(total * 100);

    const preOrderRes = await client.query(
      `insert into public.pre_orders (
        order_type, type, status, course_id, course_title, course_date,
        customer_name, customer_email, first_name, last_name, phone,
        license_type, license_number, license_image_url,
        terms_confirmed, refund_policy_confirmed,
        promo_code, promo_code_id,
        amount_subtotal, amount_discount, amount_paid, currency
      ) values (
        'course', 'course', 'pending_payment', $1, $2, $3,
        $4, $5, $6, $7, $8,
        $9, $10, $11,
        $12, $13,
        $14, $15,
        $16, $17, $18, 'usd'
      )
      returning id`,
      [
        course.id,
        course.title,
        normalizedCourseDate,
        normalizedCustomerName,
        normalizedCustomerEmail,
        first_name || null,
        last_name || null,
        phone || null,
        license_type || null,
        license_number,
        license_image_url,
        Boolean(terms_confirmed),
        Boolean(refund_policy_confirmed),
        promoRecord?.code || null,
        promoRecord?.id || null,
        subtotal,
        discount,
        total
      ]
    );
    const preOrderId = preOrderRes.rows[0].id;

    const stripeMetadata = {
      pre_order_id: preOrderId,
      course_id: String(course.id),
      course_date: normalizedCourseDate || "",
      course_session_id: String(course_session_id || ""),
      course_start_time: String(course_start_time || ""),
      course_end_time: String(course_end_time || ""),
      provider_email: String(normalizedCustomerEmail),
      provider_name: String(customer_name),
      app_source: checkoutReturnTo === "provider" ? "provider-portal" : "novi-landing",
      app_base_url: frontendBaseUrl,
      checkout_type: "course",
      checkout_return_to: checkoutReturnTo
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: normalizedCustomerEmail,
      success_url: `${frontendBaseUrl}/PreOrderConfirmation?session_id={CHECKOUT_SESSION_ID}&return_to=${encodeURIComponent(checkoutReturnTo)}`,
      cancel_url: checkoutReturnTo === "provider"
        ? `${frontendBaseUrl}${encodeURI("/ProviderDashboard")}`
        : `${frontendBaseUrl}/`,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: course.title,
              description: course_date ? `Session date: ${course_date}` : "Course enrollment"
            },
            unit_amount: amountInCents
          },
          quantity: 1
        }
      ],
      metadata: stripeMetadata,
      // Mirror metadata onto the underlying PaymentIntent so payment_intent.*
      // and charge.* webhook events can be correlated back to this transaction
      // even before the checkout session emits a completed event.
      payment_intent_data: {
        metadata: stripeMetadata
      }
    });

    await client.query(
      `update public.pre_orders
       set stripe_session_id = $2,
           stripe_checkout_url = $3,
           stripe_payment_intent_id = $4
       where id = $1`,
      [preOrderId, session.id, session.url, session.payment_intent ? String(session.payment_intent) : null]
    );

    if (promoRecord) {
      await client.query(
        `update public.course_promo_codes
         set times_used = times_used + 1
         where id = $1`,
        [promoRecord.id]
      );
    }

    // Attach the freshly-created Stripe session + pre_order to the attempt
    // row we already inserted at the top of createCourseCheckout. This is an
    // UPDATE (by primary key) — never an INSERT — so the attempt's identity
    // and request_payload_snapshot remain stable.
    await enrichPaymentTransaction(
      { id: attemptId },
      {
        pre_order_id: preOrderId,
        course_id: course.id,
        item_id: String(course.id),
        item_name: course.title,
        amount_subtotal: subtotal,
        amount_discount: discount,
        amount_total: total,
        stripe_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent ? String(session.payment_intent) : null,
        stripe_checkout_url: session.url,
        receipt_email: normalizedCustomerEmail
      },
      client
    );

    await client.query("commit");
    return {
      checkout_url: session.url,
      stripe_session_id: session.id,
      pre_order_id: preOrderId,
      amount_total: Number(total.toFixed(2))
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function createServicePreOrder(payload, options = {}) {
  const {
    customer_name,
    customer_email,
    phone,
    notes,
    service_type_id,
    license_type,
    license_number,
    license_image_url,
    certification_document_url
  } = payload || {};

  // STEP 1 — Log every attempt up-front (even invalid ones) so support has a
  // trail when a user complains they signed up but nothing shows up in the
  // admin pre-orders list.
  const trackingCtx = options?.trackingContext || {};
  const attemptId = await recordPreOrderInitiated({
    payment_type: "md_service",
    selected_item_id: service_type_id != null ? String(service_type_id) : null,
    customer_email,
    customer_name,
    customer_phone: phone || null,
    amount_total: 0,
    source_context: trackingCtx.source_context || "md_service_signup",
    source_origin: trackingCtx.source_origin || null,
    request_ip: trackingCtx.request_ip || null,
    user_agent: trackingCtx.user_agent || null,
    client_timestamp: trackingCtx.client_timestamp || null,
    server_received_timestamp: trackingCtx.server_received_timestamp || new Date().toISOString(),
    request_payload_snapshot: payload || null,
    metadata: {
      notes: notes || null,
      license_type: license_type || null,
      license_number: license_number || null,
      license_image_url: license_image_url || null,
      certification_document_url: certification_document_url || null
    }
  });

  try {
    if (!customer_name || !customer_email) {
      const err = new Error("customer_name and customer_email are required.");
      err.statusCode = 400;
      throw err;
    }
    if (!service_type_id) {
      const err = new Error("service_type_id is required.");
      err.statusCode = 400;
      throw err;
    }

    return await runServicePreOrderBusiness({
      attemptId,
      payload,
      customer_name,
      customer_email,
      phone,
      notes,
      service_type_id,
      license_type,
      license_number,
      license_image_url,
      certification_document_url
    });
  } catch (err) {
    await markAttemptFailed(attemptId, {
      failure_reason: err?.code || err?.statusCode ? String(err.code || err.statusCode) : "validation_or_processing_error",
      failure_message: err?.message || null,
      failure_code: err?.code || null,
      http_status_code: err?.statusCode || null
    });
    throw err;
  }
}

async function runServicePreOrderBusiness({
  attemptId,
  customer_name,
  customer_email,
  phone,
  notes,
  service_type_id,
  license_type,
  license_number,
  license_image_url,
  certification_document_url
}) {
  const client = await pool.connect();
  try {
    const serviceRes = await client.query(
      `select id, name
       from public.service_type
       where id = $1
       limit 1`,
      [service_type_id]
    );
    const service = serviceRes.rows[0];
    if (!service) {
      const err = new Error("Service type not found.");
      err.statusCode = 404;
      throw err;
    }

    const { rows } = await client.query(
      `insert into public.pre_orders (
        order_type,
        type,
        status,
        service_type_id,
        service_name,
        customer_name,
        customer_email,
        phone,
        license_type,
        license_number,
        license_image_url,
        certification_document_url,
        notes
      ) values (
        'service',
        'service',
        'pending_approval',
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10
      )
      returning id`,
      [
        service.id,
        service.name,
        customer_name,
        customer_email,
        phone || null,
        license_type || null,
        license_number || null,
        license_image_url || null,
        certification_document_url || null,
        notes || null
      ]
    );
    const preOrderId = rows[0].id;

    const emailSent = await sendMdServiceConfirmationEmail({
      to: customer_email,
      customerName: customer_name,
      serviceName: service.name
    });
    if (emailSent) {
      await client.query(
        `update public.pre_orders
         set confirmation_email_sent = true,
             confirmation_email_sent_at = now()
         where id = $1`,
        [preOrderId]
      );
    }

    // Attach the freshly-created pre_order row + resolved service details to
    // the attempt row we already inserted at the top of createServicePreOrder.
    await enrichPaymentTransaction(
      { id: attemptId },
      {
        pre_order_id: preOrderId,
        service_type_id: String(service.id),
        item_id: String(service.id),
        item_name: service.name
      },
      client
    );

    return {
      pre_order_id: preOrderId
    };
  } finally {
    client.release();
  }
}

async function sendMdServiceConfirmationEmail({ to, customerName, serviceName }) {
  if (!to) {
    // eslint-disable-next-line no-console
    console.warn("[checkout] md service confirmation skipped: missing recipient email");
    return false;
  }
  const firstName = String(customerName || "there").trim().split(/\s+/)[0] || "there";
  const result = await sendEmailFromTemplate("md_service_welcome", {
    to,
    first_name: firstName,
    service_name: serviceName || "NOVI MD Services",
    summary_lines: [
      "Your onboarding spot is confirmed",
      "You'll receive early access updates as we approach launch",
      "Our team will personally reach out to begin your setup",
    ],
  });
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error("[checkout] md service confirmation send failed:", result.error);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[checkout] md service confirmation sent to ${to}`);
  }
  return result.ok;
}

export async function validateCoursePromoCode({ courseId, promoCode }) {
  if (!courseId) {
    const err = new Error("course_id is required.");
    err.statusCode = 400;
    throw err;
  }
  const normalizedCode = normalizePromoCode(promoCode);
  if (!normalizedCode) {
    const err = new Error("promo_code is required.");
    err.statusCode = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    const courseRes = await client.query(
      `select id, title, price from public.scheduled_courses where id = $1 limit 1`,
      [courseId]
    );
    const course = courseRes.rows[0];
    if (!course) {
      const err = new Error("Course not found.");
      err.statusCode = 404;
      throw err;
    }

    const hasAppliesTo = await hasCoursePromoColumn(client, "applies_to");
    const appliesWhere = hasAppliesTo ? "and coalesce(applies_to, 'course') = 'course'" : "";
    const promoRes = await client.query(
      `select id, code, discount_type, discount_value, max_uses, times_used, active, starts_at, ends_at, ${hasAppliesTo ? "coalesce(applies_to, 'course')" : "'course'"} as applies_to
       from public.course_promo_codes
       where upper(code) = $1
         ${appliesWhere}
       limit 1`,
      [normalizedCode]
    );
    const promo = promoRes.rows[0];
    if (!promo || !promo.active) {
      const err = new Error("Promo code is invalid.");
      err.statusCode = 400;
      throw err;
    }

    const now = Date.now();
    if (promo.starts_at && new Date(promo.starts_at).getTime() > now) {
      const err = new Error("Promo code is not active yet.");
      err.statusCode = 400;
      throw err;
    }
    if (promo.ends_at && new Date(promo.ends_at).getTime() < now) {
      const err = new Error("Promo code has expired.");
      err.statusCode = 400;
      throw err;
    }
    if (promo.max_uses !== null && Number(promo.times_used) >= Number(promo.max_uses)) {
      const err = new Error("Promo code usage limit reached.");
      err.statusCode = 400;
      throw err;
    }

    const subtotal = Number(course.price || 0);
    const discount = computeDiscount({
      discountType: promo.discount_type,
      discountValue: promo.discount_value,
      subtotal
    });
    const total = Math.max(0, subtotal - discount);
    return {
      code: promo.code,
      course_id: course.id,
      course_title: course.title,
      subtotal,
      discount_amount: Number(discount.toFixed(2)),
      total: Number(total.toFixed(2))
    };
  } finally {
    client.release();
  }
}

export async function getPreOrder({ id, sessionId }) {
  const values = [];
  let whereClause = "";
  if (id) {
    values.push(id);
    whereClause = `id = $${values.length}`;
  } else if (sessionId) {
    values.push(sessionId);
    whereClause = `stripe_session_id = $${values.length}`;
  } else {
    const err = new Error("Either id or session_id is required.");
    err.statusCode = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    let { rows } = await client.query(
      `select id, order_type, type, status, course_id, course_title, course_date,
              customer_name, customer_email, first_name, last_name,
              amount_paid, paid_at, created_at,
              stripe_session_id, confirmation_email_sent
       from public.pre_orders
       where ${whereClause}
       limit 1`,
      values
    );
    let preOrder = rows[0] ?? null;

    // Fallback path: if webhook did not arrive yet but Stripe marks session as paid,
    // process the completed session on demand so confirmation page and email remain reliable.
    const fallbackSessionId = sessionId || preOrder?.stripe_session_id || null;
    if (fallbackSessionId && stripe) {
      try {
        // If the order is already paid, return immediately and run reconciliation in background.
        // This avoids a slow confirmation screen while still self-healing seats/payments.
        if (preOrder?.status === "paid") {
          void (async () => {
            try {
              const stripeSession = await stripe.checkout.sessions.retrieve(fallbackSessionId);
              const isPaid = stripeSession?.payment_status === "paid" && stripeSession?.status === "complete";
              if (isPaid) await processCompletedCheckoutSession(stripeSession);
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error("[checkout] async pre-order paid reconciliation failed:", error?.code || error?.message || error);
            }
          })();
          return preOrder;
        }

        const fallbackTask = async () => {
          const stripeSession = await stripe.checkout.sessions.retrieve(fallbackSessionId);
          const isPaid = stripeSession?.payment_status === "paid" && stripeSession?.status === "complete";
          if (!isPaid) return;
          await client.query(
            `update public.pre_orders
             set status = 'paid',
                 paid_at = coalesce(paid_at, now()),
                 stripe_payment_intent_id = coalesce($2, stripe_payment_intent_id),
                 stripe_customer_id = coalesce($3, stripe_customer_id),
                 updated_at = now()
             where id = $1`,
            [
              preOrder?.id,
              stripeSession?.payment_intent ? String(stripeSession.payment_intent) : null,
              stripeSession?.customer ? String(stripeSession.customer) : null
            ]
          );
          try {
            await processCompletedCheckoutSession(stripeSession);
          } catch (reconcileErr) {
            // eslint-disable-next-line no-console
            console.error("[checkout] paid-session reconciliation failed:", reconcileErr?.message || reconcileErr);
          }
          const refreshed = await client.query(
            `select id, order_type, type, status, course_id, course_title, course_date,
                    customer_name, customer_email, first_name, last_name,
                    amount_paid, paid_at, created_at,
                    stripe_session_id, confirmation_email_sent
             from public.pre_orders
             where ${whereClause}
             limit 1`,
            values
          );
          preOrder = refreshed.rows[0] ?? preOrder;
        };

        const timeoutTask = new Promise((_, reject) => {
          setTimeout(() => {
            const err = new Error(`Pre-order fallback exceeded ${preorderFallbackTimeoutMs}ms`);
            err.code = "PREORDER_FALLBACK_TIMEOUT";
            reject(err);
          }, preorderFallbackTimeoutMs);
        });

        await Promise.race([fallbackTask(), timeoutTask]);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[checkout] pre-order fallback processing failed:", error?.code || error?.message || error);
      }
    }

    // Best-effort recovery: if payment is completed but confirmation email
    // was not sent (or failed previously), retry on read.
    if (
      preOrder?.status === "paid" &&
      preOrder?.order_type === "course" &&
      !preOrder?.confirmation_email_sent
    ) {
      try {
        let courseData = null;
        if (preOrder.course_id) {
          const courseRes = await client.query(
            `select location, session_dates
             from public.scheduled_courses
             where id = $1
             limit 1`,
            [preOrder.course_id]
          );
          const course = courseRes.rows[0] || null;
          let sessionDates = course?.session_dates || [];
          if (typeof sessionDates === "string") {
            try {
              sessionDates = JSON.parse(sessionDates);
            } catch {
              sessionDates = [];
            }
          }
          if (!Array.isArray(sessionDates)) sessionDates = [];
          courseData = {
            course_location: course?.location || "",
            course_session_dates: sessionDates
          };
        }

        const sent = await sendConfirmationEmail({
          to: preOrder.customer_email,
          customerName: preOrder.customer_name,
          courseTitle: preOrder.course_title,
          courseData,
          courseDate: preOrder.course_date
        });

        if (sent) {
          await client.query(
            `update public.pre_orders
             set confirmation_email_sent = true,
                 confirmation_email_sent_at = now(),
                 updated_at = now()
             where id = $1`,
            [preOrder.id]
          );
          await client.query(
            `update public.course_payments
             set confirmation_email_sent = true,
                 updated_at = now()
             where pre_order_id = $1`,
            [preOrder.id]
          );
          preOrder = { ...preOrder, confirmation_email_sent: true };
        }
      } catch (emailRetryErr) {
        // eslint-disable-next-line no-console
        console.error("[checkout] confirmation email retry failed in getPreOrder:", emailRetryErr?.message || emailRetryErr);
      }
    }

    // Safety net: ensure provider row and setup invite are attempted even when
    // async reconciliation path did not complete.
    if (preOrder?.status === "paid" && preOrder?.order_type === "course") {
      const checkoutNames = resolveCheckoutCustomerNames({
        first_name: preOrder.first_name,
        last_name: preOrder.last_name,
        customer_name: preOrder.customer_name
      });
      try {
        await upsertProviderUserByEmail(client, {
          email: preOrder.customer_email,
          firstName: checkoutNames.firstName,
          lastName: checkoutNames.lastName
        });
      } catch (profileErr) {
        // eslint-disable-next-line no-console
        console.error("[checkout] getPreOrder provider upsert failed:", profileErr?.message || profileErr);
      }

      try {
        const inviteResult = await inviteUserIfNeeded(
          preOrder.customer_email,
          checkoutNames.firstName,
          checkoutNames.lastName,
          null,
          client,
          { customerName: preOrder.customer_name }
        );
        if (inviteResult?.authUserId) {
          await upsertProviderUserRow(client, {
            authUserId: inviteResult.authUserId,
            email: preOrder.customer_email,
            firstName: checkoutNames.firstName,
            lastName: checkoutNames.lastName
          });
        }
        // eslint-disable-next-line no-console
        console.log("[checkout] getPreOrder invite result:", {
          preOrderId: preOrder.id,
          email: preOrder.customer_email,
          wasNewUser: Boolean(inviteResult?.wasNewUser),
          inviteSent: Boolean(inviteResult?.inviteSent),
          hasAuthUserId: Boolean(inviteResult?.authUserId)
        });
      } catch (inviteErr) {
        // eslint-disable-next-line no-console
        console.error("[checkout] getPreOrder invite flow failed:", inviteErr?.message || inviteErr);
      }
    }

    return enrichPreOrderWithAccountContext(preOrder, client);
  } finally {
    client.release();
  }
}

async function sendConfirmationEmail({ to, customerName, courseTitle, courseData, courseDate }) {
  if (!to) {
    // eslint-disable-next-line no-console
    console.warn("[checkout] course confirmation skipped: missing recipient email");
    return false;
  }
  const safeFirstName = customerName || "there";
  const safeCourseName = courseTitle || "your course";

  const formatCourseDate = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };
  const formatSessionTime = (startTime, endTime) => {
    const toDisplay = (raw) => {
      if (typeof raw !== "string" || !/^\d{2}:\d{2}/.test(raw)) return "";
      const [hourRaw, minuteRaw] = raw.slice(0, 5).split(":");
      const hour = Number(hourRaw);
      const minute = Number(minuteRaw);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "";
      const suffix = hour >= 12 ? "PM" : "AM";
      return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
    };
    const start = toDisplay(startTime);
    const end = toDisplay(endTime);
    if (start && end) return `${start} - ${end}`;
    return start || end || "";
  };

  let courseDateStr = formatCourseDate(courseDate);
  let courseTimeStr = "";
  let courseLocation = "";

  if (courseDate && courseData?.course_session_dates && Array.isArray(courseData.course_session_dates)) {
    const dateKey = toSessionDateKey(courseDate);
    const selectedSession = dateKey
      ? courseData.course_session_dates.find((session) => sessionEntryCalendarKeys(session).has(dateKey))
      : null;
    if (selectedSession) {
      courseDateStr = formatCourseDate(selectedSession.date || courseDate);
      courseTimeStr = formatSessionTime(selectedSession.start_time, selectedSession.end_time);
      courseLocation = selectedSession.location || courseData.course_location || "";
    }
  }
  if (!courseLocation && courseData?.course_location) {
    courseLocation = courseData.course_location;
  }

  const details = [
    { label: "Course", value: safeCourseName },
    courseDateStr ? { label: "Date", value: courseDateStr } : null,
    courseTimeStr ? { label: "Time", value: courseTimeStr } : null,
    courseLocation ? { label: "Location", value: courseLocation } : null,
  ].filter(Boolean);

  const result = await sendEmailFromTemplate("course_enrollment_confirmed", {
    to,
    first_name: safeFirstName,
    course_title: safeCourseName,
    course_date_label: courseDateStr,
    details,
    details_title: "Course details",
    summary_lines: [
      "Additional course details and preparation instructions will be sent prior to your training date",
      "Any required forms or documentation will be provided for completion",
      "Our team will be available for any questions leading up to your course",
    ],
  });

  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error("[checkout] course confirmation send failed:", result.error);
    return false;
  }
  return true;
}

async function sendNewUserInviteEmail({ to, firstName, signupLink }) {
  if (!to) {
    // eslint-disable-next-line no-console
    console.warn("[checkout] account setup email skipped: missing recipient email");
    return false;
  }
  if (!signupLink) {
    // eslint-disable-next-line no-console
    console.warn("[checkout] account setup email skipped: missing signup link");
    return false;
  }
  const greetingName = firstName || "there";
  const result = await sendEmailFromTemplate("checkout_account_invite", {
    to,
    first_name: greetingName,
    signup_link: signupLink,
  });
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error("[checkout] account setup email send failed:", result.error);
    return false;
  }
  return true;
}

async function upsertProviderUserRow(client, {
  authUserId,
  email,
  firstName,
  lastName
}) {
  if (!client || !authUserId || !email) return null;
  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedRole = normalizeRole("provider");
  const mergedName = fullName(firstName, lastName);

  // First, try to attach this auth user id to an existing profile row by email.
  // This avoids unique(email) violations when the row already exists without the new auth_user_id.
  const existingByEmail = await client.query(
    `update public.users
     set auth_user_id = $1,
         first_name = coalesce(public.users.first_name, $3),
         last_name = coalesce(public.users.last_name, $4),
         full_name = coalesce(public.users.full_name, $5),
         role = coalesce(public.users.role, $6),
         updated_at = now()
     where lower(email) = lower($2)
     returning id, auth_user_id, email, role`,
    [
      authUserId,
      normalizedEmail,
      firstName || null,
      lastName || null,
      mergedName,
      normalizedRole
    ]
  );
  if (existingByEmail.rows[0]) return existingByEmail.rows[0];

  const inserted = await client.query(
    `insert into public.users (
       auth_user_id, email, first_name, last_name, full_name, role
     ) values ($1, $2, $3, $4, $5, $6)
     on conflict (auth_user_id)
     do update set
       email = excluded.email,
       first_name = coalesce(public.users.first_name, excluded.first_name),
       last_name = coalesce(public.users.last_name, excluded.last_name),
       full_name = coalesce(public.users.full_name, excluded.full_name),
       role = coalesce(public.users.role, excluded.role),
       updated_at = now()
     returning id, auth_user_id, email, role`,
    [
      authUserId,
      normalizedEmail,
      firstName || null,
      lastName || null,
      mergedName,
      normalizedRole
    ]
  );
  return inserted.rows[0] ?? null;
}

async function upsertProviderUserByEmail(client, {
  email,
  firstName,
  lastName
}) {
  if (!client || !email) return null;
  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedRole = normalizeRole("provider");
  const mergedName = fullName(firstName, lastName);

  const existing = await client.query(
    `select id
     from public.users
     where lower(email) = lower($1)
     limit 1`,
    [normalizedEmail]
  );
  if (existing.rows[0]?.id) {
    const updated = await client.query(
      `update public.users
       set first_name = coalesce(public.users.first_name, $2),
           last_name = coalesce(public.users.last_name, $3),
           full_name = coalesce(public.users.full_name, $4),
           role = coalesce(public.users.role, $5),
           updated_at = now()
       where id = $1
       returning id, auth_user_id, email, role`,
      [
        existing.rows[0].id,
        firstName || null,
        lastName || null,
        mergedName,
        normalizedRole
      ]
    );
    return updated.rows[0] ?? null;
  }

  const authUserIdNullable = await isUsersAuthUserIdNullable(client);
  if (!authUserIdNullable) {
    // Some environments enforce users.auth_user_id NOT NULL.
    // In that case, skip email-only inserts; the row will be created once auth user exists.
    return null;
  }

  const inserted = await client.query(
    `insert into public.users (
       email, first_name, last_name, full_name, role
     ) values ($1, $2, $3, $4, $5)
     returning id, auth_user_id, email, role`,
    [
      normalizedEmail,
      firstName || null,
      lastName || null,
      mergedName,
      normalizedRole
    ]
  );
  return inserted.rows[0] ?? null;
}

async function inviteUserIfNeeded(
  email,
  firstName,
  lastName,
  frontendBaseUrlOverride = null,
  dbClient = null,
  { customerName } = {}
) {
  if (!email) {
    return {
      wasNewUser: false,
      existingUser: false,
      inviteSent: false,
      authUserId: null
    };
  }
  const { firstName: resolvedFirstName, lastName: resolvedLastName } = resolveCheckoutCustomerNames({
    first_name: firstName,
    last_name: lastName,
    customer_name: customerName
  });
  firstName = resolvedFirstName;
  lastName = resolvedLastName;

  try {
    const runQuery = async (sql, params = []) => (dbClient ? dbClient.query(sql, params) : query(sql, params));
    const normalizedEmail = String(email).trim().toLowerCase();
    const signupBaseUrl = resolveAppBaseUrl({ origin: frontendBaseUrlOverride });
    const defaultSignupLink = `${signupBaseUrl}/signup?email=${encodeURIComponent(normalizedEmail)}`;
    const linkMetadata = {
      first_name: firstName || "",
      last_name: lastName || "",
      role: "provider"
    };

    const generateSetupLink = async (linkType = "invite") => {
      if (!supabaseAdmin?.auth?.admin?.generateLink) return { link: "", authUserId: null };
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: linkType,
        email: normalizedEmail,
        options: {
          redirectTo: `${signupBaseUrl}/set-password`,
          data: linkMetadata
        }
      });
      if (linkError) {
        // eslint-disable-next-line no-console
        console.error(`[checkout] ${linkType} link generation failed:`, linkError.message || linkError);
        return { link: "", authUserId: null };
      }
      return {
        link: linkData?.properties?.action_link || linkData?.action_link || "",
        authUserId: linkData?.user?.id || null
      };
    };

    const syncAuthUserMetadata = async (authUserId) => {
      if (!authUserId || !supabaseAdmin?.auth?.admin?.updateUserById) return;
      try {
        await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          user_metadata: {
            first_name: firstName || null,
            last_name: lastName || null,
            role: "provider"
          }
        });
      } catch (metaErr) {
        // eslint-disable-next-line no-console
        console.warn("[checkout] auth user metadata update failed:", metaErr?.message || metaErr);
      }
    };

    const existingUserRes = await runQuery(
      `select auth_user_id
       from public.users
       where lower(email) = lower($1)
       limit 1`,
      [normalizedEmail]
    );
    const existingAuthUserId = existingUserRes.rows[0]?.auth_user_id || null;
    if (existingAuthUserId) {
      await syncAuthUserMetadata(existingAuthUserId);
      if (dbClient) {
        await upsertProviderUserRow(dbClient, {
          authUserId: existingAuthUserId,
          email: normalizedEmail,
          firstName,
          lastName
        });
      }
      return {
        wasNewUser: false,
        existingUser: true,
        inviteSent: false,
        authUserId: existingAuthUserId
      };
    }

    let signupLink = defaultSignupLink;
    let createdAuthUserId = null;

    if (supabaseAdmin?.auth?.admin?.generateLink) {
      const inviteResult = await generateSetupLink("invite");
      if (inviteResult.link) signupLink = inviteResult.link;
      createdAuthUserId = inviteResult.authUserId;
    }

    let inviteSent = await sendNewUserInviteEmail({
      to: normalizedEmail,
      firstName,
      signupLink
    });
    if (!inviteSent) {
      const recoveryResult = await generateSetupLink("recovery");
      createdAuthUserId = createdAuthUserId || recoveryResult.authUserId;
      inviteSent = await sendNewUserInviteEmail({
        to: normalizedEmail,
        firstName,
        signupLink: recoveryResult.link || signupLink
      });
      // eslint-disable-next-line no-console
      console.warn("[checkout] invite resend attempted with recovery link:", {
        email: normalizedEmail,
        resent: inviteSent
      });
    }

    if (createdAuthUserId) {
      await syncAuthUserMetadata(createdAuthUserId);
      if (dbClient) {
        await upsertProviderUserRow(dbClient, {
          authUserId: createdAuthUserId,
          email: normalizedEmail,
          firstName,
          lastName
        });
      }
      await markPasswordResetPending({
        email: normalizedEmail,
        authUserId: createdAuthUserId,
        firstName,
        lastName
      });
    }

    // eslint-disable-next-line no-console
    console.log("[checkout] invite send result:", {
      email: normalizedEmail,
      wasNewUser: true,
      inviteSent,
      hasAuthUserId: Boolean(createdAuthUserId)
    });

    return {
      wasNewUser: true,
      existingUser: false,
      inviteSent,
      authUserId: createdAuthUserId
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[checkout] invite flow failed:", error);
    return {
      wasNewUser: false,
      existingUser: false,
      inviteSent: false,
      authUserId: null
    };
  }
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET || "";
}

export function verifyStripeWebhook(rawBodyBuffer, signatureHeader) {
  const secret = getStripeWebhookSecret();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return stripe.webhooks.constructEvent(rawBodyBuffer, signatureHeader, secret);
}

export async function processCompletedCheckoutSession(session) {
  const stripeSessionId = session?.id;
  if (!stripeSessionId) return;

  const client = await pool.connect();
  let postCommitEmail = null;
  let postCommitPaymentId = null;
  try {
    await client.query("begin");

    const preOrderRes = await client.query(
      `select *
       from public.pre_orders
       where stripe_session_id = $1
       limit 1
       for update`,
      [stripeSessionId]
    );
    const preOrder = preOrderRes.rows[0];
    if (!preOrder) {
      await client.query("rollback");
      return;
    }
    const existingPaymentRes = await client.query(
      `select id, confirmation_email_sent, stripe_metadata
       from public.course_payments
       where pre_order_id = $1
       limit 1`,
      [preOrder.id]
    );
    const existingPaymentRow = existingPaymentRes.rows[0] ?? null;
    const existingPaymentId = existingPaymentRow?.id ?? null;
    const existingPaymentConfirmationSent = Boolean(existingPaymentRow?.confirmation_email_sent);
    const existingPaymentSeatApplied =
      existingPaymentRow?.stripe_metadata &&
      typeof existingPaymentRow.stripe_metadata === "object" &&
      existingPaymentRow.stripe_metadata.seat_decrement_applied === true;

    const paidAt = new Date().toISOString();
    const paymentIntentId = session.payment_intent ? String(session.payment_intent) : null;
    const customerId = session.customer ? String(session.customer) : null;

    if (preOrder.status !== "paid") {
      await client.query(
        `update public.pre_orders
         set status = 'paid',
             paid_at = $2,
             stripe_payment_intent_id = coalesce($3, stripe_payment_intent_id),
             stripe_customer_id = coalesce($4, stripe_customer_id)
         where id = $1`,
        [preOrder.id, paidAt, paymentIntentId, customerId]
      );
    }

    const metaCourseDateRaw = normalizeCourseDateInput(session?.metadata?.course_date);
    const metaCourseDate = metaCourseDateRaw ? (toSessionDateKey(metaCourseDateRaw) || metaCourseDateRaw) : null;
    const courseDateStored = normalizeCourseDateInput(preOrder.course_date);
    const metaSessionId = session?.metadata?.course_session_id || null;
    const metaStartTime = session?.metadata?.course_start_time || null;
    const metaEndTime = session?.metadata?.course_end_time || null;
    const courseDateRaw =
      (courseDateStored ? (toSessionDateKey(courseDateStored) || courseDateStored) : null) || metaCourseDate;

    if (!courseDateStored && metaCourseDate) {
      await client.query(
        `update public.pre_orders set course_date = $2, updated_at = now() where id = $1`,
        [preOrder.id, metaCourseDate]
      );
    }

    const enrollmentSessionDate = courseDateRaw || preOrder.course_date;

    const orderTypeRaw = preOrder.order_type;
    const orderType =
      orderTypeRaw == null || String(orderTypeRaw).trim() === ""
        ? "course"
        : String(orderTypeRaw).toLowerCase();
    // Only tuition "course" checkouts create enrollments, course_payments, and consume scheduled_courses seats.
    if (orderType !== "course" || !preOrder.course_id) {
      await client.query("commit");
      return;
    }

    const billingDetails = session.customer_details || {};
    const existingEnrollmentRes = await client.query(
      `select id
       from public.enrollments
       where pre_order_id = $1
       limit 1`,
      [preOrder.id]
    );
    const existingEnrollmentId = existingEnrollmentRes.rows[0]?.id ?? null;

    let enrollmentId = existingEnrollmentId;
    if (!enrollmentId) {
      const enrollmentRes = await client.query(
        `insert into public.enrollments (
           course_id, pre_order_id, provider_name, provider_email, customer_name,
           status, session_date, amount_paid, paid_at
         ) values ($1, $2, $3, $4, $5, 'paid', $6, $7, $8)
         returning id`,
        [
          preOrder.course_id,
          preOrder.id,
          preOrder.customer_name,
          preOrder.customer_email,
          preOrder.customer_name,
          enrollmentSessionDate,
          preOrder.amount_paid,
          paidAt
        ]
      );
      enrollmentId = enrollmentRes.rows[0].id;
    }

    const { rows: courseRows } = await client.query(
      `select location, session_dates
       from public.scheduled_courses
       where id = $1
       limit 1
       for update`,
      [preOrder.course_id]
    );
    const selectedCourse = courseRows[0] || null;

    let sessionDatesForWrite = selectedCourse?.session_dates;
    if (typeof sessionDatesForWrite === "string") {
      try {
        sessionDatesForWrite = JSON.parse(sessionDatesForWrite);
      } catch {
        sessionDatesForWrite = [];
      }
    }
    if (!Array.isArray(sessionDatesForWrite)) sessionDatesForWrite = [];

    let sessionDatesForEmail = sessionDatesForWrite;

    let decrementedSessionDates = false;
    let seatDecrementApplied = Boolean(existingPaymentSeatApplied);
    if (!seatDecrementApplied) {
      const selectedSessionEntry = findSessionEntryForSelection(sessionDatesForWrite, {
        courseDate: courseDateRaw,
        sessionId: metaSessionId,
        startTime: metaStartTime,
        endTime: metaEndTime
      });
      const resolvedSeat = selectedSessionEntry
        ? { entry: selectedSessionEntry, mapKey: selectedSessionEntry.date ?? selectedSessionEntry.session_date ?? courseDateRaw }
        : resolveDecrementTargetForPaidCourse(sessionDatesForWrite, courseDateRaw);

      if (resolvedSeat && canDecrementSessionDateSeat(resolvedSeat.entry)) {
        const nextSessionDates = decrementSessionDateSeatInArray(sessionDatesForWrite, resolvedSeat.mapKey);
        await client.query(
          `update public.scheduled_courses
           set session_dates = $1::jsonb, updated_at = now()
           where id = $2`,
          [JSON.stringify(nextSessionDates), preOrder.course_id]
        );
        sessionDatesForEmail = nextSessionDates;
        decrementedSessionDates = true;
        seatDecrementApplied = true;
      } else if (sessionDatesForWrite.length > 0) {
        const bookableRows = sessionDatesForWrite.filter((e) => canDecrementSessionDateSeat(e));
        // If course_date was never stored but there is exactly one bookable session row, consume that seat.
        if (!courseDateRaw && bookableRows.length === 1) {
          const only = bookableRows[0];
          const anchor = only.date ?? only.session_date;
          if (anchor) {
            // eslint-disable-next-line no-console
            console.warn("[checkout] paid course: pre_order.course_date empty; decrementing sole bookable session_dates row", {
              preOrderId: preOrder.id,
              courseId: preOrder.course_id
            });
            const nextSessionDates = decrementSessionDateSeatInArray(sessionDatesForWrite, anchor);
            await client.query(
              `update public.scheduled_courses
               set session_dates = $1::jsonb, updated_at = now()
               where id = $2`,
              [JSON.stringify(nextSessionDates), preOrder.course_id]
            );
            sessionDatesForEmail = nextSessionDates;
            decrementedSessionDates = true;
            seatDecrementApplied = true;
          }
        } else if (courseDateRaw) {
          const entryForSeat = findSessionEntryByDate(sessionDatesForWrite, courseDateRaw);
          // eslint-disable-next-line no-console
          console.error("[checkout] paid course: session_dates seat row not decremented", {
            preOrderId: preOrder.id,
            courseId: preOrder.course_id,
            courseDateRawStored: preOrder.course_date,
            courseDateRaw,
            normalizedCourseDateKey: toSessionDateKey(courseDateRaw),
            sessionDateKeys: sessionDatesForWrite.map((s) => [...sessionEntryCalendarKeys(s)].join("|")),
            entryFound: Boolean(entryForSeat),
            canDecrement: entryForSeat ? canDecrementSessionDateSeat(entryForSeat) : false,
            bookableRowCount: bookableRows.length
          });
        } else if (!courseDateRaw && bookableRows.length > 1) {
          // eslint-disable-next-line no-console
          console.error("[checkout] paid course: course_date missing and multiple bookable session_dates rows", {
            preOrderId: preOrder.id,
            courseId: preOrder.course_id,
            sessionDateKeys: sessionDatesForWrite.map((s) => [...sessionEntryCalendarKeys(s)].join("|"))
          });
        }
      }
    }

    // Course-level cap only when there is no per-date inventory in JSON (never use this branch to "skip" session_dates).
    if (!decrementedSessionDates && sessionDatesForWrite.length === 0 && !courseDateRaw) {
      await client.query(
        `update public.scheduled_courses
         set available_seats = case
           when available_seats is null then null
           when available_seats > 0 then available_seats - 1
           else 0
         end
         where id = $1`,
        [preOrder.course_id]
      );
    }

    // Final safety net: ensure per-date seats reflect the true paid enrollment count for this date.
    // This guards against historical data drift or any missed decrement path.
    if (sessionDatesForWrite.length > 0 && enrollmentSessionDate) {
      const targetEntry =
        findSessionEntryForSelection(sessionDatesForWrite, {
          courseDate: enrollmentSessionDate,
          sessionId: metaSessionId,
          startTime: metaStartTime,
          endTime: metaEndTime
        }) || findSessionEntryByDate(sessionDatesForWrite, enrollmentSessionDate);
      const targetDateKey = toSessionDateKey(enrollmentSessionDate);
      const targetMaxSeats = parseInt(String(targetEntry?.max_seats ?? ""), 10);
      if (targetEntry && targetDateKey && Number.isFinite(targetMaxSeats) && targetMaxSeats >= 0) {
        const { rows: paidEnrollRows } = await client.query(
          `select count(*)::int as count
           from public.enrollments
           where course_id = $1
             and session_date::date = $2::date
             and lower(coalesce(status, '')) = any($3::text[])`,
          [
            preOrder.course_id,
            targetDateKey,
            ["paid", "confirmed", "completed", "attended"].map(normalizePaidEnrollmentStatus)
          ]
        );
        const paidCount = Number(paidEnrollRows[0]?.count || 0);
        const expectedAvailable = Math.max(0, targetMaxSeats - paidCount);
        const currentAvailable = Number(targetEntry?.available_seats ?? NaN);
        if (!Number.isFinite(currentAvailable) || currentAvailable !== expectedAvailable) {
          const nextSessionDates = sessionDatesForWrite.map((entry) => {
            if (!sessionEntryCalendarKeys(entry).has(targetDateKey)) return entry;
            const sameSessionId = metaSessionId
              ? String(entry?.session_id || "") === String(metaSessionId)
              : true;
            if (!sameSessionId && targetEntry?.session_id) return entry;
            const maxSeats = parseInt(String(entry?.max_seats ?? targetMaxSeats), 10);
            const boundedMax = Number.isFinite(maxSeats) && maxSeats >= 0 ? maxSeats : targetMaxSeats;
            return { ...entry, max_seats: boundedMax, available_seats: Math.max(0, Math.min(boundedMax, expectedAvailable)) };
          });
          await client.query(
            `update public.scheduled_courses
             set session_dates = $1::jsonb, updated_at = now()
             where id = $2`,
            [JSON.stringify(nextSessionDates), preOrder.course_id]
          );
          sessionDatesForEmail = nextSessionDates;
          seatDecrementApplied = true;
        }
      }
    }

    // Always reconcile per-date inventory from enrollment counts (idempotent safety net).
    try {
      const synced = await syncScheduledCourseSessionSeats(preOrder.course_id, client);
      if (Array.isArray(synced)) sessionDatesForEmail = synced;
      seatDecrementApplied = true;
    } catch (syncErr) {
      // eslint-disable-next-line no-console
      console.error("[checkout] session seat sync failed:", syncErr?.message || syncErr);
    }

    let wasNewUser = false;
    let linkedUserId = null;
    const checkoutNames = resolveCheckoutCustomerNames({
      first_name: preOrder.first_name,
      last_name: preOrder.last_name,
      customer_name: preOrder.customer_name
    });

    try {
      await upsertProviderUserByEmail(client, {
        email: preOrder.customer_email,
        firstName: checkoutNames.firstName,
        lastName: checkoutNames.lastName
      });
    } catch (profileErr) {
      // Never block payment finalization on profile projection failures.
      // eslint-disable-next-line no-console
      console.error("[checkout] provider profile upsert skipped:", profileErr?.message || profileErr);
    }

    const inviteResult = await inviteUserIfNeeded(
      preOrder.customer_email,
      checkoutNames.firstName,
      checkoutNames.lastName,
      session?.metadata?.app_base_url || null,
      client,
      { customerName: preOrder.customer_name }
    );
    wasNewUser = Boolean(inviteResult?.wasNewUser);
    linkedUserId = inviteResult?.authUserId || null;

    if (linkedUserId) {
      await upsertProviderUserRow(client, {
        authUserId: linkedUserId,
        email: preOrder.customer_email,
        firstName: checkoutNames.firstName,
        lastName: checkoutNames.lastName
      });
    }

    const paymentStripeMetadata = {
      ...(session.metadata || {}),
      seat_decrement_applied: seatDecrementApplied
    };

    if (existingPaymentId) {
      if (seatDecrementApplied && !existingPaymentSeatApplied) {
        await client.query(
          `update public.course_payments
           set stripe_metadata = coalesce(stripe_metadata, '{}'::jsonb) || $2::jsonb,
               updated_at = now()
           where id = $1`,
          [existingPaymentId, JSON.stringify({ seat_decrement_applied: true })]
        );
      }
      postCommitPaymentId = existingPaymentId;
    } else {
      const paymentInsertRes = await client.query(
        `insert into public.course_payments (
          pre_order_id, enrollment_id, course_id, course_title,
          customer_name, customer_email, linked_user_id,
          stripe_session_id, stripe_payment_intent_id, stripe_customer_id,
          amount_total, amount_subtotal, currency,
          billing_name, billing_email, billing_phone, billing_address, stripe_metadata,
          status, was_new_user, confirmation_email_sent
        ) values (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13,
          $14, $15, $16, $17::jsonb, $18::jsonb,
          'completed', $19, false
        )
        returning id`,
        [
          preOrder.id,
          enrollmentId,
          preOrder.course_id,
          preOrder.course_title,
          preOrder.customer_name,
          preOrder.customer_email,
          linkedUserId,
          stripeSessionId,
          paymentIntentId,
          customerId,
          Number(session.amount_total || 0) / 100,
          Number(session.amount_subtotal || 0) / 100,
          session.currency || "usd",
          billingDetails.name || null,
          billingDetails.email || preOrder.customer_email,
          billingDetails.phone || null,
          JSON.stringify(billingDetails.address || {}),
          JSON.stringify(paymentStripeMetadata),
          wasNewUser
        ]
      );
      postCommitPaymentId = paymentInsertRes.rows[0]?.id ?? null;
    }

    // Enrich the centralized payment_transactions row with any data we now
    // have but didn't have at initiation time (charge id, customer id,
    // billing details, etc.). The webhook handler will also update payment
    // status to 'succeeded' on checkout.session.completed; this call is
    // additive and idempotent.
    await enrichPaymentTransaction(
      {
        stripe_session_id: stripeSessionId,
        stripe_payment_intent_id: paymentIntentId,
        pre_order_id: preOrder.id
      },
      {
        payment_status: "succeeded",
        amount_paid: Number(session.amount_total || 0) / 100,
        amount_total: Number(session.amount_total || 0) / 100,
        amount_subtotal: Number(session.amount_subtotal || 0) / 100,
        stripe_payment_intent_id: paymentIntentId,
        stripe_customer_id: customerId,
        stripe_checkout_status: session.status || null,
        stripe_payment_status: session.payment_status || null,
        billing_name: billingDetails.name || null,
        billing_email: billingDetails.email || preOrder.customer_email,
        billing_phone: billingDetails.phone || null,
        billing_address: billingDetails.address || null,
        linked_user_id: linkedUserId,
        stripe_metadata: paymentStripeMetadata
      },
      client
    );

    if (!existingPaymentConfirmationSent) {
      postCommitEmail = {
        to: preOrder.customer_email,
        customerName: preOrder.customer_name,
        courseTitle: preOrder.course_title,
        courseData: {
          course_session_dates: sessionDatesForEmail,
          course_location: selectedCourse?.location || ""
        },
        courseDate: enrollmentSessionDate
      };
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    postCommitEmail = null;
    postCommitPaymentId = null;
    throw error;
  } finally {
    client.release();
  }

  if (postCommitEmail) {
    try {
      const emailSent = await sendConfirmationEmail(postCommitEmail);
      if (postCommitPaymentId) {
        await query(
          `update public.course_payments
           set confirmation_email_sent = $1, updated_at = now()
           where id = $2`,
          [Boolean(emailSent), postCommitPaymentId]
        );
      }
    } catch (emailErr) {
      // eslint-disable-next-line no-console
      console.error("[checkout] post-commit confirmation email failed:", emailErr?.message || emailErr);
    }
  }
}
