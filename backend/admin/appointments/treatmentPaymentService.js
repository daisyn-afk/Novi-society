import Stripe from "stripe";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";
import { hasAdminAccess } from "../auth/helpers.js";
import { sendEmailFromTemplate } from "../emails/renderTemplate.js";
import {
  recordCheckoutInitiated,
  enrichPaymentTransaction,
  markAttemptFailed,
} from "../payments/service.js";
import {
  calculateCombinedInjectableTotal,
  calculateTreatmentTotal,
  getCombinedInjectableMenus,
  loadProviderOfferings,
  parseBillingQuantities,
  resolveOfferingForAppointment,
} from "../lib/treatmentPricing.js";
import { createMarketplaceCheckoutSession, retrieveMarketplaceCheckoutSession } from "../stripe-connect/checkout.js";
import { isStripeConnectConfigured } from "../stripe-connect/config.js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const TREATMENT_PAYMENT_FLOW = "appointment_treatment";

function parseMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function depositAlreadyPaid(appt) {
  const status = String(appt?.payment_status || "").toLowerCase();
  if (status === "paid") return parseMoney(appt?.amount_paid || appt?.deposit_amount);
  return 0;
}

async function loadTreatmentLogContext(treatmentRecordId) {
  const id = String(treatmentRecordId || "").trim();
  if (!id) return null;
  const { rows } = await query(
    `select units_used, units_label, areas_treated
       from public.treatment_records
      where id = $1
      limit 1`,
    [id]
  );
  return rows[0] || null;
}

async function computeMenuTreatmentTotal({ appt, body = {}, invoice = {} }) {
  const offerings = await loadProviderOfferings(appt.provider_id);
  const tr = await loadTreatmentLogContext(body.treatment_record_id || appt.treatment_record_id);
  const combinedBundle = getCombinedInjectableMenus(offerings, appt.service_type_id);
  const isCombined = Boolean(combinedBundle);

  if (isCombined && combinedBundle) {
    const billing = parseBillingQuantities({
      units_used: tr?.units_used ?? body.units_used ?? body.unitsUsed ?? invoice.units_used,
      units_label: tr?.units_label ?? body.units_label ?? invoice.units_label,
      syringes_used: body.syringes_used ?? invoice.syringes_used,
    });
    const unitsUsed = billing.units;
    const syringesUsed = billing.syringes;
    const areasTreated = tr?.areas_treated || body.areas_treated || body.areasTreated || invoice.areas_treated || [];
    const calc = calculateCombinedInjectableTotal({
      toxOffering: combinedBundle.tox.data,
      fillerOffering: combinedBundle.filler.data,
      unitsUsed,
      syringesUsed,
      areasTreated,
    });
    return {
      resolved: { key: `${combinedBundle.stId}_combined`, data: combinedBundle.tox.data },
      calc,
    };
  }

  const billing = parseBillingQuantities({
    units_used: tr?.units_used ?? body.units_used ?? body.unitsUsed ?? invoice.units_used,
    units_label: tr?.units_label ?? body.units_label ?? invoice.units_label,
  });

  const resolved = resolveOfferingForAppointment({
    serviceLabel: appt.service,
    serviceTypeId: appt.service_type_id,
    offerings,
    injectableSubKey: invoice.injectable_sub_key || body.injectable_sub_key,
    unitsLabel: tr?.units_label || body.units_label || body.unitsLabel || invoice.units_label,
    unitsUsed: billing.units || billing.syringes,
  });
  if (!resolved?.data) return { resolved: null, calc: null };

  const unitsUsed = billing.units || billing.syringes;
  const areasTreated = tr?.areas_treated || body.areas_treated || body.areasTreated || invoice.areas_treated || [];
  let chargeModes = invoice.charge_modes || body.charge_modes || body.chargeModes;
  if (!chargeModes?.length && !invoice.manual_override) {
    const hint = String(resolved.data?.pricing_model || "").toLowerCase();
    const units = Number(unitsUsed) || 0;
    const areaCount = Array.isArray(areasTreated) ? areasTreated.length : 0;
    chargeModes = [];
    if (hint.includes("per unit") || hint.includes("syringe")) {
      if (units > 0) chargeModes.push("unit");
      if (areaCount > 0) chargeModes.push("area");
    } else if (hint.includes("per area")) {
      if (areaCount > 0) chargeModes.push("area");
    } else {
      chargeModes.push("flat");
    }
    if (!chargeModes.length) {
      if (units > 0) chargeModes.push("unit");
      else if (areaCount > 0) chargeModes.push("area");
      else chargeModes.push("flat");
    }
  }

  const calc = calculateTreatmentTotal({
    offering: resolved.data,
    pricingModel: resolved.pricingModel,
    unitsUsed,
    areasTreated,
    chargeModes,
    unitRate: invoice.unit_rate ?? body.unit_rate ?? body.unitRate,
    areaRate: invoice.area_rate ?? body.area_rate ?? body.areaRate,
    flatAmount: invoice.flat_amount ?? body.flat_amount ?? body.flatAmount,
    finalTotal: invoice.manual_override ? invoice.total : undefined,
  });
  return { resolved, calc };
}

