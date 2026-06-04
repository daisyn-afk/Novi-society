import Stripe from "stripe";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";
import { hasAdminAccess } from "../auth/helpers.js";
import { sendEmailFromTemplate } from "../emails/renderTemplate.js";
import {
  recordCheckoutInitiated,
  enrichPaymentTransaction,
  markAttemptFailed,
  PAYMENT_FLOW,
} from "../payments/service.js";
import { createMarketplaceCheckoutSession, retrieveMarketplaceCheckoutSession } from "../stripe-connect/checkout.js";
import { isStripeConnectConfigured } from "../stripe-connect/config.js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";

export const DEFAULT_APPOINTMENT_DEPOSIT_USD = 50;
export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

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

function toCurrencyCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function formatDepositUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

/** Booking deposit from provider profile metadata. Empty/unset = no deposit ($0). */
export async function resolveProviderBookingDeposit(providerId) {
  const pid = String(providerId || "").trim();
  if (!pid) return 0;
  const { rows } = await query(
    `select pp.metadata
       from public.users u
       left join public.provider_profiles pp
         on pp.user_id = u.id
      where u.auth_user_id::text = $1 or u.id::text = $1
      limit 1`,
    [pid]
  );
  const metadata =
    rows[0]?.metadata && typeof rows[0].metadata === "object" ? rows[0].metadata : {};

  if (
    metadata.booking_deposit == null ||
    metadata.booking_deposit === ""
  ) {
    return 0;
  }

  const fixed = Number(metadata.booking_deposit);
  if (Number.isFinite(fixed) && fixed >= 0) return fixed;

  return 0;
}

/** Deposit for an appointment. While awaiting payment, always use current Practice Profile. */
export async function resolveAppointmentDeposit(appointment) {
  const status = String(appointment?.status || "").toLowerCase();
  if (status === "awaiting_payment") {
    return resolveProviderBookingDeposit(appointment?.provider_id);
  }
  const saved = Number(appointment?.deposit_amount);
  if (Number.isFinite(saved) && saved >= 0) return saved;
  return resolveProviderBookingDeposit(appointment?.provider_id);
}

/**
 * Sync awaiting_payment rows with the provider's current booking_deposit.
 * Fixes legacy rows that still have deposit_amount=50 from the old platform default.
 */
export async function enrichAppointmentDepositFields(appointment) {
  if (!appointment || typeof appointment !== "object") return appointment;
  const status = String(appointment.status || "").toLowerCase();
  if (status !== "awaiting_payment") return appointment;

  const deposit = await resolveProviderBookingDeposit(appointment.provider_id);
  const id = String(appointment.id || "").trim();

  if (deposit <= 0 && id) {
    const nowIso = new Date().toISOString();
    await query(
      `update public.appointments
          set status = 'confirmed',
              deposit_amount = 0,
              payment_status = 'unpaid',
              amount_paid = 0,
              confirmed_at = coalesce(confirmed_at, $2::timestamptz),
              updated_at = now()
        where id = $1
          and status = 'awaiting_payment'`,
      [id, nowIso]
    );
    return {
      ...appointment,
      status: "confirmed",
      deposit_amount: 0,
      payment_status: "unpaid",
      amount_paid: 0,
      confirmed_at: appointment.confirmed_at || nowIso,
    };
  }

  if (id && Number(appointment.deposit_amount) !== deposit) {
    await query(
      `update public.appointments set deposit_amount = $2, updated_at = now() where id = $1`,
      [id, deposit]
    );
  }

  return {
    ...appointment,
    deposit_amount: deposit,
  };
}

