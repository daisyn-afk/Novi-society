import { format, parseISO } from "date-fns";

/**
 * Calendar date for display (local timezone).
 * DB may store `appointment_date` as timestamptz; raw ISO strings look like the wrong day
 * when pasted into UI vs list rows that use parseISO + local format.
 */
export function formatAppointmentDate(dateValue, pattern = "EEE, MMM d, yyyy") {
  if (!dateValue) return "";
  try {
    const dt = typeof dateValue === "string" ? parseISO(dateValue) : dateValue;
    if (Number.isNaN(dt.getTime())) {
      const s = String(dateValue).trim();
      return s.length >= 10 ? s.slice(0, 10) : s;
    }
    return format(dt, pattern);
  } catch {
    const s = String(dateValue || "").trim();
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
}

/**
 * Resolves the human-readable service label for an appointment row.
 * Falls back to joined service_type name when `service` is missing on legacy rows.
 */
export function appointmentServiceLabel(appt) {
  if (!appt) return "";
  const direct = String(appt.service || "").trim();
  if (direct) return direct;
  const fromType = String(appt.service_type_name || appt.service_name || "").trim();
  if (fromType) return fromType;
  return String(appt.treatment || "").trim();
}
