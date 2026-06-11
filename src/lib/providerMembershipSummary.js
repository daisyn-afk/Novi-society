import { isMdPurchasablePlan } from "./serviceTypeMembershipModel";

/** Match md_subscription rows to a provider user record (auth id, users.id, or email). */
export function providerLookupKeys(provider) {
  const keys = new Set();
  for (const raw of [provider?.auth_user_id, provider?.id, provider?.provider_id, provider?.users_id]) {
    const v = String(raw || "").trim();
    if (v) keys.add(v.toLowerCase());
  }
  const email = String(provider?.email || provider?.provider_email || "").trim().toLowerCase();
  if (email) keys.add(`email:${email}`);
  return keys;
}

export function subscriptionsForProvider(provider, allSubscriptions = []) {
  const keys = providerLookupKeys(provider);
  return (allSubscriptions || []).filter((sub) => {
    const pid = String(sub?.provider_id || "").trim().toLowerCase();
    if (pid && keys.has(pid)) return true;
    const email = String(sub?.provider_email || "").trim().toLowerCase();
    return email && keys.has(`email:${email}`);
  });
}

function normStatus(value) {
  return String(value || "").trim().toLowerCase();
}

export function summarizeProviderMemberships(provider, allSubscriptions = [], serviceTypes = []) {
  const subs = subscriptionsForProvider(provider, allSubscriptions);
  const activeSubs = subs.filter((s) => normStatus(s.status) === "active");
  const byServiceId = new Map();
  for (const sub of subs) {
    const sid = String(sub?.service_type_id || "").trim();
    if (!sid) continue;
    const existing = byServiceId.get(sid) || [];
    existing.push(sub);
    byServiceId.set(sid, existing);
  }

  const catalog = (serviceTypes || []).filter((st) => st?.is_active !== false && isMdPurchasablePlan(st));
  const rows = catalog.map((st) => {
    const sid = String(st.id);
    const matches = byServiceId.get(sid) || [];
    const active = matches.find((s) => normStatus(s.status) === "active") || null;
    const latest = matches[0] || null;
    return {
      service_type_id: sid,
      service_type_name: st.name || st.service_name || sid,
      has_active: Boolean(active),
      subscription: active || latest,
      all_subscriptions: matches,
    };
  });

  const orphanSubs = subs.filter((sub) => {
    const sid = String(sub?.service_type_id || "").trim();
    return !sid || !catalog.some((st) => String(st.id) === sid);
  });

  return {
    subs,
    activeSubs,
    activeCount: activeSubs.length,
    totalCount: subs.length,
    rows,
    orphanSubs,
    missingActiveCount: rows.filter((r) => !r.has_active).length,
  };
}

export function membershipStatusLabel(sub) {
  if (!sub) return "None";
  const status = normStatus(sub.status);
  if (status === "active") {
    const billing = normStatus(sub.billing_status);
    if (billing && billing !== "active" && billing !== "pending") {
      return `${status} · billing ${billing}`;
    }
    return "active";
  }
  return status || "unknown";
}

export function membershipStatusTone(sub) {
  const status = normStatus(sub?.status);
  if (status === "active") return "green";
  if (["pending", "pending_payment", "pending_md_approval"].includes(status)) return "amber";
  if (["cancelled", "revoked", "inactive", "suspended"].includes(status)) return "slate";
  return "slate";
}
