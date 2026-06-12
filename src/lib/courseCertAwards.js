import {
  isMembershipPlan,
  serviceDisplayName,
  servicesInMembership,
} from "@/lib/serviceTypeMembershipModel";

export function dedupeCertAwards(awards = []) {
  const seen = new Set();
  return (awards || []).filter((cert) => {
    const key = String(cert?.service_type_id || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Internal MD-scope rows (one per treatment service). Not shown as the NOVI completion certificate. */
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

/** Certificate issued after a provider completes a scheduled NOVI class (manual admin issuance). */
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

export function normalizeTemplateCertFields(template, serviceTypes = []) {
  if (!template) return template;
  const linkedIds = template.linked_service_type_ids || [];
  const certifications_awarded = buildCertAwardsFromLinkedServices(linkedIds, serviceTypes);
  const certification_name = resolveCourseCompletionCertificateName(
    { ...template, certifications_awarded },
    serviceTypes
  );
  return {
    ...template,
    certifications_awarded,
    certification_name,
  };
}
