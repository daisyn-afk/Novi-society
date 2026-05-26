import { pool } from "../db.js";

function asTrimmed(value) {
  return String(value ?? "").trim();
}

function formatAddress({ addressLine1, addressLine2, city, state, zip } = {}) {
  return [
    addressLine1,
    addressLine2,
    [city, state].filter(Boolean).join(", "),
    zip,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function formatLicenseSummary(license) {
  return [
    license.license_type,
    license.license_number,
    license.issuing_state || license.license_state,
    license.status ? `(${license.status})` : null,
  ]
    .filter(Boolean)
    .join(" / ");
}

function formatCertSummary(cert) {
  return [
    cert.certification_name || cert.cert_name || cert.name,
    cert.issued_by ? `by ${cert.issued_by}` : null,
    cert.status ? `(${cert.status})` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

async function safeQuery(sql, params = []) {
  try {
    const { rows } = await pool.query(sql, params);
    return rows || [];
  } catch {
    return [];
  }
}

async function fetchProviderProfileByAuthUserId(authUserId) {
  const rows = await safeQuery(
    `select u.auth_user_id,
            u.email,
            u.full_name,
            pp.address_line1,
            pp.address_line2,
            pp.city,
            pp.state,
            pp.zip,
            pp.metadata
     from public.users u
     left join public.provider_profiles pp on pp.user_id = u.id
     where u.auth_user_id = $1
     limit 1`,
    [authUserId]
  );
  return rows[0] || null;
}

async function fetchVerifiedLicenses(providerId) {
  return safeQuery(
    `select license_type, license_number, issuing_state, status, expiration_date
     from public.licenses
     where provider_id::text = $1
       and lower(coalesce(status, '')) = 'verified'
     order by created_at desc`,
    [providerId]
  );
}

async function fetchMdSubscriptions(providerId) {
  return safeQuery(
    `select service_type_name, status, activated_at, signed_by_name
     from public.md_subscription
     where provider_id::text = $1
     order by created_at desc`,
    [providerId]
  );
}

async function fetchMdRelationships(providerId) {
  return safeQuery(
    `select medical_director_name, medical_director_email, status, start_date
     from public.medical_director_relationship
     where provider_id::text = $1
     order by created_at desc`,
    [providerId]
  );
}

async function fetchActiveCertifications(providerId) {
  return safeQuery(
    `select certification_name, cert_name, issued_by, status, category, certificate_number
     from public.certification
     where provider_id::text = $1
       and lower(coalesce(status, '')) in ('active', 'approved', 'verified')
     order by created_at desc nulls last`,
    [providerId]
  );
}

/**
 * Merge authenticated provider profile + marketplace form data into a complete
 * manufacturer application payload (stored on the row and emailed to admin/rep).
 */
export async function buildManufacturerApplicationPayload({ me, formData = {} }) {
  const providerId = asTrimmed(me?.id);
  const profile = providerId ? await fetchProviderProfileByAuthUserId(providerId) : null;
  const metadata =
    profile?.metadata && typeof profile.metadata === "object" ? profile.metadata : {};

  const [licenses, mdSubs, mdRels, certifications] = providerId
    ? await Promise.all([
        fetchVerifiedLicenses(providerId),
        fetchMdSubscriptions(providerId),
        fetchMdRelationships(providerId),
        fetchActiveCertifications(providerId),
      ])
    : [[], [], [], []];

  const primaryLicense = licenses[0] || {};
  const activeMdSubs = mdSubs.filter(
    (sub) => asTrimmed(sub.status).toLowerCase() === "active"
  );
  const activeMdRels = mdRels.filter(
    (rel) => asTrimmed(rel.status).toLowerCase() === "active"
  );
  const primaryMdRel = activeMdRels[0] || mdRels[0] || {};

  const practiceAddress =
    asTrimmed(formData.practice_address) ||
    formatAddress({
      addressLine1: me?.address_line1 || profile?.address_line1,
      addressLine2: me?.address_line2 || profile?.address_line2,
      city: me?.city || profile?.city,
      state: me?.state || profile?.state,
      zip: me?.zip || profile?.zip,
    });

  const practiceName =
    asTrimmed(formData.practice_name) ||
    asTrimmed(metadata.practice_name) ||
    asTrimmed(me?.full_name) ||
    asTrimmed(profile?.full_name);

  const practicePhone =
    asTrimmed(formData.practice_phone) ||
    asTrimmed(me?.phone) ||
    asTrimmed(metadata.phone);

  const supervisingName =
    asTrimmed(formData.supervising_physician_name) ||
    asTrimmed(primaryMdRel.medical_director_name) ||
    "NOVI Board of Medical Directors";

  const supervisingEmail =
    asTrimmed(formData.supervising_physician_email) ||
    asTrimmed(primaryMdRel.medical_director_email);

  const additionalFromForm =
    formData.additional_fields && typeof formData.additional_fields === "object"
      ? formData.additional_fields
      : {};

  const additionalFields = {
    ...additionalFromForm,
    provider_id: providerId || additionalFromForm.provider_id || null,
    phone: practicePhone || null,
    practice_address_full: practiceAddress || null,
    specialty: asTrimmed(me?.specialty) || asTrimmed(metadata.specialty) || null,
    city: asTrimmed(me?.city) || asTrimmed(profile?.city) || null,
    state: asTrimmed(me?.state) || asTrimmed(profile?.state) || null,
    npi: asTrimmed(metadata.npi) || asTrimmed(additionalFromForm.npi) || null,
    dea_number:
      asTrimmed(metadata.dea_number) ||
      asTrimmed(metadata.dea) ||
      asTrimmed(additionalFromForm.dea_number) ||
      null,
    md_coverage:
      activeMdSubs.length > 0
        ? activeMdSubs
            .map((sub) =>
              [sub.service_type_name, sub.status ? `(${sub.status})` : null]
                .filter(Boolean)
                .join(" ")
            )
            .join("; ")
        : "No active MD Board coverage",
    verified_licenses_summary:
      licenses.length > 0
        ? licenses.map(formatLicenseSummary).join("; ")
        : null,
    certifications_summary:
      certifications.length > 0
        ? certifications.map(formatCertSummary).join("; ")
        : null,
    md_coverage_details: activeMdSubs,
    verified_licenses: licenses,
    certifications,
    supervising_md_details: activeMdRels,
  };

  return {
    provider_email: asTrimmed(me?.email) || asTrimmed(formData.email) || asTrimmed(profile?.email),
    provider_name: asTrimmed(me?.full_name) || asTrimmed(formData.full_name) || asTrimmed(profile?.full_name),
    practice_name: practiceName,
    practice_address: practiceAddress,
    practice_phone: practicePhone,
    license_type:
      asTrimmed(formData.license_type) || asTrimmed(primaryLicense.license_type),
    license_number:
      asTrimmed(formData.license_number) || asTrimmed(primaryLicense.license_number),
    license_state:
      asTrimmed(formData.license_state) ||
      asTrimmed(primaryLicense.issuing_state) ||
      asTrimmed(primaryLicense.license_state),
    supervising_physician_name: supervisingName,
    supervising_physician_email: supervisingEmail,
    additional_fields: additionalFields,
  };
}
