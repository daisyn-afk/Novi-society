/**
 * Client helpers for MD coverage UX. **Assignment** runs on the server:
 * `POST /functions/submitMdBoardCoverageAssignment` (`backend/admin/mdAssignmentService.js`).
 *
 * Priority: (1) service offerings `medical_director_service_offering`, (2) optional state licenses when
 * `MD_ASSIGNMENT_STATE_MATCHING=1`, (3) sequential round-robin per `service_type_id`, (4) dev-only pool
 * fallback when `MD_ASSIGNMENT_POOL_FALLBACK=1` on the API.
 */

/**
 * @returns {boolean} True if provider already has active or pending supervision with this MD **for this service**.
 */
export function providerAlreadyLinkedToMdForService(existingRelationships, medicalDirectorId, serviceTypeId) {
  const mid = String(medicalDirectorId || "");
  const st = String(serviceTypeId || "").trim();
  return (existingRelationships || []).some((r) => {
    if (String(r?.medical_director_id || "") !== mid) return false;
    const status = String(r?.status || "").toLowerCase();
    if (status !== "active" && status !== "pending") return false;
    const relSt = String(r?.service_type_id || "").trim();
    if (!st) return true;
    if (!relSt) return true;
    return relSt === st;
  });
}

/** @deprecated Prefer `providerAlreadyLinkedToMdForService` (per-service). */
export function providerAlreadyLinkedToMd(existingRelationships, medicalDirectorId) {
  const mid = String(medicalDirectorId || "");
  return (existingRelationships || []).some((r) => {
    if (String(r?.medical_director_id || "") !== mid) return false;
    const s = String(r?.status || "").toLowerCase();
    return s === "active" || s === "pending";
  });
}

export function buildMdAutoAssignmentSupervisionNote(serviceTypeName, serviceTypeId) {
  const label = String(serviceTypeName || serviceTypeId || "service").trim();
  return [
    "NOVI Board MD coverage (assignment engine).",
    `Coverage service: ${label}.`,
    "The provider does not choose a medical director; NOVI assigns using supported services and sequential round-robin.",
    "State-based rules can be enabled server-side (MD_ASSIGNMENT_STATE_MATCHING) once MD state data is populated.",
  ].join(" ");
}
