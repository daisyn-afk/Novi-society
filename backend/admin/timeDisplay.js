/** Shared 12-hour clock formatting for emails and server-rendered labels. */

export function formatDisplayTime(timeValue) {
  if (timeValue == null || timeValue === "") return "";
  const raw = String(timeValue).trim();
  const [hRaw, mRaw] = raw.slice(0, 5).split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return raw;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatTimeRange(startTime, endTime, separator = " – ") {
  const start = formatDisplayTime(startTime);
  const end = formatDisplayTime(endTime);
  if (start && end) return `${start}${separator}${end}`;
  return start || end || "";
}

export function formatSessionScheduleLine({ start_time, end_time, location } = {}) {
  const time = formatTimeRange(start_time, end_time);
  if (!time && !location) return "";
  if (!time) return String(location || "");
  if (!location) return time;
  return `${time} · ${location}`;
}