export async function requestAppointmentTreatmentPayment({
  token,
  appointmentId,
  body = {},
}) {
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

  const { rows } = await query(`select * from public.appointments where id = $1 limit 1`, [id]);
  const appt = rows[0];
  if (!appt) {
    const e = new Error("Appointment not found.");
    e.statusCode = 404;
    throw e;
  }
  if (appt.provider_id !== me.id && !hasAdminAccess(me.role)) {
    const e = new Error("Forbidden.");
    e.statusCode = 403;
    throw e;
  }

  const bookingDeposit = Number(appt.deposit_amount);
  if (
    Number.isFinite(bookingDeposit) &&
    bookingDeposit > 0 &&
    String(appt.payment_status || "").toLowerCase() !== "paid"
  ) {
    const e = new Error(
      "The patient must pay the booking deposit before you can send a treatment invoice for this visit."
    );
    e.statusCode = 409;
    throw e;
  }

  const treatmentPayStatus = String(appt.treatment_payment_status || "").toLowerCase();
  if (treatmentPayStatus === "paid") {
    const e = new Error(
      "This treatment balance has already been paid. You cannot send a new payment link for this visit."
    );
    e.statusCode = 409;
    throw e;
  }

  const invoice = body.invoice && typeof body.invoice === "object" ? body.invoice : {};
  const manualOverride = Boolean(invoice.manual_override);
  let treatmentTotal = parseMoney(invoice.total ?? body.total_amount);

  if (!manualOverride) {
    const { resolved, calc } = await computeMenuTreatmentTotal({ appt, body, invoice });
    if (calc && calc.total > 0) {
      treatmentTotal = calc.total;
      invoice.lines = calc.lines;
      invoice.subtotal = calc.subtotal;
      invoice.offering_key = resolved?.key || invoice.offering_key;
      invoice.menu_pricing_model = resolved?.data?.pricing_model || invoice.menu_pricing_model;
    }
  }

  const discount = Math.min(
    parseMoney(body.discount ?? invoice.discount),
    treatmentTotal
  );
  const totalAfterDiscount = Math.max(0, Math.round((treatmentTotal - discount) * 100) / 100);
  const depositCredit = parseMoney(invoice.deposit_credit ?? depositAlreadyPaid(appt));
  const amountDue = Math.max(0, Math.round((totalAfterDiscount - depositCredit) * 100) / 100);

  if (amountDue <= 0) {
    const e = new Error("Treatment amount must be greater than zero after discount and deposit credit.");
    e.statusCode = 400;
    throw e;
  }

  const invoiceWithTotals = {
    ...invoice,
    total: treatmentTotal,
    discount,
    total_after_discount: totalAfterDiscount,
    deposit_credit: depositCredit,
    amount_due: amountDue,
  };
  const treatmentRecordId = String(body.treatment_record_id || appt.treatment_record_id || "").trim() || null;

  await query(
    `update public.appointments
        set treatment_amount = $2,
            treatment_payment_status = 'awaiting_payment',
            treatment_invoice = $3::jsonb,
            total_amount = $2,
            treatment_record_id = coalesce($4, treatment_record_id),
            updated_at = now()
      where id = $1`,
    [id, amountDue, JSON.stringify(invoiceWithTotals), treatmentRecordId]
  );

  const serviceLabel = String(appt.service || "your visit").trim();
  const providerName = String(appt.provider_name || "your provider").trim();

  await query(
    `insert into public.notifications (user_id, user_email, type, message, link_page)
     values ($1, $2, 'general', $3, $4)`,
    [
      appt.patient_id,
      appt.patient_email,
      `${providerName} sent a treatment invoice for $${amountDue.toFixed(2)} (${serviceLabel}). Tap to pay.`,
      "PatientAppointments",
    ]
  ).catch(() => {});

  const patientEmail = String(appt.patient_email || "").trim();
  if (patientEmail) {
    try {
      await sendEmailFromTemplate("appointment_treatment_invoice", {
        to: patientEmail,
        first_name: String(appt.patient_name || "there").split(/\s+/)[0],
        amount_due: `$${amountDue.toFixed(2)}`,
        service_label: serviceLabel,
        provider_name: providerName,
      });
    } catch {
      // best effort — template may not exist yet
    }
  }

  const { rows: updatedRows } = await query(`select * from public.appointments where id = $1 limit 1`, [id]);
  return updatedRows[0] || appt;
}

