function isMembershipChildService(st) {
  return Boolean(String(st?.legacy_parent_membership_id || "").trim());
}

function isMembershipPlan(st) {
  if (!st || isMembershipChildService(st)) return false;
  return st.is_membership === true;
}

function serviceDisplayName(service, allServiceTypes = []) {
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

function servicesInMembership(membership, allServiceTypes = []) {
  if (!membership) return [];
  const ids = Array.isArray(membership.included_service_ids) ? membership.included_service_ids : [];
  return ids
    .map((id) => (allServiceTypes || []).find((st) => String(st.id) === String(id)))
    .filter(Boolean);
}

export function dedupeCertAwards(awards = []) {
  const seen = new Set();
  return (awards || []).filter((cert) => {
    const key = String(cert?.service_type_id || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildCertAwardsFromLinkedServices(linkedIds = [], serviceTypes = []) {
  const awards = [];
  for (const id of linkedIds || []) {
    const st = (serviceTypes || []).find((s) => String(s.id) === String(id));
    if (!st) continue;
    if (isMembershipPlan(st)) {
      for (const child of servicesInMembership(st, serviceTypes)) {
        const label = serviceDisplayName(child, serviceTypes);
        awards.push({
          service_type_id: child.id,
          service_type_name: child.name,
          cert_name: `${label} Certification`,
        });
      }
      continue;
    }
    awards.push({
      service_type_id: st.id,
      service_type_name: st.name,
      cert_name: `${serviceDisplayName(st, serviceTypes)} Certification`,
    });
  }
  return dedupeCertAwards(awards);
}

function isMembershipPlan(st) {
  if (!st || isMembershipChildService(st)) return false;
  return st.is_membership === true;
}

function servicesInMembership(membership, allServiceTypes = []) {
  if (!membership) return [];
  const ids = Array.isArray(membership.included_service_ids) ? membership.included_service_ids : [];
  return ids
    .map((id) => (allServiceTypes || []).find((st) => String(st.id) === String(id)))
    .filter(Boolean);
}

/** Certificate issued after a provider completes a scheduled NOVI class. */
export function resolveCourseCompletionCertificateName(template, serviceTypes = []) {
  const existing = String(template?.certification_name || "").trim();
  if (existing) return existing;

  const linkedIds = template?.linked_service_type_ids || [];
  const linked = linkedIds
    .map((id) => (serviceTypes || []).find((s) => String(s.id) === String(id)))
    .filter(Boolean);
  const memberships = linked.filter((st) => isMembershipPlan(st));

  if (memberships.length === 1) {
    return `${memberships[0].name} Certification`;
  }

  const title = String(template?.title || "").trim();
  if (title) return `${title} Certification`;

  return "Course Certification";
}

export function awardsMatchStored(derived = [], stored = []) {
  const key = (list) =>
    JSON.stringify(
      dedupeCertAwards(list)
        .map((c) => ({
          service_type_id: String(c.service_type_id || ""),
          service_type_name: c.service_type_name || null,
          cert_name: c.cert_name || null,
        }))
        .sort((a, b) => a.service_type_id.localeCompare(b.service_type_id))
    );
  return key(derived) === key(stored);
}
