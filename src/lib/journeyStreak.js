import { format, parseISO, subDays } from "date-fns";

/** Consecutive calendar-day check-in streak ending today (or yesterday if not checked in today). */
export function calculateCheckinStreak(checkins = []) {
  if (!Array.isArray(checkins) || checkins.length === 0) return 0;

  const dates = new Set(
    checkins
      .map((c) => String(c?.date || "").trim())
      .filter(Boolean)
  );
  if (dates.size === 0) return 0;

  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

  let cursor;
  if (dates.has(today)) {
    cursor = new Date();
  } else if (dates.has(yesterday)) {
    cursor = subDays(new Date(), 1);
  } else {
    return 0;
  }

  let streak = 0;
  while (dates.has(format(cursor, "yyyy-MM-dd"))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

export function formatScanChartDate(scan) {
  const raw = scan?.scanned_at || scan?.date;
  if (!raw) return "";
  try {
    return format(parseISO(raw), "MMM d");
  } catch {
    return String(raw).slice(0, 10);
  }
}
