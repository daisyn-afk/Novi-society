/** Strip non-digits from a phone string. */
export function digitsFromPhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

/** Format typed input as US phone: (555) 123-4567 */
export function formatUsPhoneInput(phone) {
  const digits = digitsFromPhone(phone).slice(0, 11);
  const normalized =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits.slice(0, 10);

  const area = normalized.slice(0, 3);
  const exchange = normalized.slice(3, 6);
  const line = normalized.slice(6, 10);

  if (!area) return "";
  if (normalized.length <= 3) return `(${area}`;
  if (normalized.length <= 6) return `(${area}) ${exchange}`;
  return `(${area}) ${line ? `${exchange}-${line}` : exchange}`;
}

/**
 * US NANP phone: 10 digits; optional leading country code 1.
 * Area code and exchange cannot start with 0 or 1.
 */
export function isValidUsPhone(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return false;
  if (!/^[\d\s().+\-]+$/.test(raw)) return false;

  const digits = digitsFromPhone(raw);
  const normalized =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (normalized.length !== 10) return false;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(normalized);
}

/** Returns an error message, or null if valid (empty allowed when optional). */
export function usPhoneValidationError(phone, { required = false } = {}) {
  const trimmed = String(phone || "").trim();
  if (!trimmed) {
    return required ? "Phone number is required." : null;
  }
  if (!isValidUsPhone(trimmed)) {
    return "Enter a valid US phone number (10 digits, e.g. (555) 123-4567).";
  }
  return null;
}
