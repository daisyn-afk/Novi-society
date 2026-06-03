import Stripe from "stripe";
import { query } from "./db.js";
import { insertAppNotification } from "./certificationNotifications.js";
import { monthlyFeeForNewMdService } from "./mdMembershipPricing.js";
import { submitMdBoardCoverageAssignment } from "./mdAssignmentService.js";
import { attachSignedContractToSubscription, getServiceTypeContractInfo } from "./mdContractPdfService.js";
import { getProviderIdAliases } from "./mdSupervisedAccess.js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
export const mdStripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const CHECKOUT_TYPE = "md_board_coverage";

function s(v) {
  return String(v ?? "").trim();
}

async function persistMdSubscriptionSignature(row, { signatureData, signedByName, signedAtIso } = {}) {
  if (!row?.id || !signatureData) return row;
  const touchIso = signedAtIso || row.signed_at || new Date().toISOString();
  const { rows } = await query(
    `update public.md_subscription
        set signature_data = coalesce(signature_data, $2),
            signed_at = coalesce(signed_at, $3::timestamptz),
            signed_by_name = coalesce(nullif($4, ''), signed_by_name),
            updated_at = now()
      where id = $1::uuid
      returning *`,
    [row.id, signatureData, touchIso, signedByName || row.signed_by_name || null]
  );
  return rows[0] || row;
}

