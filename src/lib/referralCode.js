export function normalizeReferralCode(code) {
  return String(code || "").trim().toUpperCase();
}

/** True if empty input, or input matches provider code (case-insensitive). */
export function referralCodeMatchesProvider(entered, providerCode) {
  const input = String(entered || "").trim();
  if (!input) return true;
  const expected = normalizeReferralCode(providerCode);
  if (!expected) return false;
  return normalizeReferralCode(input) === expected;
}
