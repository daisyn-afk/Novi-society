import { timeZoneLabel } from "@/lib/providerTimezone";

/** Admins schedule class start/end in US Eastern (handles daylight saving). */
export const ADMIN_CLASS_TIME_ZONE = "America/New_York";

/** @deprecated use ADMIN_CLASS_TIME_ZONE */
export const CLASS_TIME_ZONE = ADMIN_CLASS_TIME_ZONE;

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

export function zonedDateTimeToUtc(dateString, hour, minute, timeZone) {
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

export function parseClassDateTime(date, time, fallbackHour = 0, fallbackMinute = 0, timeZone = ADMIN_CLASS_TIME_ZONE) {
  if (!date) return null;
  const normalizedTime = typeof time === "string" && time.trim() ? time.trim() : null;
  const [hhRaw, mmRaw] = normalizedTime ? normalizedTime.split(":") : [];
  const hh = Number.isFinite(Number(hhRaw)) ? Number(hhRaw) : fallbackHour;
  const mm = Number.isFinite(Number(mmRaw)) ? Number(mmRaw) : fallbackMinute;
  return zonedDateTimeToUtc(date, hh, mm, timeZone);
}

export function getSessionWindowForDate(course, sessionDate) {
  if (!sessionDate) return null;
  const sessionConfig = Array.isArray(course?.session_dates)
    ? course.session_dates.find((d) => String(d?.date || "").slice(0, 10) === String(sessionDate).slice(0, 10))
    : null;

  const startAt = parseClassDateTime(sessionDate, sessionConfig?.start_time, 0, 0, ADMIN_CLASS_TIME_ZONE);
  const endAt = parseClassDateTime(sessionDate, sessionConfig?.end_time, 23, 59, ADMIN_CLASS_TIME_ZONE);
  if (!startAt || !endAt) return null;

  const expiresAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
  return { startAt, endAt, expiresAt, sessionConfig };
}

export function isNowWithinSessionRedeemWindow(course, sessionDate, now = new Date()) {
  const window = getSessionWindowForDate(course, sessionDate);
  if (!window) return false;
  return now >= window.startAt && now <= window.expiresAt;
}

export function formatInstantForZone(dateValue, timeZone, options = {}) {
  if (!dateValue) return "";
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  }).format(date);
}

/** Provider-facing labels: admin US Eastern schedule converted to provider local time. */
export function describeSessionWindowForProvider(course, sessionDate, providerTimeZone) {
  const window = getSessionWindowForDate(course, sessionDate);
  if (!window) return null;

  const providerTz = providerTimeZone || ADMIN_CLASS_TIME_ZONE;
  return {
    ...window,
    providerTimeZone: providerTz,
    adminTimeZone: ADMIN_CLASS_TIME_ZONE,
    startLabelProvider: formatInstantForZone(window.startAt, providerTz),
    endLabelProvider: formatInstantForZone(window.endAt, providerTz),
    expiresLabelProvider: formatInstantForZone(window.expiresAt, providerTz),
    startLabelAdmin: formatInstantForZone(window.startAt, ADMIN_CLASS_TIME_ZONE),
    endLabelAdmin: formatInstantForZone(window.endAt, ADMIN_CLASS_TIME_ZONE),
    providerZoneLabel: timeZoneLabel(providerTz),
    adminZoneLabel: timeZoneLabel(ADMIN_CLASS_TIME_ZONE),
  };
}

export function formatProviderWindowRange(display) {
  if (!display) return "";
  return `${display.startLabelProvider} – ${display.expiresLabelProvider} (${display.providerZoneLabel})`;
}
