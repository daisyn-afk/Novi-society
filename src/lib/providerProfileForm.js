import { pairsFromGalleryMetadata, pairsToGalleryMetadata } from "@/lib/galleryPhotos";

/** Build practice profile form state from auth `me` (marketplace-facing fields). */
export function buildProviderProfileForm(me = {}) {
  return {
    practice_name: me.practice_name || "",
    bio: me.bio || "",
    city: me.city || "",
    state: me.state || "",
    zip: me.zip || "",
    phone: me.phone || "",
    contact_email: me.contact_email || "",
    address: me.address || "",
    consultation_fee: me.consultation_fee ?? "",
    starting_price: me.starting_price ?? "",
    deposit_percent: me.deposit_percent ?? "",
    cancellation_hours: me.cancellation_hours ?? "",
    booking_deposit: me.booking_deposit ?? "",
    accepts_new_patients: me.accepts_new_patients ?? true,
    avatar_url: me.avatar_url || "",
    brand_logo_url: me.brand_logo_url || "",
    website_url: me.website_url || me.website || "",
    instagram_handle: me.instagram_handle || me.instagram || "",
    facebook: me.facebook || "",
    tiktok: me.tiktok || "",
    referral_program_active: me.referral_program_active ?? false,
    referral_code: me.referral_code || "",
    referral_discount: me.referral_discount || "",
    gallery_photos: pairsFromGalleryMetadata(me.gallery_photos),
    practice_packages: Array.isArray(me.practice_packages) ? me.practice_packages : [],
    schedule: me.schedule && typeof me.schedule === "object" ? me.schedule : {},
    specialties: Array.isArray(me.specialties) ? me.specialties : [],
    languages: Array.isArray(me.languages) ? me.languages : [],
    credentials: Array.isArray(me.credentials) ? me.credentials : [],
  };
}

export function sanitizeProfileSavePayload(data) {
  const payload = { ...data };
  if (Array.isArray(payload.gallery_photos)) {
    payload.gallery_photos = pairsToGalleryMetadata(payload.gallery_photos);
  }
  return payload;
}
