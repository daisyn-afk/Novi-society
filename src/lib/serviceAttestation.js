import { isNoviIssuedCert } from "./certificationBuckets";
import { servicesInMembership, serviceDisplayName } from "./serviceTypeMembershipModel";

const ACTIVE_CERT_STATUSES = new Set(["active", "approved", "verified"]);

export function buildUnlockedCourseIds({ enrollments = [], sessions = [], courses = [] } = {}) {
  const courseMap = Object.fromEntries((courses || []).map((c) => [String(c.id), c]));
  const unlocked = new Set();

  for (const enrollment of enrollments || []) {
    if (!["completed", "attended"].includes(String(enrollment?.status || "").toLowerCase())) continue;
    const courseId = String(enrollment?.course_id || "").trim();
    if (courseId) unlocked.add(courseId);
  }

  for (const session of sessions || []) {
    const enrollmentKey = String(session?.enrollment_id || "");
    if (enrollmentKey.startsWith("class_date:")) continue;
    if (!session?.code_used) continue;
    const courseId = String(session?.course_id || "").trim();
    if (courseId) unlocked.add(courseId);
  }

  return { unlockedCourseIds: unlocked, courseMap };
}

export function buildProviderAttestationContext({
  certifications = [],
  enrollments = [],
  sessions = [],
  courses = [],
} = {}) {
  const { unlockedCourseIds, courseMap } = buildUnlockedCourseIds({ enrollments, sessions, courses });
  return {
    certifications: certifications || [],
    enrollments: enrollments || [],
    sessions: sessions || [],
    courses: courses || [],
    unlockedCourseIds,
    courseMap,
  };
}

function certsForService(serviceTypeId, certifications = []) {
  const sid = String(serviceTypeId || "");
  return (certifications || []).filter((c) => String(c?.service_type_id || "") === sid);
}

function hasActiveCert(serviceTypeId, certifications = []) {
  return certsForService(serviceTypeId, certifications).some((c) =>
    ACTIVE_CERT_STATUSES.has(String(c?.status || "").toLowerCase())
  );
}

function hasPendingCert(serviceTypeId, certifications = []) {
  return certsForService(serviceTypeId, certifications).some(
    (c) => String(c?.status || "").toLowerCase() === "pending"
  );
}

function hasNoviTrainingCert(serviceTypeId, certifications = []) {
  return certsForService(serviceTypeId, certifications).some((c) => isNoviIssuedCert(c));
}

function courseServiceTypeIds(course) {
  const linked = (course?.linked_service_type_ids || []).map(String).filter(Boolean);
  if (linked.length > 0) return linked;
  return (course?.certifications_awarded || [])
    .map((award) => String(award?.service_type_id || ""))
    .filter(Boolean);
}

/**
 * Course templates link to membership plans (Admin → Service Types), so a
 * completed course unlocks both the linked id itself and, when the linked id
 * is a membership, every service included in that membership.
 */
function hasCompletedCourseForService(serviceTypeId, context, allServiceTypes = []) {
  const sid = String(serviceTypeId || "");
  const membershipIdsIncludingService = (allServiceTypes || [])
    .filter((st) => st?.is_membership === true)
    .filter((m) => servicesInMembership(m, allServiceTypes).some((c) => String(c.id) === sid))
    .map((m) => String(m.id));
  const matchIds = new Set([sid, ...membershipIdsIncludingService]);

  for (const courseId of context.unlockedCourseIds || []) {
    const course = context.courseMap?.[courseId];
    if (courseServiceTypeIds(course).some((id) => matchIds.has(id))) return true;
  }
  return false;
}

function additionalCertMatches(service, cert) {
  const label = String(service?.additional_cert_label || "").trim().toLowerCase();
  if (!label) return true;
  const certName = String(cert?.certification_name || "").trim().toLowerCase();
  return certName.includes(label) || label.includes(certName);
}

function evaluateTrainingRequirement(service, context, allServiceTypes = []) {
  if (service?.requires_novi_course !== true) {
    return { required: false, met: true, pending: false };
  }

  if (hasNoviTrainingCert(service.id, context.certifications)) {
    return { required: true, met: true, pending: false, via: "novi_cert" };
  }
  if (hasCompletedCourseForService(service.id, context, allServiceTypes)) {
    return { required: true, met: true, pending: false, via: "course" };
  }
  if (service.allow_external_cert === true) {
    if (hasActiveCert(service.id, context.certifications)) {
      return { required: true, met: true, pending: false, via: "external_cert" };
    }
    if (hasPendingCert(service.id, context.certifications)) {
      return { required: true, met: false, pending: true, via: "external_cert" };
    }
    return { required: true, met: false, pending: false, needsExternalCert: true };
  }

  if (hasPendingCert(service.id, context.certifications)) {
    return { required: true, met: false, pending: true };
  }

  return { required: true, met: false, pending: false, needsNoviCourse: true };
}

