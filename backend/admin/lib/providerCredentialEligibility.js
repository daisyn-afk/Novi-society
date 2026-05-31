/** Shared rules for patient booking + marketplace visibility. */

export const ACTIVE_CERT_STATUSES = ["active", "approved", "verified"];

/** SQL fragment: license row is verified and not past expiration. */
export function verifiedNonExpiredLicenseSql(alias = "l") {
  return `${alias}.status = 'verified'
    and (${alias}.expiration_date is null or ${alias}.expiration_date > current_date)`;
}

/** SQL fragment: provider certification is active and not past expiration. */
export function activeNonExpiredCertSql(alias = "c") {
  return `lower(coalesce(${alias}.status, '')) in ('active', 'approved', 'verified')
    and (${alias}.expires_at is null or ${alias}.expires_at::date > current_date)`;
}