export async function createAppointmentTreatmentCheckout({
  token,
  appointmentId,
  tracking = {},
  body = {},
}) {
  const serverReceivedAt = new Date().toISOString();
  const clientTimestamp = tracking.clientTimestamp || body.client_timestamp || null;

  const attemptId = await recordCheckoutInitiated({
    payment_flow: TREATMENT_PAYMENT_FLOW,
    payment_type: "appointment_treatment",
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
      const e = new Error("Only patients can pay for treatments.");
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

    const { rows: apptRows } = await query(`select * from public.appointments where id = $1 limit 1`, [appointmentId]);
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
    if (String(appt.treatment_payment_status || "").toLowerCase() !== "awaiting_payment") {
      const e = new Error("No treatment balance is due for this appointment.");
      e.statusCode = 409;
      throw e;
    }

    const amountDue = parseMoney(appt.treatment_amount);
    if (amountDue <= 0) {
      const e = new Error("Treatment amount is not set.");
      e.statusCode = 400;
      throw e;
    }

    const amountCents = Math.round(amountDue * 100);
    const customerEmail = String(appt.patient_email || me.email || "").trim().toLowerCase();
    const customerName = String(appt.patient_name || me.full_name || "Patient").trim();
    const serviceLabel = String(appt.service || "Treatment").trim();
    const providerName = String(appt.provider_name || "Provider").trim();
    const depositCredit = depositAlreadyPaid(appt);

    const base = String(appBaseUrl || "http://localhost:5173").replace(/\/$/, "");
    const successUrl = `${base}/PatientAppointments?payment=treatment_success&appointment_id=${encodeURIComponent(appointmentId)}`;
    const cancelUrl = `${base}/PatientAppointments?payment=treatment_cancelled&appointment_id=${encodeURIComponent(appointmentId)}`;

    const description =
      depositCredit > 0
        ? `${serviceLabel} with ${providerName} (booking deposit of $${depositCredit.toFixed(2)} already applied)`
        : `${serviceLabel} with ${providerName}`;

    const treatmentMetadata = {
      checkout_type: "appointment_treatment",
      appointment_id: appointmentId,
      provider_id: String(appt.provider_id || ""),
      patient_id: String(appt.patient_id || ""),
      treatment_record_id: String(appt.treatment_record_id || ""),
      customer_email: customerEmail,
      customer_name: customerName,
      service: serviceLabel,
      deposit_credit: String(depositCredit),
    };

    const { session: checkoutSession } = await createMarketplaceCheckoutSession({
      legacyStripe: stripe,
      providerAuthUserId: String(appt.provider_id || ""),
      amountCents,
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
              unit_amount: amountCents,
              product_data: {
                name: `Treatment — ${serviceLabel}`,
                description,
              },
            },
          },
        ],
        metadata: treatmentMetadata,
        payment_intent_data: { metadata: treatmentMetadata },
      },
    });

    await query(
      `update public.appointments
          set treatment_stripe_session_id = $2, updated_at = now()
        where id = $1`,
      [appointmentId, checkoutSession.id]
    );

    if (attemptId) {
      await enrichPaymentTransaction(
        { id: attemptId },
        {
          stripe_session_id: checkoutSession.id,
          stripe_checkout_status: checkoutSession.status || null,
        }
      );
    }

    return {
      sessionId: checkoutSession.id,
      sessionUrl: checkoutSession.url,
      amountDue,
      depositCredit,
    };
  } catch (error) {
    await markAttemptFailed(attemptId, {
      failure_reason: error?.statusCode ? String(error.statusCode) : "processing_error",
      failure_message: error?.message || "Treatment payment failed.",
      http_status_code: error?.statusCode || 500,
    });
    throw error;
  }
}

