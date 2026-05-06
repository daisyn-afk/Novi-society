/** Seat counts on each `session_dates[]` entry: `max_seats` and `available_seats` (both required for a bookable date). */

/** Trim and drop blank/whitespace-only checkout values so we never persist `"   "` as course_date. */
export function normalizeCourseDateInput(value) {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toSessionDateKey(value);
  }
  const s = String(value).trim();
  return s || null;
}

export function toSessionDateKey(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Calendar date in UTC — matches PostgreSQL `date` / ISO `YYYY-MM-DD` strings.
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const head = s.includes("T") ? s.split("T")[0] : s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function parseSeatCount(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    if (t === "") return null;
    const n = Math.floor(Number(t));
    return Number.isFinite(n) ? n : null;
  }
  if (value === "") return null;
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : null;
}

/** Valid seat row: max ≥ 0, available ≥ 0, available ≤ max. */
function inferredMaxSeats(entry) {
  let max = parseSeatCount(entry?.max_seats);
  const avail = parseSeatCount(entry?.available_seats);
  if (max == null && avail != null && avail > 0) max = avail;
  return max;
}

/** Bounds for decrement/checkout; allows legacy rows with missing max_seats but positive available_seats. */
function seatBoundsForDecrement(entry) {
  const max = inferredMaxSeats(entry);
  let avail = parseSeatCount(entry?.available_seats);
  if (max == null || max < 0) return null;
  if (avail == null && max === 0) avail = 0;
  if (avail == null || avail < 0) return null;
  if (avail > max) return null;
  if (avail <= 0) return null;
  return { max, avail };
}

export function hasValidSessionSeatEntry(entry) {
  const max = inferredMaxSeats(entry);
  const avail = parseSeatCount(entry?.available_seats);
  if (max == null || max < 0) return false;
  if (avail == null || avail < 0) return false;
  if (avail > max) return false;
  return true;
}

export function effectiveAvailableSeats(entry) {
  if (!hasValidSessionSeatEntry(entry)) return null;
  const max = inferredMaxSeats(entry);
  const avail = parseSeatCount(entry.available_seats);
  return Math.min(max, avail);
}

/** Missing/invalid seat fields or zero available → treated as sold out (not selectable). */
export function isSessionDateEntrySoldOut(entry) {
  return !hasValidSessionSeatEntry(entry) || effectiveAvailableSeats(entry) <= 0;
}

/** Calendar keys for a row (some rows set `date`, others `session_date`, or both). */
export function sessionEntryCalendarKeys(entry) {
  const keys = new Set();
  if (entry?.date) {
    const k = toSessionDateKey(entry.date);
    if (k) keys.add(k);
  }
  if (entry?.session_date) {
    const k = toSessionDateKey(entry.session_date);
    if (k) keys.add(k);
  }
  return keys;
}

export function findSessionEntryByDate(sessionDates, courseDate) {
  if (!Array.isArray(sessionDates)) return null;
  const normalized = normalizeCourseDateInput(courseDate);
  if (!normalized) return null;
  const key = toSessionDateKey(normalized);
  if (!key) return null;
  return sessionDates.find((s) => sessionEntryCalendarKeys(s).has(key)) ?? null;
}

export function findSessionEntryForSelection(sessionDates, {
  courseDate,
  sessionId,
  startTime,
  endTime
} = {}) {
  if (!Array.isArray(sessionDates)) return null;
  const dateKey = toSessionDateKey(normalizeCourseDateInput(courseDate));
  if (!dateKey) return null;
  const sameDateRows = sessionDates.filter((s) => sessionEntryCalendarKeys(s).has(dateKey));
  if (sameDateRows.length === 0) return null;

  if (sessionId) {
    const matchBySessionId = sameDateRows.find((s) => String(s?.session_id || "") === String(sessionId));
    if (matchBySessionId) return matchBySessionId;
  }

  const hasTimeHint = typeof startTime === "string" || typeof endTime === "string";
  if (hasTimeHint) {
    const matchByTime = sameDateRows.find((s) => {
      const sameStart = String(s?.start_time || "") === String(startTime || "");
      const sameEnd = String(s?.end_time || "") === String(endTime || "");
      return sameStart && sameEnd;
    });
    if (matchByTime) return matchByTime;
  }

  const firstBookable = sameDateRows.find((s) => canDecrementSessionDateSeat(s));
  return firstBookable || sameDateRows[0];
}

/**
 * After payment, find the session_dates row to decrement.
 * Falls back to the only bookable row when the stored course_date key does not match (legacy / bad data).
 */
export function resolveDecrementTargetForPaidCourse(sessionDates, courseDateRaw) {
  if (!Array.isArray(sessionDates) || sessionDates.length === 0) return null;
  const normalizedInput = normalizeCourseDateInput(courseDateRaw);
  if (!normalizedInput) return null;

  const entry = findSessionEntryByDate(sessionDates, normalizedInput);
  if (entry && seatBoundsForDecrement(entry)) {
    return { entry, mapKey: normalizedInput };
  }

  const bookable = sessionDates.filter((e) => seatBoundsForDecrement(e));
  if (bookable.length === 1) {
    const only = bookable[0];
    const anchor = only.date ?? only.session_date;
    if (anchor) {
      // eslint-disable-next-line no-console
      console.warn("[sessionDateSeats] paid course: single bookable session used (course_date key mismatch)", {
        courseDateRaw,
        normalizedInput,
        sessionKeys: sessionDates.map((s) => [...sessionEntryCalendarKeys(s)].join("|")),
        anchorKey: toSessionDateKey(anchor)
      });
      return { entry: only, mapKey: anchor };
    }
  }

  return entry ? { entry, mapKey: normalizedInput } : null;
}

