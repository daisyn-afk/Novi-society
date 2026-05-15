# Payment Activity & Lifecycle Tracking

**Task ref:** Production-grade Stripe payment observability
**Status:** Implemented · three migrations applied · 23/23 webhook end-to-end smoke + 33/33 immutability+events smoke + 21/21 attempt-isolation smoke + 51/51 lifecycle integration checks passing
**Scope:** every Stripe-driven checkout in the app (course tuition, model signups, MD service pre-orders) plus all related webhook events (created, completed, expired, failed, succeeded, refunded, disputed). Every "Pay" click is logged independently with the exact request payload — even when validation rejects it — and snapshot fields are immutable at the database level.

This document explains what was built, how the data model is shaped, where each piece of code lives, and how to extend or query the system.

If you only have time to read one section, read **§9 Complete Payment Data Tracking Spec (Single Source of Truth)**.

---

## 1. Why this exists

Before this change, the app stored payments in `public.course_payments` *only after* a checkout succeeded. There was no record of:

- Declined cards / incorrect card entries
- Insufficient funds, 3DS failures, fraud blocks
- Abandoned checkouts (user left the page)
- Expired checkout sessions
- Webhook delivery problems
- MD service pre-orders (no Stripe flow at all)

This made it impossible for support to investigate "I tried to pay but it didn't work" tickets — the failed attempts left no trace anywhere in the database.

The new system stores **every** observable lifecycle event for every Stripe flow into a centralized place support and admins can query.

---

## 2. Data model

Two tables and one view in the `public` schema. Migration history:

| Migration | What it added |
|---|---|
| `20260515120000_payment_tracking.sql` | Original `payment_transactions` + `payment_events` tables, indexes, and `updated_at` trigger. |
| `20260515130000_payment_attempt_snapshots.sql` | Per-attempt snapshot columns: `attempt_number`, `selected_item_id`, `request_payload_snapshot`, `client_timestamp`, `server_received_timestamp`. |
| `20260515140000_payment_immutability_and_timeline.sql` | `previous_status` column on `payment_transactions`. DB-level immutability trigger. `payment_attempt_timeline` forensic view. |

### 2.1 `payment_transactions`

One row per checkout attempt. Holds the **current state** of that attempt plus a denormalized snapshot of everything we know about it.

Key column groups:

| Group | Columns |
|---|---|
| Identity | `id`, `created_at`, `updated_at` |
| Flow classification | `payment_flow` (`course` / `model` / `service` / `other`), `payment_type`, `payment_status` |
| Linkage | `pre_order_id`, `course_id`, `service_type_id`, `item_id`, `item_name` |
| Customer | `user_id`, `linked_user_id`, `customer_email`, `customer_name`, `customer_phone` |
| Amounts | `amount_subtotal`, `amount_discount`, `amount_total`, `amount_paid`, `currency` |
| Stripe IDs | `stripe_session_id`, `stripe_payment_intent_id`, `stripe_charge_id`, `stripe_customer_id`, `stripe_checkout_url`, `stripe_checkout_status`, `stripe_payment_status` |
| Card (Stripe-safe only) | `payment_method_type`, `card_brand`, `card_last4`, `card_exp_month`, `card_exp_year`, `card_funding`, `card_country` |
| Receipt | `receipt_email`, `receipt_url` |
| Billing | `billing_name`, `billing_email`, `billing_phone`, `billing_address` (jsonb) |
| Source / debugging | `source_context`, `source_origin`, `request_ip`, `user_agent` |
| Failure | `failure_code`, `failure_message`, `failure_reason`, `decline_code`, `last_failure_event_id` |
| Free-form | `metadata` (our metadata), `stripe_metadata` (mirror of Stripe metadata) |
| Lifecycle timestamps | `initiated_at`, `checkout_opened_at`, `succeeded_at`, `failed_at`, `canceled_at`, `expired_at`, `refunded_at`, `disputed_at`, `last_event_at`, `last_event_type` |
| Per-attempt snapshot | `selected_item_id` (raw, uncoerced), `request_payload_snapshot` (jsonb deep copy of the request body), `attempt_number` (monotonic per `(customer_email, payment_flow)`), `client_timestamp` (browser click time), `server_received_timestamp` (server arrival time) |

