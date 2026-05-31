function normalizeNullableText(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeAcceptsNewPatients(value) {
  if (typeof value === "boolean") return value;
  if (value === "false" || value === "0") return false;
  if (value === "true" || value === "1") return true;
  return true;
}

function normalizeMetadataJsonValue(key, value) {
  if (value === null || value === undefined) return null;
  if (key === "schedule" || key === "service_offerings_v2") {
    return typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  if (["specialties", "languages", "credentials", "practice_packages", "gallery_photos"].includes(key)) {
    return Array.isArray(value) ? value : [];
  }
  return value;
}

export const PROVIDER_METADATA_TEXT_KEYS = [
  "bio",
  "phone",
  "specialty",
  "avatar_url",
  "website_url",
  "instagram_handle",
  "practice_name",
  "contact_email",
  "consultation_fee",
  "starting_price",
  "deposit_percent",
  "cancellation_hours",
  "facebook",
  "tiktok",
  "booking_deposit",
  "md_name",
  "md_license_number",
  "md_license_state",
  "supervision_agreement_date",
];

export const PROVIDER_METADATA_JSON_KEYS = [
  "schedule",
  "specialties",
  "languages",
  "credentials",
  "service_offerings_v2",
  "practice_packages",
  "gallery_photos",
];

export const PROVIDER_METADATA_BOOLEAN_KEYS = ["accepts_new_patients"];

/** Map frontend `address` to backend `address_line1`. */
export function normalizeProviderProfileUpdates(updates = {}) {
  const normalized = { ...updates };
  if (
    Object.prototype.hasOwnProperty.call(normalized, "address") &&
    !Object.prototype.hasOwnProperty.call(normalized, "address_line1")
  ) {
    normalized.address_line1 = normalized.address;
  }
  delete normalized.address;
  return normalized;
}

export function buildProviderMetadataUpdates(updates = {}) {
  const metadataUpdates = {};

  for (const key of PROVIDER_METADATA_TEXT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      metadataUpdates[key] = normalizeNullableText(updates[key]);
    }
  }

  for (const key of PROVIDER_METADATA_JSON_KEYS) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      metadataUpdates[key] = normalizeMetadataJsonValue(key, updates[key]);
    }
  }

  for (const key of PROVIDER_METADATA_BOOLEAN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      metadataUpdates[key] = normalizeAcceptsNewPatients(updates[key]);
    }
  }

  return metadataUpdates;
}

export function mapProviderProfileToMeExtras(providerProfile) {
  const metadata =
    providerProfile?.metadata && typeof providerProfile.metadata === "object"
      ? providerProfile.metadata
      : {};

  return {
    practice_name: normalizeNullableText(metadata.practice_name),
    contact_email: normalizeNullableText(metadata.contact_email),
    consultation_fee: metadata.consultation_fee ?? null,
    starting_price: metadata.starting_price ?? null,
    deposit_percent: metadata.deposit_percent ?? null,
    cancellation_hours: metadata.cancellation_hours ?? null,
    booking_deposit: metadata.booking_deposit ?? null,
    facebook: normalizeNullableText(metadata.facebook),
    tiktok: normalizeNullableText(metadata.tiktok),
    accepts_new_patients: normalizeAcceptsNewPatients(metadata.accepts_new_patients),
    schedule:
      typeof metadata.schedule === "object" && !Array.isArray(metadata.schedule)
        ? metadata.schedule
        : {},
    specialties: Array.isArray(metadata.specialties) ? metadata.specialties : [],
    languages: Array.isArray(metadata.languages) ? metadata.languages : [],
    credentials: Array.isArray(metadata.credentials) ? metadata.credentials : [],
    service_offerings_v2:
      typeof metadata.service_offerings_v2 === "object" &&
      !Array.isArray(metadata.service_offerings_v2)
        ? metadata.service_offerings_v2
        : {},
    practice_packages: Array.isArray(metadata.practice_packages) ? metadata.practice_packages : [],
    gallery_photos: Array.isArray(metadata.gallery_photos) ? metadata.gallery_photos : [],
    address: providerProfile?.address_line1 || null,
    md_name: normalizeNullableText(metadata.md_name),
    md_license_number: normalizeNullableText(metadata.md_license_number),
    md_license_state: normalizeNullableText(metadata.md_license_state),
    supervision_agreement_date: normalizeNullableText(metadata.supervision_agreement_date),
  };
}
