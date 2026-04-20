import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../db.js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL || "NOVI Society <no-reply@novisocietyhub.com>";
const noviEmailLogoUrl = process.env.NOVI_EMAIL_LOGO_URL || `${appBaseUrl}/novi-email-logo.png`;

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
    let { rows } = await client.query(
      `select id, order_type, type, status, course_title, course_date, customer_email, amount_paid, paid_at, created_at
       from public.pre_orders
       where ${whereClause}
       limit 1`,
      values
    );
    let preOrder = rows[0] ?? null;

    // Fallback path: if webhook did not arrive yet but Stripe marks session as paid,
    // process the completed session on demand so confirmation page and email remain reliable.
    if (preOrder?.status !== "paid" && sessionId && stripe) {
      try {
        const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
        const isPaid = stripeSession?.payment_status === "paid" && stripeSession?.status === "complete";
        if (isPaid) {
          await processCompletedCheckoutSession(stripeSession);
          const refreshed = await client.query(
            `select id, order_type, type, status, course_title, course_date, customer_email, amount_paid, paid_at, created_at
             from public.pre_orders
             where ${whereClause}
             limit 1`,
            values
          );
          preOrder = refreshed.rows[0] ?? preOrder;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[checkout] pre-order fallback processing failed:", error);
      }
    }

    return preOrder;
  } finally {
    client.release();
  }
}

async function sendConfirmationEmail({ to, customerName, courseTitle, courseData, courseDate }) {
  if (!resendApiKey || !to) return false;
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
  const toDateKey = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  };

  let courseDateStr = formatCourseDate(courseDate);
  let courseTimeStr = "";
  let courseLocation = "";

  if (courseDate && courseData?.course_session_dates && Array.isArray(courseData.course_session_dates)) {
    const dateKey = toDateKey(courseDate);
    const selectedSession = dateKey
      ? courseData.course_session_dates.find((session) => toDateKey(session?.date) === dateKey)
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

  const courseDetailsRows = [
    `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:100px"><strong>Course</strong></td><td style="padding:6px 0;font-size:14px;color:#111827">${safeCourseName}</td></tr>`,
    courseDateStr ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px"><strong>Date</strong></td><td style="padding:6px 0;font-size:14px;color:#111827">${courseDateStr}</td></tr>` : "",
    courseTimeStr ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px"><strong>Time</strong></td><td style="padding:6px 0;font-size:14px;color:#111827">${courseTimeStr}</td></tr>` : "",
    courseLocation ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px"><strong>Location</strong></td><td style="padding:6px 0;font-size:14px;color:#111827">${courseLocation}</td></tr>` : ""
  ].filter(Boolean).join("");

  const logoMarkup = noviEmailLogoUrl
    ? `<img src="${noviEmailLogoUrl}" alt="NOVI Society" style="width:160px;height:auto" />`
    : `<div style="font-size:28px;font-weight:700;letter-spacing:0.04em;color:#ffffff">NOVI SOCIETY</div>`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'DM Sans',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:36px 40px;text-align:center;border-radius:16px 16px 0 0">
          ${logoMarkup}
        </td></tr>
        <tr><td style="background:#fff;padding:48px 40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Hi ${safeFirstName},</p>
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Welcome to NOVI Society - we're excited to have you with us.</p>
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Your enrollment for <strong>${safeCourseName}</strong> has been successfully confirmed.</p>

          <div style="background:#f9f8f6;border-radius:12px;padding:24px;margin-bottom:32px;border:1px solid rgba(0,0,0,0.07)">
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2D6B7F">Course Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              ${courseDetailsRows}
            </table>
          </div>

          <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">This immersive training is designed to take you from foundational knowledge to confident, hands-on application. You'll receive in-depth education on anatomy, product selection, injection techniques, and patient safety - along with live model experience to ensure you leave fully prepared.</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">As part of NOVI, this course is more than just training. It's your entry point into a fully supported system that includes:</p>

          <ul style="margin:0 0 32px;padding-left:20px;color:#374151;font-size:15px;line-height:1.9">
            <li>Ongoing mentorship and guidance</li>
            <li>Medical director oversight</li>
            <li>Compliance and scope-of-practice support</li>
            <li>Tools to help you launch and grow your aesthetic practice</li>
          </ul>

          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111827">What to Expect Next</p>
          <ul style="margin:0 0 32px;padding-left:20px;color:#374151;font-size:15px;line-height:1.9">
            <li>Additional course details and preparation instructions will be sent prior to your training date</li>
            <li>Any required forms or documentation will be provided for completion</li>
            <li>Our team will be available for any questions leading up to your course</li>
          </ul>

          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6">If you have any questions in the meantime, feel free to reach out - we're here to support you every step of the way.</p>

          <div style="border-top:1px solid #e5e7eb;padding-top:28px;margin-top:8px">
            <p style="margin:0 0 4px;font-size:15px;color:#374151">We look forward to seeing you soon.</p>
            <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:17px;color:#1e2535;font-style:italic">Welcome to NOVI.</p>
            <p style="margin:0 0 20px;font-size:14px;color:#6b7280;font-style:italic">A New Way to Be Seen.</p>
            <p style="margin:0;font-size:15px;color:#374151">Best,<br><strong>The NOVI Society Team</strong></p>
          </div>
        </td></tr>
        <tr><td style="padding:24px 40px;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">© ${new Date().getFullYear()} NOVI Society LLC · 8109 Meadow Valley Dr, McKinney, TX 75071</p>
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af"><a href="mailto:support@novisociety.com" style="color:#9ca3af">support@novisociety.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
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
    if (!res.ok) {
      const bodyText = await res.text();
      // eslint-disable-next-line no-console
      console.error("[checkout] resend send failed:", res.status, bodyText);
    }
    return res.ok;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[checkout] resend request failed:", error);
    return false;
  }
}

