/**
 * Provider Locked Sections Map
 *
 * Single source of truth for which provider dashboard sections are "locked" for
 * non-certified / non-active providers, and what the required access tier is
 * for each one.
 *
 * Tiers (ascending), as returned by `useProviderAccess`:
 *   none → pending → courses_only → md_eligible → full
 *
 * Per product spec ("Locked Provider Experience"):
 *   • Courses & Enrollments and "Apply for Coverage" must be fully accessible
 *     to ALL provider states — so they are NOT in the locked map (tier "none").
 *   • Supplier Marketplace, Growth Studio, and My Practice are locked behind
 *     an active/certified state and render the LockedOverlay over the real
 *     page content (freemium-style — "see but not fully use").
 */

export const TIER_ORDER = ["none", "pending", "courses_only", "md_eligible", "full"];

export function tierRank(tier) {
  const idx = TIER_ORDER.indexOf(tier);
  return idx === -1 ? -1 : idx;
}

export function meetsTier(currentTier, requiredTier) {
  return tierRank(currentTier) >= tierRank(requiredTier);
}

/**
 * Per-page lock configuration. If a page is not in this map, it is considered
 * fully accessible (no overlay).
 *
 * `featureKey` matches the FEATURE_META key in `ProviderSalesLock`.
 */
export const PROVIDER_SECTION_LOCKS = {
  ProviderMarketplace: { featureKey: "marketplace", requiredTier: "md_eligible" },
  ProviderLaunchPad: { featureKey: "growth_studio", requiredTier: "md_eligible" },
  ProviderPractice: { featureKey: "practice", requiredTier: "full" },
};

export function getSectionLock(pageKey) {
  return PROVIDER_SECTION_LOCKS[pageKey] || null;
}

export function isSectionLockedForStatus(pageKey, status) {
  const lock = getSectionLock(pageKey);
  if (!lock) return false;
  if (!status || status === "loading") return false;
  return !meetsTier(status, lock.requiredTier);
}
