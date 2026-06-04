export function normalizePreCourseMaterials(value) {
  if (value == null) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

/** Prefer non-empty template materials, then scheduled instance (matches backend). */
export function resolvePreCourseMaterials(course, template) {
  const fromTemplate = normalizePreCourseMaterials(template?.pre_course_materials);
  const fromCourse = normalizePreCourseMaterials(course?.pre_course_materials);
  if (fromTemplate.length > 0) return fromTemplate;
  if (fromCourse.length > 0) return fromCourse;
  return [];
}

/** Resolve materials on a course row that may include merged template fields from the API. */
export function coursePreCourseMaterials(course) {
  return normalizePreCourseMaterials(course?.pre_course_materials);
}

export function withResolvedPreCourseMaterials(course, template) {
  if (!course) return course;
  return {
    ...course,
    pre_course_materials: resolvePreCourseMaterials(course, template),
  };
}
