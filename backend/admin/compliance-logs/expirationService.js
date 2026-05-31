import { query } from "../db.js";
import {
  insertAppNotification,
  resolveNotificationRecipient,
} from "../certificationNotifications.js";
import { suspendMdSubscriptionAccess } from "../mdSubscriptionAccess.js";
import { notifyProviderCredentialSuspended } from "./credentialSuspendedNotify.js";
import { hasOpenAutomatedLog, insertComplianceLog } from "./service.js";

const ACTIVE_LICENSE_STATUSES = ["verified", "pending_review"];
const ACTIVE_CERT_STATUSES = ["active", "approved", "verified"];

async function hasRecentNotification({ userId, userEmail, type, dedupeKey, withinDays = 7 }) {
  const key = String(dedupeKey || "").trim();
  if (!key) return false;
  const { rows } = await query(
    `select 1
       from public.notifications n
      where lower(coalesce(n.type, '')) = lower($1)
        and n.message like '%' || $4 || '%'
        and n.created_at > now() - ($5::int || ' days')::interval
        and (
          ($2::text <> '' and n.user_id = $2)
          or ($3::text <> '' and lower(coalesce(n.user_email, '')) = lower($3))
        )
      limit 1`,
    [type, String(userId || ""), String(userEmail || ""), key, withinDays]
  );
  return Boolean(rows[0]);
}

/**
 * Daily job: mark expired licenses/certs, suspend MD access in DB, notify, compliance logs.
 *
 * Stripe: intentionally NOT called — stripe_subscription_id unchanged; billing continues
 * until an admin cancels in Stripe or the provider uses the cancel flow (also DB-only).
 *
 * Bookings: blocked via suspended status + expired license/cert in marketplace + validateBookingScope.
 */
export async function runCheckExpirations() {
  const result = {
    licenses_expired: 0,
    certs_expired: 0,
    subscriptions_suspended: 0,
    notifications_sent: 0,
    compliance_logs_created: 0,
    compliance_logs_skipped: 0,
  };

  const { rows: expiredLicenses } = await query(
    `select l.id, l.provider_id::text as provider_id, l.provider_email,
            l.license_type, l.license_number, l.expiration_date
       from public.licenses l
      where l.expiration_date is not null
        and l.expiration_date <= current_date
        and lower(coalesce(l.status, '')) = any($1::text[])`,
    [ACTIVE_LICENSE_STATUSES]
  );

  for (const lic of expiredLicenses || []) {
    await query(
      `update public.licenses
          set status = 'expired',
              updated_at = now()
        where id = $1`,
      [lic.id]
    );
    result.licenses_expired += 1;
    result.subscriptions_suspended += await suspendMdSubscriptionAccess({
      providerId: lic.provider_id,
    });

    const dedupeKey = `license_expired:${lic.id}`;
    const licenseLabel = `${lic.license_type || "License"} ${lic.license_number || ""}`.trim();
    const notifyResult = await notifyProviderCredentialSuspended({
      providerId: lic.provider_id,
      providerEmail: lic.provider_email,
      kind: "license",
    });
    if (notifyResult.sent) result.notifications_sent += 1;

    if (await hasOpenAutomatedLog(dedupeKey)) {
      result.compliance_logs_skipped += 1;
    } else {
      await insertComplianceLog({
        provider_id: lic.provider_id,
        provider_email: lic.provider_email,
        log_type: "license_review",
        summary: `License expired: ${licenseLabel}`,
        details: `Provider license expired on ${lic.expiration_date}. Review renewal after provider re-uploads.`,
        action_required: true,
        source: "automated",
        automated_key: dedupeKey,
      });
      result.compliance_logs_created += 1;
    }
  }

  const { rows: expiredCerts } = await query(
    `select c.id, c.provider_id, c.provider_email, c.service_type_id,
            c.certification_name, c.cert_name, c.expires_at
       from public.certification c
      where c.provider_id is not null
        and c.expires_at is not null
        and c.expires_at::date <= current_date
        and lower(coalesce(c.status, '')) = any($1::text[])`,
    [ACTIVE_CERT_STATUSES]
  );

  for (const cert of expiredCerts || []) {
    await query(
      `update public.certification
          set status = 'expired',
              updated_at = now()
        where id = $1`,
      [cert.id]
    );
    result.certs_expired += 1;
    result.subscriptions_suspended += await suspendMdSubscriptionAccess({
      providerId: cert.provider_id,
      serviceTypeId: cert.service_type_id,
    });

    const dedupeKey = `cert_expired:${cert.id}`;
    const certName = cert.certification_name || cert.cert_name || "Certification";
    const notifyResult = await notifyProviderCredentialSuspended({
      providerId: cert.provider_id,
      providerEmail: cert.provider_email,
      kind: "certification",
    });
    if (notifyResult.sent) result.notifications_sent += 1;

    if (await hasOpenAutomatedLog(dedupeKey)) {
      result.compliance_logs_skipped += 1;
    } else {
      await insertComplianceLog({
        provider_id: cert.provider_id,
        provider_email: cert.provider_email,
        log_type: "certification_review",
        summary: `Certification expired: ${certName}`,
        details: `Provider certification expired on ${cert.expires_at}. Review after renewal is submitted.`,
        action_required: true,
        source: "automated",
        automated_key: dedupeKey,
      });
      result.compliance_logs_created += 1;
    }
  }

  return result;
}