export async function processAppointmentTreatmentCheckoutCompletedSession(session) {
  const metadata = session?.metadata || {};
  if (String(metadata.checkout_type || "").toLowerCase() !== "appointment_treatment") return;

  const appointmentId = String(metadata.appointment_id || "").trim();
  if (!appointmentId) return;

  const paidAmount = Math.round((Number(session?.amount_total) || 0)) / 100;
  const stripeSessionId = String(session?.id || "");
  const nowIso = new Date().toISOString();

  const { rows } = await query(`select * from public.appointments where id = $1 limit 1`, [appointmentId]);
  const appt = rows[0];
  if (!appt) return;

  const priorPaid = parseMoney(appt.amount_paid);
  const newAmountPaid = Math.round((priorPaid + paidAmount) * 100) / 100;

  await query(
    `update public.appointments
        set treatment_payment_status = 'paid',
            treatment_paid_at = coalesce(treatment_paid_at, $2::timestamptz),
            treatment_stripe_session_id = coalesce(treatment_stripe_session_id, $3),
            amount_paid = $4,
            updated_at = now()
      where id = $1`,
    [appointmentId, nowIso, stripeSessionId || null, newAmountPaid]
  );

  await enrichPaymentTransaction(
    { stripe_session_id: stripeSessionId },
    {
      item_id: appointmentId,
      item_name: appt.service ? `${appt.service} — treatment payment` : "Treatment payment",
      amount_paid: paidAmount,
      payment_status: "succeeded",
      linked_user_id: appt.patient_id || null,
      stripe_payment_intent_id: String(session?.payment_intent || ""),
      stripe_checkout_status: session?.status || null,
      stripe_payment_status: session?.payment_status || null,
      metadata: { appointment_id: appointmentId, checkout_type: "appointment_treatment" },
    }
  );

  await query(
    `insert into public.notifications (user_id, user_email, type, message, link_page)
     values ($1, $2, 'general', $3, $4)`,
    [
      appt.provider_id,
      null,
      `Treatment payment received ($${paidAmount.toFixed(2)}) from ${appt.patient_name || "a patient"} for ${appt.service || "an appointment"}.`,
      "ProviderPractice",
    ]
  ).catch(() => {});

  const patientEmail = String(appt.patient_email || metadata.customer_email || "").trim();
  if (patientEmail) {
    try {
      await sendEmailFromTemplate("appointment_treatment_paid", {
        to: patientEmail,
        first_name: String(appt.patient_name || "there").split(/\s+/)[0],
        amount_paid: `$${paidAmount.toFixed(2)}`,
        service_label: appt.service || "your treatment",
        provider_name: appt.provider_name || "your provider",
      });
    } catch {
      // best effort
    }
  }
}

export async function syncAppointmentTreatmentPayment({ token, appointmentId, stripeSessionId }) {
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

  const { rows: apptRows } = await query(`select * from public.appointments where id = $1 limit 1`, [id]);
  const appt = apptRows[0];
  if (!appt) {
    const e = new Error("Appointment not found.");
    e.statusCode = 404;
    throw e;
  }
  if (appt.patient_id !== me.id && !hasAdminAccess(me.role)) {
    const e = new Error("Forbidden.");
    e.statusCode = 403;
    throw e;
  }
  if (String(appt.treatment_payment_status || "").toLowerCase() === "paid") {
    return appt;
  }

  let sessionId = String(stripeSessionId || appt.treatment_stripe_session_id || "").trim();
  if (!sessionId) {
    const e = new Error("No Stripe checkout session found for this treatment payment.");
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

  await processAppointmentTreatmentCheckoutCompletedSession(session);

  const { rows: updatedRows } = await query(`select * from public.appointments where id = $1 limit 1`, [id]);
  return updatedRows[0] || appt;
}

/** Provider preview: suggested invoice from treatment menu + logged units/areas. */
export async function previewTreatmentInvoice({ token, appointmentId, body = {} }) {
  if (!token) {
    const e = new Error("Missing bearer token.");
    e.statusCode = 401;
    throw e;
  }
  const me = await getMeFromAccessToken(token);
  const id = String(appointmentId || "").trim();

  const { rows } = await query(`select * from public.appointments where id = $1 limit 1`, [id]);
  const appt = rows[0];
  if (!appt) {
    const e = new Error("Appointment not found.");
    e.statusCode = 404;
    throw e;
  }
  if (appt.provider_id !== me.id && !hasAdminAccess(me.role)) {
    const e = new Error("Forbidden.");
    e.statusCode = 403;
    throw e;
  }

  const { resolved, calc } = await computeMenuTreatmentTotal({ appt, body });
  if (!calc) {
    return {
      offering_key: null,
      pricing_model: null,
      lines: [],
      subtotal: 0,
      total: 0,
      deposit_credit: depositAlreadyPaid(appt),
      amount_due: 0,
    };
  }

  const depositCredit = depositAlreadyPaid(appt);
  const amountDue = Math.max(0, Math.round((calc.total - depositCredit) * 100) / 100);

  return {
    offering_key: resolved?.key || null,
    pricing_model: resolved?.pricingModel || null,
    menu_pricing_model: resolved?.data?.pricing_model || null,
    lines: calc.lines,
    subtotal: calc.subtotal,
    total: calc.total,
    deposit_credit: depositCredit,
    amount_due: amountDue,
  };
}