function evaluateAdditionalCertRequirement(service, context) {
  if (service?.requires_additional_provider_cert !== true) {
    return { required: false, met: true, pending: false, label: "" };
  }

  const label = String(service.additional_cert_label || "").trim();
  const active = certsForService(service.id, context.certifications).filter((c) =>
    ACTIVE_CERT_STATUSES.has(String(c?.status || "").toLowerCase())
  );
  if (active.some((c) => additionalCertMatches(service, c))) {
    return { required: true, met: true, pending: false, label };
  }

  const pending = certsForService(service.id, context.certifications).some(
    (c) => String(c?.status || "").toLowerCase() === "pending"
  );
  if (pending) {
    return { required: true, met: false, pending: true, label };
  }

  return { required: true, met: false, pending: false, label, needsUpload: true };
}

/**
 * Evaluate admin-configured attestation requirements for one treatment service.
 */
export function evaluateServiceAttestation(serviceType, context, allServiceTypes = []) {
  const service = serviceType || {};
  const training = evaluateTrainingRequirement(service, context, allServiceTypes);
  const additionalCert = evaluateAdditionalCertRequirement(service, context);
  const complete = training.met && additionalCert.met;
  const pending = (training.pending || additionalCert.pending) && !complete;

  const nextSteps = [];
  if (!training.met) {
    if (training.pending) {
      nextSteps.push({
        action: "wait_review",
        label: "Certification under review",
        description: "Your submitted certification is pending admin approval.",
      });
    } else if (training.needsExternalCert && service.allow_external_cert) {
      nextSteps.push({
        action: "submit_external_cert",
        label: "Submit external certification",
        description: "Upload your prior certification for admin review.",
      });
    } else {
      nextSteps.push({
        action: "complete_novi_course",
        label: "Complete a NOVI course",
        description: "Enroll in a linked NOVI course and redeem your class attendance code.",
      });
      if (service.allow_external_cert) {
        nextSteps.push({
          action: "submit_external_cert",
          label: "Or submit external certification",
          description: "Upload a certification from another program for admin review.",
        });
      }
    }
  }
  if (!additionalCert.met) {
    if (additionalCert.pending) {
      nextSteps.push({
        action: "wait_review",
        label: additionalCert.label
          ? `${additionalCert.label} under review`
          : "Certificate upload under review",
        description: "Your uploaded certificate is pending admin verification.",
      });
    } else {
      nextSteps.push({
        action: "upload_additional_cert",
        label: additionalCert.label
          ? `Upload ${additionalCert.label}`
          : "Upload required certificate",
        description: "Upload the required certificate for admin verification.",
      });
    }
  }

  let status = "complete";
  if (!complete) {
    if (pending) status = "pending_review";
    else if (additionalCert.needsUpload) status = "needs_additional_cert";
    else if (training.needsExternalCert) status = "needs_external_cert";
    else status = "needs_novi_course";
  }

  return {
    serviceTypeId: String(service.id || ""),
    serviceName: serviceDisplayName(service, allServiceTypes),
    complete,
    pending,
    status,
    requirements: { training, additionalCert },
    nextSteps,
  };
}

export function membershipAttestationSummary(membership, serviceTypes = [], context) {
  const children = servicesInMembership(membership, serviceTypes);
  const services = children.map((st) => evaluateServiceAttestation(st, context, serviceTypes));
  return {
    membershipId: String(membership?.id || ""),
    membershipName: String(membership?.name || ""),
    services,
    complete: services.length > 0 && services.every((s) => s.complete),
    pendingCount: services.filter((s) => s.pending).length,
    incompleteCount: services.filter((s) => !s.complete).length,
  };
}

export function isMembershipReadyForMdApply(membership, serviceTypes = [], context) {
  const children = servicesInMembership(membership, serviceTypes);
  if (!children.length) {
    // No included services configured — require direct training/cert proof
    // for this plan so providers only activate coverage they qualified for.
    return (
      hasCompletedCourseForService(membership?.id, context, serviceTypes) ||
      hasNoviTrainingCert(membership?.id, context?.certifications) ||
      hasActiveCert(membership?.id, context?.certifications)
    );
  }
  return membershipAttestationSummary(membership, serviceTypes, context).complete;
}

/** Individual treatment services a provider may submit external / additional certs for. */
export function attestableIndividualServices(serviceTypes = [], context, { excludeServiceIds = [] } = {}) {
  const excluded = new Set((excludeServiceIds || []).map(String));
  return (serviceTypes || [])
    .filter((st) => st.is_membership !== true && st.is_active !== false)
    .filter((st) => !excluded.has(String(st.id)))
    .map((st) => evaluateServiceAttestation(st, context, serviceTypes))
    .filter((row) => !row.complete);
}

export function isServicePracticable(serviceType, context, allServiceTypes = []) {
  return evaluateServiceAttestation(serviceType, context, allServiceTypes).complete;
}

export function filterPracticableServices(serviceTypes = [], activeServiceIds, context) {
  const active =
    activeServiceIds instanceof Set
      ? activeServiceIds
      : new Set((activeServiceIds || []).map((id) => String(id)));

  return (serviceTypes || []).filter((st) => {
    if (!active.has(String(st.id))) return false;
    if (st.is_membership === true) return false;
    if (st.is_active === false) return false;
    return isServicePracticable(st, context, serviceTypes);
  });
}
