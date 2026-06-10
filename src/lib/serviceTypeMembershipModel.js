/** Strip "Membership Name — " prefix from migrated child service names. */
export function serviceDisplayName(service, allServiceTypes = []) {
  const name = String(service?.name || "").trim();
  if (!name) return name;

  const parentId = String(service?.legacy_parent_membership_id || "").trim();
  if (!parentId) return name;

  const parent = (allServiceTypes || []).find((st) => String(st.id) === parentId);
  const parentName = String(parent?.name || "").trim();
  if (!parentName) return name;

  for (const sep of [" — ", " - "]) {
    const prefix = `${parentName}${sep}`;
    if (name.startsWith(prefix)) return name.slice(prefix.length).trim() || name;
  }

  return name;
}

export function isMembershipChildService(st) {
  return Boolean(String(st?.legacy_parent_membership_id || "").trim());
}

/** @deprecated use isMembershipChildService */
export const isTierChildService = isMembershipChildService;

/** Row was created from a coverage_tier during tier_migration_v1 (child service, not a plan). */
export function isTierMigrationChildRow(st) {
  const meta = st?.metadata;
  if (!meta || typeof meta !== "object") return false;
  if (String(meta.tier_migration_v1 || "") !== "true") return false;
  const courses = meta.linked_course_ids;
  return Array.isArray(courses) && courses.length > 0;
}

/** Listed on another membership's included_service_ids (child service even if flags are wrong). */
export function isIncludedInAnotherMembership(st, allServiceTypes = []) {
  if (!st) return false;
  const id = String(st.id);
  return (allServiceTypes || []).some((m) => {
    if (String(m.id) === id) return false;
    if (m.is_membership !== true) return false;
    return (m.included_service_ids || []).map(String).includes(id);
  });
}

/** Membership plan — what providers purchase MD coverage for. */
export function isMembershipPlan(st, allServiceTypes = []) {
  if (!st || isMembershipChildService(st)) return false;
  if (isTierMigrationChildRow(st)) return false;
  if (allServiceTypes.length > 0 && isIncludedInAnotherMembership(st, allServiceTypes)) return false;
  return st.is_membership === true;
}

export function isMdPurchasablePlan(st, allServiceTypes = []) {
  return isMembershipPlan(st, allServiceTypes);
}

/** GFE is only configured on individual services, never membership plans. */
export function serviceRequiresGfe(st) {
  if (!st || isMembershipPlan(st)) return false;
  return st.requires_gfe === true;
}

/** Services included in a membership (from included_service_ids). */
export function servicesInMembership(membership, allServiceTypes = []) {
  if (!membership) return [];
  return (membership.included_service_ids || [])
    .map((id) => allServiceTypes.find((st) => String(st.id) === String(id)))
    .filter(Boolean)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

/** All child services covered by an active membership subscription. */
export function servicesUnlockedForSubscription(sub, membership, allServiceTypes = []) {
  if (String(sub?.status || "").toLowerCase() !== "active") return [];
  return servicesInMembership(membership, allServiceTypes);
}

/**
 * Active MD subscription → membership id + every included service id.
 */
/** Individual treatment rows for provider menus (excludes purchasable membership plans). */
export function treatmentMenuServiceTypes(serviceTypes = [], activeServiceIds) {
  const active = activeServiceIds instanceof Set
    ? activeServiceIds
    : new Set((activeServiceIds || []).map((id) => String(id)));

  return (serviceTypes || []).filter((st) => {
    if (!active.has(String(st.id))) return false;
    if (isMembershipPlan(st)) return false;
    return st.is_active !== false;
  });
}

/** Locked treatment rows — services without coverage, not membership plans. */
export function lockedTreatmentMenuServices(serviceTypes = [], activeServiceIds) {
  const active = activeServiceIds instanceof Set
    ? activeServiceIds
    : new Set((activeServiceIds || []).map((id) => String(id)));

  return (serviceTypes || []).filter((st) => {
    if (isMembershipPlan(st)) return false;
    if (active.has(String(st.id))) return false;
    return st.is_active !== false;
  });
}

export function expandActiveServiceIds(activeSubscriptions = [], serviceTypes = []) {
  const ids = new Set();
  const byId = new Map((serviceTypes || []).map((st) => [String(st.id), st]));

  for (const sub of activeSubscriptions || []) {
    if (String(sub?.status || "").toLowerCase() !== "active") continue;
    const membershipId = String(sub?.service_type_id || "").trim();
    if (!membershipId) continue;
    ids.add(membershipId);

    const membership = byId.get(membershipId);
    for (const svc of servicesInMembership(membership, serviceTypes)) {
      ids.add(String(svc.id));
    }
  }

  return ids;
}
