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
/** Practice Profile booking_deposit: empty or 0 means no deposit required. */
export function profileBookingDepositAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function providerConfirmActionLabel() {
  return "Confirm Appointment";
}

/** Appointment row has a booking deposit amount on file. */
export function appointmentHasBookingDeposit(appt) {
  const n = Number(appt?.deposit_amount);
  return Number.isFinite(n) && n > 0;
}

/** Patient completed the booking deposit Stripe payment for this visit. */
export function appointmentDepositPaid(appt) {
  return String(appt?.payment_status || "").toLowerCase() === "paid";
}

/** Provider cannot log treatment or mark done until booking deposit is paid. */
export function appointmentDepositBlocksProvider(appt) {
  return appointmentHasBookingDeposit(appt) && !appointmentDepositPaid(appt);
}

/** Patient can pay booking deposit from their appointments list. */
export function appointmentPatientCanPayDeposit(appt) {
  if (!appointmentHasBookingDeposit(appt) || appointmentDepositPaid(appt)) return false;
  const status = String(appt?.status || "").toLowerCase();
  return status === "confirmed" || status === "awaiting_payment" || status === "completed";
}

export function appointmentServiceLabel(appt) {
  if (!appt) return "";
  const direct = String(appt.service || "").trim();
  if (direct) return direct;
  const fromType = String(appt.service_type_name || appt.service_name || "").trim();
  if (fromType) return fromType;
  return String(appt.treatment || "").trim();
}
