/** Shared membership → treatment service helpers (mirrors src/lib/serviceTypeMembershipModel.js). */

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

export function isMembershipPlan(st) {
  if (!st || isMembershipChildService(st)) return false;
  return st.is_membership === true;
}

export function servicesInMembership(membership, allServiceTypes = []) {
  if (!membership) return [];

  const membershipId = String(membership.id || "").trim();
  const byIncluded = (membership.included_service_ids || [])
    .map((id) => allServiceTypes.find((st) => String(st.id) === String(id)))
    .filter(Boolean);

  const children =
    byIncluded.length > 0
      ? byIncluded
      : (allServiceTypes || []).filter(
          (st) =>
            membershipId &&
            String(st.legacy_parent_membership_id || "") === membershipId &&
            !isMembershipPlan(st)
        );

  return children.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

export function treatmentMenuServiceTypes(serviceTypes = [], activeServiceIds) {
  const active =
    activeServiceIds instanceof Set
      ? activeServiceIds
      : new Set((activeServiceIds || []).map((id) => String(id)));

  return (serviceTypes || []).filter((st) => {
    if (!active.has(String(st.id))) return false;
    if (isMembershipPlan(st)) return false;
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

/**
 * Resolve a patient-facing service label to a bookable treatment row covered by active MD subs.
 */
export function resolveBookableTreatmentService({
  serviceName,
  activeSubscriptions = [],
  serviceTypes = [],
}) {
  const label = String(serviceName || "").trim();
  if (!label) return null;

  const activeServiceIds = expandActiveServiceIds(activeSubscriptions, serviceTypes);
  const bookable = treatmentMenuServiceTypes(serviceTypes, activeServiceIds);
  const lower = label.toLowerCase();

  return (
    bookable.find((st) => serviceDisplayName(st, serviceTypes).toLowerCase() === lower) ||
    bookable.find((st) => String(st.name || "").trim().toLowerCase() === lower) ||
    null
  );
}