**`payment_status` value reference** (column is intentionally not enum-typed so future flows don't require a migration):

| Value | Meaning |
|---|---|
| `initiated` | Stripe checkout session was just created. |
| `checkout_opened` | User actually landed on the Stripe-hosted page. |
| `processing` | PaymentIntent is processing (e.g. ACH, async settlement). |
| `requires_action` | 3DS / authentication required. |
| `succeeded` | Payment captured. |
| `failed` | Declined / card error / authentication failed. |
| `canceled` | User canceled or PaymentIntent was canceled. |
| `expired` | Checkout session expired without payment. |
| `refunded` | Charge refunded (full or partial). |
| `disputed` | Chargeback / dispute opened. |

**Indexes:**

- Unique partial index on `stripe_session_id WHERE stripe_session_id IS NOT NULL` (enforces 1 transaction per Stripe session).
- B-tree indexes on `payment_status`, `payment_flow`, `customer_email`, `pre_order_id`, `stripe_payment_intent_id`, `stripe_charge_id`, `stripe_customer_id`, `created_at DESC`.

### 2.2 `payment_events`

Append-only log. Every webhook delivery, plus our own lifecycle events (`initiated`, `checkout_opened`) get a row.

Key column groups:

| Group | Columns |
|---|---|
| Identity | `id`, `created_at`, `occurred_at` (the Stripe event timestamp) |
| Linkage | `payment_transaction_id`, `pre_order_id`, `payment_flow` |
| Event classification | `event_type`, `event_status` |
| Stripe context | `stripe_event_id`, `stripe_event_type`, `stripe_session_id`, `stripe_payment_intent_id`, `stripe_charge_id`, `stripe_customer_id` |
| Money | `amount`, `amount_refunded`, `currency` |
| Card | `payment_method_type`, `card_brand`, `card_last4` |
| Failure | `failure_code`, `failure_message`, `failure_reason`, `decline_code` |
| Customer | `customer_email`, `source_context` |
| Free-form | `metadata` (Stripe metadata at time of event), `raw_event` (full Stripe object, defensively sanitized) |

**`event_type` value reference** — these are our normalized names, not Stripe's:

| Our `event_type` | Originating Stripe event |
|---|---|
| `initiated` | (none — emitted when we create a Stripe session) |
| `checkout_opened` | (none — emitted when user reaches Stripe checkout) |
| `session_completed` | `checkout.session.completed` |
| `session_expired` | `checkout.session.expired` |
| `session_async_succeeded` | `checkout.session.async_payment_succeeded` |
| `session_async_failed` | `checkout.session.async_payment_failed` |
| `payment_succeeded` | `payment_intent.succeeded` |
| `payment_failed` | `payment_intent.payment_failed` |
| `payment_canceled` | `payment_intent.canceled` |
| `payment_processing` | `payment_intent.processing` |
| `payment_requires_action` | `payment_intent.requires_action` |
| `charge_succeeded` | `charge.succeeded` |
| `charge_failed` | `charge.failed` |
| `charge_refunded` | `charge.refunded` |
| `charge_captured` | `charge.captured` |
| `charge_dispute_created` | `charge.dispute.created` |

**Indexes:**

- Unique partial index on `stripe_event_id WHERE stripe_event_id IS NOT NULL` — guarantees idempotency on webhook redelivery.
- B-tree indexes on `payment_transaction_id`, `pre_order_id`, `stripe_session_id`, `stripe_payment_intent_id`, `stripe_charge_id`, `event_type`, `customer_email`, `created_at DESC`.

---

## 3. Code layout

```
backend/admin/payments/service.js         # Centralized tracker — every other file imports from here
backend/admin/checkout/service.js         # Course checkout + MD service pre-order → wired
backend/admin/checkout/routes.js          # Forwards source/IP/user-agent headers
backend/admin/functions/routes.js         # Model signup checkout + /modelCheckoutWebhook → wired
backend/admin/webhooks/routes.js          # Main /webhooks/stripe entry → records every tracked event
supabase/migrations/20260515120000_payment_tracking.sql   # DB migration
```

### 3.1 `backend/admin/payments/service.js` — the tracker

Exposes six functions. All are **fail-soft**: if the tracking tables don't exist, or any query fails, they log and return `null` so business logic is never blocked by tracking.

#### `recordCheckoutInitiated(input, client?)`

Called at the **top of every checkout route**, before any validation. Always performs a plain `INSERT` — every call yields a brand new `payment_transactions` row and an `initiated` event row. The function never upserts or merges with a prior attempt.

`input` shape (all fields optional except where noted):

```js
{
  payment_flow: "course" | "model" | "service",   // required
  payment_type: "course" | "model" | "md_service",
  selected_item_id,                               // raw, uncoerced user input
  pre_order_id, course_id, service_type_id,       // optional; usually filled in later via enrichPaymentTransaction
  item_id, item_name,
  user_id, linked_user_id,
  customer_email, customer_name, customer_phone,
  amount_subtotal, amount_discount, amount_total, currency,
  stripe_session_id, stripe_payment_intent_id,    // optional — usually NULL at this stage
  stripe_customer_id, stripe_checkout_url,
  receipt_email,
  billing_name, billing_email, billing_phone, billing_address,
  source_context, source_origin, request_ip, user_agent,
  client_timestamp,                                // ISO from the browser at click time
  server_received_timestamp,                       // ISO at server arrival
  request_payload_snapshot,                        // deep copy of the raw request body
  metadata: { ...any extra fields you want to keep }
}
```

`attempt_number` is auto-computed inside the insert from prior attempts with the same `(customer_email, payment_flow)`.

`client` (optional) — when called inside an existing `pg` transaction, pass the `pg` client so the tracker writes run inside the same transaction. The tracker automatically wraps its work in a `SAVEPOINT`, so any tracking-only error is rolled back to the savepoint and never poisons the caller's outer transaction. **However**, the per-attempt insert should normally happen *outside* the business transaction so the row survives a business-side rollback (see §5.7).

Returns the transaction `id` (uuid string) or `null` on failure.

#### `markAttemptFailed(transactionId, { failure_reason, failure_message, failure_code, http_status_code, stripe_session_id?, stripe_payment_intent_id? }, client?)`

Called from a checkout route's catch block (or anywhere a previously-recorded attempt has now failed). Idempotently:

1. Flips `payment_status` to `failed` (unless already terminal).
2. Sets `failed_at`, `failure_reason`, `failure_message`, `failure_code` via `coalesce` so earlier richer values aren't overwritten.
3. Appends an `attempt_failed` event row carrying the same failure context.

#### `recordCheckoutOpened({ stripe_session_id, source_context? })`

Called when we have proof the user actually reached the Stripe-hosted checkout page. Flips `payment_status` to `checkout_opened` (only if the transaction is not already in a terminal state) and appends a `checkout_opened` event.

Frontend can call this from the `success_url` / `cancel_url` arrival, or it can be omitted — every `payment_intent.*` event also implicitly proves the user reached checkout.

#### `recordStripeWebhookEvent(event)`

Single entry point for webhook handlers. Pass the verified Stripe event object; the tracker:

1. Identifies the relevant transaction by **session id → payment intent id → charge id → pre_order id (uuid only)**.
2. Idempotency check on `stripe_event_id` — duplicate deliveries are skipped.
3. Updates the transaction's `payment_status` (with terminal-state guards — see §5.2).
4. Back-fills enrichment fields (`coalesce` semantics so we never overwrite better data with worse).
5. Appends a `payment_events` row with the full sanitized event payload.

#### `enrichPaymentTransaction(refs, patch, client?)`

For cases where we get richer data *outside* the webhook (e.g. inside `processCompletedCheckoutSession` we already have the linked user id, or after `stripe.checkout.sessions.create` succeeds and we need to attach the session id to the just-created attempt row).

`refs` accepts **either** a direct primary key — `{ id: attemptId }` — **or** a lookup tuple — `{ stripe_session_id, stripe_payment_intent_id, stripe_charge_id, pre_order_id }`.

`patch` is a whitelisted set of columns. UUID-typed columns (`pre_order_id`, `course_id`, `linked_user_id`) are coerced via the UUID regex so a malformed string becomes `null` instead of crashing the update. Every column uses `coalesce(column, new_value)` — values that are already set are **never** silently overwritten.

#### `recordPreOrderInitiated(input, client?)`

Thin wrapper around `recordCheckoutInitiated` with `payment_flow: "service"` defaulted. Used for the MD service flow which doesn't currently go through Stripe.

#### `PAYMENT_FLOW`

```js
PAYMENT_FLOW.COURSE   // "course"
PAYMENT_FLOW.MODEL    // "model"
PAYMENT_FLOW.SERVICE  // "service"
```

### 3.2 Wiring per flow

| Flow | Where it's wired |
|---|---|
| **Course tuition** | `createCourseCheckout` in `backend/admin/checkout/service.js` calls `recordCheckoutInitiated` at the **top of the function** (outside the business transaction). Business validation runs inside a try-block; on Stripe-session-creation success it calls `enrichPaymentTransaction({ id })` to attach the session id + pre_order id; on any error it calls `markAttemptFailed`. `processCompletedCheckoutSession` calls `enrichPaymentTransaction` again to push final success data. |
| **Model signup** | `POST /functions/createModelCheckout` route in `backend/admin/functions/routes.js` — same pattern: log attempt up front, enrich on success, `markAttemptFailed` in catch. `processModelCheckoutCompletedSession` calls `enrichPaymentTransaction` on success. |
| **MD service** | `createServicePreOrder` in `backend/admin/checkout/service.js` — same pattern with `recordPreOrderInitiated` (wrapper around `recordCheckoutInitiated` defaulting `payment_flow: "service"`). |
| **Main webhook** | `backend/admin/webhooks/routes.js` calls `recordStripeWebhookEvent` for every tracked event type *before* running the pre-existing business handlers. |
| **Model webhook** | `POST /functions/modelCheckoutWebhook` calls `recordStripeWebhookEvent` for every tracked event type. |
| **Frontend (course)** | `src/api/courseCheckoutApi.js` adds an `x-novi-client-timestamp` header + body field on every `createCheckout` and `createServicePreOrder` call. |
| **Frontend (model / wait-list)** | `src/api/providers/lovableProvider.js` stamps a `client_timestamp` on `base44.functions.invoke("createModelCheckout" \| "createPreOrderCheckout" \| "createCheckoutSession", ...)`. |

### 3.3 What we changed in Stripe calls

Both course and model `stripe.checkout.sessions.create(...)` calls now also pass `payment_intent_data.metadata` mirroring the session metadata. This is what makes correlation possible for `payment_intent.*` and `charge.*` events: those events carry the metadata from the PaymentIntent, not the Checkout Session, so without this mirror the only way to find the parent transaction would be an extra API call to Stripe.

---

## 4. End-to-end payment flows

These diagrams show exactly what happens at each stage of every flow — what code runs, what gets written to the database, and what the user experiences.

### 4.1 Flow A — Course checkout

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER FILLS CHECKOUT FORM (CourseCheckout page)                     │
│  POST /admin/checkout/course                                        │
│                                                                     │
│  1. Validates course, seats, promo code (DB, row-locked)            │
│  2. Inserts pre_orders row          → status = pending_payment      │
│  3. Calls stripe.checkout.sessions.create(...)                      │
│       metadata + payment_intent_data.metadata both set              │
│  4. Updates pre_orders with stripe_session_id                       │
│  5. recordCheckoutInitiated(...)    → payment_transactions (initiated)│
│                                       payment_events (initiated)    │
│  Returns: { checkout_url, stripe_session_id, pre_order_id }         │
└────────────────────────┬────────────────────────────────────────────┘
                         │  Frontend redirects user to Stripe
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  USER IS ON STRIPE-HOSTED CHECKOUT PAGE                             │
│  payment_transactions status = checkout_opened  (via webhook)       │
│                                                                     │
│         User abandons          User enters card details             │
│               │                         │                          │
│               ▼                         ▼                          │
│  ┌────────────────────┐    ┌────────────────────────┐              │
│  │ Session expires    │    │ Card declined          │              │
│  │ (no payment made)  │    │ (or 3DS failure, etc.) │              │
│  │                    │    │                        │              │
│  │ checkout.session   │    │ payment_intent         │              │
│  │  .expired webhook  │    │  .payment_failed       │              │
│  │                    │    │  webhook               │              │
│  │ status → expired   │    │                        │              │
│  │ expired_at set     │    │ status → failed        │              │
│  │                    │    │ failure_code stored     │              │
│  │ pre_orders: no     │    │ decline_code stored     │              │
│  │ change (still      │    │ failure_message stored  │              │
│  │ pending_payment)   │    │ failed_at set           │              │
│  └────────────────────┘    │ last_failure_event_id  │              │
│                            │                        │              │
│                            │   User retries ───────►│ Card OK      │
│                            └────────────────────────┘              │
└─────────────────────────────────────┬───────────────────────────────┘
                                      │  Card accepted
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STRIPE FIRES TWO WEBHOOKS (usually within milliseconds)            │
│  POST /webhooks/stripe                                              │
│                                                                     │
│  ① charge.succeeded                                                 │
│     recordStripeWebhookEvent(event)                                 │
│       payment_transactions: card_brand, card_last4, card_exp,       │
│                             stripe_charge_id, stripe_customer_id,   │
│                             receipt_email, receipt_url,             │
│                             billing_address  ← all stored           │
│       status → succeeded  /  succeeded_at set                       │
│       payment_events row appended (charge_succeeded)                │
│                                                                     │
│  ② checkout.session.completed                                       │
│     recordStripeWebhookEvent(event)                                 │
│       stripe_checkout_status, stripe_payment_status merged (coalesce)│
│       billing_address merged if missing                             │
│       status stays succeeded (terminal-state guard)                 │
│       payment_events row appended (session_completed)               │
│                                                                     │
│     processCompletedCheckoutSession(session)  ← existing logic      │
│       pre_orders: status → paid, paid_at set                        │
│       enrollments row created                                       │
│       scheduled_courses: available_seats decremented                │
│       confirmation email sent                                       │
│       provider user upserted / invite email sent                    │
│                                                                     │
│     enrichPaymentTransaction(...)                                   │
│       payment_transactions: amount_paid, billing_details,           │
│                             linked_user_id merged                   │
└─────────────────────────────────────────────────────────────────────┘

  Event log sequence for a retried payment:
  initiated → checkout_opened → payment_failed → charge_succeeded → session_completed
```

---

### 4.2 Flow B — Model signup checkout

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER FILLS MODEL SIGNUP FORM (ModelSignup page)                    │
│  POST /functions/createModelCheckout                                │
│                                                                     │
│  1. Validates course date, time slot, seat cap                      │
│  2. Applies promo code (if any)                                     │
│  3. Inserts pre_orders row (order_type = model)                     │
│       status = pending / payment_status = pending                   │
│                                                                     │
│  ── Free / fully-discounted path ──────────────────────────────────│
│  If finalCents = 0:                                                 │
│    pre_orders: status → paid, payment_status → completed            │
│    Confirmation email sent immediately                              │
│    Returns { free: true }                                           │
│                                                                     │
│  ── Paid path ──────────────────────────────────────────────────── │
│  4. stripe.checkout.sessions.create(...)                            │
│       metadata + payment_intent_data.metadata both set              │
│       checkout_type: "model" in metadata                            │
│  5. Updates pre_orders with stripe_session_id                       │
│  6. recordCheckoutInitiated(...)   → payment_transactions (initiated)│
│                                      payment_events (initiated)     │
│  Returns: { url, pre_order_id }                                     │
└────────────────────────┬────────────────────────────────────────────┘
                         │  Frontend redirects user to Stripe
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STRIPE CHECKOUT (same decline / expiry paths as Flow A)            │
│                                                                     │
│  On success, TWO webhook routes both fire:                          │
│                                                                     │
│  POST /webhooks/stripe (main)                                       │
│    checkout_type = "model" → processModelCheckoutCompletedSession   │
│    recordStripeWebhookEvent(event)  (same enrichment as Flow A)     │
│                                                                     │
│  POST /functions/modelCheckoutWebhook (legacy, also wired)          │
│    recordStripeWebhookEvent(event)  (idempotent — no duplicate rows)│
│    processModelCheckoutCompletedSession(session)                    │
│      pre_orders: status → paid, payment_status → completed          │
│      amount_paid set, paid_at set                                   │
│      Confirmation email sent                                        │
│      enrichPaymentTransaction(...)  ← billing + status merged       │
└─────────────────────────────────────────────────────────────────────┘

  Event log sequence (success path):
  initiated → checkout_opened → charge_succeeded → session_completed
```

---

### 4.3 Flow C — MD service pre-order (no Stripe yet)

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER FILLS MD SERVICE FORM                                         │
│  POST /admin/checkout/service                                       │
│                                                                     │
│  1. Validates service_type_id                                       │
│  2. Inserts pre_orders row                                          │
│       order_type = service  /  status = pending_approval            │
│  3. Sends confirmation email (Resend)                               │
│  4. recordPreOrderInitiated(...)   → payment_transactions           │
│       payment_flow = service                                        │
│       payment_type = md_service                                     │
│       payment_status = initiated                                    │
│       stripe_session_id = NULL  (no Stripe charge yet)             │
│       payment_events row appended (initiated)                       │
│  Returns: { pre_order_id }                                          │
└─────────────────────────────────────────────────────────────────────┘

  No further webhook events for this flow until Stripe billing is added.
  When that happens: call recordCheckoutInitiated with a real
  stripe_session_id and the tracker picks up from there automatically.
```

---

### 4.4 Status lifecycle diagram (all flows)

```
                    ┌─────────────┐
   session created  │  initiated  │
   ────────────────►│             │
                    └──────┬──────┘
                           │ user arrives at Stripe page
                           ▼
                    ┌──────────────────┐
                    │ checkout_opened  │
                    └──────┬───────────┘
                           │
              ┌────────────┼──────────────┐
              │            │              │
              ▼            ▼              ▼
         ┌─────────┐  ┌─────────┐  ┌───────────┐
         │ failed  │  │ expired │  │ processing│
         │ (card   │  │ (session│  │ (async    │
         │ decline)│  │ timeout)│  │ settlement│
         └────┬────┘  └─────────┘  └─────┬─────┘
              │                          │
              │ user retries with        │ settlement
              │ different card           │ completes
              │                          │
              └──────────┬───────────────┘
                         ▼
                   ┌───────────┐
                   │ succeeded │◄─── charge.succeeded
                   └─────┬─────┘     session.completed
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
         ┌──────────┐         ┌──────────┐
         │ refunded │         │ disputed │
         └──────────┘         └──────────┘
              ▲                     ▲
              │                     │
       charge.refunded       charge.dispute.created
```

Terminal statuses (`succeeded`, `refunded`, `disputed`) cannot be overwritten
by earlier or out-of-order webhook events.

---

## 5. Behavioural rules

### 5.1 Idempotency

- `payment_events.stripe_event_id` has a partial unique index. The webhook handler also does an early dedup check on the same column.
- Re-delivering the same event = 0 net change. Verified by the integration test.

### 5.2 Status transitions (terminal-state guard)

In `shouldTransitionTo(current, target)`:

- Terminal statuses `refunded` / `disputed` can only move to another terminal status.
- `succeeded` can only move to `refunded` / `disputed`.
- Any other status can transition freely.

This means an out-of-order webhook delivery (which Stripe occasionally produces) cannot flip a succeeded payment back to `failed`.

### 5.3 Enrichment is independent of status transitions

Even when the status transition is blocked, the tracker still back-fills missing fields like `card_brand`, `card_last4`, `billing_address`, `stripe_checkout_status`, etc. using `coalesce(column, new_value)` semantics. This guarantees we don't lose information from a `checkout.session.completed` event that arrives *after* `charge.succeeded` already set the status to `succeeded`.

### 5.4 Savepoints around tracker writes

When the tracker is called with a `pg` client (inside an outer transaction), every write happens inside `SAVEPOINT sp_payment_tracking_N`. If the tracker errors:

1. Rollback to the savepoint.
2. Log and return `null`.
3. The outer caller's transaction is unaffected.

This is critical: payment tracking must never break payment processing.

### 5.5 UUID coercion

Any value that lands in a `uuid` column (e.g. `pre_order_id` extracted from Stripe metadata) is validated against the UUID regex first. Malformed values become `null` instead of throwing `invalid input syntax for type uuid`.

### 5.6 Tables-missing fallback

On first call, the tracker probes `information_schema.tables` to confirm both `payment_transactions` and `payment_events` exist. If not (e.g. migration hasn't been run on this environment), every tracker call becomes a no-op. The result is cached, so the probe runs at most once per process.

### 5.7 Per-attempt isolation (every click = new row)

The tracker writes the attempt row **at the top of every checkout route**, *before* any validation runs and **outside** the business transaction. This guarantees:

| Scenario | Behaviour |
|---|---|
| User enters wrong / invalid `course_id` (or `service_type_id`) and clicks Pay | A `payment_transactions` row is created with the exact `request_payload_snapshot`, `selected_item_id` set to the literal user input, and `payment_status = 'failed'` plus a populated `failure_message`. |
| User changes the selection and retries | A **brand new row** is inserted (no upsert / merge). The prior attempt's row is never mutated. `attempt_number` increments. |
| User double-clicks Pay | Each click creates a new Stripe session ID and therefore a new row. Each row keeps its own `request_payload_snapshot` taken at the moment of insertion. |
| Stripe API call throws | The attempt row exists with `payment_status = 'failed'`, `failure_code` set to the Stripe error code, and `failure_message` set to the Stripe error text. |
| Inner business transaction commits but Stripe session creation later fails | The attempt row's status moves to `failed` via `markAttemptFailed`. No partial `pre_orders` row leaks. |

Implementation invariants (enforced by code + smoke test):

1. `recordCheckoutInitiated` performs a plain `INSERT` (no `ON CONFLICT DO UPDATE`). Every call yields a new primary key. If two calls were to somehow land with the same `stripe_session_id`, the partial unique index would raise — that is an actionable bug, not silently merged data.
2. `request_payload_snapshot` is stored as `jsonb`, deep-copying the request body verbatim. We do not strip fields. This is the **source of truth** for "what did the user submit".
3. `selected_item_id` is stored uncoerced (`text`). If the user typed `"this-is-not-a-uuid"`, that exact string is in the column. Use this to diagnose typos, autofill bugs, or cache poisoning.
4. `attempt_number` is computed at insert time via `coalesce((select max(attempt_number) + 1 from payment_transactions where customer_email = ? and payment_flow = ?), 1)`. Two simultaneous inserts could in theory tie, but for support purposes a tie is acceptable; the unique row id is still distinct.
5. `client_timestamp` is captured by the frontend at the click moment (`x-novi-client-timestamp` header or `client_timestamp` body field). `server_received_timestamp` is set on arrival. A large gap (>30s) suggests the browser tab was idle / suspended / using stale state.
6. After Stripe session creation succeeds, the route calls `enrichPaymentTransaction({ id: attemptId }, { stripe_session_id, ... })` — this uses `coalesce(column, new_value)` so once a value is set it is never silently overwritten by a later enrichment call. Smoke test verified.

The smoke test `scripts/_smoke_payment_attempt_isolation.mjs` validates all five scenarios from the requirements against the live database and was used to gate this change.

---

## 6. Security & PCI compliance

- **No raw card data is stored.** Only `card_brand`, `card_last4`, `card_exp_month`, `card_exp_year`, `card_funding`, `card_country` — all Stripe-provided and Stripe-considered safe.
- Webhook signature verification (`stripe.webhooks.constructEvent`) remains the only entry point — unauthenticated requests cannot insert events.
- Before persisting `raw_event`, we strip the `payment_method` field defensively. Stripe never sends a PAN/CVV in the first place, but the strip protects against future API additions.
- `customer_email` is lower-cased on write so searches are case-insensitive without needing a function index.

---

## 7. Running the migration

There are three migration files; each uses `create … if not exists` / `add column if not exists` / `create or replace`, so **all are idempotent and safe to re-run**.

### Production / staging

Apply each file in order through Supabase's migration system, the team's existing pipeline, or `psql`:

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260515120000_payment_tracking.sql
psql "$DATABASE_URL" -f supabase/migrations/20260515130000_payment_attempt_snapshots.sql
psql "$DATABASE_URL" -f supabase/migrations/20260515140000_payment_immutability_and_timeline.sql
```

### Verification

```sql
-- both tables present
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('payment_transactions', 'payment_events');

-- the timeline view is present
select viewname from pg_views
where schemaname = 'public' and viewname = 'payment_attempt_timeline';

-- the immutability trigger is wired up
select trigger_name from information_schema.triggers
where event_object_table = 'payment_transactions'
  and trigger_name = 'trg_payment_transactions_immutability';
```

The tracker itself short-circuits gracefully if either table is missing, so applying the migration can be done before *or* after the code deploy.

### Required env vars

| Variable | Where it's used | Notes |
|---|---|---|
| `DATABASE_URL` | Backend connection pool | Same as the rest of the app. |
| `STRIPE_SECRET_KEY` | `stripe.checkout.sessions.create`, `stripe.webhooks.constructEvent` | Test mode key `sk_test_…` for staging/dev. |
| `STRIPE_WEBHOOK_SECRET` | `verifyStripeWebhook` | The `whsec_…` value Stripe gives you when you create the endpoint. **Different per environment.** |

### Stripe webhook endpoint configuration

In the Stripe Dashboard → **Developers → Webhooks → Add endpoint**, register **two endpoints** per environment:

| Purpose | Endpoint URL |
|---|---|
| Main checkout (course + MD service) | `https://<your-host>/api/webhooks/stripe` |
| Model signup (legacy split webhook) | `https://<your-host>/api/functions/modelCheckoutWebhook` |

Select these event types on each:

```
checkout.session.created            checkout.session.completed
checkout.session.expired            checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
payment_intent.created              payment_intent.succeeded
payment_intent.payment_failed       payment_intent.canceled
payment_intent.processing           payment_intent.requires_action
charge.succeeded                    charge.failed
charge.refunded                     charge.captured
charge.dispute.created
```

After creating the endpoint, copy its **Signing secret** (`whsec_…`) into the env variable `STRIPE_WEBHOOK_SECRET` for that environment. On Vercel: Project Settings → Environment Variables.

### Vercel-specific: disabling Vercel's body parser

Stripe signs the **raw request bytes**, so we **must** see the unmodified body. Vercel's Node-function runtime parses JSON bodies by default — which silently corrupts the signature.

`api/index.js` already declares the correct config:

```js
export const config = {
  api: {
    bodyParser: false,
    externalResolver: true
  }
};
```

If you ever see the log line `[webhook/stripe] rejected: req.body is not a Buffer (got object)`, this is what's broken — the config above was lost or overridden.

### Local development

To deliver real Stripe events to localhost, use the Stripe CLI:

```bash
stripe listen --forward-to localhost:8787/webhooks/stripe
stripe listen --forward-to localhost:8787/functions/modelCheckoutWebhook  # only if testing model flow
```

The CLI prints a `whsec_…` value — put it in your local `.env` as `STRIPE_WEBHOOK_SECRET` and **restart the dev server**.

### Webhook troubleshooting checklist

If you see `payment_status='initiated'` rows that never advance:

1. **Is the webhook actually being called?** Check Stripe Dashboard → Developers → Webhooks → your endpoint → "Recent events". Each delivery is listed with the HTTP response code we returned.
2. **What did we return?** 200 = success. 400 = signature failure or pre-parsed body. 500 = handler crashed.
3. **Are env vars set in this environment?** Open Vercel → Project Settings → Environment Variables, confirm `STRIPE_WEBHOOK_SECRET` exists for the matching environment (Production / Preview / Development).
4. **Read the server logs.** With this round of changes, all webhook entry points log:
   - `[webhook/stripe] rejected: missing stripe-signature header`
   - `[webhook/stripe] rejected: req.body is not a Buffer (got object)` — the Vercel-bodyParser issue.
   - `[webhook/stripe] signature verification FAILED: <reason>` — wrong secret, or some middleware mutated the body.
   - `[webhook/stripe] processed <event.type> <event.id>` — success.

If you ever lose the bodyParser config, that single grep'able log line is enough to diagnose the entire class of failures in seconds.

---

## 8. Query cookbook for support / admins

### 8.1 Find a user's entire payment history

```sql
select pt.created_at, pt.payment_flow, pt.item_name, pt.amount_total,
       pt.payment_status, pt.failure_reason, pt.card_brand, pt.card_last4,
       pt.stripe_session_id
from public.payment_transactions pt
where pt.customer_email = lower('user@example.com')
order by pt.created_at desc;
```

### 8.2 Investigate a specific failed payment

```sql
-- 1. find the transaction
select * from public.payment_transactions
where stripe_session_id = 'cs_test_...';

-- 2. walk through every event
select created_at, event_type, event_status,
       failure_code, decline_code, failure_message,
       stripe_event_id, stripe_event_type
from public.payment_events
where payment_transaction_id = '<id from above>'
order by created_at asc;
```

### 8.3 All declined cards today, grouped by reason

```sql
select decline_code, failure_code, count(*) as count
from public.payment_transactions
where payment_status = 'failed'
  and failed_at >= current_date
group by decline_code, failure_code
order by count desc;
```

### 8.4 Abandoned / expired checkouts in the last 24h

```sql
select customer_email, item_name, amount_total, created_at
from public.payment_transactions
where payment_status in ('initiated', 'checkout_opened', 'expired')
  and created_at >= now() - interval '24 hours'
  and succeeded_at is null
order by created_at desc;
```

### 8.5 Re-deliver a specific Stripe event for debugging

Take `stripe_event_id` from `payment_events` and use the Stripe Dashboard → Developers → Events → Resend. The tracker is idempotent so this is safe to do as many times as needed.

### 8.6 Reconstruct the complete forensic timeline of one attempt

```sql
select event_logged_at,
       event_type,
       previous_status,
       current_status,
       transition_target,
       stripe_event_type,
       failure_message,
       failure_code,
       decline_code,
       card_brand,
       card_last4,
       event_amount,
       event_metadata->'status_transition' as transition_delta
from public.payment_attempt_timeline
where payment_transaction_id = '<uuid>'
order by occurred_at asc;
```

The view joins every row of `payment_events` to its parent `payment_transactions` row. Rows arrive in chronological order — the result is a narrative of every observable thing that happened to the attempt.

---

## 9. Complete Payment Data Tracking Spec (Single Source of Truth)

This is the authoritative contract between engineering, support, and admins.
If anything in this document conflicts with reality, this section wins; please
fix the reality (or, if intentional, fix this section).

### 9.1 Vocabulary

- **Attempt** — One row in `payment_transactions`. Created when a user clicks "Pay". Identified by `id` (uuid).
- **Event** — One row in `payment_events`. An immutable record of something that happened to an attempt (an initiation, a webhook delivery, a marked failure, etc.).
- **Snapshot field** — A column whose value is captured at the moment of attempt creation and **never changes** (e.g. `request_payload_snapshot`).
- **Monotonic field** — A column that starts NULL and becomes non-null at most once. Once set, it never changes (e.g. `stripe_session_id`).
- **Mutable field** — A column whose value can be updated by legitimate enrichment flows (e.g. `payment_status`, `billing_address`).

### 9.2 What is stored vs. when

| Field group | Captured at | Mutability |
|---|---|---|
| `id`, `created_at`, `customer_email`, `customer_name`, `payment_flow`, `payment_type`, `selected_item_id`, `request_payload_snapshot`, `client_timestamp`, `server_received_timestamp`, `attempt_number`, `request_ip`, `user_agent`, `source_context`, `source_origin` | **Route entry** — `recordCheckoutInitiated` runs *before* any validation, *outside* the business transaction. | **Immutable** at the DB level (trigger). |
| `pre_order_id`, `course_id`, `service_type_id`, `item_id`, `item_name`, `amount_subtotal`, `amount_discount`, `amount_total`, `currency`, `stripe_session_id`, `stripe_payment_intent_id`, `stripe_checkout_url` | **After business validation + Stripe API call** — `enrichPaymentTransaction({id, ...})` runs inside the business transaction. | **Monotonic** at the DB level (trigger). |
| `stripe_charge_id`, `stripe_customer_id`, `stripe_checkout_status`, `stripe_payment_status`, `payment_method_type`, `card_brand`, `card_last4`, `card_exp_month`, `card_exp_year`, `card_funding`, `card_country`, `receipt_email`, `receipt_url`, `billing_name`, `billing_email`, `billing_phone`, `billing_address` | **Webhook delivery** — `recordStripeWebhookEvent` enriches them via `coalesce` semantics. | Mutable but write-once in practice (`coalesce`). |
| `payment_status`, `previous_status`, `failure_code`, `failure_message`, `failure_reason`, `decline_code`, `amount_paid`, `last_event_at`, `last_event_type`, `last_failure_event_id`, `succeeded_at`, `failed_at`, `canceled_at`, `expired_at`, `refunded_at`, `disputed_at`, `linked_user_id`, `stripe_metadata`, `metadata`, `updated_at` | **As lifecycle events arrive** (webhook or in-process success flow). | Mutable. `previous_status` is auto-populated by the trigger when `payment_status` changes. |

### 9.3 Status state machine

Allowed forward transitions (others are blocked by `shouldTransitionTo`):

```
                     ┌─────────────────────────────┐
                     ▼                             │
initiated ─► checkout_opened ─► processing ─► requires_action
   │                │                │              │
   │                └────────────────┴──────┬───────┘
   │                                        ▼
   └─► failed       expired           succeeded ─► refunded
                                              \─► disputed
```

Rules:
- `succeeded` can only move to `refunded` or `disputed`.
- `refunded` / `disputed` can only move to another terminal status.
- Any non-terminal status can transition freely to a non-terminal or terminal status.
- The trigger auto-captures `previous_status` on every change.

### 9.4 Stripe events we observe

| Stripe event | Internal `event_type` | `status_target` | Notes |
|---|---|---|---|
| `checkout.session.created` | `session_created` | (none) | Informational — confirms Stripe accepted our session creation. |
| `checkout.session.completed` | `session_completed` | `succeeded` | Primary success signal for synchronous payments. |
| `checkout.session.expired` | `session_expired` | `expired` | Session timed out without payment. |
| `checkout.session.async_payment_succeeded` | `session_async_succeeded` | `succeeded` | Bank-debit-style asynchronous settlement. |
| `checkout.session.async_payment_failed` | `session_async_failed` | `failed` | Asynchronous settlement bounced. |
| `payment_intent.created` | `payment_intent_created` | (none) | Informational — confirms PI was minted. |
| `payment_intent.requires_action` | `payment_requires_action` | `requires_action` | 3-D Secure / Strong Customer Authentication challenge. |
| `payment_intent.processing` | `payment_processing` | `processing` | ACH / async authorisation in flight. |
| `payment_intent.succeeded` | `payment_succeeded` | `succeeded` | PaymentIntent confirmed. |
| `payment_intent.payment_failed` | `payment_failed` | `failed` | Carries `last_payment_error` (`failure_code` / `failure_message` / `decline_code`). |
| `payment_intent.canceled` | `payment_canceled` | `canceled` | Explicit cancellation. |
| `charge.succeeded` | `charge_succeeded` | `succeeded` | Money moved. |
| `charge.failed` | `charge_failed` | `failed` | Carries `failure_code` / `failure_message`. |
| `charge.captured` | `charge_captured` | `succeeded` | Manual-capture flow (we don't currently use this, but recorded if it appears). |
| `charge.refunded` | `charge_refunded` | `refunded` | Full or partial refund. |
| `charge.dispute.created` | `charge_dispute_created` | `disputed` | Cardholder opened a chargeback. |
| Anything else tracked | snake-cased event type | (none) | Logged as raw event in `payment_events.raw_event` for forensics. |

Both webhook endpoints (`POST /admin/webhooks/stripe` and `POST /functions/modelCheckoutWebhook`) call `recordStripeWebhookEvent` for every event in this table.

### 9.5 Failure categorisation

When an attempt ends in `failed`, support can categorise it by joining four fields:

| Source | Column | Example values |
|---|---|---|
| Our routing layer | `failure_reason` | `validation_error`, `validation_or_processing_error`, `409`, `403`. |
| Our error wrapper | `http_status_code` (in event metadata) | `400`, `404`, `409`, `500`. |
| Stripe `last_payment_error.code` | `failure_code` | `card_declined`, `expired_card`, `incorrect_cvc`, `authentication_required`, `processing_error`. |
| Stripe `outcome.network_decline_code` | `decline_code` | `generic_decline`, `insufficient_funds`, `lost_card`, `do_not_honor`. |
| Free-form text | `failure_message` | Stripe-supplied human text. |

`last_failure_event_id` points at the `payment_events.stripe_event_id` that drove the most recent `failed` transition — useful for re-delivery during debugging.

### 9.6 Retry tracking

Retries are not modelled as "updates to the existing record". Every "Pay" click is a fresh row.

- `attempt_number` per `(customer_email, payment_flow)` increments monotonically.
- Support can run "show me every attempt this customer has ever made" with a single `select` ordered by `attempt_number desc`.
- The original (failed/abandoned) attempt rows remain immutable forever, providing a permanent forensic trail.

### 9.7 Immutability contract (enforced by trigger)

The trigger `trg_payment_transactions_immutability` (defined in `20260515140000_payment_immutability_and_timeline.sql`) raises an exception on any UPDATE that violates the rules. The exception bubbles up to the caller — there is no silent overwrite.

The contract is intentionally aggressive: even a stray ad-hoc SQL update against the production database will be blocked. If you legitimately need to mutate a snapshot field, you must drop or alter the trigger.

### 9.8 Where the data lives — at a glance

| Need | Look here |
|---|---|
| Current state of one attempt | `payment_transactions` row (one row per attempt) |
| Full chronological history of one attempt | `payment_attempt_timeline` view filtered by `payment_transaction_id` |
| All events received from Stripe | `payment_events` table |
| Raw Stripe event object | `payment_events.raw_event` (sanitized; we never store PAN/CVV — Stripe doesn't send them anyway) |
| What the customer originally clicked / typed | `payment_transactions.request_payload_snapshot` and `selected_item_id` |
| When the click happened vs. when we received it | `client_timestamp` and `server_received_timestamp` |
| Why an attempt failed | `failure_code` + `failure_message` + `decline_code` + `failure_reason` + (for the latest failure) the event pointed at by `last_failure_event_id` |

---

## 10. Extending to a new Stripe flow

When adding a new Stripe checkout (e.g. patient appointment booking):

1. After `stripe.checkout.sessions.create(...)`, call `recordCheckoutInitiated(...)` with `payment_flow: "patient_appointment"` (or whatever new value) — `payment_flow` is free-form text so no migration is needed.
2. Add `payment_intent_data.metadata` mirroring your session metadata.
3. The main webhook (`/webhooks/stripe`) already records every Stripe event type listed in §2.2, so success/failure capture is automatic.
4. If your flow has its own webhook endpoint, import `recordStripeWebhookEvent` and call it before your business logic.

That's it — no schema change required for new flows.

---

## 11. What was deliberately *not* done

- **No frontend / admin UI.** The data is there and queryable; building an admin investigation screen on top is its own task.
- **No retention policy.** All rows live forever for now. Add a retention / archival job if growth becomes an issue.
- **No automatic Stripe reconciliation cron.** The system relies on webhook delivery; for known-missing-event situations there's no automatic catch-up job yet.
- **No metric / alerting hooks.** Easy to bolt on later by querying `payment_events` aggregates.
- **No new payment architecture.** The original Stripe flows (course / model / service) and the original tables (`pre_orders`, `course_payments`) are unchanged; the tracking system is purely additive.

---

## 12. File-level change summary

| File | Status | What changed |
|---|---|---|
| `supabase/migrations/20260515120000_payment_tracking.sql` | **new** | Creates `payment_transactions` + `payment_events`, all indexes, partial unique constraints, `updated_at` trigger. |
| `supabase/migrations/20260515130000_payment_attempt_snapshots.sql` | **new** | Adds per-attempt snapshot columns (`attempt_number`, `selected_item_id`, `request_payload_snapshot`, `client_timestamp`, `server_received_timestamp`). |
| `supabase/migrations/20260515140000_payment_immutability_and_timeline.sql` | **new** | `previous_status` column. DB-level immutability + monotonic trigger. `payment_attempt_timeline` forensic view. |
| `backend/admin/payments/service.js` | **new** | The whole tracker: `recordCheckoutInitiated` (pure INSERT), `markAttemptFailed`, `recordCheckoutOpened`, `recordStripeWebhookEvent`, `enrichPaymentTransaction`, `recordPreOrderInitiated`, plus `eventTypeFromStripe` covering 16 Stripe event types. |
| `backend/admin/checkout/service.js` | modified | `createCourseCheckout` + `createServicePreOrder` → log attempt at top of function (outside business txn), enrich on Stripe-success, `markAttemptFailed` in catch. `processCompletedCheckoutSession` → enriches on payment success. |
| `backend/admin/checkout/routes.js` | modified | Builds `trackingContext` including `client_timestamp` + `server_received_timestamp`; forwards to the service layer. |
| `backend/admin/webhooks/routes.js` | modified | Records every tracked event type. Up-front guards now reject pre-parsed bodies, missing headers, and signature failures with diagnostic log lines instead of silent 500s. |
| `backend/admin/functions/routes.js` | modified | `createModelCheckout` route → same log-attempt-up-front pattern. `processModelCheckoutCompletedSession` → enriches on success. `/modelCheckoutWebhook` → records every tracked event type and applies the same up-front diagnostic guards. |
| `backend/admin/app.js` | modified | `express.raw({ type: "application/json" })` now mounted on `/functions/modelCheckoutWebhook` too (was only on `/webhooks/stripe`). |
| `api/index.js` | modified | Vercel function config sets `bodyParser: false` so the raw bytes reach `express.raw()` for signature verification. |
| `src/api/courseCheckoutApi.js` | modified | Stamps `x-novi-client-timestamp` header + body `client_timestamp` on every payment-creating call. New `createServicePreOrder` helper. |
| `src/api/providers/lovableProvider.js` | modified | Auto-stamps `client_timestamp` on `createModelCheckout`, `createPreOrderCheckout`, `createCheckoutSession`. |
