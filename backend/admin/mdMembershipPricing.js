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
