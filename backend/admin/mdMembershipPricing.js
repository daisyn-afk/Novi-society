/** NOVI Board MD coverage monthly pricing (keep in sync with src/lib/mdMembershipPricing.js). */
export const MD_FIRST_SERVICE_MONTHLY_FEE = 279;
export const MD_ADDON_SERVICE_MONTHLY_FEE = 129;
export const MD_MAX_COVERED_SERVICES = 5;

export function monthlyFeeForNewMdService(activeServiceCountBeforeAdd = 0) {
  const n = Math.max(0, Number(activeServiceCountBeforeAdd) || 0);
  if (n >= MD_MAX_COVERED_SERVICES) return 0;
  if (n === 0) return MD_FIRST_SERVICE_MONTHLY_FEE;
  return MD_ADDON_SERVICE_MONTHLY_FEE;
}

function parseCsvEnv(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isMdCoverageTestPricingEnabled() {
  return String(process.env.MD_COVERAGE_TEST_PRICING_ENABLED || "").trim() === "1";
}

export function isAllowlistedMdCoverageTestProvider(providerId, providerEmail) {
  const id = String(providerId || "").trim();
  const email = String(providerEmail || "").trim().toLowerCase();
  const idList = parseCsvEnv(process.env.MD_COVERAGE_TEST_PROVIDER_IDS);
  const emailList = parseCsvEnv(process.env.MD_COVERAGE_TEST_PROVIDER_EMAILS).map((e) =>
    e.toLowerCase()
  );
  if (id && idList.includes(id)) return true;
  if (email && emailList.includes(email)) return true;
  return false;
}

function parseTestMonthlyFee() {
  const fee = Number(process.env.MD_COVERAGE_TEST_MONTHLY_FEE);
  if (!Number.isFinite(fee) || fee < 0) return null;
  return fee;
}

/**
 * Server-side MD checkout fee. Allowlisted providers use MD_COVERAGE_TEST_MONTHLY_FEE when enabled.
 * @param {{ providerId?: string, providerEmail?: string, activeServiceCountBeforeAdd?: number }} params
 */
export function resolveMdCoverageMonthlyFee({
  providerId,
  providerEmail,
  activeServiceCountBeforeAdd = 0,
} = {}) {
  const standard = monthlyFeeForNewMdService(activeServiceCountBeforeAdd);
  if (!isMdCoverageTestPricingEnabled()) return standard;
  if (!isAllowlistedMdCoverageTestProvider(providerId, providerEmail)) return standard;
  const override = parseTestMonthlyFee();
  if (override == null) return standard;
  if (standard === 0) return 0;
  return override;
}

export function enrichMdSubscriptionMonthlyFees(subs) {
  const active = (subs || [])
    .filter((s) => String(s?.status || "").toLowerCase() === "active")
    .sort((a, b) => {
      const ta = new Date(a.activated_at || a.created_at || 0).getTime();
      const tb = new Date(b.activated_at || b.created_at || 0).getTime();
      return ta - tb;
    });
  const feeById = new Map();
  active.forEach((sub, idx) => {
    const id = String(sub.id || "");
    const stored = sub.service_type_monthly_fee;
    feeById.set(
      id,
      stored != null && stored !== "" && Number.isFinite(Number(stored))
        ? Number(stored)
        : idx === 0
          ? MD_FIRST_SERVICE_MONTHLY_FEE
          : idx < MD_MAX_COVERED_SERVICES
            ? MD_ADDON_SERVICE_MONTHLY_FEE
            : 0
    );
  });
  return (subs || []).map((sub) => {
    const id = String(sub.id || "");
    const fee = feeById.get(id);
    if (fee == null) return sub;
    return { ...sub, service_type_monthly_fee: fee };
  });
}