/**
 * Daily job: warn providers when license/cert is expiring within 30 days.
 * Does not create compliance logs.
 */
export async function runComplianceChecks({ lookAheadDays = 30 } = {}) {
  const result = {
    notifications_sent: 0,
    notifications_skipped: 0,
  };

  const { rows: expiringLicenses } = await query(
    `select l.id, l.provider_id::text as provider_id, l.provider_email,
            l.license_type, l.license_number, l.expiration_date
       from public.licenses l
      where l.expiration_date is not null
        and l.expiration_date > current_date
        and l.expiration_date <= current_date + $1::int
        and lower(coalesce(l.status, '')) = any($2::text[])`,
    [lookAheadDays, ACTIVE_LICENSE_STATUSES]
  );

  for (const lic of expiringLicenses || []) {
    const recipient = await resolveNotificationRecipient({
      providerId: lic.provider_id,
      providerEmail: lic.provider_email,
    });
    const dedupeKey = `license_expiring:${lic.id}`;
    if (
      await hasRecentNotification({
        userId: recipient.userId,
        userEmail: recipient.userEmail,
        type: "license_expiring_soon",
        dedupeKey,
      })
    ) {
      result.notifications_skipped += 1;
      continue;
    }
    const licenseLabel = `${lic.license_type || "License"} ${lic.license_number || ""}`.trim();
    await insertAppNotification({
      user_id: recipient.userId,
      user_email: recipient.userEmail,
      type: "license_expiring_soon",
      message: `Your ${licenseLabel} expires on ${lic.expiration_date}. Renew before expiration to avoid MD coverage suspension. [${dedupeKey}]`,
      link_page: "ProviderCredentialsCoverage",
    });
    result.notifications_sent += 1;
  }

  const { rows: expiringCerts } = await query(
    `select c.id, c.provider_id, c.provider_email, c.certification_name, c.cert_name, c.expires_at
       from public.certification c
      where c.provider_id is not null
        and c.expires_at is not null
        and c.expires_at::date > current_date
        and c.expires_at::date <= current_date + $1::int
        and lower(coalesce(c.status, '')) = any($2::text[])`,
    [lookAheadDays, ACTIVE_CERT_STATUSES]
  );

  for (const cert of expiringCerts || []) {
    const recipient = await resolveNotificationRecipient({
      providerId: cert.provider_id,
      providerEmail: cert.provider_email,
    });
    const dedupeKey = `cert_expiring:${cert.id}`;
    if (
      await hasRecentNotification({
        userId: recipient.userId,
        userEmail: recipient.userEmail,
        type: "certification_expiring_soon",
        dedupeKey,
      })
    ) {
      result.notifications_skipped += 1;
      continue;
    }
    const certName = cert.certification_name || cert.cert_name || "Certification";
    await insertAppNotification({
      user_id: recipient.userId,
      user_email: recipient.userEmail,
      type: "certification_expiring_soon",
      message: `Your ${certName} certification expires on ${cert.expires_at}. Renew before expiration to stay compliant. [${dedupeKey}]`,
      link_page: "ProviderCredentialsCoverage",
    });
    result.notifications_sent += 1;
  }

  return result;
}
