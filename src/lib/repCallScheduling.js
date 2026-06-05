export const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
];

export const CALL_DURATIONS = [15, 30, 45, 60];

export function detectBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}

export function resolveTimezoneValue(value) {
  const detected = detectBrowserTimezone();
  if (US_TIMEZONES.some((tz) => tz.value === value)) return value;
  if (US_TIMEZONES.some((tz) => tz.value === detected)) return detected;
  return "America/New_York";
}

export function todayDateInputValue() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentTimeInputValue() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** True when appointment date/time is before now (local timezone). */
export function isAppointmentInPast(appointmentDate, appointmentTime = "09:00") {
  const dateStr = String(appointmentDate || "").trim();
  if (!dateStr) return true;
  const todayStr = todayDateInputValue();
  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;
  const timeStr = String(appointmentTime || "09:00").trim();
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10) || 0);
  const now = new Date();
  return h < now.getHours() || (h === now.getHours() && m < now.getMinutes());
}

export function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}
