/** NOVI Board MD coverage monthly pricing (keep in sync with src/lib/mdMembershipPricing.js). */
export const MD_FIRST_SERVICE_MONTHLY_FEE = 279;
export const MD_ADDON_SERVICE_MONTHLY_FEE = 129;
export const MD_MAX_COVERED_SERVICES = 5;
export const MD_MAX_MONTHLY_CAP = 795;

export function monthlyFeeForNewMdService(activeServiceCountBeforeAdd = 0) {
  const n = Math.max(0, Number(activeServiceCountBeforeAdd) || 0);
  if (n >= MD_MAX_COVERED_SERVICES) return 0;
  if (n === 0) return MD_FIRST_SERVICE_MONTHLY_FEE;
  return MD_ADDON_SERVICE_MONTHLY_FEE;
}

export function isMdCoverageAtServiceCap(activeServiceCount = 0) {
  return Math.max(0, Number(activeServiceCount) || 0) >= MD_MAX_COVERED_SERVICES;
}

export function mdCoverageCapErrorMessage() {
  return `You can cover up to ${MD_MAX_COVERED_SERVICES} services ($${MD_MAX_MONTHLY_CAP}/mo maximum). Cancel an existing service before adding another.`;
}

export function assertCanAddMdCoverageService(activeServiceCountBeforeAdd = 0) {
  if (isMdCoverageAtServiceCap(activeServiceCountBeforeAdd)) {
    return { ok: false, error: mdCoverageCapErrorMessage() };
  }
  return { ok: true };
}

export function calcMdCoverageMonthlyTotal(
  activeServiceCount = 0,
  feeForSlot = monthlyFeeForNewMdService
) {
  const count = Math.max(0, Number(activeServiceCount) || 0);
  if (count <= 0) return 0;
  if (count >= MD_MAX_COVERED_SERVICES) return MD_MAX_MONTHLY_CAP;
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    total += feeForSlot(i);
  }
  return Math.min(total, MD_MAX_MONTHLY_CAP);
}

export function calcMdCoverageProration(monthlyFee, referenceDate = new Date()) {
  const fee = Number(monthlyFee) || 0;
  const today = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayOfMonth = today.getDate();
  const daysRemaining = daysInMonth - dayOfMonth + 1;
  const dueToday = fee <= 0 ? 0 : (fee / daysInMonth) * daysRemaining;
  return {
    daysInMonth,
    daysRemaining,
    dueToday: Math.round(dueToday * 100) / 100,
    periodStart: new Date(today.getFullYear(), today.getMonth(), dayOfMonth),
    periodEnd: new Date(today.getFullYear(), today.getMonth() + 1, 0),
    nextBillingDate: new Date(today.getFullYear(), today.getMonth() + 1, 1),
  };
}

export function buildMdCoverageCheckoutBillingPreview({
  activeServiceCountBeforeAdd = 0,
  referenceDate = new Date(),
  providerId,
  providerEmail,
} = {}) {
  const activeBefore = Math.max(0, Number(activeServiceCountBeforeAdd) || 0);
  const feeForSlot = (slotIndex) =>
    resolveMdCoverageMonthlyFee({
      providerId,
      providerEmail,
      activeServiceCountBeforeAdd: slotIndex,
    });
  const thisServiceMonthly = feeForSlot(activeBefore);
  const newActiveCount = activeBefore + 1;
  const newTotalMonthlyFromNextCycle = calcMdCoverageMonthlyTotal(newActiveCount, feeForSlot);
  const proration = calcMdCoverageProration(thisServiceMonthly, referenceDate);
  return {
    thisServiceMonthly,
    newTotalMonthlyFromNextCycle,
    newActiveCount,
    dueTodayProrated: proration.dueToday,
    proration,
  };
}

export function nextMdCoverageBillingAnchorUnix(referenceDate = new Date()) {
  const today = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const anchor = new Date(today.getFullYear(), today.getMonth() + 1, 1, 0, 0, 0, 0);
  return Math.floor(anchor.getTime() / 1000);
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
