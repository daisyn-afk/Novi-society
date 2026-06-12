import { query } from "../db.js";
import { getUserById } from "./repository.js";
import { mapProviderProfileToMeExtras } from "../auth/providerProfileFields.js";
import { getProviderLaunchChecklist } from "../launch-roadmap/repository.js";

function normalizeNullableText(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

/** Full provider profile for admin detail panels (Growth Studio, contact info, offerings). */
export async function getAdminProviderDetail(publicUserId) {
  const user = await getUserById(publicUserId);
  if (!user) return null;

  const { rows } = await query(
    `select p.metadata,
            p.address_line1,
            p.address_line2,
            p.city,
            p.state,
            p.zip,
            p.onboarding_completed
       from public.provider_profiles p
      where p.user_id = $1
      limit 1`,
    [user.id]
  );

  const profileRow = rows[0] || null;
  const metadata =
    profileRow?.metadata && typeof profileRow.metadata === "object" && !Array.isArray(profileRow.metadata)
      ? profileRow.metadata
      : {};

  const providerProfile = profileRow
    ? { ...profileRow, metadata }
    : null;

  const profileExtras = providerProfile ? mapProviderProfileToMeExtras(providerProfile) : {};
  const authUserId = String(user.auth_user_id || "").trim();
  const launch_checklist = authUserId ? await getProviderLaunchChecklist(authUserId) : {};

  const profile = {
    id: authUserId || user.id,
    auth_user_id: authUserId || null,
    users_id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    full_name: user.full_name,
    role: user.role,
    bio: normalizeNullableText(metadata.bio),
    phone: normalizeNullableText(metadata.phone),
    specialty: normalizeNullableText(metadata.specialty),
    avatar_url: normalizeNullableText(metadata.avatar_url),
    website_url: normalizeNullableText(metadata.website_url),
    instagram_handle: normalizeNullableText(metadata.instagram_handle),
    address_line1: profileRow?.address_line1 || null,
    address_line2: profileRow?.address_line2 || null,
    city: profileRow?.city || null,
    state: profileRow?.state || null,
    zip: profileRow?.zip || null,
    onboarding_completed: profileRow?.onboarding_completed || false,
    launch_checklist,
    ...profileExtras,
  };

  return { user, profile };
}
