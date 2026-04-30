// Fixed EST (UTC-5), no daylight-saving shifts.
export const CLASS_TIME_ZONE = "Etc/GMT+5";

function getPartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function zonedDateTimeToUtc(dateString, hour, minute, timeZone) {
  const [yearRaw, monthRaw, dayRaw] = String(dateString || "").slice(0, 10).split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!year || !month || !day) return null;

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const tzParts = getPartsInTimeZone(utcGuess, timeZone);
  const asIfUtc = Date.UTC(
    tzParts.year,
    tzParts.month - 1,
    tzParts.day,
    tzParts.hour,
    tzParts.minute,
    tzParts.second
  );
  const offsetMs = asIfUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

export function parseClassDateTime(date, time, fallbackHour = 0, fallbackMinute = 0) {
  if (!date) return null;
  const normalizedTime = typeof time === "string" && time.trim() ? time.trim() : null;
  const [hhRaw, mmRaw] = normalizedTime ? normalizedTime.split(":") : [];
  const hh = Number.isFinite(Number(hhRaw)) ? Number(hhRaw) : fallbackHour;
  const mm = Number.isFinite(Number(mmRaw)) ? Number(mmRaw) : fallbackMinute;
  return zonedDateTimeToUtc(date, hh, mm, CLASS_TIME_ZONE);
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
