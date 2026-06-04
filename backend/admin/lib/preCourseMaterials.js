/**
 * Normalize pre_course_materials from DB (jsonb array or legacy JSON string).
 */
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

/**
 * Prefer non-empty materials from template, then scheduled instance.
 */
export function resolvePreCourseMaterials(scheduled, template) {
  const fromTemplate = normalizePreCourseMaterials(template?.pre_course_materials);
  const fromScheduled = normalizePreCourseMaterials(scheduled?.pre_course_materials);
  if (fromTemplate.length > 0) return fromTemplate;
  if (fromScheduled.length > 0) return fromScheduled;
  return [];
}
