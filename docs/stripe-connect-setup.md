# Stripe Connect (Provider Marketplace) — Setup Guide

Provider marketplace payments (appointment **deposits** and **treatment** balances) can route through **Stripe Connect Express** on a **separate** Stripe platform account. Legacy flows (courses, model signup, MD subscriptions) continue using existing `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_CONNECT_ENABLED` | Yes (to turn on) | `true` enables Connect for marketplace checkouts |
| `STRIPE_CONNECT_SECRET_KEY` | When enabled | Secret key (`sk_test_...` / `sk_live_...`) for the **new** Connect platform account |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | When enabled | Signing secret (`whsec_...`) for the Connect platform webhook endpoint |
| `STRIPE_CONNECT_GFE_PLATFORM_FEE_USD` | No | Flat GFE platform fee in USD (default `1`; added on top for GFE-required treatment checkouts) |
| `STRIPE_CONNECT_GFE_PLATFORM_FEE_CENTS` | No | Optional override in cents (e.g. `100`) |
| `STRIPE_CONNECT_CLIENT_ID` | For provider OAuth | Connect OAuth client id (`ca_...`) — enables one-click provider connect |
| `STRIPE_CONNECT_PROVIDER_OAUTH_REDIRECT_URI` | No | Provider OAuth callback; default `{API_BASE}/admin/integrations/stripe-connect/oauth/callback` |

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
STRIPE_CONNECT_GFE_PLATFORM_FEE_USD=1
```

Leave `STRIPE_CONNECT_ENABLED=false` in production until staging E2E passes.

### 5. Provider onboarding flow (Standard OAuth)

When `STRIPE_CONNECT_CLIENT_ID` is set, providers connect via **Stripe OAuth** (same one-click flow as admin legacy connect). New providers without a Stripe account can create one during OAuth.

1. Provider opens **Practice → Profile**.
2. Clicks **Connect with Stripe**.
3. Signs into Stripe (or creates an account) and authorizes Novi.
4. Status shows **Stripe connected** when `charges_enabled` is true.

**Stripe Dashboard:** register the provider OAuth redirect URI:

- Production: `https://<your-domain>/api/admin/integrations/stripe-connect/oauth/callback`
- Local (backend on 8787): `http://127.0.0.1:8787/admin/integrations/stripe-connect/oauth/callback`

Optional override: `STRIPE_CONNECT_PROVIDER_OAUTH_REDIRECT_URI`

If `STRIPE_CONNECT_CLIENT_ID` is not set, providers fall back to **Express** account-link onboarding (legacy behavior).

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

## Legacy Stripe account (Standard OAuth) + platform fee transfer

Admins can OAuth-connect the legacy Stripe account as a **Standard** connected account under the Connect platform. After marketplace payments succeed, the flat **GFE fee** ($1 default) can be transferred to that account.

### Additional env vars

| Variable | Purpose |
|----------|---------|
| `STRIPE_CONNECT_CLIENT_ID` | Connect OAuth client id (`ca_...`) |
| `STRIPE_CONNECT_OAUTH_REDIRECT_URI` | Optional; default `{API_BASE}/admin/integrations/stripe-connect/platform/oauth/callback` |
| `STRIPE_CONNECT_GFE_PLATFORM_FEE_USD` | Flat GFE fee added on treatment invoices for GFE-required services (default `1`) |
| `STRIPE_CONNECT_LEGACY_FEE_TRANSFER_ENABLED` | `true` to run split `transfers.create` on `payment_intent.succeeded` |
| `STRIPE_CONNECT_OAUTH_STATE_SECRET` | Optional HMAC secret for OAuth state |

### Stripe Dashboard (legacy OAuth)

1. On the **Connect platform** account: **Developers → Connect settings** → copy **Client ID** (`ca_...`).
2. Add redirect URI (production example):
   `https://<your-domain>/api/admin/integrations/stripe-connect/platform/oauth/callback`
3. Local dev (backend on 8787):
   `http://127.0.0.1:8787/admin/integrations/stripe-connect/platform/oauth/callback`

### Admin UI

**Admin Dashboard** → **Stripe Connect — Legacy fee account** → **Connect legacy Stripe**.

### Migration

Apply:

- `supabase/migrations/20260605120000_platform_stripe_connect_legacy.sql`
- `supabase/migrations/20260605140000_connect_marketplace_transfers.sql`

### Payment split flow (platform charge)

1. Patient pays on **Connect platform** (treatment + optional **GFE Fees** line item).
2. Webhook `payment_intent.succeeded` → two `transfers.create` calls with `source_transaction`:
   - Provider payout → provider `acct_...`
   - GFE fee (flat $1 when service requires GFE) → legacy Standard `acct_...`
3. Idempotency tracked in `connect_marketplace_transfers` (per PaymentIntent + purpose).

## Deferred (not in v1)

- Auto-completing launch roadmap `stripe_connected` step (still manual in roadmap UI)
