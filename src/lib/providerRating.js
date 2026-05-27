/** Average star rating from patient reviews (marketplace uses verified reviews only). */
export function providerReviewAverage(reviews, providerId, { verifiedOnly = true } = {}) {
  if (!providerId || !Array.isArray(reviews)) return { average: null, count: 0 };

  let list = reviews.filter((r) => String(r.provider_id) === String(providerId));
  if (verifiedOnly) {
    list = list.filter((r) => r.is_verified === true || r.is_verified === "true");
  }
  if (!list.length) return { average: null, count: 0 };

  const sum = list.reduce((s, r) => s + Number(r.rating || 0), 0);
  return { average: (sum / list.length).toFixed(1), count: list.length };
}