export async function processAppointmentCheckoutCompletedSession(session) {
  const metadata = session?.metadata || {};
  if (String(metadata.checkout_type || "").toLowerCase() !== "appointment") return;

  const appointmentId = String(metadata.appointment_id || "").trim();
  if (!appointmentId) return;

  const paidAmount = toCurrencyCents(session?.amount_total ?? 0) / 100;
  const stripeSessionId = String(session?.id || "");
  const stripePaymentIntentId = String(session?.payment_intent || "");
  const nowIso = new Date().toISOString();

  const { rows } = await query(
    `select id, status, patient_id, patient_email, provider_name, service
       from public.appointments
      where id = $1
      limit 1`,
    [appointmentId]
  );
  const appt = rows[0];
  if (!appt) return;

  const setParts = [
    "amount_paid = $2",
    "payment_status = 'paid'",
    "deposit_paid_at = coalesce(deposit_paid_at, $3::timestamptz)",
    "updated_at = now()",
  ];
  const params = [appointmentId, paidAmount, nowIso];

  if (await hasAppointmentColumn("stripe_session_id")) {
    setParts.push(`stripe_session_id = coalesce(stripe_session_id, $${params.length + 1})`);
    params.push(stripeSessionId || null);
  }
  if (await hasAppointmentColumn("stripe_payment_intent_id")) {
    setParts.push(`stripe_payment_intent_id = coalesce(stripe_payment_intent_id, $${params.length + 1})`);
    params.push(stripePaymentIntentId || null);
  }
  if (String(appt.status || "").toLowerCase() === "awaiting_payment") {
    setParts.push(`status = $${params.length + 1}`);
    params.push("confirmed");
    if (await hasAppointmentColumn("confirmed_at")) {
      setParts.push(`confirmed_at = coalesce(confirmed_at, $${params.length + 1}::timestamptz)`);
      params.push(nowIso);
    }
  }

  await query(
    `update public.appointments set ${setParts.join(", ")} where id = $1`,
    params
  );

  const wasAwaitingPayment = String(appt.status || "").toLowerCase() === "awaiting_payment";
  if (wasAwaitingPayment) {
    const { rows: postRows } = await query(
      `select provider_id, patient_name, service from public.appointments where id = $1 limit 1`,
      [appointmentId]
    );
    const post = postRows[0];
    if (post?.provider_id) {
      await query(
        `insert into public.notifications (user_id, user_email, type, message, link_page)
         values ($1, $2, 'general', $3, $4)`,
        [
          post.provider_id,
          null,
          `Deposit received for ${post.patient_name || "a patient"}'s ${post.service || "appointment"}. Appointment is confirmed.`,
          "ProviderPractice",
        ]
      ).catch(() => {});
    }
  }

  await enrichPaymentTransaction(
    { stripe_session_id: stripeSessionId },
    {
      item_id: appointmentId,
      item_name: appt.service ? `${appt.service} — appointment deposit` : "Appointment deposit",
      amount_paid: paidAmount,
      payment_status: "succeeded",
      linked_user_id: appt.patient_id || null,
      stripe_payment_intent_id: stripePaymentIntentId || null,
      stripe_checkout_status: session?.status || null,
      stripe_payment_status: session?.payment_status || null,
      metadata: { appointment_id: appointmentId },
    }
  );

  const patientEmail = String(appt.patient_email || metadata.customer_email || "").trim();
  if (patientEmail) {
    try {
      await sendEmailFromTemplate("appointment_deposit_received", {
        to: patientEmail,
        first_name: String(appt.patient_name || "there").split(/\s+/)[0],
        deposit_amount: `$${paidAmount.toFixed(2)}`,
        service_label: appt.service || "your appointment",
        provider_name: appt.provider_name || "your provider",
      });
    } catch {
      // best effort
    }
  }
}

/**
 * Create a Stripe Checkout session for an appointment deposit.
 * Called by POST /admin/appointments/:id/deposit-checkout (native API).
 */
