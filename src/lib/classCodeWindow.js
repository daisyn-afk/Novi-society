export function parseClassDateTime(date, time, fallbackHour = 0, fallbackMinute = 0) {
  if (!date) return null;
  const normalizedTime = typeof time === "string" && time.trim() ? time.trim() : null;
  const [hhRaw, mmRaw] = normalizedTime ? normalizedTime.split(":") : [];
  const hh = Number.isFinite(Number(hhRaw)) ? Number(hhRaw) : fallbackHour;
  const mm = Number.isFinite(Number(mmRaw)) ? Number(mmRaw) : fallbackMinute;
  return new Date(`${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`);
}

export function getSessionWindowForDate(course, sessionDate) {
  if (!sessionDate) return null;
  const sessionConfig = Array.isArray(course?.session_dates)
    ? course.session_dates.find((d) => d?.date === sessionDate)
    : null;

  const startAt = parseClassDateTime(sessionDate, sessionConfig?.start_time, 0, 0);
  const endAt = parseClassDateTime(sessionDate, sessionConfig?.end_time, 23, 59);
  if (!startAt || !endAt) return null;

  const expiresAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
  return { startAt, endAt, expiresAt };
}

export function isNowWithinSessionRedeemWindow(course, sessionDate, now = new Date()) {
  const window = getSessionWindowForDate(course, sessionDate);
  if (!window) return false;
  return now >= window.startAt && now <= window.expiresAt;
}
