import { query } from "./db.js";

/**
 * Compliance / credential access control on md_subscription.status only.
 *
 * Intentionally does NOT:
 * - call Stripe (subscriptions keep billing until admin or provider cancel flow in Stripe)
 * - change billing_status, stripe_subscription_id, or cancel_at_period_end
 *
 * Patient marketplace lists providers with status = 'active' MD coverage (admin "Fully Active").
 * validateBookingScope still requires valid license/cert at booking time.
 */

export async function suspendMdSubscriptionAccess({ providerId, serviceTypeId = null }) {
  const pid = String(providerId || "").trim();
  if (!pid) return 0;

  const stid = String(serviceTypeId || "").trim();
  if (stid) {
    const { rowCount } = await query(
      `update public.md_subscription
          set status = 'suspended',
              updated_at = now()
        where provider_id = $1
          and service_type_id = $2
          and lower(coalesce(status, '')) = 'active'`,
      [pid, stid]
    );
    return rowCount || 0;
  }

  const { rowCount } = await query(
    `update public.md_subscription
        set status = 'suspended',
            updated_at = now()
      where provider_id = $1
        and lower(coalesce(status, '')) = 'active'`,
    [pid]
  );
  return rowCount || 0;
}
