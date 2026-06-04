/** Seat counts on each `session_dates[]` entry — mirrors backend/admin/lib/sessionDateSeats.js */

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

/** Parse JSONB/string session_dates from API (Vercel/pg may return a string). */
export function parseSessionDatesField(raw) {
  if (Array.isArray(raw)) return raw.map(coerceSessionDateSeatFields);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(coerceSessionDateSeatFields) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function coerceSessionDateSeatFields(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const max = parseSeatCount(entry.max_seats);
  const avail = parseSeatCount(entry.available_seats);
  return {
    ...entry,
    ...(max != null ? { max_seats: max } : {}),
    ...(avail != null ? { available_seats: avail } : {}),
  };
}

/** Mirrors backend resolveAvailableSeatsForSessionEntry. */
export function resolveAvailableSeatsForSessionEntry(entry, enrolled = 0) {
  const max = inferredMaxSeats(entry);
  if (max == null || max < 0) return entry;
  const safeEnrolled = Math.max(0, Number(enrolled) || 0);
  let available;
  if (safeEnrolled > 0) {
    available = Math.max(0, max - safeEnrolled);
  } else {
    const stored = parseSeatCount(entry?.available_seats);
    available = stored != null ? Math.min(max, Math.max(0, stored)) : max;
  }
  return { ...entry, max_seats: max, available_seats: available };
}

export function reconcileSessionDatesWithEnrollmentCounts(sessionDates, countsByDateKey) {
  if (!Array.isArray(sessionDates)) return sessionDates;
  const counts = countsByDateKey || new Map();
  return sessionDates.map((entry) => {
    const keys = [...sessionEntryCalendarKeys(entry)];
    let enrolled = 0;
    for (const k of keys) {
      enrolled = Math.max(enrolled, Number(counts.get(k) || 0));
    }
    return resolveAvailableSeatsForSessionEntry(entry, enrolled);
  });
}

/** Aligns seat fields on each session date (must match backend/admin/lib/sessionDateSeats.js). */
export function normalizeScheduledSessionDatesEntries(sessionDates, previousSessionDates) {
  const prevMap = new Map();
  const prevByDateMap = new Map();
  for (const p of previousSessionDates || []) {
    if (!p?.date && !p?.session_date) continue;
    const dateKey = toSessionDateKey(p.date || p.session_date);
    const k = `${p.session_id || ""}::${dateKey}`;
    prevMap.set(k, p);
    if (dateKey) {
      const arr = prevByDateMap.get(dateKey) || [];
      arr.push(p);
      prevByDateMap.set(dateKey, arr);
    }
  }
  return (sessionDates || []).map((entry) => {
    let maxSeats = parseSeatCount(entry?.max_seats);
    const availOnly = parseSeatCount(entry?.available_seats);
    if (maxSeats == null || maxSeats < 0) {
      if (availOnly != null && availOnly >= 0) {
        maxSeats = Math.max(availOnly, 1);
        return { ...entry, max_seats: maxSeats, available_seats: Math.min(maxSeats, availOnly) };
      }
      return { ...entry };
    }
    const entryDateKey = toSessionDateKey(entry.date || entry.session_date);
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

function inferredMaxSeats(entry) {
  let max = parseSeatCount(entry?.max_seats);
  const avail = parseSeatCount(entry?.available_seats);
  if (max == null && avail != null && avail > 0) max = avail;
  return max;
}

/** Bookable inventory for a session row (mirrors backend seatBoundsForDecrement). */
export function sessionSeatBoundsForBooking(entry) {
  let max = inferredMaxSeats(entry);
  let avail = parseSeatCount(entry?.available_seats);

  // Legacy/production rows saved before per-date seat fields were required.
  if (max == null) {
    if (avail != null && avail > 0) {
      max = Math.max(avail, 1);
    } else if (avail === 0) {
      return null;
    } else {
      return { max: 1, avail: 1 };
    }
  }

  if (max < 0) return null;
  if (avail == null) avail = max;
  if (avail < 0) return null;
  if (avail > max) return null;
  if (avail <= 0) return null;
  return { max, avail };
}

export function hasValidSessionSeatEntry(entry) {
  return sessionSeatBoundsForBooking(entry) != null;
}

export function effectiveAvailableSeats(entry) {
  const bounds = sessionSeatBoundsForBooking(entry);
  return bounds ? bounds.avail : null;
}

export function isSessionDateEntrySoldOut(entry) {
  return sessionSeatBoundsForBooking(entry) == null;
}

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
  const anyBookable = upcoming.some((e) => sessionSeatBoundsForBooking(e) != null);
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

export function formatMinAvailableSeatsLabel(course) {
  const sessions = Array.isArray(course?.session_dates) ? course.session_dates : [];
  const upcoming = getUpcomingSessionEntries(sessions).sort((a, b) => {
    const da = new Date(String(a?.date || a?.session_date || "").split("T")[0] + "T12:00:00");
    const db = new Date(String(b?.date || b?.session_date || "").split("T")[0] + "T12:00:00");
    return da.getTime() - db.getTime();
  });
  const valid = upcoming.filter(hasValidSessionSeatEntry);
  if (valid.length > 0) {
    const avail = effectiveAvailableSeats(valid[0]);
    return `${avail} seat${avail === 1 ? "" : "s"} left`;
  }
  // Scheduled per-date inventory exists but nothing upcoming — don't show stale course-level seats.
  if (sessions.some((e) => hasValidSessionSeatEntry(e))) return null;
  if (course?.available_seats != null) return `${course.available_seats} seats left`;
  return null;
}

export function sessionDateSeatsSummaryForEnrollment(course, sessionDate) {
  const entry = sessionDate ? findSessionEntryByDate(course?.session_dates, sessionDate) : null;
  if (entry && hasValidSessionSeatEntry(entry)) {
    return `${effectiveAvailableSeats(entry)} / ${parseSeatCount(entry.max_seats)} seats`;
  }
  if (course?.max_seats) {
    return `${course.available_seats ?? 0} seats left`;
  }
  return null;
}

/** Compact seats label for pathway cards, e.g. "12 left". */
export function formatSeatsLeftForEnrollment(course, sessionDate) {
  const entry = sessionDate ? findSessionEntryByDate(course?.session_dates, sessionDate) : null;
  if (entry && hasValidSessionSeatEntry(entry)) {
    return `${effectiveAvailableSeats(entry)} left`;
  }
  const fallback = formatMinAvailableSeatsLabel(course);
  if (!fallback) return null;
  return fallback.replace(/\s*seats?\s*left/i, " left");
}

export function todaySessionDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isSessionDateBeforeToday(dateValue) {
  const key = toSessionDateKey(dateValue);
  if (!key) return false;
  return key < todaySessionDateKey();
}

export function sessionDateEntryIdentity(entry) {
  return `${entry?.session_id || ""}|${toSessionDateKey(entry?.date || entry?.session_date) || ""}|${entry?.start_time || ""}|${String(entry?.location || "").trim()}`;
}

export function isDisallowedPastSessionDate(entry, previousSessionDates) {
  if (!isSessionDateBeforeToday(entry?.date || entry?.session_date)) return false;
  const prev = new Set((previousSessionDates || []).map(sessionDateEntryIdentity));
  return !prev.has(sessionDateEntryIdentity(entry));
}
