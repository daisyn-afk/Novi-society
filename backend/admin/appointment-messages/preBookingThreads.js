/** @typedef {{ providerId: string, patientId: string | null, legacy: boolean, isPreBooking: true }} PreThreadInfo */

/**
 * Per-patient pre-booking thread: pre:{providerId}:{patientId}
 * Legacy (all patients in one thread): pre-{providerId}
 */
export function buildPreBookingThreadId(providerId, patientId) {
  const pid = String(providerId || "").trim();
  const ptid = String(patientId || "").trim();
  if (!pid || !ptid) return null;
  return `pre:${pid}:${ptid}`;
}

export function isPreBookingThreadId(threadId) {
  const tid = String(threadId || "").trim();
  return tid.startsWith("pre:") || tid.startsWith("pre-");
}

/** @returns {PreThreadInfo | null} */
export function parsePreBookingThreadId(threadId) {
  const tid = String(threadId || "").trim();
  if (tid.startsWith("pre:")) {
    const rest = tid.slice(4);
    const sep = rest.indexOf(":");
    if (sep <= 0) return null;
    const providerId = rest.slice(0, sep).trim();
    const patientId = rest.slice(sep + 1).trim();
    if (!providerId || !patientId) return null;
    return { providerId, patientId, legacy: false, isPreBooking: true };
  }
  if (tid.startsWith("pre-")) {
    const providerId = tid.slice(4).trim();
    if (!providerId) return null;
    return { providerId, patientId: null, legacy: true, isPreBooking: true };
  }
  return null;
}

export function legacyPreBookingThreadId(providerId) {
  const pid = String(providerId || "").trim();
  return pid ? `pre-${pid}` : null;
}

export function providerPreBookingThreadLikePattern(providerId) {
  const pid = String(providerId || "").trim();
  return pid ? `pre:${pid}:%` : null;
}
