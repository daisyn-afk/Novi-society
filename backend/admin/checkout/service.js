import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../db.js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL || "NOVI Society <no-reply@novisocietyhub.com>";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

function normalizePromoCode(code) {
  return String(code || "").trim().toUpperCase();
}

function computeDiscount({ discountType, discountValue, subtotal }) {
  if (!discountType || !discountValue || subtotal <= 0) return 0;
  if (discountType === "percent" || discountType === "percentage") {
    return Math.min(subtotal, (subtotal * Number(discountValue)) / 100);
  }
  if (discountType === "fixed") return Math.min(subtotal, Number(discountValue));
  return 0;
}

function formatCurrencyAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export async function createCourseCheckout(payload) {
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");

  const {
    course_id,
    course_date,
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

  if (!course_id || !customer_email || !customer_name || !license_number || !license_image_url) {
    const err = new Error("Missing required checkout fields.");
    err.statusCode = 400;
    throw err;
  }

  if (!terms_confirmed || !refund_policy_confirmed) {
    const err = new Error("Terms and refund policy confirmations are required.");
    err.statusCode = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const courseRes = await client.query(
      `select id, title, price, available_seats, is_active
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
    if (course.available_seats !== null && Number(course.available_seats) <= 0) {
      const err = new Error("This course is sold out.");
      err.statusCode = 409;
      throw err;
    }

    const subtotal = Number(course.price || 0);
    let promoRecord = null;
    if (promo_code) {
      const normalizedCode = normalizePromoCode(promo_code);
      const promoRes = await client.query(
        `select id, code, discount_type, discount_value, max_uses, times_used, active, starts_at, ends_at
         from public.course_promo_codes
         where upper(code) = $1
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
        course_date || null,
        customer_name,
        customer_email,
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

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email,
      success_url: `${appBaseUrl}/PreOrderConfirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/`,
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
      metadata: {
        pre_order_id: preOrderId,
        course_id: String(course.id),
        provider_email: String(customer_email),
        provider_name: String(customer_name),
        app_source: "novi-landing"
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

    const promoRes = await client.query(
      `select id, code, discount_type, discount_value, max_uses, times_used, active, starts_at, ends_at
       from public.course_promo_codes
       where upper(code) = $1
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
    const { rows } = await client.query(
      `select id, order_type, type, status, course_title, course_date, customer_email, amount_paid, paid_at, created_at
       from public.pre_orders
       where ${whereClause}
       limit 1`,
      values
    );
    return rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function sendConfirmationEmail({ to, customerName, courseTitle, amountPaid, courseDate }) {
  if (!resendApiKey || !to) return false;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #1e2535; line-height: 1.55;">
      <h2 style="margin-bottom: 8px;">Enrollment Confirmed</h2>
      <p>Hi ${customerName || "there"},</p>
      <p>Your payment was received and your NOVI course enrollment is confirmed.</p>
      <div style="padding: 12px; border: 1px solid #d8e2b2; background: #f7faea; border-radius: 8px;">
        <p style="margin: 0;"><strong>Course:</strong> ${courseTitle || "-"}</p>
        <p style="margin: 0;"><strong>Date:</strong> ${courseDate || "-"}</p>
        <p style="margin: 0;"><strong>Amount paid:</strong> $${formatCurrencyAmount(amountPaid)}</p>
      </div>
      <p style="margin-top: 14px;">Thanks,<br/>NOVI Society Team</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [to],
      subject: "Your NOVI course enrollment is confirmed",
      html
    })
  });
  return res.ok;
}

async function inviteUserIfNeeded(email, firstName, lastName) {
  if (!supabaseAdmin || !email) return { wasNewUser: false, linkedUserId: null };
  try {
    const inviteRes = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name: firstName || null,
        last_name: lastName || null
      }
    });
    if (inviteRes.error) {
      const message = inviteRes.error.message || "";
      if (message.toLowerCase().includes("already")) {
        return { wasNewUser: false, linkedUserId: null };
      }
      return { wasNewUser: false, linkedUserId: null };
    }
    return { wasNewUser: true, linkedUserId: inviteRes.data?.user?.id || null };
  } catch {
    return { wasNewUser: false, linkedUserId: null };
  }
}

export function getStripeWebhookSecret() {
  return stripeWebhookSecret;
}

export function verifyStripeWebhook(rawBodyBuffer, signatureHeader) {
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  if (!stripeWebhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return stripe.webhooks.constructEvent(rawBodyBuffer, signatureHeader, stripeWebhookSecret);
}

export async function processCompletedCheckoutSession(session) {
  const stripeSessionId = session?.id;
  if (!stripeSessionId) return;

  const client = await pool.connect();
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
    if (preOrder.status === "paid") {
      await client.query("commit");
      return;
    }

    const paidAt = new Date().toISOString();
    const paymentIntentId = session.payment_intent ? String(session.payment_intent) : null;
    const customerId = session.customer ? String(session.customer) : null;

    await client.query(
      `update public.pre_orders
       set status = 'paid',
           paid_at = $2,
           stripe_payment_intent_id = coalesce($3, stripe_payment_intent_id),
           stripe_customer_id = coalesce($4, stripe_customer_id)
       where id = $1`,
      [preOrder.id, paidAt, paymentIntentId, customerId]
    );

    const billingDetails = session.customer_details || {};
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
        preOrder.course_date,
        preOrder.amount_paid,
        paidAt
      ]
    );
    const enrollmentId = enrollmentRes.rows[0].id;

    const { wasNewUser, linkedUserId } = await inviteUserIfNeeded(
      preOrder.customer_email,
      preOrder.first_name,
      preOrder.last_name
    );

    const emailSent = await sendConfirmationEmail({
      to: preOrder.customer_email,
      customerName: preOrder.customer_name,
      courseTitle: preOrder.course_title,
      amountPaid: preOrder.amount_paid,
      courseDate: preOrder.course_date
    });

    await client.query(
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
        'completed', $19, $20
      )`,
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
        JSON.stringify(session.metadata || {}),
        wasNewUser,
        emailSent
      ]
    );

    // Keep current business behavior requested: decrement seat again in webhook.
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

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
