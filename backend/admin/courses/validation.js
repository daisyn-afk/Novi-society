import {
  normalizeScheduledSessionDatesEntries,
  parseSeatCount,
  toSessionDateKey
} from "../lib/sessionDateSeats.js";

const COURSE_TYPES = ["template", "scheduled"];
const COURSE_CATEGORIES = [
  "botox",
  "fillers",
  "prp",
  "laser",
  "chemical_peel",
  "microneedling",
  "kybella",
  "skincare",
  "other"
];
const COURSE_LEVELS = ["beginner", "intermediate", "advanced"];

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function parseNullableNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function validateCourseInput(input, { partial = false, previousSessionDates } = {}) {
  const data = { ...input };
  const errors = [];

  if (!partial || data.title !== undefined) {
    if (!data.title || !String(data.title).trim()) {
      errors.push("title is required");
    }
  }

  if (!partial || data.type !== undefined) {
    if (!COURSE_TYPES.includes(data.type)) {
      errors.push("type must be template or scheduled");
    }
  }

  const resolvedType = data.type;
  let normalizedSessionDates = ensureArray(data.session_dates);

  if ((!partial && resolvedType === "scheduled") || (partial && data.type === "scheduled")) {
    if (!data.template_id) {
      errors.push("template_id is required when type is scheduled");
    }
    if (!Array.isArray(data.session_dates) || data.session_dates.length === 0) {
      errors.push("session_dates must include at least one date when type is scheduled");
    }
    normalizedSessionDates = normalizeScheduledSessionDatesEntries(
      ensureArray(data.session_dates),
      previousSessionDates
    );
    for (const entry of normalizedSessionDates) {
      if (!toSessionDateKey(entry?.date)) {
        errors.push("each session_dates entry must have a valid date");
        break;
      }
      if (!String(entry.location || "").trim()) {
        errors.push("each session date requires location");
        break;
      }
      const max = parseSeatCount(entry.max_seats);
      const avail = parseSeatCount(entry.available_seats);
      if (max == null || max < 0) {
        errors.push("each session date requires max_seats (minimum 0)");
        break;
      }
      if (avail == null || avail < 0) {
        errors.push("each session date requires available_seats (minimum 0)");
        break;
      }
      if (avail > max) {
        errors.push("available_seats cannot be greater than max_seats for any session date");
        break;
      }
    }
  }

  if (data.category !== undefined && data.category !== null && !COURSE_CATEGORIES.includes(data.category)) {
    errors.push("invalid category");
  }

  if (data.level !== undefined && data.level !== null && !COURSE_LEVELS.includes(data.level)) {
    errors.push("invalid level");
  }

  const maxSeats = parseNullableNumber(data.max_seats);
  const availableSeats = parseNullableNumber(data.available_seats);
  if (resolvedType !== "scheduled" && maxSeats !== null && availableSeats !== null && availableSeats > maxSeats) {
    errors.push("available_seats cannot exceed max_seats");
  }

  if (errors.length > 0) {
    const err = new Error("Validation failed");
    err.statusCode = 400;
    err.details = errors;
    throw err;
  }

  const scheduledSeatFields =
    resolvedType === "scheduled"
      ? { max_seats: null, available_seats: null }
      : { max_seats: maxSeats, available_seats: availableSeats };

  return {
    title: data.title,
    type: data.type,
    template_id: data.template_id ?? null,
    category: data.category ?? "other",
    level: data.level ?? "beginner",
    tags: ensureArray(data.tags),
    is_active: data.is_active ?? true,
    is_featured: data.is_featured ?? false,
    description: data.description ?? null,
    syllabus: data.syllabus ?? null,
    requirements: data.requirements ?? null,
    what_to_bring: data.what_to_bring ?? null,
    getting_ready_info: data.getting_ready_info ?? null,
    pre_course_materials: ensureArray(data.pre_course_materials),
    price: parseNullableNumber(data.price),
    duration_hours: parseNullableNumber(data.duration_hours),
    location: data.location ?? null,
    max_seats: scheduledSeatFields.max_seats,
    available_seats: scheduledSeatFields.available_seats,
    session_dates: normalizedSessionDates,
    cover_image_url: data.cover_image_url ?? null,
    instructor_name: data.instructor_name ?? null,
    instructor_bio: data.instructor_bio ?? null,
    certifications_awarded: ensureArray(data.certifications_awarded),
    certification_name: data.certification_name ?? null,
    linked_service_type_ids: ensureArray(data.linked_service_type_ids),
    platform_coverage: ensureArray(data.platform_coverage)
  };
}

