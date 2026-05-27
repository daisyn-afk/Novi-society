import { query } from "./db.js";

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

  const [{ rows: licenseRows }, { rows: subRows }, { rows: relRows }] = await Promise.all([
    query(
      `select id from public.licenses
        where provider_id = $1 and status = 'verified'
        limit 1`,
      [pid]
    ),
    query(
      `select id, service_type_id, service_type_name, status
         from public.md_subscription
        where provider_id = $1
          and lower(status) = 'active'
          and (
            lower(trim(coalesce(service_type_name, ''))) = lower($2)
            or service_type_id in (
              select id::text from public.service_type where lower(trim(name)) = lower($2) limit 1
            )
          )
        limit 1`,
      [pid, serviceName]
    ),
    query(
      `select id from public.medical_director_relationship
        where provider_id = $1 and lower(status) = 'suspended'
        limit 1`,
      [pid]
    ),
  ]);

  if (!licenseRows.length) {
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

  const referralCheck = validateReferralAgainstProvider({
    referralCodeInput: referral_code,
    metadata,
  });
  if (!referralCheck.valid) {
    return { eligible: false, reason: referralCheck.reason };
  }

  return {
    eligible: true,
    service_type_id: subRows[0].service_type_id || null,
    referral_code: referralCheck.referral_code ?? null,
  };
}
