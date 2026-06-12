import { query } from "./db.js";
import {
  activeNonExpiredCertSql,
  verifiedNonExpiredLicenseSql,
} from "./lib/providerCredentialEligibility.js";
import { resolveBookableTreatmentService } from "./lib/serviceTypeMembershipModel.js";
import { assertProviderCanPracticeService } from "./lib/serviceAttestation.js";

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function metadataBool(metadata, key, defaultValue = true) {
  if (!metadata || typeof metadata !== "object") return defaultValue;
  if (!Object.prototype.hasOwnProperty.call(metadata, key)) return defaultValue;
  const raw = metadata[key];
  if (typeof raw === "boolean") return raw;
  if (raw === "false" || raw === "0") return false;
  return Boolean(raw);
}

export function normalizeReferralCode(code) {
  return String(code || "").trim().toUpperCase();
}

/**
 * @returns {{ valid: boolean, reason?: string, referral_code?: string | null }}
 */
export function validateReferralAgainstProvider({ referralCodeInput, metadata }) {
  const input = String(referralCodeInput || "").trim();
  if (!input) return { valid: true, referral_code: null };

  const programActive = metadataBool(metadata, "referral_program_active", false);
  const expectedRaw = metadata?.referral_code != null ? String(metadata.referral_code).trim() : "";
  const expected = normalizeReferralCode(expectedRaw);

  if (!programActive || !expected) {
    return {
      valid: false,
      reason: "This provider does not have an active referral program.",
    };
  }
  if (normalizeReferralCode(input) !== expected) {
    const discRaw = metadata?.referral_discount != null ? String(metadata.referral_discount).trim() : "";
    const disc = discRaw ? ` (${discRaw})` : "";
    return {
      valid: false,
      reason: `Enter proper referral code: ${expected}${disc}.`,
    };
  }
  return { valid: true, referral_code: expected };
}

/**
 * Validates that a provider can accept a booking for the given service name.
 * @returns {{ eligible: boolean, reason?: string, service_type_id?: string, referral_code?: string | null }}
 */
