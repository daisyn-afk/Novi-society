import { query } from "../db.js";
import { servicesInMembership } from "./serviceTypeMembershipModel.js";

const ACTIVE_CERT_STATUSES = new Set(["active", "approved", "verified"]);

function isNoviIssuedCert(cert) {
  const status = String(cert?.status || "").toLowerCase();
  if (status !== "active") return false;
  if (cert?.enrollment_id) return true;
  const certificateNumber = String(cert?.certificate_number || cert?.cert_number || "");
  if (certificateNumber.startsWith("NOVI-EXT-")) return false;
  const url = String(cert?.certificate_url || "").trim();
  return certificateNumber.startsWith("NOVI-") && Boolean(url && url !== "/N/A");
}

function buildUnlockedCourseIds({ enrollments = [], sessions = [], courses = [] } = {}) {
  const courseMap = Object.fromEntries((courses || []).map((c) => [String(c.id), c]));
  const unlocked = new Set();

  for (const enrollment of enrollments || []) {
    if (!["completed", "attended"].includes(String(enrollment?.status || "").toLowerCase())) continue;
    const courseId = String(enrollment?.course_id || "").trim();
    if (courseId) unlocked.add(courseId);
  }

  for (const session of sessions || []) {
    if (!session?.code_used) continue;
    const enrollmentKey = String(session?.enrollment_id || "");
    const classDateParts = enrollmentKey.startsWith("class_date:") ? enrollmentKey.split(":") : [];
    const courseId = String(
      session?.course_id || (classDateParts.length >= 3 ? classDateParts[1] : "") || ""
    ).trim();
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

function hasCompletedCourseForService(serviceTypeId, context) {
  const sid = String(serviceTypeId || "");
  for (const courseId of context.unlockedCourseIds || []) {
    const course = context.courseMap?.[courseId];
    const linked = (course?.linked_service_type_ids || []).map(String);
    if (linked.includes(sid)) return true;
  }
  return false;
}

function additionalCertMatches(service, cert) {
  const label = String(service?.additional_cert_label || "").trim().toLowerCase();
  if (!label) return true;
  const certName = String(cert?.certification_name || "").trim().toLowerCase();
  return certName.includes(label) || label.includes(certName);
}

function evaluateTrainingRequirement(service, context) {
  if (service?.requires_novi_course !== true) {
    return { required: false, met: true, pending: false };
  }

  if (hasNoviTrainingCert(service.id, context.certifications)) {
    return { required: true, met: true, pending: false };
  }
  if (hasCompletedCourseForService(service.id, context)) {
    return { required: true, met: true, pending: false };
  }
  if (service.allow_external_cert === true) {
    if (hasActiveCert(service.id, context.certifications)) {
      return { required: true, met: true, pending: false };
    }
    if (hasPendingCert(service.id, context.certifications)) {
      return { required: true, met: false, pending: true };
    }
    return { required: true, met: false, pending: false };
  }
  if (hasPendingCert(service.id, context.certifications)) {
    return { required: true, met: false, pending: true };
  }
  return { required: true, met: false, pending: false };
}

function evaluateAdditionalCertRequirement(service, context) {
  if (service?.requires_additional_provider_cert !== true) {
    return { required: false, met: true, pending: false };
  }

  const active = certsForService(service.id, context.certifications).filter((c) =>
    ACTIVE_CERT_STATUSES.has(String(c?.status || "").toLowerCase())
  );
  if (active.some((c) => additionalCertMatches(service, c))) {
    return { required: true, met: true, pending: false };
  }
  const pending = certsForService(service.id, context.certifications).some(
    (c) => String(c?.status || "").toLowerCase() === "pending"
  );
  if (pending) return { required: true, met: false, pending: true };
  return { required: true, met: false, pending: false };
}

export function evaluateServiceAttestation(serviceType, context) {
  const service = serviceType || {};
  const training = evaluateTrainingRequirement(service, context);
  const additionalCert = evaluateAdditionalCertRequirement(service, context);
  const complete = training.met && additionalCert.met;
  const pending = (training.pending || additionalCert.pending) && !complete;

  const nextSteps = [];
  if (!training.met) {
    if (training.pending) {
      nextSteps.push({ description: "Your submitted certification is pending admin approval." });
    } else if (service.allow_external_cert) {
      nextSteps.push({ description: "Complete NOVI training or submit an external certification for review." });
    } else {
      nextSteps.push({ description: "Complete the required NOVI course and redeem your class code." });
    }
  }
  if (!additionalCert.met) {
    if (additionalCert.pending) {
      nextSteps.push({ description: "Your uploaded certificate is pending admin verification." });
    } else {
      nextSteps.push({
        description: service.additional_cert_label
          ? `Upload ${service.additional_cert_label} for admin verification.`
          : "Upload the required certificate for admin verification.",
      });
    }
  }

  return { serviceTypeId: String(service.id || ""), complete, pending, requirements: { training, additionalCert }, nextSteps };
}

export function isServicePracticable(serviceType, context) {
  return evaluateServiceAttestation(serviceType, context).complete;
}

async function loadProviderAttestationRows(providerId) {
  const pid = String(providerId || "").trim();
  if (!pid) return buildProviderAttestationContext({});

  const [{ rows: certRows }, { rows: enrollmentRows }, { rows: sessionRows }, { rows: courseRows }] =
    await Promise.all([
      query(
        `select id, service_type_id, status, enrollment_id, certification_name,
                certificate_url, certificate_number, cert_number
           from public.certification
          where provider_id = $1`,
        [pid]
      ).catch(() => ({ rows: [] })),
      query(
        `select id, course_id, status, session_date
           from public.course_enrollment
          where provider_id = $1`,
        [pid]
      ).catch(() => ({ rows: [] })),
      query(
        `select id, course_id, enrollment_id, code_used
           from public.attendance_session
          where provider_id = $1`,
        [pid]
      ).catch(() => ({ rows: [] })),
      query(`select id, linked_service_type_ids from public.course`).catch(() => ({ rows: [] })),
    ]);

  return buildProviderAttestationContext({
    certifications: certRows,
    enrollments: enrollmentRows,
    sessions: sessionRows,
    courses: courseRows.map((row) => ({
      ...row,
      linked_service_type_ids: Array.isArray(row.linked_service_type_ids)
        ? row.linked_service_type_ids
        : [],
    })),
  });
}

async function loadServiceTypeRow(serviceTypeId) {
  const { rows } = await query(
    `select id, name, requires_novi_course, allow_external_cert,
            requires_additional_provider_cert, additional_cert_label, is_membership, is_active
       from public.service_type
      where id = $1
      limit 1`,
    [String(serviceTypeId)]
  );
  return rows[0] || null;
}

export async function assertProviderCanPracticeService({ providerId, serviceTypeId }) {
  const service = await loadServiceTypeRow(serviceTypeId);
  if (!service || service.is_membership === true) return { ok: true };

  const context = await loadProviderAttestationRows(providerId);
  const evaluation = evaluateServiceAttestation(service, context);
  if (evaluation.complete) return { ok: true, evaluation };

  const step = evaluation.nextSteps[0];
  return {
    ok: false,
    evaluation,
    reason:
      step?.description ||
      "Complete the required training or certification steps before offering this service.",
  };
}

export async function loadProviderAttestationContext(providerId) {
  return loadProviderAttestationRows(providerId);
}

async function loadAllServiceTypes() {
  const { rows } = await query(
    `select id, name, requires_novi_course, allow_external_cert,
            requires_additional_provider_cert, additional_cert_label,
            included_service_ids, legacy_parent_membership_id,
            is_membership, is_active
       from public.service_type`
  );
  return rows.map((row) => ({
    ...row,
    included_service_ids: Array.isArray(row.included_service_ids) ? row.included_service_ids : [],
  }));
}

export async function assertMembershipAttestationComplete({ providerId, membershipServiceTypeId }) {
  const membershipId = String(membershipServiceTypeId || "").trim();
  if (!membershipId) return { ok: true };

  const serviceTypes = await loadAllServiceTypes();
  const membership = serviceTypes.find((st) => String(st.id) === membershipId);
  if (!membership) return { ok: true };

  const children = servicesInMembership(membership, serviceTypes);
  if (!children.length) return { ok: true };

  const context = await loadProviderAttestationRows(providerId);
  const incomplete = children
    .map((st) => ({ service: st, evaluation: evaluateServiceAttestation(st, context) }))
    .filter(({ evaluation }) => !evaluation.complete);

  if (!incomplete.length) return { ok: true };

  const names = incomplete.map(({ service }) => String(service.name || "").trim()).filter(Boolean);
  return {
    ok: false,
    error:
      names.length === 1
        ? `Complete required training or certification for ${names[0]} before activating MD coverage.`
        : `Complete required training or certification for all included services (${names.join(", ")}) before activating MD coverage.`,
    incomplete,
  };
}