export async function createAppointmentDepositCheckout({
  token,
  appointmentId,
  tracking = {},
  body = {},
}) {
  const serverReceivedAt = new Date().toISOString();
  const clientTimestamp = tracking.clientTimestamp || body.client_timestamp || null;

  const attemptId = await recordCheckoutInitiated({
    payment_flow: PAYMENT_FLOW.APPOINTMENT,
    payment_type: "appointment_deposit",
    selected_item_id: appointmentId || null,
    item_id: appointmentId || null,
    source_context: body.source_context || "patient_appointments",
    source_origin: tracking.sourceOrigin || null,
    request_ip: tracking.requestIp || null,
    user_agent: tracking.userAgent || null,
    client_timestamp: clientTimestamp,
    server_received_timestamp: serverReceivedAt,
    request_payload_snapshot: body,
    metadata: { appointment_id: appointmentId || null },
  });

  try {
    if (!token) {
      const e = new Error("Missing bearer token.");
      e.statusCode = 401;
      throw e;
    }
    const me = await getMeFromAccessToken(token);
    const role = String(me.role || "").toLowerCase();
    if (role !== "patient" && !hasAdminAccess(me.role)) {
      const e = new Error("Only patients can pay for appointments.");
      e.statusCode = 403;
      throw e;
    }
    if (!appointmentId) {
      const e = new Error("appointment_id is required.");
      e.statusCode = 400;
      throw e;
    }
    if (!stripe && !isStripeConnectConfigured()) {
      const e = new Error("Stripe is not configured.");
      e.statusCode = 500;
      throw e;
    }

    const { rows: apptRows } = await query(
      `select * from public.appointments where id = $1 limit 1`,
      [appointmentId]
    );
    const appt = apptRows[0];
    if (!appt) {
      const e = new Error("Appointment not found.");
      e.statusCode = 404;
      throw e;
    }
    if (appt.patient_id !== me.id && !hasAdminAccess(me.role)) {
      const e = new Error("You can only pay for your own appointments.");
      e.statusCode = 403;
      throw e;
    }
    if (String(appt.status || "").toLowerCase() !== "awaiting_payment") {
      const e = new Error("This appointment is not awaiting payment.");
      e.statusCode = 409;
      throw e;
    }
    if (String(appt.payment_status || "").toLowerCase() === "paid") {
      const e = new Error("Deposit already paid for this appointment.");
      e.statusCode = 409;
      throw e;
    }

    const depositUsd = await resolveAppointmentDeposit(appt);
    const depositCents = Math.round(depositUsd * 100);
    if (depositCents <= 0) {
      const e = new Error("No deposit amount configured for this appointment.");
      e.statusCode = 400;
      throw e;
    }

    if (await hasAppointmentColumn("deposit_amount")) {
      await query(
        `update public.appointments set deposit_amount = $2, updated_at = now() where id = $1`,
        [appointmentId, depositUsd]
      );
    }

    const customerEmail = String(appt.patient_email || me.email || "").trim().toLowerCase();
    const customerName = String(appt.patient_name || me.full_name || "Patient").trim();
    const serviceLabel = String(appt.service || "Appointment").trim();
    const providerName = String(appt.provider_name || "Provider").trim();

    const base = String(appBaseUrl || "http://localhost:5173").replace(/\/$/, "");
    const successUrl = `${base}/PatientAppointments?payment=success&appointment_id=${encodeURIComponent(appointmentId)}`;
    const cancelUrl = `${base}/PatientAppointments?payment=cancelled&appointment_id=${encodeURIComponent(appointmentId)}`;

    const checkoutMetadata = {
      checkout_type: "appointment",
      appointment_id: appointmentId,
      provider_id: String(appt.provider_id || ""),
      patient_id: String(appt.patient_id || ""),
      customer_email: customerEmail,
      customer_name: customerName,
      service: serviceLabel,
    };

    const { session: checkoutSession } = await createMarketplaceCheckoutSession({
      legacyStripe: stripe,
      providerAuthUserId: String(appt.provider_id || ""),
      amountCents: depositCents,
      sessionCreateParams: {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: customerEmail || undefined,
        success_url: successUrl,
        cancel_url: cancelUrl,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: depositCents,
              product_data: {
                name: `${serviceLabel} — deposit`,
                description: `Appointment deposit with ${providerName}`,
              },
            },
          },
        ],
        metadata: checkoutMetadata,
        payment_intent_data: { metadata: checkoutMetadata },
      },
    });

    const sessionUrl = checkoutSession.url;
    if (!sessionUrl) {
      const e = new Error("Checkout session did not return a URL.");
      e.statusCode = 500;
      throw e;
    }

    const updateParts = ["payment_status = 'pending'", "updated_at = now()"];
    const updateParams = [appointmentId];
    if (await hasAppointmentColumn("stripe_session_id")) {
      updateParts.push(`stripe_session_id = $${updateParams.length + 1}`);
      updateParams.push(checkoutSession.id);
    }
    await query(
      `update public.appointments set ${updateParts.join(", ")} where id = $1`,
      updateParams
    );

    await enrichPaymentTransaction(
      { id: attemptId },
      {
        user_id: me.id,
        linked_user_id: me.id,
        customer_email: customerEmail,
        customer_name: customerName,
        item_id: appointmentId,
        item_name: `${serviceLabel} — appointment deposit`,
        amount_subtotal: depositUsd,
        amount_total: depositUsd,
        currency: "usd",
        stripe_session_id: checkoutSession.id,
        stripe_payment_intent_id: checkoutSession.payment_intent
          ? String(checkoutSession.payment_intent)
          : null,
        stripe_checkout_url: sessionUrl,
        receipt_email: customerEmail,
        metadata: { appointment_id: appointmentId, provider_id: appt.provider_id },
      }
    );

    return {
      sessionUrl,
      checkout_url: sessionUrl,
      stripe_session_id: checkoutSession.id,
      deposit_amount: depositUsd,
    };
  } catch (error) {
    await markAttemptFailed(attemptId, {
      failure_reason: error?.statusCode ? String(error.statusCode) : "processing_error",
      failure_message: error?.message || "Appointment payment failed.",
      http_status_code: error?.statusCode || 500,
    });
    throw error;
  }
}

