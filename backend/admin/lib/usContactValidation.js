export function digitsFromPhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

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

export function isValidUsZip(zip) {
  const trimmed = String(zip || "").trim();
  return /^\d{5}(-\d{4})?$/.test(trimmed);
}

export function assertValidUsPhone(phone) {
  if (!isValidUsPhone(phone)) {
    const err = new Error("Enter a valid US phone number (10 digits).");
    err.statusCode = 400;
    throw err;
  }
}

export function assertValidUsZip(zip) {
  if (!isValidUsZip(zip)) {
    const err = new Error("Enter a valid US ZIP code (5 digits or ZIP+4).");
    err.statusCode = 400;
    throw err;
  }
}
