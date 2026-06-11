import { query } from "../db.js";
import { activeNonExpiredCertSql } from "../lib/providerCredentialEligibility.js";
import {
  buildProviderLookupMaps,
  listFullyActiveProviderRows,
  normalizeProviderScopedRows,
} from "../lib/fullyActiveProviders.js";

function parseMetadata(raw) {
  if (!raw || typeof raw !== "object") return {};
  return raw;
}

function metadataValue(metadata, key, fallback = null) {
  if (!Object.prototype.hasOwnProperty.call(metadata, key)) return fallback;
  return metadata[key] ?? fallback;
}

function acceptsNewPatients(metadata) {
  const raw = metadataValue(metadata, "accepts_new_patients", true);
  if (typeof raw === "boolean") return raw;
  if (raw === "false" || raw === "0") return false;
  return true;
}

/** Returns deposit amount for display, or null when provider requires no booking deposit. */
function computeMarketplaceDeposit(metadata) {
  const raw = metadataValue(metadata, "booking_deposit");
  if (raw == null || raw === "") return null;
  const fixed = Number(raw);
  if (Number.isFinite(fixed) && fixed > 0) return fixed;
  return null;
}

function mapProviderRow(row) {
  const metadata = parseMetadata(row.metadata);
  return {
    id: row.auth_user_id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    specialty: metadataValue(metadata, "specialty"),
    specialties: Array.isArray(metadata.specialties) ? metadata.specialties : [],
    bio: metadataValue(metadata, "bio"),
    phone: metadataValue(metadata, "phone"),
    avatar_url: metadataValue(metadata, "avatar_url"),
    brand_logo_url: metadataValue(metadata, "brand_logo_url") || metadataValue(metadata, "avatar_url"),
    practice_name: metadataValue(metadata, "practice_name"),
    city: row.city || metadataValue(metadata, "city"),
    state: row.state || metadataValue(metadata, "state"),
    consultation_fee: metadataValue(metadata, "consultation_fee"),
    booking_deposit: computeMarketplaceDeposit(metadata),
    deposit_percent: metadataValue(metadata, "deposit_percent"),
    cancellation_hours: metadataValue(metadata, "cancellation_hours"),
    years_experience: metadataValue(metadata, "years_experience"),
    accepts_new_patients: acceptsNewPatients(metadata),
    practice_packages: Array.isArray(metadata.practice_packages) ? metadata.practice_packages : [],
    service_offerings_v2:
      metadata.service_offerings_v2 && typeof metadata.service_offerings_v2 === "object"
        ? metadata.service_offerings_v2
        : {},
    gallery_photos: Array.isArray(metadata.gallery_photos) ? metadata.gallery_photos : [],
    referral_program_active: Boolean(metadataValue(metadata, "referral_program_active", false)),
    referral_code: metadataValue(metadata, "referral_code"),
    referral_discount: metadataValue(metadata, "referral_discount"),
    website_url: metadataValue(metadata, "website_url"),
    instagram_handle: metadataValue(metadata, "instagram_handle"),
  };
}

export async function listMarketplaceProviders() {
  const providerRows = await listFullyActiveProviderRows({
    requireAuthUserId: true,
  });

  const providers = providerRows.map(mapProviderRow);
  const { authIdByKey, keys: providerLookupKeys, emails: providerEmails } =
    buildProviderLookupMaps(providerRows);

  if (!providers.length) {
    return { providers: [], md_subscriptions: [], certifications: [], reviews: [] };
  }

  const mdSubsSql = providerEmails.length
    ? `select *
         from public.md_subscription
        where lower(coalesce(status, '')) = 'active'
          and (
            provider_id = any($1::text[])
            or lower(trim(coalesce(provider_email, ''))) = any($2::text[])
          )
        order by service_type_name`
    : `select *
         from public.md_subscription
        where lower(coalesce(status, '')) = 'active'
          and provider_id = any($1::text[])
        order by service_type_name`;

  const { rows: mdSubsRaw } = await query(
    mdSubsSql,
    providerEmails.length ? [providerLookupKeys, providerEmails] : [providerLookupKeys]
  );

  const { rows: certsRaw } = await query(
    `select c.*
       from public.certification c
      where c.provider_id = any($1::text[])
        and ${activeNonExpiredCertSql("c")}
      order by c.certification_name nulls last`,
    [providerLookupKeys]
  ).catch(() => ({ rows: [] }));

  let reviewRowsRaw = [];
  try {
    const result = await query(
      `select *
         from public.reviews
        where provider_id = any($1::text[])
          and is_verified = true`,
      [providerLookupKeys]
    );
    reviewRowsRaw = result.rows || [];
  } catch {
    reviewRowsRaw = [];
  }

  const mdSubs = normalizeProviderScopedRows(mdSubsRaw, authIdByKey);
  const certs = normalizeProviderScopedRows(certsRaw, authIdByKey);
  const reviews = normalizeProviderScopedRows(reviewRowsRaw, authIdByKey);

  return {
    providers,
    md_subscriptions: mdSubs,
    certifications: certs,
    reviews,
  };
}

export async function getMarketplaceProviderById(providerId) {
  const catalog = await listMarketplaceProviders();
  const provider = catalog.providers.find((p) => String(p.id) === String(providerId));
  if (!provider) return null;
  return {
    provider,
    md_subscriptions: catalog.md_subscriptions.filter((s) => s.provider_id === provider.id),
    certifications: catalog.certifications.filter((c) => c.provider_id === provider.id),
    reviews: catalog.reviews.filter((r) => r.provider_id === provider.id),
  };
}