export async function validateBookingScope({ providerId, service, referral_code }) {
  const pid = String(providerId || "").trim();
  const serviceName = String(service || "").trim();
  if (!pid) {
    return { eligible: false, reason: "Provider is required." };
  }
  if (!serviceName) {
    return { eligible: false, reason: "Service is required." };
  }

  const { rows: userRows } = await query(
    `select u.auth_user_id, u.role, u.is_active, u.email, u.full_name,
            pp.metadata, pp.city, pp.state
       from public.users u
       left join public.provider_profiles pp on pp.user_id = u.id
      where u.auth_user_id = $1
      limit 1`,
    [pid]
  );
  const user = userRows[0];
  if (!user || normalizeStatus(user.role) !== "provider") {
    return { eligible: false, reason: "Provider not found." };
  }
  if (user.is_active === false) {
    return { eligible: false, reason: "This provider is not currently active on NOVI." };
  }

  const metadata = user.metadata && typeof user.metadata === "object" ? user.metadata : {};
  if (!metadataBool(metadata, "accepts_new_patients", true)) {
    return { eligible: false, reason: "This provider is not accepting new patients right now." };
  }

  const [
    { rows: licenseRows },
    { rows: expiredLicenseRows },
    { rows: activeSubRows },
    { rows: relRows },
    { rows: serviceTypeRows },
  ] = await Promise.all([
    query(
      `select id from public.licenses l
        where l.provider_id = $1
          and ${verifiedNonExpiredLicenseSql("l")}
        limit 1`,
      [pid]
    ),
    query(
      `select id from public.licenses l
        where l.provider_id = $1
          and l.status = 'verified'
          and l.expiration_date is not null
          and l.expiration_date <= current_date
        limit 1`,
      [pid]
    ),
    query(
      `select ms.id, ms.service_type_id, ms.service_type_name, ms.status
         from public.md_subscription ms
        where ms.provider_id = $1
          and lower(ms.status) = 'active'`,
      [pid]
    ),
    query(
      `select id from public.medical_director_relationship
        where provider_id = $1 and lower(status) = 'suspended'
        limit 1`,
      [pid]
    ),
    query(
      `select id, name, is_membership, is_active, included_service_ids, legacy_parent_membership_id
         from public.service_type`
    ),
  ]);

  const serviceTypes = (serviceTypeRows || []).map((row) => ({
    ...row,
    included_service_ids: Array.isArray(row.included_service_ids) ? row.included_service_ids : [],
  }));

  const resolvedTreatment = resolveBookableTreatmentService({
    serviceName,
    activeSubscriptions: activeSubRows,
    serviceTypes,
  });

  const subRows = resolvedTreatment
    ? activeSubRows.filter((sub) => {
        const membership = serviceTypes.find((st) => String(st.id) === String(sub.service_type_id));
        if (!membership) return String(sub.service_type_id) === String(resolvedTreatment.id);
        const included = (membership.included_service_ids || []).map(String);
        if (included.includes(String(resolvedTreatment.id))) return true;
        return (
          String(resolvedTreatment.legacy_parent_membership_id || "") === String(sub.service_type_id)
        );
      })
    : activeSubRows.filter((sub) => {
        const membership = serviceTypes.find((st) => String(st.id) === String(sub.service_type_id));
        const names = [
          sub.service_type_name,
          membership?.name,
        ]
          .map((n) => String(n || "").trim().toLowerCase())
          .filter(Boolean);
        return names.includes(serviceName.toLowerCase());
      });

  if (!licenseRows.length) {
    if (expiredLicenseRows.length) {
      return {
        eligible: false,
        reason: "This provider's professional license has expired. Choose another provider.",
      };
    }
    return {
      eligible: false,
      reason: "This provider does not have a verified professional license on file.",
    };
  }

  if (!subRows.length) {
    const { rows: suspendedSubs } = await query(
      `select id from public.md_subscription
        where provider_id = $1
          and lower(status) = 'suspended'
          and lower(trim(coalesce(service_type_name, ''))) = lower($2)
        limit 1`,
      [pid, serviceName]
    );
    if (suspendedSubs.length) {
      return {
        eligible: false,
        reason: "MD coverage for this service is suspended. Choose another service or provider.",
      };
    }
    return {
      eligible: false,
      reason: "This provider does not have active MD coverage for this service.",
    };
  }

  if (relRows.length) {
    return {
      eligible: false,
      reason: "This provider's medical director supervision is suspended. They cannot accept bookings.",
    };
  }

  const resolvedServiceTypeId = resolvedTreatment?.id || subRows[0]?.service_type_id || null;
  const serviceTypeId = String(resolvedServiceTypeId || subRows[0]?.service_type_id || "").trim();
  const serviceCertFilterSql = `(
    ($2::text <> '' and c.service_type_id = $2)
    or lower(trim(coalesce(c.service_type_name, ''))) = lower($3)
    or c.service_type_id in (
      select st.id::text from public.service_type st where lower(trim(st.name)) = lower($3) limit 1
    )
  )`;

  const { rows: serviceCertRows } = await query(
    `select 1
       from public.certification c
      where c.provider_id = $1
        and ${serviceCertFilterSql}
      limit 1`,
    [pid, serviceTypeId, serviceName]
  );

  if (serviceCertRows.length) {
    const { rows: activeServiceCertRows } = await query(
      `select 1
         from public.certification c
        where c.provider_id = $1
          and ${activeNonExpiredCertSql("c")}
          and ${serviceCertFilterSql}
        limit 1`,
      [pid, serviceTypeId, serviceName]
    );
    if (!activeServiceCertRows.length) {
      return {
        eligible: false,
        reason: "This provider's certification for this service has expired. Choose another provider.",
      };
    }
  }

  const referralCheck = validateReferralAgainstProvider({
    referralCodeInput: referral_code,
    metadata,
  });
  if (!referralCheck.valid) {
    return { eligible: false, reason: referralCheck.reason };
  }

  const practiceCheck = await assertProviderCanPracticeService({
    providerId: pid,
    serviceTypeId: resolvedServiceTypeId,
  });
  if (!practiceCheck.ok) {
    return {
      eligible: false,
      reason:
        practiceCheck.reason ||
        "This provider has not completed required training for this service yet.",
    };
  }

  return {
    eligible: true,
    service_type_id: resolvedServiceTypeId,
    referral_code: referralCheck.referral_code ?? null,
  };
}
