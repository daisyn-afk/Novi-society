import { query } from "./db.js";
import { sendEmailFromTemplate } from "./emails/renderTemplate.js";
import { notifyAdminsOfProviderMdCancellation } from "./adminNotifications.js";
import { insertAppNotification, resolveNotificationRecipient } from "./certificationNotifications.js";
import {
  sendAppointmentCancelledPatientEmail,
  notifyPatientAppointmentCancelled,
} from "./patientAppointmentEmails.js";

/**
 * Provider MD membership cancellation cascade.
 *
 * Cancelling ONE md_subscription is scoped per service_type_id. When the
 * provider's LAST active membership is cancelled this becomes a full exit:
 * every remaining relationship is terminated, all future appointments are
 * cancelled, and all approved manufacturer access is revoked.
 *
 * Soft reset: licenses + certifications + Growth Studio progress are KEPT.
 * Access is gated by the absence of an active md_subscription, so the provider
 * naturally drops back to the "Get License Verified by NOVI Admin" / md_eligible
 * dashboard state without destroying their history.
 *
 * Stripe is NOT modified here (existing ops pattern — admins cancel billing in
 * the Stripe dashboard). The Stripe `subscription.deleted` webhook calls this
 * same cascade so admin-side Stripe cancels do not leave stale access.
 *
 * Best-effort: each side effect is isolated so one failure does not abort the
 * rest of the teardown. The core subscription cancel always runs first.
 */

const ACTIVE_APPOINTMENT_STATUSES = [
  "requested",
  "pending",
  "awaiting_payment",
  "confirmed",
];

