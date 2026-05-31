import { query } from "../db.js";
import {
  activeNonExpiredCertSql,
  verifiedNonExpiredLicenseSql,
} from "../lib/providerCredentialEligibility.js";

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

function computeMarketplaceDeposit(metadata) {
  const fixed = Number(metadataValue(metadata, "booking_deposit"));
  if (Number.isFinite(fixed) && fixed > 0) return fixed;
  const percent = Number(metadataValue(metadata, "deposit_percent"));
  const base =
    Number(metadataValue(metadata, "starting_price")) > 0
      ? Number(metadataValue(metadata, "starting_price"))
      : Number(metadataValue(metadata, "consultation_fee"));
  if (Number.isFinite(percent) && percent > 0 && Number.isFinite(base) && base > 0) {
    return Math.round(((base * percent) / 100) * 100) / 100;
  }
  return metadataValue(metadata, "booking_deposit");
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
    gallery_photos: Array.isArray(metadata.gallery_photos) ? metadata.gallery_photos : [],
    referral_program_active: Boolean(metadataValue(metadata, "referral_program_active", false)),
    referral_code: metadataValue(metadata, "referral_code"),
    referral_discount: metadataValue(metadata, "referral_discount"),
    website_url: metadataValue(metadata, "website_url"),
    instagram_handle: metadataValue(metadata, "instagram_handle"),
  };
}

export async function listMarketplaceProviders() {
  const { rows: providerRows } = await query(
    `select distinct
        u.auth_user_id,
        u.email,
        u.full_name,
        u.role,
        u.is_active,
        pp.city,
        pp.state,
        pp.metadata
       from public.users u
       inner join public.provider_profiles pp on pp.user_id = u.id
       inner join public.licenses l
         on l.provider_id = u.auth_user_id
        and ${verifiedNonExpiredLicenseSql("l")}
       inner join public.md_subscription ms
         on ms.provider_id = u.auth_user_id::text
        and lower(ms.status) = 'active'
      where u.role = 'provider'
        and coalesce(u.is_active, true) = true
        and not exists (
          select 1
            from public.medical_director_relationship mdr
           where mdr.provider_id = u.auth_user_id::text
             and lower(coalesce(mdr.status, '')) = 'suspended'
        )
      order by u.full_name nulls last, u.email`
  );

  const providers = providerRows
    .map(mapProviderRow)
    .filter((p) => p.accepts_new_patients !== false);

  const providerIds = providers.map((p) => p.id).filter(Boolean);
  if (!providerIds.length) {
    return { providers: [], md_subscriptions: [], certifications: [], reviews: [] };
  }

  const { rows: mdSubs } = await query(
    `select *
       from public.md_subscription
      where provider_id = any($1::text[])
        and lower(status) = 'active'
      order by service_type_name`,
    [providerIds]
  );

  const { rows: certs } = await query(
    `select c.*
       from public.certification c
      where c.provider_id = any($1::text[])
        and ${activeNonExpiredCertSql("c")}
      order by c.certification_name nulls last`,
    [providerIds]
  ).catch(() => ({ rows: [] }));

  let reviewRows = [];
  try {
    const result = await query(
      `select *
         from public.reviews
        where provider_id = any($1::text[])
          and is_verified = true`,
      [providerIds]
    );
    reviewRows = result.rows || [];
  } catch {
    reviewRows = [];
  }

  return {
    providers,
    md_subscriptions: mdSubs,
    certifications: certs,
    reviews: reviewRows,
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
