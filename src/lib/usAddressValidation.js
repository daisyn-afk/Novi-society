/** US ZIP: 5 digits or ZIP+4 (12345 or 12345-6789). */
export function isValidUsZip(zip) {
  const trimmed = String(zip || "").trim();
  return /^\d{5}(-\d{4})?$/.test(trimmed);
}

/** Returns an error message, or null if valid (empty allowed when optional). */
export function usZipValidationError(zip, { required = false } = {}) {
  const trimmed = String(zip || "").trim();
  if (!trimmed) {
    return required ? "ZIP code is required." : null;
  }
  if (!isValidUsZip(trimmed)) {
    return "Enter a valid US ZIP code (5 digits, e.g. 78701).";
  }
  return null;
}

/** Normalize state to uppercase 2-letter abbreviation when possible. */
export function normalizeUsStateInput(state) {
  const trimmed = String(state || "").trim();
  if (!trimmed) return "";
  return trimmed.length <= 2 ? trimmed.toUpperCase() : trimmed;
}
