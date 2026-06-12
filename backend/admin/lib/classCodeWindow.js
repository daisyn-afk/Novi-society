/** Admins schedule class start/end in US Eastern (handles daylight saving). */
export const ADMIN_CLASS_TIME_ZONE = "America/New_York";

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

export function parseClassDateTime(dateValue, timeValue, fallbackHour, fallbackMinute, timeZone = ADMIN_CLASS_TIME_ZONE) {
  if (!dateValue) return null;
  const date = String(dateValue).slice(0, 10);
  const time = String(timeValue || "").trim();
  const [hhRaw, mmRaw] = time.split(":");
  const hh = Number.isFinite(Number(hhRaw)) ? Number(hhRaw) : fallbackHour;
  const mm = Number.isFinite(Number(mmRaw)) ? Number(mmRaw) : fallbackMinute;
  return zonedDateTimeToUtc(date, hh, mm, timeZone);
}

export function toDateOnly(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return raw.slice(0, 10);
}

export function isWithinRedeemWindow(sessionDate, sessionDates) {
  const dateOnly = toDateOnly(sessionDate);
  if (!dateOnly) return { ok: false, startAt: null, endAt: null, expiresAt: null, now: new Date() };
  const config = Array.isArray(sessionDates)
    ? sessionDates.find((entry) => toDateOnly(entry?.date) === dateOnly)
    : null;
  const startAt = parseClassDateTime(dateOnly, config?.start_time, 0, 0, ADMIN_CLASS_TIME_ZONE);
  const endAt = parseClassDateTime(dateOnly, config?.end_time, 23, 59, ADMIN_CLASS_TIME_ZONE);
  if (!startAt || !endAt) return { ok: false, startAt: null, endAt: null, expiresAt: null, now: new Date() };
  const expiresAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
  const now = new Date();
  return { ok: now >= startAt && now <= expiresAt, startAt, endAt, expiresAt, now };
}