export function isUpcomingSessionDateEntry(entry, now = new Date()) {
  const raw = entry?.date || entry?.session_date;
  if (!raw) return false;
  const d = new Date(String(raw).split("T")[0] + "T12:00:00");
  if (Number.isNaN(d.getTime())) return false;
  const t = new Date(now);
  t.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d >= t;
}

export function getUpcomingSessionEntries(sessionDates, now = new Date()) {
  if (!Array.isArray(sessionDates)) return [];
  return sessionDates.filter((e) => isUpcomingSessionDateEntry(e, now));
}

export function legacyCourseLevelSoldOut(course) {
  if (course?.available_seats == null) return false;
  return Number(course.available_seats) <= 0;
}

export function isCourseFullySoldOut(course, now = new Date()) {
  const upcoming = getUpcomingSessionEntries(course?.session_dates, now);
  if (upcoming.length === 0) return legacyCourseLevelSoldOut(course);
  const anyBookable = upcoming.some((e) => hasValidSessionSeatEntry(e) && effectiveAvailableSeats(e) > 0);
  return !anyBookable;
}

export function isCourseDateSoldOut(course, courseDate, now = new Date()) {
  if (!courseDate) return legacyCourseLevelSoldOut(course);
  const entry = findSessionEntryByDate(course?.session_dates, courseDate);
  if (!entry) {
    const hasAnyDate =
      Array.isArray(course?.session_dates) &&
      course.session_dates.some((s) => s?.date || s?.session_date);
    return hasAnyDate ? true : legacyCourseLevelSoldOut(course);
  }
  return isSessionDateEntrySoldOut(entry);
}

/** True when this row has a known positive inventory (payment may consume one seat). */
export function canDecrementSessionDateSeat(entry) {
  return seatBoundsForDecrement(entry) != null;
}

export function decrementSessionDateSeatInArray(sessionDates, courseDate) {
  if (!Array.isArray(sessionDates) || courseDate == null || courseDate === "") return sessionDates;
  const norm = normalizeCourseDateInput(courseDate);
  const key = toSessionDateKey(norm ?? courseDate);
  if (!key) return sessionDates;
  return sessionDates.map((entry) => {
    if (!sessionEntryCalendarKeys(entry).has(key)) return entry;
    const bounds = seatBoundsForDecrement(entry);
    if (!bounds) return entry;
    const nextAvail = Math.max(0, bounds.avail - 1);
    return { ...entry, max_seats: bounds.max, available_seats: nextAvail };
  });
}

export function normalizeScheduledSessionDatesEntries(sessionDates, previousSessionDates) {
  const prevMap = new Map();
  const prevByDateMap = new Map();
  for (const p of previousSessionDates || []) {
    if (!p?.date) continue;
    const dateKey = toSessionDateKey(p.date);
    const k = `${p.session_id || ""}::${dateKey}`;
    prevMap.set(k, p);
    if (dateKey) {
      const arr = prevByDateMap.get(dateKey) || [];
      arr.push(p);
      prevByDateMap.set(dateKey, arr);
    }
  }
  return (sessionDates || []).map((entry) => {
    const maxSeats = parseSeatCount(entry?.max_seats);
    if (maxSeats == null || maxSeats < 0) {
      return { ...entry };
    }
    const entryDateKey = toSessionDateKey(entry.date);
    const k = `${entry.session_id || ""}::${entryDateKey}`;
    const exactPrev = prevMap.get(k);
    const sameDatePrevRows = (entryDateKey ? prevByDateMap.get(entryDateKey) : null) || [];
    const prev = exactPrev || (sameDatePrevRows.length === 1 ? sameDatePrevRows[0] : null);
    let available = parseSeatCount(entry?.available_seats);
    if (available == null) {
      if (prev && toSessionDateKey(prev.date) === toSessionDateKey(entry.date)) {
        const prevMax = parseSeatCount(prev.max_seats);
        const prevAvail = parseSeatCount(prev.available_seats);
        const prevAvailOrMax = prevAvail ?? prevMax;
        if (prevMax != null && maxSeats > prevMax) {
          available = (prevAvailOrMax ?? 0) + (maxSeats - prevMax);
        } else if (prevMax != null && maxSeats < prevMax) {
          available = Math.min(prevAvailOrMax ?? maxSeats, maxSeats);
        } else {
          available = prevAvailOrMax != null ? Math.min(maxSeats, prevAvailOrMax) : maxSeats;
        }
      } else {
        available = maxSeats;
      }
    }
    available = Math.max(0, Math.min(maxSeats, available));
    return { ...entry, max_seats: maxSeats, available_seats: available };
  });
}
