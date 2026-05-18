// Centralized payment lifecycle tracking.
//
// This module records every observable Stripe payment activity into two tables:
//   - public.payment_transactions: one row per checkout attempt; current state.
//   - public.payment_events:       append-only log of every lifecycle event we see.
//
// All public functions are intentionally fail-soft: if persistence fails for any
// reason (DB unavailable, schema drift, etc.) we log to stderr and resolve so the
// caller's business logic is never blocked by payment tracking.

import { pool, query } from "../db.js";

const COURSE_FLOW = "course";
const MODEL_FLOW = "model";
const SERVICE_FLOW = "service";

let trackingTablesAvailablePromise = null;

async function ensureTrackingTablesAvailable() {
  if (trackingTablesAvailablePromise) return trackingTablesAvailablePromise;
  trackingTablesAvailablePromise = (async () => {
    try {
      const res = await query(
        `select 1
         from information_schema.tables
         where table_schema = 'public'
           and table_name in ('payment_transactions', 'payment_events')`
      );
      return (res.rows || []).length >= 2;
    } catch {
      return false;
    }
  })();
  return trackingTablesAvailablePromise;
}

// Returns true if the last positional arg looks like a pg client (i.e. supports query()).
function detectClient(args) {
  if (!args.length) return null;
  const last = args[args.length - 1];
  if (last && typeof last === "object" && typeof last.query === "function") return last;
  return null;
}

let savepointCounter = 0;

function safeRunner(fn) {
  return async (...args) => {
    try {
      const available = await ensureTrackingTablesAvailable();
      if (!available) return null;

      const client = detectClient(args);
      if (client) {
        // When called inside an outer transaction, run inside a savepoint so a
        // tracking-only error never poisons the caller's transaction.
        savepointCounter = (savepointCounter + 1) % 1_000_000;
        const spName = `sp_payment_tracking_${savepointCounter}`;
        await client.query(`savepoint ${spName}`);
        try {
          const out = await fn(...args);
          await client.query(`release savepoint ${spName}`);
          return out;
        } catch (innerError) {
          try {
            await client.query(`rollback to savepoint ${spName}`);
          } catch (_) {
            // ignore secondary failure
          }
          // eslint-disable-next-line no-console
          console.error("[payment-tracking] failed (savepoint rolled back):", innerError?.message || innerError);
          return null;
        }
      }

      return await fn(...args);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[payment-tracking] failed:", error?.message || error);
      return null;
    }
  };
}

function toCentsToDollars(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num / 100;
}

function pickFirst(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const trimmed = typeof value === "string" ? value.trim() : value;
    if (trimmed !== "" && trimmed !== undefined && trimmed !== null) return trimmed;
  }
  return null;
}

function stringOrNull(value) {
  if (value === null || value === undefined) return null;
  const out = String(value).trim();
  return out || null;
}