/** Provider confirms a request and asks the patient to pay the deposit (or confirms with $0 deposit). */
export async function requestAppointmentDeposit({ token, appointmentId, body = {} }) {
  if (!token) {
    const e = new Error("Missing bearer token.");
    e.statusCode = 401;
    throw e;
  }
  const me = await getMeFromAccessToken(token);
  const id = String(appointmentId || "").trim();
  if (!id) {
    const e = new Error("Appointment id is required.");
    e.statusCode = 400;
    throw e;
  }

  const { rows: existingRows } = await query(
    `select * from public.appointments where id = $1 limit 1`,
    [id]
  );
  const existing = existingRows[0];
  if (!existing) {
    const e = new Error("Appointment not found.");
    e.statusCode = 404;
    throw e;
  }
  const isProvider =
    existing.provider_id === me.id || hasAdminAccess(me.role);
  if (!isProvider) {
    const e = new Error("Forbidden.");
    e.statusCode = 403;
    throw e;
  }
  if (String(existing.status || "").toLowerCase() !== "requested") {
    const e = new Error("Only pending appointment requests can be sent for deposit payment.");
    e.statusCode = 409;
    throw e;
  }

  // Deposit always comes from Practice Profile (booking_deposit), not per-appointment input.
  const depositAmount = await resolveProviderBookingDeposit(existing.provider_id);
  const nowIso = new Date().toISOString();

  if (depositAmount <= 0) {
    const { rows } = await query(
      `update public.appointments
          set status = 'confirmed',
              confirmed_at = coalesce(confirmed_at, $2::timestamptz),
              deposit_amount = 0,
              payment_status = 'unpaid',
              amount_paid = 0,
              updated_at = now()
        where id = $1
        returning *`,
      [id, nowIso]
    );
    const updated = rows[0];
    await query(
      `insert into public.notifications (user_id, user_email, type, message, link_page)
       values ($1, $2, 'general', $3, $4)`,
      [
        updated.patient_id,
        updated.patient_email,
        `Your appointment with ${updated.provider_name || "your provider"} on ${updated.appointment_date || "the scheduled date"} is confirmed — no deposit required.`,
        "PatientAppointments",
      ]
    ).catch(() => {});
    return updated;
  }

  const { rows } = await query(
    `update public.appointments
        set status = 'awaiting_payment',
            confirmed_at = coalesce(confirmed_at, $2::timestamptz),
            deposit_amount = $3,
            updated_at = now()
      where id = $1
      returning *`,
    [id, nowIso, depositAmount]
  );
  const updated = rows[0];

  await query(
    `insert into public.notifications (user_id, user_email, type, message, link_page)
     values ($1, $2, 'general', $3, $4)`,
    [
      updated.patient_id,
      updated.patient_email,
      `Your appointment with ${updated.provider_name || "your provider"} has been confirmed! Please pay your $${formatDepositUsd(depositAmount)} deposit to secure your visit.`,
      "PatientAppointments",
    ]
  ).catch(() => {});

  return updated;
}