async function sendNewUserInviteEmail({ to, firstName, inviteLink }) {
  if (!resendApiKey || !to || !inviteLink) return false;
  const greetingName = firstName || "there";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'DM Sans',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:36px 40px;text-align:center;border-radius:16px 16px 0 0">
          <img src="${noviEmailLogoUrl}" alt="NOVI Society" style="width:160px;height:auto" />
        </td></tr>
        <tr><td style="background:#fff;padding:40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.6">Hi ${greetingName},</p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">Your NOVI Society account is ready. Use the button below to set your password and access your account.</p>
          <p style="margin:0 0 28px">
            <a href="${inviteLink}" style="display:inline-block;background:#2D6B7F;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;font-size:14px">
              Set up your account
            </a>
          </p>
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6">If the button does not work, copy and paste this link into your browser:<br>${inviteLink}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [to],
        subject: "Set up your NOVI Society account",
        html
      })
    });
    if (!res.ok) {
      const bodyText = await res.text();
      // eslint-disable-next-line no-console
      console.error("[checkout] invite resend failed:", res.status, bodyText);
    }
    return res.ok;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[checkout] invite resend request failed:", error);
    return false;
  }
}

async function inviteUserIfNeeded(email, firstName, lastName) {
  if (!supabaseAdmin || !email) return { wasNewUser: false, linkedUserId: null };
  try {
    const linkRes = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: {
          first_name: firstName || null,
          last_name: lastName || null
        },
        redirectTo: `${appBaseUrl}/`
      }
    });

    if (linkRes.error) {
      const message = String(linkRes.error.message || "");
      if (message.toLowerCase().includes("already")) {
        return { wasNewUser: false, linkedUserId: null };
      }
      // eslint-disable-next-line no-console
      console.error("[checkout] generate invite link failed:", linkRes.error);
      return { wasNewUser: false, linkedUserId: null };
    }

    const inviteLink = linkRes.data?.properties?.action_link || linkRes.data?.action_link;
    const linkedUserId = linkRes.data?.user?.id || null;

    let inviteSent = false;
    if (inviteLink) {
      inviteSent = await sendNewUserInviteEmail({ to: email, firstName, inviteLink });
    }

    if (!inviteSent) {
      const inviteRes = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          first_name: firstName || null,
          last_name: lastName || null
        },
        redirectTo: `${appBaseUrl}/`
      });
      if (inviteRes.error) {
        const message = String(inviteRes.error.message || "");
        if (!message.toLowerCase().includes("already")) {
          // eslint-disable-next-line no-console
          console.error("[checkout] supabase invite fallback failed:", inviteRes.error);
        }
      }
    }

    return { wasNewUser: true, linkedUserId };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[checkout] invite flow failed:", error);
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

    const { rows: courseRows } = await client.query(
      `select location, session_dates
       from public.scheduled_courses
       where id = $1
       limit 1`,
      [preOrder.course_id]
    );
    const selectedCourse = courseRows[0] || null;

    const { wasNewUser, linkedUserId } = await inviteUserIfNeeded(
      preOrder.customer_email,
      preOrder.first_name,
      preOrder.last_name
    );

    const emailSent = await sendConfirmationEmail({
      to: preOrder.customer_email,
      customerName: preOrder.customer_name,
      courseTitle: preOrder.course_title,
      courseData: {
        course_session_dates: selectedCourse?.session_dates || [],
        course_location: selectedCourse?.location || ""
      },
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