function lowerOrNull(value) {
  const v = stringOrNull(value);
  return v ? v.toLowerCase() : null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidOrNull(value) {
  const v = stringOrNull(value);
  if (!v) return null;
  return UUID_REGEX.test(v) ? v : null;
}

function jsonOrEmpty(value) {
  if (value === null || value === undefined) return "{}";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

function jsonOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function extractCardDetails(paymentMethodDetails) {
  const details = paymentMethodDetails || {};
  const card = details.card || details.card_present || {};
  return {
    payment_method_type: stringOrNull(details.type) || (card && Object.keys(card).length ? "card" : null),
    card_brand: stringOrNull(card.brand),
    card_last4: stringOrNull(card.last4),
    card_exp_month: numberOrNull(card.exp_month),
    card_exp_year: numberOrNull(card.exp_year),
    card_funding: stringOrNull(card.funding),
    card_country: stringOrNull(card.country)
  };
}

function extractStripeError(errorObj) {
  if (!errorObj) {
    return {
      failure_code: null,
      failure_message: null,
      failure_reason: null,
      decline_code: null
    };
  }
  return {
    failure_code: stringOrNull(errorObj.code) || stringOrNull(errorObj.type),
    failure_message: stringOrNull(errorObj.message),
    failure_reason: stringOrNull(errorObj.type) || stringOrNull(errorObj.code),
    decline_code: stringOrNull(errorObj.decline_code)
  };
}

function deriveCheckoutStatus(session) {
  if (!session) return null;
  return stringOrNull(session.status);
}

function derivePaymentStatusFromIntent(intent) {
  const raw = stringOrNull(intent?.status);
  if (!raw) return null;
  switch (raw) {
    case "succeeded":
      return "succeeded";
    case "processing":
      return "processing";
    case "requires_action":
    case "requires_confirmation":
    case "requires_payment_method":
      return "requires_action";
    case "canceled":
      return "canceled";
    default:
      return raw;
  }
}

// Records the start of a new payment attempt. Always performs a plain
// INSERT — every call yields a brand new row, including:
//   - The exact request payload at the moment the user clicked "Pay".
//   - Client + server timestamps (for stale-state debugging).
//   - An auto-computed attempt_number scoped to (customer_email, payment_flow).
//
// Stripe-derived fields (stripe_session_id, amount_total, etc.) are optional
// here; they get filled in later via `enrichPaymentTransaction({id, ...})`.
// `client` can be a pg pool client (inside an existing txn) or null.
export const recordCheckoutInitiated = safeRunner(async (input, client = null) => {
  const runner = client || pool;
  const flow = stringOrNull(input.payment_flow) || COURSE_FLOW;
  const metadata = input.metadata || {};
  const billingAddress = input.billing_address || null;
  const normalizedEmail = lowerOrNull(input.customer_email);

  const sql = `
    insert into public.payment_transactions (
      payment_flow, payment_type, payment_status,
      pre_order_id, course_id, service_type_id, item_id, item_name,
      selected_item_id,
      user_id, linked_user_id,
      customer_email, customer_name, customer_phone,
      amount_subtotal, amount_discount, amount_total, currency,
      stripe_session_id, stripe_payment_intent_id, stripe_customer_id, stripe_checkout_url,
      receipt_email,
      billing_name, billing_email, billing_phone, billing_address,
      source_context, source_origin, request_ip, user_agent,
      metadata,
      attempt_number,
      request_payload_snapshot,
      client_timestamp,
      server_received_timestamp,
      initiated_at, last_event_at, last_event_type
    ) values (
      $1, $2, 'initiated',
      $3, $4, $5, $6, $7,
      $8,
      $9, $10,
      $11, $12, $13,
      $14, $15, $16, $17,
      $18, $19, $20, $21,
      $22,
      $23, $24, $25, $26::jsonb,
      $27, $28, $29, $30,
      $31::jsonb,
      coalesce((
        select max(attempt_number) + 1
        from public.payment_transactions
        where customer_email = $11
          and payment_flow = $1
      ), 1),
      $32::jsonb,
      $33,
      coalesce($34::timestamptz, now()),
      now(), now(), 'initiated'
    )
    returning id, attempt_number
  `;

  const serverReceived = input.server_received_timestamp || null;
  const clientTs = input.client_timestamp || null;
  const rawPayloadSnapshot = input.request_payload_snapshot != null
    ? input.request_payload_snapshot
    : null;

  const params = [
    flow,
    stringOrNull(input.payment_type) || flow,
    uuidOrNull(input.pre_order_id),
    uuidOrNull(input.course_id),
    stringOrNull(input.service_type_id),
    stringOrNull(input.item_id) || stringOrNull(input.course_id) || stringOrNull(input.service_type_id),
    stringOrNull(input.item_name),
    // selected_item_id keeps the raw user-supplied identifier exactly as it
    // arrived (no UUID coercion) so investigators can see what the user
    // actually typed/clicked — even when it's malformed garbage.
    stringOrNull(input.selected_item_id)
      || stringOrNull(input.course_id)
      || stringOrNull(input.service_type_id)
      || stringOrNull(input.item_id),
    uuidOrNull(input.user_id),
    uuidOrNull(input.linked_user_id),
    normalizedEmail,
    stringOrNull(input.customer_name),
    stringOrNull(input.customer_phone),
    numberOrNull(input.amount_subtotal),
    numberOrNull(input.amount_discount),
    numberOrNull(input.amount_total),
    stringOrNull(input.currency) || "usd",
    stringOrNull(input.stripe_session_id),
    stringOrNull(input.stripe_payment_intent_id),
    stringOrNull(input.stripe_customer_id),
    stringOrNull(input.stripe_checkout_url),
    lowerOrNull(input.receipt_email) || normalizedEmail,
    stringOrNull(input.billing_name) || stringOrNull(input.customer_name),
    lowerOrNull(input.billing_email) || normalizedEmail,
    stringOrNull(input.billing_phone) || stringOrNull(input.customer_phone),
    // Leave billing_address NULL when caller did not provide one so later
    // webhook events with full billing addresses can populate it via coalesce.
    billingAddress ? jsonOrEmpty(billingAddress) : null,
    stringOrNull(input.source_context) || `${flow}_checkout`,
    stringOrNull(input.source_origin),
    stringOrNull(input.request_ip),
    stringOrNull(input.user_agent),
    jsonOrEmpty(metadata),
    rawPayloadSnapshot != null ? jsonOrEmpty(rawPayloadSnapshot) : null,
    clientTs,
    serverReceived
  ];

  const { rows } = await runner.query(sql, params);
  const transactionId = rows?.[0]?.id || null;
  const attemptNumber = rows?.[0]?.attempt_number ?? null;

  if (transactionId) {
    await runner.query(
      `insert into public.payment_events (
        payment_transaction_id, pre_order_id, payment_flow,
        event_type, event_status,
        stripe_session_id, stripe_payment_intent_id, stripe_customer_id,
        amount, currency,
        customer_email, source_context,
        metadata, occurred_at
      ) values (
        $1, $2, $3,
        'initiated', 'pending',
        $4, $5, $6,
        $7, $8,
        $9, $10,
        $11::jsonb, now()
      )`,
      [
        transactionId,
        uuidOrNull(input.pre_order_id),
        flow,
        stringOrNull(input.stripe_session_id),
        stringOrNull(input.stripe_payment_intent_id),
        stringOrNull(input.stripe_customer_id),
        numberOrNull(input.amount_total),
        stringOrNull(input.currency) || "usd",
        normalizedEmail,
        stringOrNull(input.source_context) || `${flow}_checkout`,
        jsonOrEmpty({
          ...metadata,
          attempt_number: attemptNumber || undefined,
          selected_item_id: stringOrNull(input.selected_item_id) || undefined,
          request_payload_snapshot: rawPayloadSnapshot || undefined,
          client_timestamp: clientTs || undefined,
          server_received_timestamp: serverReceived || undefined,
          source_origin: stringOrNull(input.source_origin) || undefined,
          request_ip: stringOrNull(input.request_ip) || undefined,
          user_agent: stringOrNull(input.user_agent) || undefined
        })
      ]
    );
  }
  return transactionId;
});

// Marks an existing attempt as failed (e.g. when validation failed, or the
// Stripe API call threw). Always appends a corresponding payment_events row.
export const markAttemptFailed = safeRunner(async (transactionId, {
  failure_reason,
  failure_message,
  failure_code,
  stripe_session_id = null,
  stripe_payment_intent_id = null,
  http_status_code = null
} = {}, client = null) => {
  if (!uuidOrNull(transactionId)) return null;
  const runner = client || pool;
  const setClauses = [
    "payment_status = case when payment_status in ('succeeded','refunded','disputed') then payment_status else 'failed' end",
    "failed_at = coalesce(failed_at, now())",
    "failure_reason = coalesce(failure_reason, $2)",
    "failure_message = coalesce(failure_message, $3)",
    "failure_code = coalesce(failure_code, $4)",
    "stripe_session_id = coalesce(stripe_session_id, $5)",
    "stripe_payment_intent_id = coalesce(stripe_payment_intent_id, $6)",
    "last_event_at = now()",
    "last_event_type = 'attempt_failed'",
    "updated_at = now()"
  ];
  const params = [
    transactionId,
    stringOrNull(failure_reason),
    stringOrNull(failure_message),
    stringOrNull(failure_code),
    stringOrNull(stripe_session_id),
    stringOrNull(stripe_payment_intent_id)
  ];
  await runner.query(
    `update public.payment_transactions set ${setClauses.join(", ")} where id = $1
     returning id, pre_order_id, payment_flow, customer_email, source_context`,
    params
  );
  await runner.query(
    `insert into public.payment_events (
      payment_transaction_id, payment_flow,
      event_type, event_status,
      stripe_session_id, stripe_payment_intent_id,
      failure_code, failure_message, failure_reason,
      metadata, occurred_at
    )
    select id, payment_flow,
      'attempt_failed', 'failure',
      $2, $3, $4, $5, $6,
      jsonb_build_object('http_status_code', $7::int), now()
    from public.payment_transactions
    where id = $1`,
    [
      transactionId,
      stringOrNull(stripe_session_id),
      stringOrNull(stripe_payment_intent_id),
      stringOrNull(failure_code),
      stringOrNull(failure_message),
      stringOrNull(failure_reason),
      http_status_code == null ? null : Number(http_status_code)
    ]
  );
  return transactionId;
});

// Called from confirmation pages or any context where we have proof the user
// actually arrived at the Stripe-hosted page.
export const recordCheckoutOpened = safeRunner(async ({ stripe_session_id, source_context = null } = {}) => {
  const sid = stringOrNull(stripe_session_id);
  if (!sid) return null;
  const { rows } = await query(
    `update public.payment_transactions
     set payment_status = case
           when payment_status in ('succeeded', 'failed', 'canceled', 'expired', 'refunded', 'disputed') then payment_status
           else 'checkout_opened'
         end,
         checkout_opened_at = coalesce(checkout_opened_at, now()),
         source_context = coalesce(source_context, $2),
         last_event_at = now(),
         last_event_type = case
           when payment_status in ('succeeded', 'failed', 'canceled', 'expired', 'refunded', 'disputed') then last_event_type
           else 'checkout_opened'
         end,
         updated_at = now()
     where stripe_session_id = $1
     returning id, pre_order_id, payment_flow`,
    [sid, stringOrNull(source_context)]
  );
  const tx = rows?.[0];
  if (!tx) return null;
  await query(
    `insert into public.payment_events (
      payment_transaction_id, pre_order_id, payment_flow,
      event_type, event_status, stripe_session_id,
      source_context, occurred_at
    ) values ($1, $2, $3, 'checkout_opened', 'pending', $4, $5, now())`,
    [tx.id, tx.pre_order_id, tx.payment_flow, sid, stringOrNull(source_context)]
  );
  return tx.id;
});

async function findTransactionByEventRefs(client, refs) {
  const runner = client || pool;
  const sessionId = stringOrNull(refs.stripe_session_id);
  const intentId = stringOrNull(refs.stripe_payment_intent_id);
  const chargeId = stringOrNull(refs.stripe_charge_id);
  const preOrderId = uuidOrNull(refs.pre_order_id);

  if (sessionId) {
    const res = await runner.query(
      `select * from public.payment_transactions where stripe_session_id = $1 limit 1`,
      [sessionId]
    );
    if (res.rows?.[0]) return res.rows[0];
  }
  if (intentId) {
    const res = await runner.query(
      `select * from public.payment_transactions where stripe_payment_intent_id = $1 order by created_at desc limit 1`,
      [intentId]
    );
    if (res.rows?.[0]) return res.rows[0];
  }
  if (chargeId) {
    const res = await runner.query(
      `select * from public.payment_transactions where stripe_charge_id = $1 order by created_at desc limit 1`,
      [chargeId]
    );
    if (res.rows?.[0]) return res.rows[0];
  }
  if (preOrderId) {
    const res = await runner.query(
      `select * from public.payment_transactions where pre_order_id = $1 order by created_at desc limit 1`,
      [preOrderId]
    );
    if (res.rows?.[0]) return res.rows[0];
  }
  return null;
}

function eventTypeFromStripe(stripeEventType) {
  switch (stripeEventType) {
    // Informational creation events — they do not transition payment_status
    // (the row was already inserted as 'initiated' by the route). We log
    // them so we have proof Stripe acknowledged the session / PaymentIntent.
    case "checkout.session.created":
      return { event_type: "session_created", status_target: null };
    case "payment_intent.created":
      return { event_type: "payment_intent_created", status_target: null };

    case "checkout.session.completed":
      return { event_type: "session_completed", status_target: "succeeded" };
    case "checkout.session.expired":
      return { event_type: "session_expired", status_target: "expired" };
    case "checkout.session.async_payment_succeeded":
      return { event_type: "session_async_succeeded", status_target: "succeeded" };
    case "checkout.session.async_payment_failed":
      return { event_type: "session_async_failed", status_target: "failed" };
    case "payment_intent.succeeded":
      return { event_type: "payment_succeeded", status_target: "succeeded" };
    case "payment_intent.payment_failed":
      return { event_type: "payment_failed", status_target: "failed" };
    case "payment_intent.canceled":
      return { event_type: "payment_canceled", status_target: "canceled" };
    case "payment_intent.processing":
      return { event_type: "payment_processing", status_target: "processing" };
    case "payment_intent.requires_action":
      return { event_type: "payment_requires_action", status_target: "requires_action" };
    case "charge.succeeded":
      return { event_type: "charge_succeeded", status_target: "succeeded" };
    case "charge.failed":
      return { event_type: "charge_failed", status_target: "failed" };
    case "charge.refunded":
      return { event_type: "charge_refunded", status_target: "refunded" };
    case "charge.dispute.created":
      return { event_type: "charge_dispute_created", status_target: "disputed" };
    case "charge.captured":
      return { event_type: "charge_captured", status_target: "succeeded" };
    default:
      return { event_type: stripeEventType?.replace(/\./g, "_") || "unknown", status_target: null };
  }
}

function shouldTransitionTo(currentStatus, target) {
  if (!target) return false;
  // Terminal statuses we never overwrite with non-terminal ones.
  const terminal = new Set(["refunded", "disputed"]);
  if (terminal.has(currentStatus) && !terminal.has(target)) return false;
  // Don't overwrite succeeded with processing/requires_action/checkout_opened.
  if (currentStatus === "succeeded") {
    return ["refunded", "disputed"].includes(target);
  }
  return true;
}

// Records a Stripe webhook event end-to-end: finds (or skips) the matching
// transaction, updates its current status, and appends an event row.
export const recordStripeWebhookEvent = safeRunner(async (event) => {
  if (!event || !event.type) return null;
  const stripeEvent = event;
  const stripeObj = stripeEvent.data?.object || {};
  const objectType = stripeObj.object || "";

  const sessionId = objectType === "checkout.session"
    ? stripeObj.id
    : stripeObj.checkout_session || null;
  const intentId = objectType === "payment_intent"
    ? stripeObj.id
    : (objectType === "charge"
      ? stripeObj.payment_intent || null
      : (stripeObj.payment_intent || null));
  const chargeId = objectType === "charge"
    ? stripeObj.id
    : (stripeObj.latest_charge || null);
  const customerId = stripeObj.customer || null;
  const stripeMetadata = stripeObj.metadata || {};

  const { event_type, status_target } = eventTypeFromStripe(stripeEvent.type);

  const card = objectType === "charge"
    ? extractCardDetails(stripeObj.payment_method_details)
    : (objectType === "payment_intent" && stripeObj.charges?.data?.[0]
      ? extractCardDetails(stripeObj.charges.data[0].payment_method_details)
      : { payment_method_type: null, card_brand: null, card_last4: null, card_exp_month: null, card_exp_year: null, card_funding: null, card_country: null });

  let errorInfo = { failure_code: null, failure_message: null, failure_reason: null, decline_code: null };
  if (objectType === "payment_intent") {
    errorInfo = extractStripeError(stripeObj.last_payment_error);
  } else if (objectType === "charge") {
    errorInfo = {
      failure_code: stringOrNull(stripeObj.failure_code),
      failure_message: stringOrNull(stripeObj.failure_message),
      failure_reason: stringOrNull(stripeObj.outcome?.reason) || stringOrNull(stripeObj.failure_code),
      decline_code: stringOrNull(stripeObj.outcome?.network_decline_code)
    };
  }

  const billingDetails = objectType === "charge"
    ? (stripeObj.billing_details || {})
    : (objectType === "checkout.session"
      ? (stripeObj.customer_details || {})
      : {});

  const safeStripeObjectForLog = (() => {
    const obj = { ...stripeObj };
    // Strip nested raw card numbers if present (Stripe never sends PAN/CVV but be defensive).
    if (obj.payment_method) delete obj.payment_method;
    return obj;
  })();

  const client = await pool.connect();
  try {
    await client.query("begin");
    let transaction = await findTransactionByEventRefs(client, {
      stripe_session_id: sessionId,
      stripe_payment_intent_id: intentId,
      stripe_charge_id: chargeId,
      pre_order_id: uuidOrNull(stripeMetadata.pre_order_id)
    });

    let transactionId = transaction?.id || null;

    // Idempotency: if we've already stored this exact Stripe event, just return.
    if (stripeEvent.id) {
      const dup = await client.query(
        `select id from public.payment_events where stripe_event_id = $1 limit 1`,
        [stripeEvent.id]
      );
      if (dup.rows?.[0]) {
        await client.query("commit");
        return dup.rows[0].id;
      }
    }

    if (transaction) {
      // Always enrich the row with any new identifiers, billing info, card
      // details, etc. We separate "status transition" (which respects the
      // terminal-state guard) from "field enrichment" (which always runs)
      // because a checkout.session.completed event that arrives AFTER a
      // charge.succeeded event still carries valuable session-only fields
      // (checkout_status, payment_status, billing_address) we don't want to
      // lose.
      const allowStatusTransition = status_target && shouldTransitionTo(transaction.payment_status, status_target);
      const setClauses = ["last_event_at = now()", "last_event_type = $1", "updated_at = now()"];
      const params = [event_type];
      let n = params.length;

      if (allowStatusTransition) {
        n += 1; setClauses.push(`payment_status = $${n}`); params.push(status_target);
      }

      const amountFromObj = (() => {
        if (objectType === "checkout.session") return toCentsToDollars(stripeObj.amount_total);
        if (objectType === "payment_intent") return toCentsToDollars(stripeObj.amount_received || stripeObj.amount);
        if (objectType === "charge") return toCentsToDollars(stripeObj.amount_captured || stripeObj.amount);
        return null;
      })();
      if (amountFromObj !== null && allowStatusTransition && status_target === "succeeded") {
        n += 1; setClauses.push(`amount_paid = $${n}`); params.push(amountFromObj);
      }

      if (sessionId && !transaction.stripe_session_id) {
        n += 1; setClauses.push(`stripe_session_id = $${n}`); params.push(sessionId);
      }
      if (intentId && !transaction.stripe_payment_intent_id) {
        n += 1; setClauses.push(`stripe_payment_intent_id = $${n}`); params.push(intentId);
      }
      if (chargeId && !transaction.stripe_charge_id) {
        n += 1; setClauses.push(`stripe_charge_id = $${n}`); params.push(chargeId);
      }
      if (customerId && !transaction.stripe_customer_id) {
        n += 1; setClauses.push(`stripe_customer_id = $${n}`); params.push(customerId);
      }
      if (objectType === "checkout.session") {
        const cs = deriveCheckoutStatus(stripeObj);
        if (cs) { n += 1; setClauses.push(`stripe_checkout_status = $${n}`); params.push(cs); }
        const ps = stringOrNull(stripeObj.payment_status);
        if (ps) { n += 1; setClauses.push(`stripe_payment_status = $${n}`); params.push(ps); }
      } else if (objectType === "payment_intent") {
        const ps = derivePaymentStatusFromIntent(stripeObj);
        // Only overwrite stripe_payment_status from a PaymentIntent when we
        // don't already have a "paid" terminal value from a session event.
        if (ps) {
          n += 1;
          setClauses.push(`stripe_payment_status = case when stripe_payment_status = 'paid' then stripe_payment_status else $${n} end`);
          params.push(ps);
        }
      }

      const billingName = stringOrNull(billingDetails.name);
      if (billingName) { n += 1; setClauses.push(`billing_name = coalesce(billing_name, $${n})`); params.push(billingName); }
      const billingEmail = lowerOrNull(billingDetails.email);
      if (billingEmail) { n += 1; setClauses.push(`billing_email = coalesce(billing_email, $${n})`); params.push(billingEmail); }
      const billingPhone = stringOrNull(billingDetails.phone);
      if (billingPhone) { n += 1; setClauses.push(`billing_phone = coalesce(billing_phone, $${n})`); params.push(billingPhone); }
      if (billingDetails.address) {
        n += 1; setClauses.push(`billing_address = coalesce(billing_address, $${n}::jsonb)`); params.push(jsonOrEmpty(billingDetails.address));
      }

      if (card.payment_method_type) { n += 1; setClauses.push(`payment_method_type = coalesce(payment_method_type, $${n})`); params.push(card.payment_method_type); }
      if (card.card_brand) { n += 1; setClauses.push(`card_brand = coalesce(card_brand, $${n})`); params.push(card.card_brand); }
      if (card.card_last4) { n += 1; setClauses.push(`card_last4 = coalesce(card_last4, $${n})`); params.push(card.card_last4); }
      if (card.card_exp_month) { n += 1; setClauses.push(`card_exp_month = coalesce(card_exp_month, $${n})`); params.push(card.card_exp_month); }
      if (card.card_exp_year) { n += 1; setClauses.push(`card_exp_year = coalesce(card_exp_year, $${n})`); params.push(card.card_exp_year); }
      if (card.card_funding) { n += 1; setClauses.push(`card_funding = coalesce(card_funding, $${n})`); params.push(card.card_funding); }
      if (card.card_country) { n += 1; setClauses.push(`card_country = coalesce(card_country, $${n})`); params.push(card.card_country); }

      const receiptEmail = lowerOrNull(stripeObj.receipt_email);
      if (receiptEmail) { n += 1; setClauses.push(`receipt_email = coalesce(receipt_email, $${n})`); params.push(receiptEmail); }
      const receiptUrl = stringOrNull(stripeObj.receipt_url);
      if (receiptUrl) { n += 1; setClauses.push(`receipt_url = coalesce(receipt_url, $${n})`); params.push(receiptUrl); }

      if (allowStatusTransition) {
        if (status_target === "succeeded") {
          setClauses.push("succeeded_at = coalesce(succeeded_at, now())");
        } else if (status_target === "failed") {
          setClauses.push("failed_at = coalesce(failed_at, now())");
          if (errorInfo.failure_code) { n += 1; setClauses.push(`failure_code = $${n}`); params.push(errorInfo.failure_code); }
          if (errorInfo.failure_message) { n += 1; setClauses.push(`failure_message = $${n}`); params.push(errorInfo.failure_message); }
          if (errorInfo.failure_reason) { n += 1; setClauses.push(`failure_reason = $${n}`); params.push(errorInfo.failure_reason); }
          if (errorInfo.decline_code) { n += 1; setClauses.push(`decline_code = $${n}`); params.push(errorInfo.decline_code); }
          if (stripeEvent.id) { n += 1; setClauses.push(`last_failure_event_id = $${n}`); params.push(stripeEvent.id); }
        } else if (status_target === "canceled") {
          setClauses.push("canceled_at = coalesce(canceled_at, now())");
        } else if (status_target === "expired") {
          setClauses.push("expired_at = coalesce(expired_at, now())");
        } else if (status_target === "refunded") {
          setClauses.push("refunded_at = coalesce(refunded_at, now())");
        } else if (status_target === "disputed") {
          setClauses.push("disputed_at = coalesce(disputed_at, now())");
        }
      }

      if (stripeMetadata && Object.keys(stripeMetadata).length) {
        n += 1; setClauses.push(`stripe_metadata = stripe_metadata || $${n}::jsonb`); params.push(jsonOrEmpty(stripeMetadata));
      }

      n += 1;
      params.push(transaction.id);
      await client.query(
        `update public.payment_transactions set ${setClauses.join(", ")} where id = $${n}`,
        params
      );
    }

    // Always append an event row (even when no transaction was found, so we
    // don't lose data; pre_order_id / metadata can be inspected later).
    const eventInsert = await client.query(
      `insert into public.payment_events (
        payment_transaction_id, pre_order_id, payment_flow,
        event_type, event_status,
        stripe_event_id, stripe_event_type,
        stripe_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_customer_id,
        payment_method_type, card_brand, card_last4,
        amount, amount_refunded, currency,
        failure_code, failure_message, failure_reason, decline_code,
        customer_email, source_context,
        metadata, raw_event, occurred_at
      ) values (
        $1, $2, $3,
        $4, $5,
        $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17,
        $18, $19, $20, $21,
        $22, $23,
        $24::jsonb, $25::jsonb, to_timestamp($26)
      )
      on conflict (stripe_event_id) where stripe_event_id is not null
      do nothing
      returning id`,
      [
        transactionId,
        uuidOrNull(transaction?.pre_order_id) || uuidOrNull(stripeMetadata.pre_order_id),
        transaction?.payment_flow || stringOrNull(stripeMetadata.checkout_type) || null,
        event_type,
        status_target || null,
        stringOrNull(stripeEvent.id),
        stringOrNull(stripeEvent.type),
        stringOrNull(sessionId),
        stringOrNull(intentId),
        stringOrNull(chargeId),
        stringOrNull(customerId),
        stringOrNull(card.payment_method_type),
        stringOrNull(card.card_brand),
        stringOrNull(card.card_last4),
        (() => {
          if (objectType === "checkout.session") return toCentsToDollars(stripeObj.amount_total);
          if (objectType === "payment_intent") return toCentsToDollars(stripeObj.amount_received || stripeObj.amount);
          if (objectType === "charge") return toCentsToDollars(stripeObj.amount_captured || stripeObj.amount);
          return null;
        })(),
        toCentsToDollars(stripeObj.amount_refunded),
        stringOrNull(stripeObj.currency),
        errorInfo.failure_code,
        errorInfo.failure_message,
        errorInfo.failure_reason,
        errorInfo.decline_code,
        lowerOrNull(stripeObj.receipt_email) || lowerOrNull(billingDetails.email) || lowerOrNull(transaction?.customer_email),
        transaction?.source_context || null,
        // Capture the status transition delta in the event row's metadata so a
        // single ORDER BY occurred_at scan of payment_events tells the full
        // forensic story of every state change for the attempt.
        jsonOrEmpty({
          ...stripeMetadata,
          status_transition: status_target ? {
            from: transaction?.payment_status ?? null,
            to: status_target,
            applied: shouldTransitionTo(transaction?.payment_status, status_target)
          } : undefined
        }),
        jsonOrNull(safeStripeObjectForLog) || "null",
        stripeEvent.created || Math.floor(Date.now() / 1000)
      ]
    );

    await client.query("commit");
    return eventInsert.rows?.[0]?.id || transactionId;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

// Helper to attach known Stripe IDs / customer to an existing transaction.
// Useful when, e.g., we finalize a transaction in processCompletedCheckoutSession
// and have richer data than what was available at session-creation time.
//
// `refs` accepts EITHER a direct `{ id }` (preferred when the caller already
// holds the attempt's primary key) OR a lookup tuple
// `{ stripe_session_id, stripe_payment_intent_id, stripe_charge_id, pre_order_id }`.
export const enrichPaymentTransaction = safeRunner(async (
  refs = {},
  patch = {},
  client = null
) => {
  let transaction = null;
  const directId = uuidOrNull(refs.id);
  if (directId) {
    const runner = client || pool;
    const res = await runner.query(
      `select * from public.payment_transactions where id = $1 limit 1`,
      [directId]
    );
    transaction = res.rows?.[0] || null;
  } else {
    transaction = await findTransactionByEventRefs(client, {
      stripe_session_id: refs.stripe_session_id,
      stripe_payment_intent_id: refs.stripe_payment_intent_id,
      stripe_charge_id: refs.stripe_charge_id,
      pre_order_id: refs.pre_order_id
    });
  }

  const runner = client || pool;
  const setClauses = ["updated_at = now()"];
  const params = [];
  let n = 0;
  const allowed = [
    "payment_status",
    "amount_paid",
    "amount_subtotal",
    "amount_discount",
    "amount_total",
    "stripe_session_id",
    "stripe_payment_intent_id",
    "stripe_charge_id",
    "stripe_customer_id",
    "stripe_checkout_url",
    "stripe_checkout_status",
    "stripe_payment_status",
    "payment_method_type",
    "card_brand",
    "card_last4",
    "card_exp_month",
    "card_exp_year",
    "receipt_email",
    "receipt_url",
    "billing_name",
    "billing_email",
    "billing_phone",
    "linked_user_id",
    "pre_order_id",
    "course_id",
    "service_type_id",
    "item_id",
    "item_name"
  ];
  // Columns typed as uuid in the schema. We coerce non-uuid strings to NULL so
  // a bad caller can't crash the enrichment with an invalid uuid literal.
  const uuidColumns = new Set(["pre_order_id", "course_id", "linked_user_id"]);
  for (const key of allowed) {
    if (patch[key] === undefined || patch[key] === null) continue;
    const value = uuidColumns.has(key) ? uuidOrNull(patch[key]) : patch[key];
    if (value === null) continue;
    n += 1;
    setClauses.push(`${key} = coalesce(${key}, $${n})`);
    params.push(value);
  }
  if (patch.billing_address) {
    n += 1;
    setClauses.push(`billing_address = coalesce(billing_address, $${n}::jsonb)`);
    params.push(jsonOrEmpty(patch.billing_address));
  }
  if (patch.stripe_metadata) {
    n += 1;
    setClauses.push(`stripe_metadata = stripe_metadata || $${n}::jsonb`);
    params.push(jsonOrEmpty(patch.stripe_metadata));
  }
  if (n === 0) return transaction.id;
  n += 1;
  params.push(transaction.id);
  await runner.query(
    `update public.payment_transactions set ${setClauses.join(", ")} where id = $${n}`,
    params
  );
  return transaction.id;
});

// Record a non-Stripe lifecycle event (e.g., an "MD service" pre-order that is
// not yet payable but we still want to track). Always inserts a payment_events
// row tied to a payment_transactions row.
export const recordPreOrderInitiated = safeRunner(async (input, client = null) => {
  // Wrapper that defaults flow to 'service' and no stripe ids.
  return recordCheckoutInitiated({
    payment_flow: SERVICE_FLOW,
    payment_type: input.payment_type || SERVICE_FLOW,
    ...input
  }, client);
});

export const PAYMENT_FLOW = Object.freeze({
  COURSE: COURSE_FLOW,
  MODEL: MODEL_FLOW,
  SERVICE: SERVICE_FLOW
});
