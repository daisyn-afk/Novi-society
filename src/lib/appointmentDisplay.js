import { format, isSameDay, isToday, isTomorrow, isYesterday, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";

/**
 * Parse appointment calendar date as a local day (not UTC).
 * `appointment_date` is stored as a date column (`YYYY-MM-DD`); ISO strings with a
 * midnight UTC suffix must not shift to the previous day in US timezones.
 */
export function parseAppointmentDateLocal(dateValue) {
  if (dateValue == null || dateValue === "") return null;
  if (dateValue instanceof Date) {
    if (Number.isNaN(dateValue.getTime())) return null;
    return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
  }
  const s = String(dateValue).trim();
  const datePart = s.length >= 10 ? s.slice(0, 10) : s;
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return null;
  const dt = new Date(year, month - 1, day);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Stable `YYYY-MM-DD` key for grouping/sorting appointment rows. */
export function appointmentDateKey(dateValue) {
  const dt = parseAppointmentDateLocal(dateValue);
  if (!dt) {
    const s = String(dateValue || "").trim();
    return s || "unscheduled";
  }
  return format(dt, "yyyy-MM-dd");
}

/**
 * Calendar date for display in the provider/patient's local timezone.
 */
export function formatAppointmentDate(dateValue, pattern = "EEE, MMM d, yyyy") {
  const dt = parseAppointmentDateLocal(dateValue);
  if (!dt) {
    const s = String(dateValue || "").trim();
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
  return format(dt, pattern);
}

/**
 * 24h `HH:mm` (or `HH:mm:ss`) from DB/HTML inputs → `h:mm AM/PM`.
 * Use this (or `formatDisplayTime`) for any clock-time string shown in UI.
 */
export function formatAppointmentTime(timeValue) {
  if (timeValue == null || timeValue === "") return "";
  const raw = String(timeValue).trim();
  const [hRaw, mRaw] = raw.slice(0, 5).split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return raw;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Alias for `formatAppointmentTime` — preferred name for non-appointment clock times. */
export const formatDisplayTime = formatAppointmentTime;

/** ISO timestamp / Date → `h:mm AM/PM` (or custom pattern). */
export function formatTimestampTime(value, pattern = "h:mm a") {
  if (value == null || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, pattern);
}

/** ISO timestamp / Date → `MMM d, yyyy at h:mm AM/PM`. */
export function formatTimestampDateTime(value, pattern = "MMM d, yyyy 'at' h:mm a") {
  return formatTimestampTime(value, pattern);
}

/** Chat bubble timestamp for today. */
export function formatMessageTime(ts) {
  return formatTimestampTime(ts);
}

/** Chat thread list: time today, otherwise date label. */
export function formatMessageThreadTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

/** Course/session slot times on one line, e.g. `5:25 PM – 10:22 PM`. */
export function formatTimeRange(startTime, endTime, separator = " – ") {
  const start = formatAppointmentTime(startTime);
  const end = formatAppointmentTime(endTime);
  if (start && end) return `${start}${separator}${end}`;
  return start || end || "";
}

export function formatSessionScheduleLine({ start_time, end_time, location } = {}) {
  const time = formatTimeRange(start_time, end_time);
  if (!time && !location) return "";
  if (!time) return String(location || "");
  if (!location) return time;
  return `${time} · ${location}`;
}

export function sessionEntryForDate(courseOrDates, dateValue) {
  if (!dateValue) return null;
  const key = String(dateValue).slice(0, 10);
  const rows = Array.isArray(courseOrDates)
    ? courseOrDates
    : courseOrDates?.session_dates || [];
  return (
    rows.find((d) => String(d?.date || d?.session_date || "").slice(0, 10) === key) || null
  );
}

export function isAppointmentDateToday(dateValue) {
  const dt = parseAppointmentDateLocal(dateValue);
  return dt ? isToday(dt) : false;
}

export function isAppointmentDateTomorrow(dateValue) {
  const dt = parseAppointmentDateLocal(dateValue);
  return dt ? isTomorrow(dt) : false;
}

export function isSameAppointmentDay(dateValue, day) {
  const dt = parseAppointmentDateLocal(dateValue);
  if (!dt || !day) return false;
  return isSameDay(dt, day);
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

function appointmentMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Provider-facing payment summary for appointment list/detail UI.
 * Uses collected `amount_paid` and explicit payment statuses — not ambiguous `total_amount` alone.
 */
export function appointmentProviderPaymentSummary(appt) {
  if (!appt) return null;

  const amountPaid = appointmentMoney(appt.amount_paid);
  const depositAmount = appointmentMoney(appt.deposit_amount);
  const hasDeposit = appointmentHasBookingDeposit(appt);
  const depositPaid = appointmentDepositPaid(appt);
  const treatmentStatus = String(appt.treatment_payment_status || "unpaid").toLowerCase();
  const treatmentAwaiting = treatmentStatus === "awaiting_payment";
  const treatmentPaid = treatmentStatus === "paid";
  const balanceDue = treatmentAwaiting
    ? appointmentMoney(appt.treatment_amount) || appointmentMoney(appt.total_amount)
    : 0;

  let status = "none";
  let statusLabel = "";
  let primaryAmount = 0;
  let amountCaption = "";
  let detailLines = [];

  if (treatmentPaid) {
    status = "paid";
    statusLabel = "Fully paid";
    primaryAmount = amountPaid;
    amountCaption = "collected";
  } else if (treatmentAwaiting && balanceDue > 0) {
    status = "due";
    statusLabel = "Balance due";
    primaryAmount = balanceDue;
    amountCaption = "owed";
    if (amountPaid > 0) {
      detailLines.push({ label: "Collected", amount: amountPaid });
    }
  } else if (hasDeposit && !depositPaid) {
    status = "unpaid";
    statusLabel = "Deposit unpaid";
    primaryAmount = depositAmount;
    amountCaption = "deposit due";
  } else if (depositPaid && amountPaid > 0) {
    status = "partial";
    statusLabel = "Deposit paid";
    primaryAmount = amountPaid;
    amountCaption = "collected";
    if (!treatmentAwaiting && !treatmentPaid) {
      detailLines.push({ label: "Treatment", amount: null, text: "Not billed yet" });
    }
  } else if (amountPaid > 0) {
    status = "partial";
    statusLabel = "Collected";
    primaryAmount = amountPaid;
    amountCaption = "collected";
  } else if (hasDeposit) {
    status = "unpaid";
    statusLabel = "Deposit unpaid";
    primaryAmount = depositAmount;
    amountCaption = "deposit due";
  }

  if (!statusLabel || primaryAmount <= 0) return null;

  return {
    status,
    statusLabel,
    primaryAmount,
    amountCaption,
    amountPaid,
    balanceDue,
    depositPaid,
    treatmentPaid,
    treatmentAwaiting,
    detailLines,
  };
}

/** Completed visits in the current calendar month (by appointment_date). */
export function appointmentsThisMonthRevenue(appointments, referenceDate = new Date()) {
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  return (appointments || [])
    .filter((a) => {
      const d = parseAppointmentDateLocal(a.appointment_date);
      return a.status === "completed" && d && isWithinInterval(d, { start: monthStart, end: monthEnd });
    })
    .sort((a, b) => {
      const da = parseAppointmentDateLocal(a.appointment_date)?.getTime() || 0;
      const db = parseAppointmentDateLocal(b.appointment_date)?.getTime() || 0;
      if (db !== da) return db - da;
      return String(b.appointment_time || "").localeCompare(String(a.appointment_time || ""));
    });
}

export function thisMonthRevenueTotal(appointments, referenceDate = new Date()) {
  return appointmentsThisMonthRevenue(appointments, referenceDate).reduce(
    (sum, a) => sum + (Number(a.amount_paid) || 0),
    0
  );
}

export const APPOINTMENT_PAYMENT_STATUS_STYLES = {
  paid: { bg: "rgba(74,222,128,0.18)", text: "#16a34a", border: "rgba(74,222,128,0.45)" },
  partial: { bg: "rgba(251,191,36,0.18)", text: "#d97706", border: "rgba(251,191,36,0.45)" },
  due: { bg: "rgba(250,111,48,0.15)", text: "#c2410c", border: "rgba(250,111,48,0.35)" },
  unpaid: { bg: "rgba(248,113,113,0.15)", text: "#dc2626", border: "rgba(248,113,113,0.35)" },
  none: { bg: "rgba(30,37,53,0.06)", text: "rgba(30,37,53,0.5)", border: "rgba(30,37,53,0.12)" },
};