function s(value) {
  return String(value ?? "").trim();
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function formatLongDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

async function fetchServiceTypeNames(ids = []) {
  const list = [...new Set((ids || []).map((id) => s(id)).filter(Boolean))];
  if (!list.length) return new Map();
  try {
    const { rows } = await query(
      `select id, name from public.service_type where id = any($1::text[])`,
      [list]
    );
    return new Map(rows.map((r) => [s(r.id), s(r.name) || s(r.id)]));
  } catch {
    return new Map();
  }
}

function manufacturerRequiredServiceTypeIds(manufacturer) {
  const raw = manufacturer?.required_service_type_ids;
  let arr = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((id) => s(id)).filter(Boolean);
}

/**
 * @param {object} params
 * @param {string} params.subscriptionId        md_subscription.id to cancel
 * @param {string|null} [params.providerId]     expected owner (provider self-serve guard)
 * @param {string|null} [params.reason]
 * @param {string|null} [params.notes]
 * @param {"provider"|"admin"|"stripe"} [params.cancelledBy]
 * @param {string|null} [params.cancelledByName]
 * @param {boolean} [params.enforceOwnership]   verify providerId owns the sub (true for self-serve)
 * @returns {Promise<{success:boolean, error?:string, alreadyCancelled?:boolean, summary?:object}>}
 */
export async function processMdMembershipCancellation({
  subscriptionId,
  providerId = null,
  reason = null,
  notes = null,
  cancelledBy = "provider",
  cancelledByName = null,
  enforceOwnership = true,
}) {
  const subId = s(subscriptionId);
  if (!subId) {
    return { success: false, error: "subscription_id is required." };
  }

  const { rows } = await query(
    `select * from public.md_subscription where id = $1::uuid limit 1`,
    [subId]
  );
  const sub = rows[0];
  if (!sub) return { success: false, error: "Subscription not found." };

  const subProviderId = s(sub.provider_id);
  if (enforceOwnership) {
    const expected = s(providerId);
    if (!expected || expected !== subProviderId) {
      return { success: false, error: "Forbidden." };
    }
  }

  if (s(sub.status).toLowerCase() === "cancelled") {
    return { success: true, alreadyCancelled: true };
  }

  const pid = subProviderId || s(providerId);
  const cancelledServiceTypeId = s(sub.service_type_id);
  const cancelledServiceName = s(sub.service_type_name) || "MD Board Coverage";
  const nowIso = new Date().toISOString();

  // ── 1. Cancel the subscription (DB only; Stripe handled separately) ───────
  await query(
    `update public.md_subscription
        set status = 'cancelled',
            cancellation_reason = $2,
            cancellation_notes = $3,
            cancelled_at = coalesce(cancelled_at, $4::timestamptz),
            cancelled_by_name = coalesce($5, cancelled_by_name),
            updated_at = now()
      where id = $1::uuid`,
    [subId, reason, notes, nowIso, cancelledByName]
  );

  // ── 2. Resolve provider identity ──────────────────────────────────────────
  let providerName = s(sub.provider_name);
  let providerEmail = s(sub.provider_email);
  try {
    const { rows: userRows } = await query(
      `select full_name, email from public.users where auth_user_id = $1 limit 1`,
      [pid]
    );
    providerName = s(userRows[0]?.full_name) || providerName || providerEmail;
    providerEmail = s(userRows[0]?.email) || providerEmail;
  } catch {
    /* fall back to subscription snapshot */
  }

  // ── 3. Remaining active coverage decides partial vs full exit ─────────────
  let remainingActiveServiceTypeIds = [];
  try {
    const { rows: activeRows } = await query(
      `select service_type_id
         from public.md_subscription
        where provider_id = $1
          and lower(coalesce(status, '')) = 'active'`,
      [pid]
    );
    remainingActiveServiceTypeIds = activeRows
      .map((r) => s(r.service_type_id))
      .filter(Boolean);
  } catch {
    remainingActiveServiceTypeIds = [];
  }
  const remainingActiveSet = new Set(remainingActiveServiceTypeIds);
  const isFullExit = remainingActiveServiceTypeIds.length === 0;
  // A duplicate membership for the same service (e.g. Neurotoxin × 2): cancelling
  // one while another stays active must NOT tear down that service's coverage.
  const serviceFullyCancelled = !remainingActiveSet.has(cancelledServiceTypeId);

  const summary = {
    providerId: pid,
    cancelledServiceTypeId,
    cancelledServiceName,
    isFullExit,
    serviceFullyCancelled,
    terminatedRelationships: 0,
    cancelledAppointments: 0,
    revokedManufacturers: 0,
    repEmailsSent: 0,
  };

  // ── 4. Terminate MD relationship(s) ───────────────────────────────────────
  // Full exit: every remaining active relationship for the provider.
  // Partial (service fully cancelled): only the cancelled service_type_id.
  // Partial (duplicate service still active): nothing — coverage continues.
  let supervisingMdName = "";
  if (isFullExit || serviceFullyCancelled) {
    try {
      const relWhere = isFullExit
        ? `provider_id = $1 and lower(coalesce(status, '')) = 'active'`
        : `provider_id = $1 and lower(coalesce(status, '')) = 'active' and service_type_id = $2`;
      const relParams = isFullExit ? [pid] : [pid, cancelledServiceTypeId];
      const { rows: terminatedRels } = await query(
        `update public.medical_director_relationship
            set status = 'terminated',
                end_date = coalesce(end_date, $${relParams.length + 1}::date),
                updated_at = now()
          where ${relWhere}
          returning id, medical_director_name`,
        [...relParams, todayDateString()]
      );
      summary.terminatedRelationships = terminatedRels.length;
      supervisingMdName = s(terminatedRels[0]?.medical_director_name);

      for (const rel of terminatedRels) {
        await query(
          `update public.md_coverage_request
              set status = 'cancelled', updated_at = now()
            where medical_director_relationship_id = $1::uuid`,
          [rel.id]
        ).catch(() => {});
      }
    } catch (err) {
      console.warn("[mdCancellation] relationship termination failed:", err?.message || err);
    }
  }

  // ── 5. Cancel future appointments ─────────────────────────────────────────
  // Full exit: all future appointments. Partial (service fully cancelled): only
  // that service_type_id. Duplicate service still active: leave them booked.
  if (isFullExit || serviceFullyCancelled) {
   try {
    const apptWhere = isFullExit
      ? `provider_id = $1
           and appointment_date >= $2::date
           and lower(coalesce(status, '')) = any($3::text[])`
      : `provider_id = $1
           and appointment_date >= $2::date
           and service_type_id = $4
           and lower(coalesce(status, '')) = any($3::text[])`;
    const apptParams = isFullExit
      ? [pid, todayDateString(), ACTIVE_APPOINTMENT_STATUSES]
      : [pid, todayDateString(), ACTIVE_APPOINTMENT_STATUSES, cancelledServiceTypeId];

    const cancelReason = "Provider MD coverage cancelled — appointment cancelled by NOVI.";
    const { rows: apptsToCancel } = await query(
      `select id, patient_id, patient_email, patient_name, provider_name,
              service, service_type_id, appointment_date, status
         from public.appointments
        where ${apptWhere}`,
      apptParams
    );

    if (apptsToCancel.length) {
      const apptIds = apptsToCancel.map((row) => row.id);
      await query(
        `update public.appointments
            set status = 'cancelled',
                cancellation_reason = $2,
                updated_at = now()
          where id = any($1::uuid[])`,
        [apptIds, cancelReason]
      );
    }
    summary.cancelledAppointments = apptsToCancel.length;

    for (const appt of apptsToCancel) {
      const serviceLabel = s(appt.service) || cancelledServiceName;
      const wasRequest = s(appt.status).toLowerCase() === "requested";
      try {
        await sendAppointmentCancelledPatientEmail({
          to: s(appt.patient_email),
          patientName: appt.patient_name,
          providerName: appt.provider_name || providerName,
          serviceLabel,
          appointmentDate: appt.appointment_date,
          reason: "Your provider's medical oversight for this service has ended.",
          wasRequest,
        });
      } catch (err) {
        console.warn("[mdCancellation] patient cancel email failed:", err?.message || err);
      }
      try {
        await notifyPatientAppointmentCancelled({
          patientId: appt.patient_id,
          patientEmail: appt.patient_email,
          providerName: appt.provider_name || providerName,
          serviceLabel,
          appointmentDate: appt.appointment_date,
          wasRequest,
        });
      } catch (err) {
        console.warn("[mdCancellation] patient cancel notification failed:", err?.message || err);
      }
    }
   } catch (err) {
    console.warn("[mdCancellation] appointment cancellation failed:", err?.message || err);
   }
  }

  // ── 6. Manufacturer access: revoke + notify reps (per supplier) ────────────
  try {
    const { rows: approvedApps } = await query(
      `select id, manufacturer_id, manufacturer_name, provider_name, provider_email,
              license_type, license_number, practice_name, practice_address
         from public.manufacturer_applications
        where provider_id = $1
          and lower(coalesce(status, '')) = 'approved'`,
      [pid]
    );

    if (approvedApps.length) {
      const manufacturerIds = [...new Set(approvedApps.map((a) => s(a.manufacturer_id)).filter(Boolean))];
      const { rows: manufacturerRows } = await query(
        `select id, name, account_rep_name, account_rep_email, required_service_type_ids
           from public.manufacturers
          where id = any($1::uuid[])`,
        [manufacturerIds]
      ).catch(() => ({ rows: [] }));
      const manufacturerById = new Map(manufacturerRows.map((m) => [s(m.id), m]));

      const serviceNameById = await fetchServiceTypeNames([
        cancelledServiceTypeId,
        ...manufacturerRows.flatMap((m) => manufacturerRequiredServiceTypeIds(m)),
      ]);

      for (const app of approvedApps) {
        const manufacturer = manufacturerById.get(s(app.manufacturer_id));
        const required = manufacturerRequiredServiceTypeIds(manufacturer);

        // Still satisfied if any required membership remains active. A supplier
        // with no required memberships only loses access on a full exit.
        const stillSatisfied = isFullExit
          ? false
          : required.length === 0
            ? true
            : required.some((id) => remainingActiveSet.has(id));
        if (stillSatisfied) continue;

        await query(
          `update public.manufacturer_applications
              set status = 'cancelled',
                  admin_notes = trim(both E'\\n' from coalesce(admin_notes, '') || E'\\n' || $2),
                  updated_at = now()
            where id = $1`,
          [
            app.id,
            `[NOVI] Access revoked — provider cancelled MD membership (${cancelledServiceName}).`,
          ]
        ).catch(() => {});
        summary.revokedManufacturers += 1;

        const repEmail = s(manufacturer?.account_rep_email);
        if (!repEmail) continue;

        const lostServiceNames = (required.length
          ? required.filter((id) => isFullExit || !remainingActiveSet.has(id))
          : [cancelledServiceTypeId]
        )
          .map((id) => serviceNameById.get(s(id)) || cancelledServiceName)
          .filter(Boolean);
        const approvedServiceCategories = [...new Set(lostServiceNames)].join(", ")
          || cancelledServiceName;

        const detailRows = [
          { label: "Provider Name", value: s(app.provider_name) || providerName },
          { label: "License Type", value: s(app.license_type) },
          { label: "License Number", value: s(app.license_number) },
          { label: "Practice Name", value: s(app.practice_name) },
          { label: "Practice Address", value: s(app.practice_address) },
          { label: "Provider Email", value: s(app.provider_email) || providerEmail },
        ].filter((row) => row.value);

        try {
          const sent = await sendEmailFromTemplate("manufacturer_provider_cancellation_rep", {
            to: repEmail,
            first_name: s(manufacturer?.account_rep_name) || "there",
            provider_full_name: s(app.provider_name) || providerName,
            details: detailRows,
            details_title: "Provider Information",
            membership_type: "MD Board Coverage",
            approved_service_categories: approvedServiceCategories,
            medical_director_name: supervisingMdName || "NOVI-assigned Medical Director",
            membership_effective_date: formatLongDate(sub.activated_at || sub.created_at),
            termination_date: formatLongDate(nowIso),
          });
          if (sent?.sent) summary.repEmailsSent += 1;
        } catch (err) {
          console.warn("[mdCancellation] rep cancellation email failed:", err?.message || err);
        }
      }
    }
  } catch (err) {
    console.warn("[mdCancellation] manufacturer revocation failed:", err?.message || err);
  }

  // ── 7. Notify NOVI admins ─────────────────────────────────────────────────
  try {
    await notifyAdminsOfProviderMdCancellation({
      providerName,
      providerEmail,
      serviceTypeName: cancelledServiceName,
      mdSubscriptionId: sub.id,
      stripeSubscriptionId: sub.stripe_subscription_id,
      reason,
      notes,
    });
  } catch (err) {
    console.warn("[mdCancellation] admin notification failed:", err?.message || err);
  }

  // ── 8. Notify the provider ────────────────────────────────────────────────
  try {
    const recipient = await resolveNotificationRecipient({ providerId: pid, providerEmail });
    let message;
    if (isFullExit) {
      message = `Your last active NOVI MD membership (${cancelledServiceName}) has been cancelled. Your platform access is now locked — your verified license is kept, so you can reactivate MD coverage anytime to restore access.`;
    } else if (!serviceFullyCancelled) {
      message = `One of your ${cancelledServiceName} memberships has been cancelled. You still have active coverage for ${cancelledServiceName}, so your access is unaffected. Stripe billing may continue until NOVI deactivates it — contact support if needed.`;
    } else {
      message = `Your MD coverage for ${cancelledServiceName} has been cancelled. Your other active memberships are unaffected. Stripe billing may continue until NOVI deactivates it — contact support if needed.`;
    }
    await insertAppNotification({
      user_id: recipient.userId,
      user_email: recipient.userEmail || providerEmail,
      type: "md_coverage_cancelled",
      message,
      link_page: "ProviderCredentialsCoverage",
    });
  } catch (err) {
    console.warn("[mdCancellation] provider notification failed:", err?.message || err);
  }

  return { success: true, summary };
}
