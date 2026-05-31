import { query } from "./db.js";
import { notifyAdminsOfProviderMdCancellation } from "./adminNotifications.js";
import { insertAppNotification, resolveNotificationRecipient } from "./certificationNotifications.js";

/**
 * Provider-initiated cancel: updates NOVI database + notifies admins.
 * Does NOT call Stripe — admins must cancel billing in Stripe dashboard.
 */
export async function requestProviderMdSubscriptionCancel({
  subscriptionId,
  providerId,
  reason = null,
  notes = null,
}) {
  const subId = String(subscriptionId || "").trim();
  const pid = String(providerId || "").trim();
  if (!subId || !pid) {
    return { success: false, error: "subscription_id and provider are required." };
  }

  const { rows } = await query(
    `select *
       from public.md_subscription
      where id = $1::uuid
      limit 1`,
    [subId]
  );
  const sub = rows[0];
  if (!sub) return { success: false, error: "Subscription not found." };
  if (String(sub.provider_id || "") !== pid) {
    return { success: false, error: "Forbidden." };
  }

  const nowIso = new Date().toISOString();
  await query(
    `update public.md_subscription
        set status = 'cancelled',
            cancellation_reason = $2,
            cancellation_notes = $3,
            cancelled_at = $4::timestamptz,
            updated_at = now()
      where id = $1::uuid`,
    [subId, reason, notes, nowIso]
  );

  const { rows: userRows } = await query(
    `select full_name, email from public.users where auth_user_id = $1 limit 1`,
    [pid]
  );
  const providerName = userRows[0]?.full_name || sub.provider_name || sub.provider_email;
  const providerEmail = userRows[0]?.email || sub.provider_email;

  void notifyAdminsOfProviderMdCancellation({
    providerName,
    providerEmail,
    serviceTypeName: sub.service_type_name,
    mdSubscriptionId: sub.id,
    stripeSubscriptionId: sub.stripe_subscription_id,
    reason,
    notes,
  });

  const recipient = await resolveNotificationRecipient({
    providerId: pid,
    providerEmail,
  });
  await insertAppNotification({
    user_id: recipient.userId,
    user_email: recipient.userEmail || providerEmail,
    type: "md_coverage_cancelled",
    message: `Your MD coverage for ${sub.service_type_name || "this service"} has been cancelled in NOVI. Stripe billing may continue until NOVI deactivates it in Stripe — contact support if needed.`,
    link_page: "ProviderCredentialsCoverage",
  });

  return { success: true };
}
