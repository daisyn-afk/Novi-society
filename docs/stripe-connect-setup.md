# Stripe Connect (Provider Marketplace) — Setup Guide

Provider marketplace payments (appointment **deposits** and **treatment** balances) can route through **Stripe Connect Express** on a **separate** Stripe platform account. Legacy flows (courses, model signup, MD subscriptions) continue using existing `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_CONNECT_ENABLED` | Yes (to turn on) | `true` enables Connect for marketplace checkouts |
| `STRIPE_CONNECT_SECRET_KEY` | When enabled | Secret key (`sk_test_...` / `sk_live_...`) for the **new** Connect platform account |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | When enabled | Signing secret (`whsec_...`) for the Connect platform webhook endpoint |
| `STRIPE_CONNECT_APPLICATION_FEE_BPS` | No | Platform fee in basis points (default `0` = provider receives full transfer) |

**Unchanged (legacy):**

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Post-deploy checklist

### 1. Create the Connect platform Stripe account

1. Create a **new** Stripe account (do not reuse the legacy platform account).
2. In Dashboard → **Connect** → enable **Express** accounts.
3. Copy the **Secret key** → `STRIPE_CONNECT_SECRET_KEY`.

### 2. Run the database migration

Apply `supabase/migrations/20260604180000_stripe_connect_provider.sql` on your Supabase project (CLI or dashboard).

### 3. Configure webhooks on the **Connect** Stripe account

Create an endpoint pointing to your API:

```
https://<your-domain>/api/webhooks/stripe-connect
```

Subscribe at minimum to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `account.updated`
- (optional) payment tracking: `payment_intent.*`, `charge.*`, `checkout.session.expired`

Copy the signing secret → `STRIPE_CONNECT_WEBHOOK_SECRET`.

**Local dev:**

```bash
stripe listen --forward-to localhost:3001/webhooks/stripe-connect
```

Use the printed `whsec_...` as `STRIPE_CONNECT_WEBHOOK_SECRET` (restart the backend after changing `.env`).

### 4. Set environment variables

**Staging first** (recommended):

```env
STRIPE_CONNECT_ENABLED=true
STRIPE_CONNECT_SECRET_KEY=sk_test_...
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_APPLICATION_FEE_BPS=0
```

Leave `STRIPE_CONNECT_ENABLED=false` in production until staging E2E passes.

### 5. Provider onboarding flow

1. Provider opens **Practice → Profile**.
2. Clicks **Connect Stripe** (visible when Connect is enabled and configured).
3. Completes Stripe Express onboarding.
4. Status shows **Stripe connected** when `charges_enabled` is true.

Until onboarding completes, patients see an error if they try to pay a deposit/treatment while Connect is enabled.

### 6. Test end-to-end (test mode)

1. Provider connects Stripe (test mode).
2. Set a **booking deposit** on Practice Profile.
3. Patient books → provider confirms → patient pays deposit.
4. Verify in Stripe Dashboard (Connect account): payment with transfer to connected account.
5. Provider sends treatment invoice → patient pays balance.
6. Confirm appointment rows update (`payment_status`, `treatment_payment_status`) and webhooks hit `/api/webhooks/stripe-connect`.

### 7. Production cutover

1. Switch Connect keys to **live** mode.
2. Set `STRIPE_CONNECT_ENABLED=true` in production.
3. Re-create live webhook endpoint on the Connect platform account.
4. Communicate to providers: complete Stripe Connect before accepting paid bookings.

## Code map

| Area | Path |
|------|------|
| Config / fee | `backend/admin/stripe-connect/config.js` |
| Onboarding API | `backend/admin/stripe-connect/routes.js` |
| Checkout routing | `backend/admin/stripe-connect/checkout.js` |
| Connect webhooks | `backend/admin/webhooks/routes.js` → `POST /stripe-connect` |
| Deposit checkout | `backend/admin/appointments/paymentService.js` |
| Treatment checkout | `backend/admin/appointments/treatmentPaymentService.js` |
| Provider UI | `src/components/provider/ProviderStripeConnectCard.jsx` |

## Deferred (not in v1)

- Splitting a portion of each payment to the **legacy** Stripe account
- Auto-completing launch roadmap `stripe_connected` step (still manual in roadmap UI)