/**
 * After Stripe redirect, confirm deposit payment when webhooks are delayed (e.g. local dev).
 * Idempotent — safe if checkout.session.completed already ran.
 */
export async function syncAppointmentDepositPayment({ token, appointmentId, stripeSessionId }) {
  if (!token) {
    const e = new Error("Missing bearer token.");
    e.statusCode = 401;
    throw e;
  }
  const me = await getMeFromAccessToken(token);
  const id = String(appointmentId || "").trim();
  if (!id) {
    const e = new Error("Appointment id is required.");
    e.statusCode = 400;
    throw e;
  }
  if (!stripe && !isStripeConnectConfigured()) {
    const e = new Error("Stripe is not configured.");
    e.statusCode = 500;
    throw e;
  }

  const { rows: apptRows } = await query(
    `select * from public.appointments where id = $1 limit 1`,
    [id]
  );
  const appt = apptRows[0];
  if (!appt) {
    const e = new Error("Appointment not found.");
    e.statusCode = 404;
    throw e;
  }

  const role = String(me.role || "").toLowerCase();
  const isOwner = appt.patient_id === me.id;
  if (!isOwner && !hasAdminAccess(me.role)) {
    const e = new Error("Forbidden.");
    e.statusCode = 403;
    throw e;
  }

  if (String(appt.payment_status || "").toLowerCase() === "paid") {
    return appt;
  }

  let sessionId = String(stripeSessionId || appt.stripe_session_id || "").trim();
  if (!sessionId) {
    const { rows: txRows } = await query(
      `select stripe_session_id
         from public.payment_transactions
        where item_id = $1
          and payment_flow = 'appointment'
          and stripe_session_id is not null
        order by created_at desc
        limit 1`,
      [id]
    );
    sessionId = String(txRows[0]?.stripe_session_id || "").trim();
  }
  if (!sessionId) {
    const e = new Error("No Stripe checkout session found for this appointment.");
    e.statusCode = 409;
    throw e;
  }

  const { session } = await retrieveMarketplaceCheckoutSession({
    legacyStripe: stripe,
    sessionId,
  });
  const paid =
    String(session?.payment_status || "").toLowerCase() === "paid" ||
    String(session?.status || "").toLowerCase() === "complete";

  if (!paid) {
    const e = new Error("Payment has not completed yet.");
    e.statusCode = 409;
    throw e;
  }

  await processAppointmentCheckoutCompletedSession(session);

  const { rows: updatedRows } = await query(
    `select * from public.appointments where id = $1 limit 1`,
    [id]
  );
  return updatedRows[0] || appt;
}
