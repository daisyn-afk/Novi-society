const CATEGORIES = [
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
const LEVELS = ["beginner", "intermediate", "advanced"];

function ensureArray(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

export function validateTemplateInput(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.title !== undefined) {
    if (!body.title || !String(body.title).trim()) errors.push("title is required");
  }
  if (body.category != null && !CATEGORIES.includes(body.category)) {
    errors.push("invalid category");
  }
  if (body.level != null && !LEVELS.includes(body.level)) {
    errors.push("invalid level");
  }
  const maxSeats = body.max_seats === undefined || body.max_seats === "" ? null : Number(body.max_seats);
  const avail = body.available_seats === undefined || body.available_seats === "" ? null : Number(body.available_seats);
  if (maxSeats != null && avail != null && avail > maxSeats) {
    errors.push("available_seats cannot exceed max_seats");
  }
  if (errors.length) {
    const err = new Error("Validation failed");
    err.statusCode = 400;
    err.details = errors;
    throw err;
  }

  return {
    title: body.title?.trim(),
    description: body.description ?? null,
    category: body.category ?? "other",
    level: body.level ?? "beginner",
    price: body.price === "" || body.price === undefined ? null : Number(body.price),
    duration_hours:
      body.duration_hours === "" || body.duration_hours === undefined ? null : Number(body.duration_hours),
    location: body.location ?? null,
    max_seats: maxSeats,
    available_seats: avail,
    instructor_name: body.instructor_name ?? null,
    instructor_bio: body.instructor_bio ?? null,
    cover_image_url: body.cover_image_url ?? null,
    syllabus: body.syllabus ?? null,
    requirements: body.requirements ?? null,
    what_to_bring: body.what_to_bring ?? null,
    getting_ready_info: body.getting_ready_info ?? null,
    pre_course_materials: ensureArray(body.pre_course_materials),
    session_dates: ensureArray(body.session_dates),
    tags: ensureArray(body.tags),
    is_active: body.is_active ?? true,
    is_featured: body.is_featured ?? false,
    platform_coverage: ensureArray(body.platform_coverage),
    linked_service_type_ids: ensureArray(body.linked_service_type_ids),
    certification_name: body.certification_name ?? null,
    certifications_awarded: ensureArray(body.certifications_awarded)
  };
}