async function maybeStoreSignedContract(subscriptionRow, { signatureData, signedByName, signedAtIso, force = false } = {}) {
  let row = subscriptionRow;
  if (signatureData && row?.id && !row.signature_data) {
    row = await persistMdSubscriptionSignature(row, { signatureData, signedByName, signedAtIso });
  }
  const sig = signatureData || row?.signature_data;
  if (!row?.id || !sig) {
    return row?.signed_contract_url || null;
  }
  if (row.signed_contract_url && !force) {
    return row.signed_contract_url;
  }
  let contractPdfUrl = null;
  let agreementText = null;
  try {
    const contractInfo = await getServiceTypeContractInfo(row.service_type_id);
    contractPdfUrl = hasUsableContractUrl(contractInfo.md_contract_url)
      ? contractInfo.md_contract_url
      : null;
    agreementText = contractInfo.md_agreement_text || null;
  } catch {
    /* continue with standalone agreement PDF */
  }
  try {
    return await attachSignedContractToSubscription(row.id, {
      providerId: row.provider_id,
      serviceTypeId: row.service_type_id,
      serviceTypeName: row.service_type_name,
      providerName: signedByName || row.signed_by_name || row.provider_name,
      signedAtIso: signedAtIso || row.signed_at || new Date().toISOString(),
      signatureDataUrl: sig,
      contractPdfUrl,
      agreementText,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[md-billing] signed contract generation failed:", err?.message || err);
    return null;
  }
}

export async function ensureSignedContractForSubscription(subscriptionRowOrId, overrides = {}) {
  let row =
    subscriptionRowOrId && typeof subscriptionRowOrId === "object"
      ? subscriptionRowOrId
      : await getMdSubscriptionById(String(subscriptionRowOrId || "").trim());
  if (!row?.id) return null;
  if (row.signed_contract_url && !overrides.force) return row.signed_contract_url;
  const url = await maybeStoreSignedContract(row, {
    signatureData: overrides.signatureData || row.signature_data,
    signedByName: overrides.signedByName || row.signed_by_name,
    signedAtIso: overrides.signedAtIso || row.signed_at,
    force: Boolean(overrides.force),
  });
  if (url) {
    row = { ...row, signed_contract_url: url };
  }
  return url;
}

function hasUsableContractUrl(value) {
  const raw = String(value || "").trim();
  return /^https?:\/\//i.test(raw);
}

/** Ensure signed PDF URLs exist before returning subscription rows to clients. */
export async function backfillSignedContractsForRows(rows = []) {
  const out = [];
  for (const row of rows || []) {
    if (!row?.id || row.signed_contract_url || !row.signature_data) {
      out.push(row);
      continue;
    }
    try {
      const url = await ensureSignedContractForSubscription(row);
      out.push(url ? { ...row, signed_contract_url: url } : row);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[md-billing] backfill signed contract failed:", row.id, err?.message || err);
      out.push(row);
    }
  }
  return out;
}

function unixToIso(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

async function logBillingEvent({
  mdSubscriptionId,
  eventType,
  stripeEventId = null,
  stripeInvoiceId = null,
  stripeSubscriptionId = null,
  failureCode = null,
  failureMessage = null,
  cancellationReason = null,
  cancellationNotes = null,
  cancelledByName = null,
  amountPaid = null,
  currency = null,
  metadata = null,
}) {
  const subId = s(mdSubscriptionId);
  if (!subId) return;
  if (stripeEventId) {
    const { rows: dup } = await query(
      `select 1 from public.md_subscription_billing_event where stripe_event_id = $1 limit 1`,
      [stripeEventId]
    );
    if (dup[0]) return;
  }
  try {
    await query(
      `insert into public.md_subscription_billing_event (
        md_subscription_id, event_type, stripe_event_id, stripe_invoice_id, stripe_subscription_id,
        failure_code, failure_message, cancellation_reason, cancellation_notes, cancelled_by_name,
        amount_paid, currency, metadata
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)`,
      [
        subId,
        s(eventType) || "unknown",
        stripeEventId || null,
        stripeInvoiceId || null,
        stripeSubscriptionId || null,
        failureCode || null,
        failureMessage || null,
        cancellationReason || null,
        cancellationNotes || null,
        cancelledByName || null,
        amountPaid != null && Number.isFinite(Number(amountPaid)) ? Number(amountPaid) : null,
        currency || null,
        JSON.stringify(metadata && typeof metadata === "object" ? metadata : {}),
      ]
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[md-billing] logBillingEvent failed:", err?.message || err);
  }
}

async function getMdSubscriptionById(id) {
  const { rows } = await query(`select * from public.md_subscription where id = $1::uuid limit 1`, [id]);
  return rows[0] || null;
}

async function getMdSubscriptionByStripeSubscriptionId(stripeSubscriptionId) {
  const sid = s(stripeSubscriptionId);
  if (!sid) return null;
  const { rows } = await query(
    `select * from public.md_subscription where stripe_subscription_id = $1 limit 1`,
    [sid]
  );
  return rows[0] || null;
}

async function getLatestMdSubscriptionForService(providerId, serviceTypeId) {
  const { aliases } = await getProviderIdAliases(providerId);
  const providerIds = aliases?.length ? aliases : [String(providerId || "").trim()].filter(Boolean);
  const { rows } = await query(
    `select * from public.md_subscription
     where provider_id::text = any($1::text[]) and service_type_id = $2
     order by created_at desc nulls last
     limit 1`,
    [providerIds, serviceTypeId]
  );
  return rows[0] || null;
}

async function ensureMdAssignment(providerId, providerEmail, providerName, serviceTypeId, serviceTypeName) {
  const result = await submitMdBoardCoverageAssignment({
    providerId,
    providerEmail,
    providerName,
    serviceTypeId,
    serviceTypeName,
  });
  return result;
}

/**
 * Create a pending md_subscription row before Stripe Checkout (paid activations).
 */
export async function createPendingMdSubscriptionForCheckout({
  providerId,
  providerEmail,
  providerName,
  serviceTypeId,
  serviceTypeName,
  monthlyFee,
  enrollmentId = null,
  signatureData = null,
  signedByName = null,
}) {
  const pid = s(providerId);
  const stId = s(serviceTypeId);
  if (!pid || !stId) {
    throw new Error("provider_id and service_type_id are required.");
  }

  const existing = await getLatestMdSubscriptionForService(pid, stId);
  const existingStatus = s(existing?.status).toLowerCase();
  if (existing && existingStatus === "active") {
    if (signatureData) {
      let row = await persistMdSubscriptionSignature(existing, {
        signatureData,
        signedByName: signedByName || providerName,
        signedAtIso: existing.signed_at,
      });
      await maybeStoreSignedContract(row, {
        signatureData,
        signedByName: signedByName || row.signed_by_name || providerName,
        signedAtIso: row.signed_at,
        force: !row.signed_contract_url,
      });
      row = (await getMdSubscriptionById(row.id)) || row;
      return row;
    }
    return existing;
  }
  if (existing && existingStatus === "pending") {
    const touchIso = new Date().toISOString();
    const { rows: updatedRows } = await query(
      `update public.md_subscription
          set signature_data = coalesce($2, signature_data),
              signed_at = coalesce(signed_at, $3::timestamptz),
              signed_by_name = coalesce($4, signed_by_name),
              billing_updated_at = now(),
              updated_at = now()
        where id = $1::uuid
        returning *`,
      [existing.id, signatureData || null, touchIso, signedByName || providerName || null]
    );
    const updated = updatedRows[0] || existing;
    await maybeStoreSignedContract(updated, {
      signatureData: signatureData || updated.signature_data,
      signedByName: signedByName || updated.signed_by_name || providerName,
      signedAtIso: updated.signed_at || touchIso,
    });
    return updated;
  }

  const fee =
    monthlyFee != null && Number.isFinite(Number(monthlyFee))
      ? Number(monthlyFee)
      : monthlyFeeForNewMdService(
          (
            await query(
              `select id from public.md_subscription
               where provider_id = $1 and lower(status) = 'active' and service_type_id <> $2`,
              [pid, stId]
            )
          ).rows.length
        );

  const nowIso = new Date().toISOString();
  const { rows } = await query(
    `insert into public.md_subscription (
      provider_id, provider_email, provider_name, service_type_id, service_type_name,
      service_type_monthly_fee, status, billing_status, signed_at, signed_by_name,
      activated_at, enrollment_id, signature_data, billing_updated_at
    ) values ($1, $2, $3, $4, $5, $6, 'pending', 'pending', $7, $8, null, $9, $10, now())
    returning *`,
    [
      pid,
      providerEmail || null,
      providerName || null,
      stId,
      serviceTypeName || null,
      fee,
      nowIso,
      signedByName || providerName || null,
      enrollmentId || null,
      signatureData || null,
    ]
  );
  const created = rows[0];
  await maybeStoreSignedContract(created, {
    signatureData,
    signedByName: signedByName || providerName,
    signedAtIso: nowIso,
  });
  return created;
}

export async function attachCheckoutSessionToMdSubscription(mdSubscriptionId, stripeCheckoutSessionId) {
  await query(
    `update public.md_subscription
        set stripe_checkout_session_id = $2,
            billing_updated_at = now(),
            updated_at = now()
      where id = $1::uuid`,
    [mdSubscriptionId, stripeCheckoutSessionId]
  );
}

/**
 * Activate coverage from a completed Stripe Checkout session (webhook or redirect backup).
 */
export async function activateMdSubscriptionFromStripeSession(session) {
  const checkoutType = s(session?.metadata?.checkout_type).toLowerCase();
  if (checkoutType && checkoutType !== CHECKOUT_TYPE) {
    return { skipped: true, reason: "not_md_board_coverage" };
  }

  const mdSubId = s(session?.metadata?.md_subscription_id);
  const providerId = s(session?.metadata?.provider_auth_user_id);
  const serviceTypeId = s(session?.metadata?.service_type_id);
  let row =
    (mdSubId ? await getMdSubscriptionById(mdSubId) : null) ||
    (session?.id
      ? (
          await query(
            `select * from public.md_subscription where stripe_checkout_session_id = $1 limit 1`,
            [session.id]
          )
        ).rows[0]
      : null) ||
    (providerId && serviceTypeId ? await getLatestMdSubscriptionForService(providerId, serviceTypeId) : null);

  if (!row) {
    return { skipped: true, reason: "md_subscription_not_found" };
  }

  if (s(row.status).toLowerCase() === "active" && row.stripe_subscription_id) {
    const signedContractUrl = await ensureSignedContractForSubscription(row);
    await ensureMdAssignment(
      row.provider_id,
      row.provider_email,
      row.provider_name,
      row.service_type_id,
      row.service_type_name
    );
    return {
      ok: true,
      already_active: true,
      md_subscription_id: row.id,
      signed_contract_url: signedContractUrl || row.signed_contract_url || null,
    };
  }

  const stripeSubscriptionId = s(session?.subscription);
  const stripeCustomerId = s(session?.customer);
  let periodStart = null;
  let periodEnd = null;

  if (stripeSubscriptionId && mdStripe) {
    try {
      const stripeSub = await mdStripe.subscriptions.retrieve(stripeSubscriptionId);
      periodStart = unixToIso(stripeSub.current_period_start);
      periodEnd = unixToIso(stripeSub.current_period_end);
    } catch {
      // continue with session data only
    }
  }

  const nowIso = new Date().toISOString();
  const { rows } = await query(
    `update public.md_subscription
        set status = 'active',
            billing_status = 'active',
            stripe_customer_id = coalesce(nullif($2, ''), stripe_customer_id),
            stripe_subscription_id = coalesce(nullif($3, ''), stripe_subscription_id),
            stripe_checkout_session_id = coalesce(nullif($4, ''), stripe_checkout_session_id),
            activated_at = coalesce(activated_at, $5::timestamptz),
            current_period_start = coalesce($6::timestamptz, current_period_start),
            current_period_end = coalesce($7::timestamptz, current_period_end),
            last_payment_failure_code = null,
            last_payment_failure_message = null,
            last_payment_failed_at = null,
            billing_updated_at = now(),
            updated_at = now()
      where id = $1::uuid
      returning *`,
    [
      row.id,
      stripeCustomerId,
      stripeSubscriptionId,
      session.id || null,
      nowIso,
      periodStart,
      periodEnd,
    ]
  );
  row = rows[0] || row;

  await logBillingEvent({
    mdSubscriptionId: row.id,
    eventType: "checkout_completed",
    stripeSubscriptionId: stripeSubscriptionId || null,
    metadata: { checkout_session_id: session.id },
  });

  await ensureMdAssignment(
    row.provider_id,
    row.provider_email,
    row.provider_name,
    row.service_type_id,
    row.service_type_name
  );

  const signedContractUrl = await ensureSignedContractForSubscription(row);

  await insertAppNotification({
    user_id: row.provider_id,
    user_email: row.provider_email,
    type: "md_relationship_approved",
    message: `Your MD Board coverage for ${row.service_type_name || "your service"} is active. Monthly billing is set up.`,
    link_page: "ProviderCredentialsCoverage",
  });

  return { ok: true, md_subscription_id: row.id, signed_contract_url: signedContractUrl || row.signed_contract_url || null };
}

/**
 * $0 activation or client redirect backup when webhook has not run yet.
 */
export async function finalizeMdBoardCoverage({
  providerId,
  providerEmail,
  providerName,
  serviceTypeId,
  serviceTypeName,
  enrollmentId = null,
  signatureData = null,
  signedByName = null,
}) {
  const pid = s(providerId);
  const stId = s(serviceTypeId);
  if (!pid || !stId) {
    return { ok: false, error: "provider_id and service_type_id are required." };
  }

  let row = await getLatestMdSubscriptionForService(pid, stId);
  const status = s(row?.status).toLowerCase();

  if (row && status === "pending" && row.stripe_checkout_session_id && mdStripe) {
    try {
      if (signatureData) {
        row = await persistMdSubscriptionSignature(row, {
          signatureData,
          signedByName: signedByName || providerName,
          signedAtIso: row.signed_at,
        });
      }
      const session = await mdStripe.checkout.sessions.retrieve(row.stripe_checkout_session_id);
      if (session.status === "complete") {
        return activateMdSubscriptionFromStripeSession(session);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[md-billing] finalize session retrieve failed:", err?.message || err);
    }
  }

  if (row && status === "active") {
    if (signatureData) {
      row = await persistMdSubscriptionSignature(row, {
        signatureData,
        signedByName: signedByName || providerName,
        signedAtIso: row.signed_at,
      });
    }
    const signedContractUrl = await ensureSignedContractForSubscription(row, {
      signatureData: signatureData || row.signature_data,
      signedByName: signedByName || row.signed_by_name || providerName,
      signedAtIso: row.signed_at,
    });
    await ensureMdAssignment(pid, providerEmail, providerName, stId, serviceTypeName);
    return {
      ok: true,
      already_active: true,
      md_subscription_id: row.id,
      signed_contract_url: signedContractUrl || row.signed_contract_url || null,
    };
  }

  const activeOtherCount = (
    await query(
      `select id from public.md_subscription
       where provider_id = $1 and lower(status) = 'active' and service_type_id <> $2`,
      [pid, stId]
    )
  ).rows.length;
  const monthlyFee = monthlyFeeForNewMdService(activeOtherCount);
  const nowIso = new Date().toISOString();

  if (!row || (status !== "pending" && status !== "active")) {
    const { rows } = await query(
      `insert into public.md_subscription (
        provider_id, provider_email, provider_name, service_type_id, service_type_name,
        service_type_monthly_fee, status, billing_status, signed_at, signed_by_name,
        activated_at, enrollment_id, signature_data, billing_updated_at
      ) values ($1, $2, $3, $4, $5, $6, 'active', 'active', $7, $8, $9, $10, $11, now())
      returning *`,
      [
        pid,
        providerEmail || null,
        providerName || null,
        stId,
        serviceTypeName || null,
        monthlyFee,
        nowIso,
        signedByName || providerName || null,
        nowIso,
        enrollmentId || null,
        signatureData || null,
      ]
    );
    row = rows[0];
    await logBillingEvent({
      mdSubscriptionId: row.id,
      eventType: "free_activation",
      metadata: { monthly_fee: monthlyFee },
    });
  } else if (status === "pending" && !row.stripe_subscription_id) {
    const { rows } = await query(
      `update public.md_subscription
          set status = 'active',
              billing_status = 'active',
              service_type_monthly_fee = coalesce(service_type_monthly_fee, $2),
              activated_at = coalesce(activated_at, $3::timestamptz),
              signature_data = coalesce($4, signature_data),
              signed_at = coalesce(signed_at, $3::timestamptz),
              signed_by_name = coalesce($5, signed_by_name),
              billing_updated_at = now(),
              updated_at = now()
        where id = $1::uuid
        returning *`,
      [row.id, monthlyFee, nowIso, signatureData || null, signedByName || providerName || null]
    );
    row = rows[0];
    await logBillingEvent({
      mdSubscriptionId: row.id,
      eventType: "free_activation",
      metadata: { monthly_fee: monthlyFee },
    });
  }

  const signedContractUrl = await ensureSignedContractForSubscription(row, {
    signatureData: signatureData || row.signature_data,
    signedByName: signedByName || row.signed_by_name,
    signedAtIso: row.signed_at || nowIso,
  });

  const assignResult = await ensureMdAssignment(pid, providerEmail, providerName, stId, serviceTypeName);
  if (!assignResult.ok) {
    return { ok: false, error: assignResult.error || "MD assignment failed." };
  }

  return {
    ok: true,
    md_subscription_id: row.id,
    assignment: assignResult,
    signed_contract_url: signedContractUrl || row.signed_contract_url || null,
  };
}

export async function handleMdInvoicePaid(invoice, stripeEventId = null) {
  const stripeSubscriptionId = s(invoice?.subscription);
  const row = await getMdSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
  if (!row) return { skipped: true };

  const amountPaid =
    invoice.amount_paid != null ? Number(invoice.amount_paid) / 100 : null;
  const periodStart = unixToIso(invoice.period_start);
  const periodEnd = unixToIso(invoice.period_end);

  await query(
    `update public.md_subscription
        set status = 'active',
            billing_status = 'active',
            current_period_start = coalesce($2::timestamptz, current_period_start),
            current_period_end = coalesce($3::timestamptz, current_period_end),
            last_stripe_invoice_id = $4,
            last_payment_failure_code = null,
            last_payment_failure_message = null,
            last_payment_failed_at = null,
            billing_updated_at = now(),
            updated_at = now()
      where id = $1::uuid`,
    [row.id, periodStart, periodEnd, invoice.id || null]
  );

  await logBillingEvent({
    mdSubscriptionId: row.id,
    eventType: "invoice_paid",
    stripeEventId,
    stripeInvoiceId: invoice.id || null,
    stripeSubscriptionId,
    amountPaid,
    currency: invoice.currency || "usd",
    metadata: { billing_reason: invoice.billing_reason },
  });

  return { ok: true };
}

export async function handleMdInvoicePaymentFailed(invoice, stripeEventId = null) {
  const stripeSubscriptionId = s(invoice?.subscription);
  const row = await getMdSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
  if (!row) return { skipped: true };

  let failureCode = null;
  let failureMessage = s(invoice?.last_finalization_error?.message) || null;

  if (mdStripe && invoice.id) {
    try {
      const full = await mdStripe.invoices.retrieve(invoice.id, { expand: ["payment_intent"] });
      const pi = full.payment_intent;
      if (typeof pi === "object" && pi) {
        failureCode = pi.last_payment_error?.code || failureCode;
        failureMessage =
          pi.last_payment_error?.message ||
          failureMessage ||
          "Your card was declined.";
      }
    } catch {
      // use invoice fields only
    }
  }

  if (!failureMessage) {
    failureMessage = "Monthly MD coverage payment failed. Please update your payment method.";
  }

  const nowIso = new Date().toISOString();

  await query(
    `update public.md_subscription
        set status = 'suspended',
            billing_status = 'past_due',
            last_payment_failed_at = $2::timestamptz,
            last_payment_failure_code = $3,
            last_payment_failure_message = $4,
            last_stripe_invoice_id = $5,
            billing_updated_at = now(),
            updated_at = now()
      where id = $1::uuid`,
    [row.id, nowIso, failureCode, failureMessage, invoice.id || null]
  );

  await logBillingEvent({
    mdSubscriptionId: row.id,
    eventType: "payment_failed",
    stripeEventId,
    stripeInvoiceId: invoice.id || null,
    stripeSubscriptionId,
    failureCode,
    failureMessage,
    metadata: { attempt_count: invoice.attempt_count },
  });

  await insertAppNotification({
    user_id: row.provider_id,
    user_email: row.provider_email,
    type: "general",
    message: `MD coverage payment failed for ${row.service_type_name || "your service"}: ${failureMessage}`,
    link_page: "ProviderCredentialsCoverage",
  });

  return { ok: true, failure_message: failureMessage };
}

export async function handleMdSubscriptionUpdated(subscription, stripeEventId = null) {
  const stripeSubscriptionId = s(subscription?.id);
  const row = await getMdSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
  if (!row) return { skipped: true };

  const periodStart = unixToIso(subscription.current_period_start);
  const periodEnd = unixToIso(subscription.current_period_end);
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  const stripeStatus = s(subscription.status).toLowerCase();

  let billingStatus = row.billing_status || "active";
  let accessStatus = row.status || "active";

  if (stripeStatus === "past_due" || stripeStatus === "unpaid") {
    billingStatus = "past_due";
    accessStatus = "suspended";
  } else if (stripeStatus === "active" || stripeStatus === "trialing") {
    billingStatus = "active";
    accessStatus = "active";
  } else if (stripeStatus === "canceled" || stripeStatus === "cancelled") {
    billingStatus = "cancelled";
    accessStatus = "cancelled";
  }

  await query(
    `update public.md_subscription
        set billing_status = $2,
            status = $3,
            cancel_at_period_end = $4,
            current_period_start = coalesce($5::timestamptz, current_period_start),
            current_period_end = coalesce($6::timestamptz, current_period_end),
            billing_updated_at = now(),
            updated_at = now()
      where id = $1::uuid`,
    [row.id, billingStatus, accessStatus, cancelAtPeriodEnd, periodStart, periodEnd]
  );

  await logBillingEvent({
    mdSubscriptionId: row.id,
    eventType: "subscription_updated",
    stripeEventId,
    stripeSubscriptionId,
    metadata: { stripe_status: stripeStatus, cancel_at_period_end: cancelAtPeriodEnd },
  });

  return { ok: true };
}

export async function handleMdSubscriptionDeleted(subscription, stripeEventId = null) {
  const stripeSubscriptionId = s(subscription?.id);
  const row = await getMdSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
  if (!row) return { skipped: true };

  const nowIso = new Date().toISOString();

  await query(
    `update public.md_subscription
        set status = 'cancelled',
            billing_status = 'cancelled',
            cancelled_at = coalesce(cancelled_at, $2::timestamptz),
            cancel_at_period_end = false,
            billing_updated_at = now(),
            updated_at = now()
      where id = $1::uuid`,
    [row.id, nowIso]
  );

  await logBillingEvent({
    mdSubscriptionId: row.id,
    eventType: "subscription_ended",
    stripeEventId,
    stripeSubscriptionId,
    metadata: { ended_by: "stripe_subscription_deleted" },
  });

  await insertAppNotification({
    user_id: row.provider_id,
    user_email: row.provider_email,
    type: "general",
    message: `MD Board coverage for ${row.service_type_name || "your service"} has ended.`,
    link_page: "ProviderCredentialsCoverage",
  });

  return { ok: true };
}

/**
 * Stripe-aware cancel (updates Stripe subscription). Not used by compliance checkExpirations
 * or POST /cancelMDSubscription — those are DB-only; admins cancel Stripe manually.
 */
export async function cancelMdSubscriptionForProvider({
  mdSubscriptionId,
  providerId,
  reason = null,
  notes = null,
  cancelledByName = null,
  cancelImmediately = false,
}) {
  const row = await getMdSubscriptionById(mdSubscriptionId);
  if (!row) {
    return { ok: false, error: "Subscription not found." };
  }
  if (s(row.provider_id) !== s(providerId)) {
    return { ok: false, error: "Forbidden." };
  }

  const stripeSubscriptionId = s(row.stripe_subscription_id);
  if (stripeSubscriptionId && mdStripe) {
    if (cancelImmediately) {
      await mdStripe.subscriptions.cancel(stripeSubscriptionId);
    } else {
      await mdStripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  const nowIso = new Date().toISOString();
  const updates = cancelImmediately
    ? {
        status: "cancelled",
        billing_status: "cancelled",
        cancelled_at: nowIso,
        cancel_at_period_end: false,
      }
    : {
        cancel_at_period_end: true,
        cancellation_reason: reason,
        cancellation_notes: notes,
        cancelled_by_name: cancelledByName,
      };

  if (cancelImmediately) {
    await query(
      `update public.md_subscription
          set status = 'cancelled',
              billing_status = 'cancelled',
              cancelled_at = $2::timestamptz,
              cancellation_reason = $3,
              cancellation_notes = $4,
              cancelled_by_name = $5,
              cancel_at_period_end = false,
              billing_updated_at = now(),
              updated_at = now()
        where id = $1::uuid`,
      [row.id, nowIso, reason, notes, cancelledByName]
    );
  } else {
    await query(
      `update public.md_subscription
          set cancel_at_period_end = true,
              cancellation_reason = $2,
              cancellation_notes = $3,
              cancelled_by_name = $4,
              billing_updated_at = now(),
              updated_at = now()
        where id = $1::uuid`,
      [row.id, reason, notes, cancelledByName]
    );
  }

  await logBillingEvent({
    mdSubscriptionId: row.id,
    eventType: cancelImmediately ? "cancelled_immediately" : "cancel_scheduled",
    stripeSubscriptionId: stripeSubscriptionId || null,
    cancellationReason: reason,
    cancellationNotes: notes,
    cancelledByName: cancelledByName,
    metadata: { cancel_immediately: cancelImmediately },
  });

  return { ok: true, cancel_at_period_end: !cancelImmediately };
}

export async function processMdBoardStripeEvent(event) {
  const type = event?.type;
  const obj = event?.data?.object || {};

  if (type === "checkout.session.completed") {
    const checkoutType = s(obj?.metadata?.checkout_type).toLowerCase();
    if (checkoutType === CHECKOUT_TYPE) {
      return activateMdSubscriptionFromStripeSession(obj);
    }
    return { skipped: true };
  }

  if (type === "invoice.paid") {
    if (s(obj?.subscription)) return handleMdInvoicePaid(obj, event.id);
    return { skipped: true };
  }

  if (type === "invoice.payment_failed") {
    if (s(obj?.subscription)) return handleMdInvoicePaymentFailed(obj, event.id);
    return { skipped: true };
  }

  if (type === "customer.subscription.updated") {
    const checkoutType = s(obj?.metadata?.checkout_type).toLowerCase();
    if (checkoutType === CHECKOUT_TYPE || obj?.id) {
      const row = await getMdSubscriptionByStripeSubscriptionId(obj.id);
      if (row || checkoutType === CHECKOUT_TYPE) {
        return handleMdSubscriptionUpdated(obj, event.id);
      }
    }
    return { skipped: true };
  }

  if (type === "customer.subscription.deleted") {
    const row = await getMdSubscriptionByStripeSubscriptionId(obj.id);
    if (row) return handleMdSubscriptionDeleted(obj, event.id);
    return { skipped: true };
  }

  return { skipped: true, reason: "unhandled_event_type" };
}
