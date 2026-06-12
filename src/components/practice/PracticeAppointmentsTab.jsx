import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { appointmentsApi } from "@/api/appointmentsApi";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MessageThread from "@/components/messaging/MessageThread";
import MessageUnreadBadge from "@/components/messaging/MessageUnreadBadge";
import { useAppointmentMessageUnread, unreadCountForThread } from "@/hooks/useAppointmentMessageUnread";
import {
  Calendar, Clock, User, MessageSquare, CheckCircle, X, FileText,
  ShieldCheck, ChevronLeft, ChevronRight, LayoutList, LayoutGrid,
  AlertCircle, DollarSign, Zap, Plus, Phone, Mail, Eye, Stethoscope
} from "lucide-react";
import { format, isToday, isTomorrow, startOfWeek, addDays, parseISO, addWeeks, subWeeks } from "date-fns";
import TreatmentDocumentDialog from "@/components/practice/TreatmentDocumentDialog.jsx";
import GFEStatusBadge from "@/components/GFEStatusBadge";
import AppointmentGfeProviderControls from "@/components/appointments/AppointmentGfeProviderControls";
import {
  APPOINTMENT_PAYMENT_STATUS_STYLES,
  appointmentDateKey,
  appointmentDepositBlocksProvider,
  appointmentDepositPaid,
  appointmentHasBookingDeposit,
  appointmentProviderPaymentSummary,
  appointmentServiceLabel,
  formatAppointmentDate,
  formatAppointmentTime,
  isAppointmentDateToday,
  isSameAppointmentDay,
  parseAppointmentDateLocal,
  profileBookingDepositAmount,
  providerConfirmActionLabel,
} from "@/lib/appointmentDisplay";
import {
  appointmentGfeBlockMessage,
  appointmentGfeBlocksTreatment,
  appointmentGfeDisplayStatus,
  appointmentGfeLink,
  appointmentGfeValidityLabel,
} from "@/lib/appointmentGfe";
import { useToast } from "@/components/ui/use-toast";
import { useSendAppointmentGfe } from "@/hooks/useSendAppointmentGfe";

function findTreatmentRecordForAppointment(records, appt) {
  if (!appt?.id) return null;
  const byAppointment = (records || []).find(
    (r) => String(r?.appointment_id || "") === String(appt.id)
  );
  if (byAppointment) return byAppointment;
  const linkedId = String(appt.treatment_record_id || "").trim();
  if (!linkedId) return null;
  return (records || []).find((r) => String(r?.id || "") === linkedId) || null;
}

const STATUS = {
  requested:  { bg: "rgba(251,191,36,0.18)", text: "#d97706", border: "rgba(251,191,36,0.45)", label: "Pending", dot: "#fbbf24" },
  confirmed:  { bg: "rgba(96,165,250,0.18)",  text: "#3b82f6", border: "rgba(96,165,250,0.45)", label: "Confirmed", dot: "#60a5fa" },
  completed:  { bg: "rgba(74,222,128,0.18)",  text: "#16a34a", border: "rgba(74,222,128,0.45)", label: "Done", dot: "#4ade80" },
  cancelled:  { bg: "rgba(248,113,113,0.18)", text: "#dc2626", border: "rgba(248,113,113,0.45)", label: "Cancelled", dot: "#f87171" },
  no_show:    { bg: "rgba(30,37,53,0.06)",    text: "rgba(30,37,53,0.4)", border: "rgba(30,37,53,0.12)", label: "No-Show", dot: "#94a3b8" },
  awaiting_payment: { bg: "rgba(200,230,60,0.18)", text: "#4a6b10", border: "rgba(200,230,60,0.45)", label: "Awaiting Payment", dot: "#C8E63C" },
  awaiting_consent: { bg: "rgba(123,142,200,0.18)", text: "#4a5fa8", border: "rgba(123,142,200,0.45)", label: "Awaiting Consent", dot: "#7B8EC8" },
};

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am–7pm

function dateLabel(d) {
  if (!d) return "";
  const dt = parseAppointmentDateLocal(d);
  if (!dt) return String(d);
  if (isToday(dt)) return "Today";
  if (isTomorrow(dt)) return "Tomorrow";
  return format(dt, "EEE, MMM d");
}

function appointmentHour(timeStr) {
  if (!timeStr) return null;
  const match = String(timeStr).trim().match(/^(\d{1,2})/);
  return match ? parseInt(match[1], 10) : null;
}

function appointmentsOnDay(appointments, day) {
  return appointments
    .filter((a) => a.appointment_date && isSameAppointmentDay(a.appointment_date, day))
    .sort((a, b) => (a.appointment_time || "").localeCompare(b.appointment_time || ""));
}

function formatHourLabel(h) {
  return formatAppointmentTime(`${String(h).padStart(2, "0")}:00`);
}

function formatPaymentAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function AppointmentPaymentDisplay({ appt, variant = "compact" }) {
  const summary = appointmentProviderPaymentSummary(appt);
  if (!summary) return null;

  const styles = APPOINTMENT_PAYMENT_STATUS_STYLES[summary.status] || APPOINTMENT_PAYMENT_STATUS_STYLES.none;

  if (variant === "detail") {
    return (
      <div
        className="col-span-2 rounded-xl px-3 py-2.5 space-y-1.5"
        style={{ background: styles.bg, border: `1px solid ${styles.border}` }}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: styles.text }}>
            {summary.statusLabel}
          </span>
          <span className="text-sm font-bold" style={{ color: "#1e2535" }}>
            {formatPaymentAmount(summary.primaryAmount)}
            {summary.amountCaption ? (
              <span className="text-[11px] font-medium ml-1" style={{ color: "rgba(30,37,53,0.5)" }}>
                {summary.amountCaption}
              </span>
            ) : null}
          </span>
        </div>
        {summary.amountPaid > 0 && summary.status === "due" && (
          <p className="text-[11px]" style={{ color: "rgba(30,37,53,0.55)" }}>
            Collected so far: {formatPaymentAmount(summary.amountPaid)}
          </p>
        )}
        {summary.detailLines.map((line) => (
          <p key={line.label} className="text-[11px]" style={{ color: "rgba(30,37,53,0.55)" }}>
            {line.label}: {line.text || formatPaymentAmount(line.amount)}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="text-right flex-shrink-0 min-w-[5.5rem]">
      <p className="text-sm font-bold leading-tight" style={{ color: "#1e2535" }}>
        {formatPaymentAmount(summary.primaryAmount)}
      </p>
      <span
        className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5"
        style={{ background: styles.bg, color: styles.text, border: `1px solid ${styles.border}` }}
      >
        {summary.statusLabel}
      </span>
      {summary.amountPaid > 0 && summary.status === "due" && (
        <p className="text-[10px] mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>
          {formatPaymentAmount(summary.amountPaid)} collected
        </p>
      )}
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────
function StatCard({ icon: Icon, color, label, value, sub }) {
  return (
    <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(30,37,53,0.07)" }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium" style={{ color: "rgba(30,37,53,0.5)" }}>{label}</p>
        <p className="font-bold text-lg leading-tight" style={{ color: "#1e2535", fontFamily: "'DM Sans', sans-serif" }}>{value}</p>
        {sub && <p className="text-[11px]" style={{ color: "rgba(30,37,53,0.4)" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Mini appointment pill for calendar grid ───────────────────────
function CalApptPill({ appt, onClick }) {
  const sc = STATUS[appt.status] || STATUS.confirmed;
  const serviceLabel = appointmentServiceLabel(appt);
  const timeLabel = appt.appointment_time ? formatAppointmentTime(appt.appointment_time) : "TBD";
  return (
    <button
      type="button"
      onClick={() => onClick(appt)}
      className="w-full min-w-0 max-w-full text-left px-1.5 py-1 rounded-md transition-all hover:opacity-80 overflow-hidden"
      style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
    >
      <p className="text-[10px] font-bold leading-tight truncate">{timeLabel}</p>
      <p className="text-[10px] font-semibold leading-tight truncate">{appt.patient_name?.split(" ")[0] || "Patient"}</p>
      {serviceLabel ? (
        <p className="text-[9px] font-normal leading-tight truncate opacity-75">{serviceLabel}</p>
      ) : null}
    </button>
  );
}

// ── Week agenda row (mobile) ──────────────────────────────────────
function WeekAgendaCard({ appt, onClick }) {
  const sc = STATUS[appt.status] || STATUS.confirmed;
  const serviceLabel = appointmentServiceLabel(appt);
  const timeLabel = appt.appointment_time ? formatAppointmentTime(appt.appointment_time) : "Time TBD";
  return (
    <button
      type="button"
      onClick={() => onClick(appt)}
      className="w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all hover:shadow-sm"
      style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
    >
      <div className="min-w-[4.75rem] flex-shrink-0 text-center">
        <p className="text-sm font-bold whitespace-nowrap leading-tight" style={{ color: sc.text }}>{timeLabel}</p>
        {appt.duration_minutes ? (
          <p className="text-[10px] opacity-70" style={{ color: sc.text }}>{appt.duration_minutes}m</p>
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "#1e2535" }}>{appt.patient_name || appt.patient_email || "Patient"}</p>
        {serviceLabel ? (
          <p className="text-xs truncate mt-0.5" style={{ color: "rgba(30,37,53,0.55)" }}>{serviceLabel}</p>
        ) : null}
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(255,255,255,0.55)", color: sc.text }}>
        {sc.label}
      </span>
    </button>
  );
}

// ── Appointment detail drawer content ────────────────────────────
function ApptDetail({
  appt,
  treatmentRecords,
  onConfirm,
  onCancel,
  onComplete,
  onNoShow,
  noShowPending,
  onSendGFE,
  gfeSending,
  gfeFeedback,
  onDoc,
  onMessage,
  messageUnreadCount,
  onClose,
  confirmActionLabel = "Confirm Appointment",
}) {
  const sc = STATUS[appt.status] || STATUS.confirmed;
  const hasRecord = findTreatmentRecordForAppointment(treatmentRecords, appt);
  const serviceLabel = appointmentServiceLabel(appt);
  const gfeStatus = appointmentGfeDisplayStatus(appt);
  const gfeLink = appointmentGfeLink(appt);
  const depositBlocked = appointmentDepositBlocksProvider(appt);
  const gfeBlocked = appointmentGfeBlocksTreatment(appt);
  const gfeBlockMessage = appointmentGfeBlockMessage(appt);
  const gfeValidUntil = appointmentGfeValidityLabel(appt);
  const providerActionBlocked = depositBlocked || gfeBlocked;
  const depositPaid = appointmentDepositPaid(appt);
  const paymentSummary = appointmentProviderPaymentSummary(appt);
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(30,37,53,0.4)" }}>Appointment request</p>
          <p className="font-bold text-lg mt-0.5" style={{ fontFamily: "'DM Serif Display', serif", color: "#1e2535" }}>
            {appt.patient_name || "Patient"}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{sc.label}</span>
            <GFEStatusBadge status={gfeStatus} examUrl={gfeLink || undefined} />
            {appt.appointment_date && isAppointmentDateToday(appt.appointment_date) && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10" }}>TODAY</span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" style={{ color: "rgba(30,37,53,0.35)" }}><X className="w-4 h-4" /></button>
      </div>

      {/* Patient info */}
      <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.08)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: "rgba(123,142,200,0.15)", color: "#7B8EC8" }}>
            {(appt.patient_name || "P")[0]}
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{appt.patient_name || "Unknown Patient"}</p>
            {appt.patient_email && (
              <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                <Mail className="w-3 h-3 flex-shrink-0" />{appt.patient_email}
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="flex items-start gap-1.5 text-xs col-span-2" style={{ color: "rgba(30,37,53,0.55)" }}>
            <Stethoscope className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block" style={{ color: "#1e2535" }}>Service</span>
              <span>{serviceLabel || "—"}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            {dateLabel(appt.appointment_date)}
          </div>
          {appt.appointment_time && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />{formatAppointmentTime(appt.appointment_time)}
            </div>
          )}
          {appt.duration_minutes && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />{appt.duration_minutes} min
            </div>
          )}
          <AppointmentPaymentDisplay appt={appt} variant="detail" />
        </div>
      </div>

      {/* Patient notes */}
      {appt.patient_notes && (
        <div className="px-3 py-2.5 rounded-xl text-xs italic" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.18)", color: "rgba(30,37,53,0.6)" }}>
          <span className="font-bold not-italic" style={{ color: "#7B8EC8" }}>Patient note: </span>
          "{appt.patient_notes}"
        </div>
      )}

      {appt.requires_gfe === true && (
        <div
          className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)", color: "rgba(30,37,53,0.65)" }}
        >
          <span className="font-bold shrink-0" style={{ color: "#7B8EC8" }}>GFE</span>
          <GFEStatusBadge status={gfeStatus} examUrl={gfeLink || undefined} size="sm" />
          <AppointmentGfeProviderControls
            appointment={appt}
            gfeSending={gfeSending}
            onSendGFE={onSendGFE}
          />
          {gfeStatus === "pending" && gfeLink && appt.gfe_sent_at && (
            <span className="text-[10px]" style={{ color: "rgba(30,37,53,0.45)" }}>
              Sent {format(new Date(appt.gfe_sent_at), "MMM d, h:mm a")}
            </span>
          )}
          {gfeValidUntil && (
            <span className="text-[10px] font-medium" style={{ color: "#166534" }}>
              Valid until {gfeValidUntil}
              {appt.gfe_expiring_soon ? " · expiring soon" : ""}
            </span>
          )}
          {appt.gfe_expired && (
            <span className="text-[10px] font-medium" style={{ color: "#991b1b" }}>
              GFE expired — send a new exam
            </span>
          )}
          {gfeStatus === "approved" && appt.gfe_provider_name && (
            <span className="text-[10px]" style={{ color: "rgba(30,37,53,0.45)" }}>
              {appt.gfe_provider_name}
              {appt.gfe_completed_at ? ` · ${format(new Date(appt.gfe_completed_at), "MMM d, yyyy")}` : ""}
            </span>
          )}
        </div>
      )}

      {appt.referral_code && (
        <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", color: "rgba(30,37,53,0.65)" }}>
          <span className="font-bold" style={{ color: "#7c3aed" }}>Referral code used: </span>
          <span className="font-mono">{appt.referral_code}</span>
          <p className="mt-1 text-[11px] not-italic" style={{ color: "rgba(30,37,53,0.5)" }}>
            Remember to honor the referral discount when confirming this visit.
          </p>
        </div>
      )}

      {/* Provider notes */}
      {appt.notes && (
        <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(250,111,48,0.06)", border: "1px solid rgba(250,111,48,0.18)", color: "rgba(30,37,53,0.6)" }}>
          <span className="font-bold" style={{ color: "#FA6F30" }}>Your notes: </span>
          {appt.notes}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {gfeFeedback?.id === appt.id && gfeFeedback.message && (
          <div
            className="px-3 py-2.5 rounded-xl text-xs"
            style={
              gfeFeedback.type === "success"
                ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.35)", color: "#166534" }
                : { background: "rgba(254,226,226,0.85)", border: "1px solid rgba(220,38,38,0.35)", color: "#991b1b" }
            }
          >
            {gfeFeedback.message}
          </div>
        )}
        {appt.status === "requested" && (
          <div className="flex flex-col gap-2">
            <Button
              className="w-full gap-1.5 h-auto min-h-10 py-2.5 whitespace-normal text-center leading-snug"
              style={{ background: "#FA6F30", color: "#fff" }}
              onClick={onConfirm}
            >
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {confirmActionLabel}
            </Button>
            <Button className="w-full gap-1.5" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4" />Decline
            </Button>
          </div>
        )}
        {appt.status === "awaiting_payment" && (
          <div
            className="px-3 py-2.5 rounded-xl text-xs font-semibold text-center"
            style={{ background: "rgba(200,230,60,0.15)", border: "1px solid rgba(200,230,60,0.35)", color: "#4a6b10" }}
          >
            Awaiting patient deposit{appt.deposit_amount ? ` ($${appt.deposit_amount})` : ""}
          </div>
        )}
        {appt.status === "confirmed" && appointmentHasBookingDeposit(appt) && !depositPaid && (
          <div
            className="px-3 py-2.5 rounded-xl text-xs"
            style={{ background: "rgba(200,230,60,0.15)", border: "1px solid rgba(200,230,60,0.35)", color: "#4a6b10" }}
          >
            Booking deposit of <strong>${appt.deposit_amount}</strong> is unpaid. The patient must pay after their visit before you can log treatment or mark this appointment done.
          </div>
        )}
        {appt.status === "confirmed" && depositPaid && (
          <div
            className="px-3 py-2.5 rounded-xl text-xs"
            style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.35)", color: "#166534" }}
          >
            Booking deposit paid (${appt.amount_paid || appt.deposit_amount}). This amount will be applied to the final treatment checkout.
          </div>
        )}
        {appt.status === "completed" && paymentSummary?.status === "due" && (
          <div
            className="px-3 py-2.5 rounded-xl text-xs"
            style={{ background: "rgba(250,111,48,0.1)", border: "1px solid rgba(250,111,48,0.35)", color: "#c2410c" }}
          >
            Treatment balance of <strong>{formatPaymentAmount(paymentSummary.balanceDue)}</strong> is unpaid.
            {paymentSummary.amountPaid > 0 && (
              <> {formatPaymentAmount(paymentSummary.amountPaid)} has been collected and applied.</>
            )}
          </div>
        )}
        {appt.status === "completed" && paymentSummary?.status === "paid" && (
          <div
            className="px-3 py-2.5 rounded-xl text-xs"
            style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.35)", color: "#166534" }}
          >
            Fully paid — {formatPaymentAmount(paymentSummary.amountPaid)} collected for this visit.
          </div>
        )}
        {appt.status === "completed" && paymentSummary?.status === "partial" && (
          <div
            className="px-3 py-2.5 rounded-xl text-xs"
            style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", color: "#b45309" }}
          >
            Deposit paid ({formatPaymentAmount(paymentSummary.amountPaid)}). Final treatment checkout has not been sent or paid yet.
          </div>
        )}
        {gfeBlocked && gfeBlockMessage && (
          <div
            className="px-3 py-2.5 rounded-xl text-xs"
            style={{ background: "rgba(254,226,226,0.85)", border: "1px solid rgba(220,38,38,0.35)", color: "#991b1b" }}
          >
            {gfeBlockMessage}
          </div>
        )}
        {appt.status === "confirmed" && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="w-full gap-1.5"
              style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10", border: "1px solid rgba(200,230,60,0.4)" }}
              onClick={onComplete}
              disabled={providerActionBlocked}
            >
              <CheckCircle className="w-4 h-4" />Mark Done
            </Button>
            <Button className="w-full gap-1.5" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4" />Cancel
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="w-full gap-1.5 relative"
            variant="outline"
            onClick={onMessage}
          >
            <MessageSquare className="w-4 h-4" />
            Message Patient
            <MessageUnreadBadge count={messageUnreadCount} />
          </Button>
          <Button
            className="w-full gap-1.5"
            style={{ background: "rgba(250,111,48,0.1)", color: "#FA6F30", border: "1px solid rgba(250,111,48,0.3)" }}
            onClick={onDoc}
            disabled={providerActionBlocked && !hasRecord}
          >
            <FileText className="w-4 h-4" />{hasRecord ? "View Record" : "Log Treatment"}
          </Button>
        </div>
        {appt.status === "confirmed" && (
          <Button
            className="w-full gap-1.5"
            variant="outline"
            onClick={onNoShow}
            disabled={noShowPending}
          >
            {noShowPending ? "Updating…" : "No Show"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function PracticeAppointmentsTab({
  appointments,
  initialFilter = "upcoming",
  openMessageAppointmentId = null,
  onOpenMessageHandled,
  defaultBookingDeposit = null,
}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    void qc.prefetchQuery({
      queryKey: ["me"],
      queryFn: () => base44.auth.me(),
      staleTime: 10 * 60 * 1000,
    });
  }, [qc]);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    staleTime: 10 * 60 * 1000,
  });

  const [view, setView] = useState("list"); // "list" | "week"
  const [filter, setFilter] = useState(initialFilter);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, appt: null });
  const [confirmTime, setConfirmTime] = useState("");
  const [cancelDialog, setCancelDialog] = useState({ open: false, appt: null, isDecline: false });
  const [cancelReason, setCancelReason] = useState("");
  const [notesDialog, setNotesDialog] = useState({ open: false, appt: null });
  const [notesText, setNotesText] = useState("");
  const [docDialog, setDocDialog] = useState({ open: false, appt: null, existing: null });
  const [completePrompt, setCompletePrompt] = useState({ open: false, appt: null });
  const [msgDialog, setMsgDialog] = useState(null);
  const { sendGFE, gfeSending, gfeFeedback, setGfeFeedback } = useSendAppointmentGfe({
    onLocalUpdate: (id, patch) => {
      setSelectedAppt((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
    },
  });
  const { data: unreadSummary } = useAppointmentMessageUnread();

  useEffect(() => {
    if (initialFilter) setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    const openId = String(openMessageAppointmentId || "").trim();
    if (!openId) return;
    const appt = (appointments || []).find((a) => String(a.id) === openId);
    if (appt) setMsgDialog(appt);
    onOpenMessageHandled?.();
  }, [openMessageAppointmentId, appointments, onOpenMessageHandled]);

  const { data: treatmentRecords = [] } = useQuery({
    queryKey: ["treatment-records"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.TreatmentRecord.filter({ provider_id: me.id }, "-created_date");
    },
  });

  const profileBookingDeposit = profileBookingDepositAmount(defaultBookingDeposit);
  const confirmActionLabel = providerConfirmActionLabel(defaultBookingDeposit);

  const openConfirmDialog = (appt) => {
    const existingTime = appt?.appointment_time ? String(appt.appointment_time).slice(0, 5) : "";
    setConfirmTime(existingTime);
    setConfirmDialog({ open: true, appt });
  };

  const confirmAppt = useMutation({
    mutationFn: async ({ id }) => {
      if (confirmTime) {
        await appointmentsApi.update(id, { appointment_time: confirmTime });
      }
      await appointmentsApi.requestDeposit(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-appointments"] });
      setConfirmDialog({ open: false, appt: null });
      setConfirmTime("");
      setDetailOpen(false);
      setFilter("upcoming");
      toast({
        title: "Appointment confirmed",
        description:
          profileBookingDeposit === 0
            ? "No booking deposit on your profile — the patient was notified."
            : `The patient was notified. They will pay the $${profileBookingDeposit} booking deposit after their visit before you can log treatment.`,
        duration: 6000,
      });
    },
    onError: (err) => {
      const msg = String(err?.message || "Could not request deposit payment.").replace(/^\[lovable-provider\]\s*\d+\s+/, "");
      toast({ title: "Could not confirm", description: msg, variant: "destructive", duration: 8000 });
    },
  });

  const cancelAppt = useMutation({
    mutationFn: ({ id }) => base44.entities.Appointment.update(id, { status: "cancelled", cancellation_reason: cancelReason }),
    onSuccess: () => {
      qc.invalidateQueries(["my-appointments"]);
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
      setCancelDialog({ open: false, appt: null });
      setCancelReason("");
      setDetailOpen(false);
    },
  });

  const saveNotes = useMutation({
    mutationFn: ({ id }) => base44.entities.Appointment.update(id, { notes: notesText }),
    onSuccess: () => { qc.invalidateQueries(["my-appointments"]); setNotesDialog({ open: false, appt: null }); },
  });

  const markComplete = useMutation({
    mutationFn: ({ id }) => base44.entities.Appointment.update(id, {
      status: "completed",
      completed_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-appointments"] });
      setDetailOpen(false);
    },
  });

  const markNoShow = useMutation({
    mutationFn: ({ id }) => base44.entities.Appointment.update(id, { status: "no_show" }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ["my-appointments"] });
      const previous = qc.getQueryData(["my-appointments"]);
      qc.setQueryData(["my-appointments"], (old) =>
        Array.isArray(old)
          ? old.map((a) => (a.id === id ? { ...a, status: "no_show" } : a))
          : old
      );
      setDetailOpen(false);
      setSelectedAppt(null);
      return { previous };
    },
    onSuccess: (data) => {
      const n = data?.patient_notifications || {};
      const emailed = n.no_show_email === "sent";
      const notified = n.no_show_notification === "sent";
      toast({
        title: "Marked as no-show",
        description: emailed && notified
          ? "Patient emailed and notified in-app to book again."
          : emailed
            ? "Patient emailed to book another appointment."
            : notified
              ? "Patient notified in-app (email could not be sent)."
              : n.no_show_email === "failed"
                ? "Status saved, but the no-show email could not be sent. Check RESEND configuration."
                : "Status saved. Add a patient email on their account to send notifications.",
      });
      void qc.invalidateQueries({ queryKey: ["my-notifications"] });
    },
    onError: (err, _vars, context) => {
      if (context?.previous) qc.setQueryData(["my-appointments"], context.previous);
      const msg = String(err?.message || "Could not update appointment.").replace(/^\[lovable-provider\]\s*\d+\s+/, "");
      toast({
        title: "Update failed",
        description: msg,
        variant: "destructive",
      });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["my-appointments"] });
    },
  });

  // Stats
  const todayAppts = appointments.filter((a) => a.appointment_date && isAppointmentDateToday(a.appointment_date));
  const pendingReqs = appointments.filter(a => a.status === "requested");
  const weekAppts = appointments.filter((a) => {
    const d = parseAppointmentDateLocal(a.appointment_date);
    if (!d) return false;
    return d >= weekStart && d < addDays(weekStart, 7);
  });
  const weekRevenue = weekAppts.filter(a => a.status === "completed").reduce((s, a) => s + (Number(a.amount_paid) || 0), 0);

  // Week days
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Filtered list
  const filtered = appointments.filter((a) => {
    if (filter === "upcoming") return ["confirmed","requested","awaiting_payment","awaiting_consent"].includes(a.status);
    if (filter === "today") return a.appointment_date && isAppointmentDateToday(a.appointment_date);
    if (filter === "requests") return a.status === "requested";
    if (filter === "completed") return a.status === "completed";
    return true;
  }).sort((a, b) => {
    const da = a.appointment_date || "", db = b.appointment_date || "";
    if (da !== db) return da.localeCompare(db);
    return (a.appointment_time || "").localeCompare(b.appointment_time || "");
  });

  const weekFiltered = filtered.filter((a) => {
    const d = parseAppointmentDateLocal(a.appointment_date);
    if (!d) return false;
    return d >= weekStart && d < addDays(weekStart, 7);
  });

  const openDetail = (appt) => {
    setSelectedAppt(appt);
    setGfeFeedback({ id: null, type: null, message: "" });
    setDetailOpen(true);
  };

  const tabs = [
    { key: "upcoming", label: "Upcoming", count: appointments.filter(a => ["confirmed","requested","awaiting_payment","awaiting_consent"].includes(a.status)).length },
    { key: "today", label: "Today", count: todayAppts.length },
    { key: "requests", label: "Requests", count: pendingReqs.length },
    { key: "completed", label: "Completed", count: null },
    { key: "all", label: "All", count: null },
  ];

  return (
    <div className="space-y-4 max-w-5xl">

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Calendar} color="#FA6F30" label="Today" value={todayAppts.length} sub={todayAppts.filter(a=>a.status==="confirmed").length + " confirmed"} />
        <StatCard icon={AlertCircle} color="#fbbf24" label="Pending Requests" value={pendingReqs.length} sub="need a response" />
        <StatCard icon={Zap} color="#7B8EC8" label="This Week" value={weekAppts.length} sub="scheduled" />
        <StatCard icon={DollarSign} color="#C8E63C" label="Week Revenue" value={weekRevenue > 0 ? `$${weekRevenue.toLocaleString()}` : "—"} sub="from completed" />
      </div>

      {/* ── Pending requests banner ── */}
      {pendingReqs.length > 0 && (
        <div className="rounded-2xl px-5 py-3 flex items-center gap-3" style={{ background: "rgba(251,191,36,0.12)", border: "1.5px solid rgba(251,191,36,0.4)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#d97706" }} />
          <p className="text-sm font-semibold flex-1" style={{ color: "#1e2535" }}>
            {pendingReqs.length} patient{pendingReqs.length > 1 ? "s are" : " is"} waiting for a response
          </p>
          <button onClick={() => setFilter("requests")} className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: "rgba(251,191,36,0.25)", color: "#d97706" }}>
            Review now →
          </button>
        </div>
      )}

      {/* ── View toggle + tabs ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setFilter(t.key); setView("list"); }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={filter === t.key ? { background: "#FA6F30", color: "#fff" } : { background: "rgba(255,255,255,0.55)", color: "#1e2535", border: "1px solid rgba(30,37,53,0.12)" }}>
              {t.label}
              {t.count > 0 && <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center"
                style={{ background: filter === t.key ? "rgba(255,255,255,0.25)" : "rgba(250,111,48,0.25)", color: filter === t.key ? "#fff" : "#FA6F30" }}>{t.count}</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 p-0.5 rounded-xl" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(30,37,53,0.1)" }}>
          <button onClick={() => setView("list")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={view === "list" ? { background: "#fff", color: "#1e2535", boxShadow: "0 1px 6px rgba(30,37,53,0.1)" } : { color: "rgba(30,37,53,0.45)" }}>
            <LayoutList className="w-3.5 h-3.5" />List
          </button>
          <button onClick={() => setView("week")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={view === "week" ? { background: "#fff", color: "#1e2535", boxShadow: "0 1px 6px rgba(30,37,53,0.1)" } : { color: "rgba(30,37,53,0.45)" }}>
            <LayoutGrid className="w-3.5 h-3.5" />Week
          </button>
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-20 rounded-2xl" style={{ background: "rgba(255,255,255,0.4)", border: "1px solid rgba(30,37,53,0.07)" }}>
              <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.18)" }} />
              <p className="font-semibold" style={{ color: "#1e2535" }}>Nothing here yet</p>
              <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.4)" }}>Appointments will appear here when patients book with you.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Group by date */}
              {Object.entries(
                filtered.reduce((acc, a) => {
                  const key = appointmentDateKey(a.appointment_date) || "unscheduled";
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(a);
                  return acc;
                }, {})
              ).sort(([a],[b]) => a.localeCompare(b)).map(([date, appts]) => (
                <div key={date}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2 mt-4 first:mt-0" style={{ color: "rgba(30,37,53,0.4)" }}>
                    {date === "unscheduled" ? "Unscheduled" : dateLabel(date)}
                    {date !== "unscheduled" && isAppointmentDateToday(date) && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-black" style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10" }}>TODAY</span>
                    )}
                  </p>
                  {appts.map(a => {
                    const sc = STATUS[a.status] || STATUS.confirmed;
                    const serviceLabel = appointmentServiceLabel(a);
                    const gfeStatus = appointmentGfeDisplayStatus(a);
                    const gfeLink = appointmentGfeLink(a);
                    const messageUnread = unreadCountForThread(unreadSummary, a.id);
                    const openMessages = (e) => {
                      e.stopPropagation();
                      setMsgDialog(a);
                    };
                    return (
                      <button key={a.id} onClick={() => openDetail(a)}
                        className="w-full text-left rounded-2xl mb-2 transition-all hover:shadow-md overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.7)", border: a.status === "requested" ? "1.5px solid rgba(251,191,36,0.5)" : "1px solid rgba(30,37,53,0.07)", boxShadow: "0 1px 8px rgba(30,37,53,0.04)" }}>
                        <div className="p-4 flex items-center gap-3">
                          {/* Status stripe */}
                          <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: sc.dot, minHeight: 40 }} />

                          {/* Time block */}
                          <div className="min-w-[4.75rem] text-center flex-shrink-0">
                            {a.appointment_time ? (
                              <>
                                <p className="text-sm font-bold whitespace-nowrap leading-tight" style={{ color: "#1e2535" }}>{formatAppointmentTime(a.appointment_time)}</p>
                                <p className="text-[10px]" style={{ color: "rgba(30,37,53,0.4)" }}>{a.duration_minutes ? `${a.duration_minutes}m` : ""}</p>
                              </>
                            ) : (
                              <p className="text-xs italic" style={{ color: "rgba(30,37,53,0.3)" }}>TBD</p>
                            )}
                          </div>

                          {/* Patient + service */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm" style={{ color: "#1e2535" }}>{a.patient_name || a.patient_email || "Patient"}</p>
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                              <GFEStatusBadge status={gfeStatus} examUrl={gfeLink || undefined} />
                              {messageUnread > 0 && (
                                <span
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: "rgba(250,111,48,0.15)", color: "#FA6F30" }}
                                >
                                  New message
                                </span>
                              )}
                            </div>
                            {a.patient_email && (
                              <p className="text-xs flex items-center gap-1 mt-0.5 truncate" style={{ color: "rgba(30,37,53,0.5)" }}>
                                <Mail className="w-3 h-3 flex-shrink-0" />{a.patient_email}
                              </p>
                            )}
                            {serviceLabel ? (
                              <p className="text-xs mt-0.5 font-medium" style={{ color: "rgba(30,37,53,0.55)" }}>{serviceLabel}</p>
                            ) : null}
                            {a.status === "requested" && a.referral_code && (
                              <p
                                className="text-[11px] mt-1 font-medium"
                                style={{ color: "#7c3aed" }}
                              >
                                Referral used: <span className="font-mono">{a.referral_code}</span>
                              </p>
                            )}
                            {a.patient_notes && (
                              <p className="text-xs mt-1 italic truncate" style={{ color: "rgba(30,37,53,0.4)" }}>"{a.patient_notes}"</p>
                            )}
                          </div>

                          <AppointmentPaymentDisplay appt={a} />

                          <div className="flex gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={openMessages}
                              title="Open messages"
                              className="w-8 h-8 rounded-xl flex items-center justify-center relative transition-all hover:opacity-80"
                              style={{
                                background: messageUnread > 0 ? "rgba(250,111,48,0.12)" : "rgba(30,37,53,0.05)",
                                color: messageUnread > 0 ? "#FA6F30" : "rgba(30,37,53,0.45)",
                                border: messageUnread > 0 ? "1px solid rgba(250,111,48,0.35)" : "1px solid rgba(30,37,53,0.1)",
                              }}
                            >
                              <MessageSquare className="w-4 h-4" />
                              <MessageUnreadBadge count={messageUnread} />
                            </button>
                            {a.status === "requested" && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openConfirmDialog(a);
                                  }}
                                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
                                  style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10", border: "1px solid rgba(200,230,60,0.4)" }}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCancelDialog({ open: true, appt: a, isDecline: true });
                                  }}
                                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
                                  style={{ background: "rgba(218,106,99,0.12)", color: "#DA6A63", border: "1px solid rgba(218,106,99,0.3)" }}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetail(a);
                              }}
                              title="View details"
                              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
                              style={{ background: "rgba(30,37,53,0.05)", color: "rgba(30,37,53,0.45)", border: "1px solid rgba(30,37,53,0.1)" }}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── WEEK VIEW ── */}
      {view === "week" && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.08)" }}>
          {/* Week nav */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3" style={{ borderBottom: "1px solid rgba(30,37,53,0.07)" }}>
            <button type="button" onClick={() => setWeekStart((d) => subWeeks(d, 1))} className="p-1.5 rounded-lg hover:bg-slate-100" style={{ color: "rgba(30,37,53,0.4)" }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>
                {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                {weekFiltered.length} appointment{weekFiltered.length !== 1 ? "s" : ""} this week
              </p>
            </div>
            <button type="button" onClick={() => setWeekStart((d) => addWeeks(d, 1))} className="p-1.5 rounded-lg hover:bg-slate-100" style={{ color: "rgba(30,37,53,0.4)" }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {weekFiltered.length === 0 ? (
            <div className="text-center py-16 px-6">
              <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.18)" }} />
              <p className="font-semibold" style={{ color: "#1e2535" }}>No appointments this week</p>
              <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.4)" }}>Try another week or switch filters.</p>
            </div>
          ) : (
            <>
              {/* Mobile: day-by-day agenda */}
              <div className="md:hidden px-4 py-4 space-y-4">
                {weekDays.map((d) => {
                  const dayAppts = appointmentsOnDay(weekFiltered, d);
                  if (dayAppts.length === 0) return null;
                  return (
                    <div key={d.toISOString()}>
                      <div
                        className="flex items-center gap-2 mb-2 px-1"
                        style={isToday(d) ? { color: "#4a6b10" } : { color: "rgba(30,37,53,0.55)" }}
                      >
                        <p className="text-xs font-bold uppercase tracking-wider">{format(d, "EEE")}</p>
                        <p className="text-lg font-bold leading-none" style={{ color: isToday(d) ? "#1e2535" : "#1e2535" }}>
                          {format(d, "MMM d")}
                        </p>
                        {isToday(d) && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10" }}>
                            TODAY
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {dayAppts.map((a) => (
                          <WeekAgendaCard key={a.id} appt={a} onClick={openDetail} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: time grid */}
              <div className="hidden md:block overflow-x-auto">
                <div className="min-w-[720px]">
                  <div className="grid" style={{ gridTemplateColumns: "48px repeat(7, minmax(0, 1fr))" }}>
                    <div />
                    {weekDays.map((d) => {
                      const dayCount = appointmentsOnDay(weekFiltered, d).length;
                      return (
                        <div
                          key={d.toISOString()}
                          className="px-2 py-2.5 text-center min-w-0"
                          style={{ borderLeft: "1px solid rgba(30,37,53,0.06)", background: isToday(d) ? "rgba(200,230,60,0.08)" : "transparent" }}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isToday(d) ? "#4a6b10" : "rgba(30,37,53,0.4)" }}>
                            {format(d, "EEE")}
                          </p>
                          <p className="font-bold text-lg leading-tight" style={{ color: isToday(d) ? "#4a6b10" : "#1e2535" }}>
                            {format(d, "d")}
                          </p>
                          {dayCount > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full mx-auto mt-0.5" style={{ background: isToday(d) ? "#C8E63C" : "#FA6F30" }} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
                    {HOURS.map((h) => (
                      <div key={h} className="grid" style={{ gridTemplateColumns: "4.75rem repeat(7, minmax(0, 1fr))", minHeight: 52 }}>
                        <div className="flex items-start justify-end pr-2 pt-1">
                          <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: "rgba(30,37,53,0.3)" }}>
                            {formatHourLabel(h)}
                          </span>
                        </div>
                        {weekDays.map((d) => {
                          const dayAppts = appointmentsOnDay(weekFiltered, d).filter((a) => {
                            const apptH = appointmentHour(a.appointment_time);
                            if (apptH == null) return h === 9;
                            return apptH === h;
                          });
                          return (
                            <div
                              key={d.toISOString()}
                              className="px-1 py-0.5 space-y-0.5 min-w-0 overflow-hidden"
                              style={{
                                borderLeft: "1px solid rgba(30,37,53,0.06)",
                                borderTop: "1px solid rgba(30,37,53,0.04)",
                                background: isToday(d) ? "rgba(200,230,60,0.03)" : "transparent",
                              }}
                            >
                              {dayAppts.map((a) => (
                                <CalApptPill key={a.id} appt={a} onClick={openDetail} />
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Detail slide-over ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          {selectedAppt && (
            <>
            <DialogHeader className="sr-only">
              <DialogTitle>
                {appointmentServiceLabel(selectedAppt) || "Appointment"} — {selectedAppt.patient_name || "Patient"}
              </DialogTitle>
            </DialogHeader>
            <ApptDetail
              appt={selectedAppt}
              treatmentRecords={treatmentRecords}
              gfeSending={Boolean(gfeSending[selectedAppt?.id])}
              gfeFeedback={gfeFeedback}
              onClose={() => setDetailOpen(false)}
              onConfirm={() => { openConfirmDialog(selectedAppt); setDetailOpen(false); }}
              onCancel={() => { setCancelDialog({ open: true, appt: selectedAppt, isDecline: selectedAppt.status === "requested" }); setDetailOpen(false); }}
              onComplete={() => {
                if (appointmentDepositBlocksProvider(selectedAppt)) {
                  toast({
                    title: "Booking deposit required",
                    description: "The patient must pay the booking deposit before you can mark this appointment done.",
                    variant: "destructive",
                  });
                  return;
                }
                markComplete.mutate(
                  { id: selectedAppt.id },
                  {
                    onSuccess: () => setCompletePrompt({ open: true, appt: selectedAppt }),
                  }
                );
              }}
              onNoShow={() => markNoShow.mutate({ id: selectedAppt.id })}
              noShowPending={markNoShow.isPending}
              onSendGFE={() => sendGFE(selectedAppt)}
              onDoc={() => {
                const existing = findTreatmentRecordForAppointment(treatmentRecords, selectedAppt);
                if (appointmentDepositBlocksProvider(selectedAppt) && !existing) {
                  toast({
                    title: "Booking deposit required",
                    description: "The patient must pay the booking deposit before you can log treatment for this visit.",
                    variant: "destructive",
                  });
                  return;
                }
                setDocDialog({ open: true, appt: selectedAppt, existing: existing || null });
                setDetailOpen(false);
              }}
              onMessage={() => {
                setMsgDialog(selectedAppt);
                setDetailOpen(false);
              }}
              messageUnreadCount={unreadCountForThread(unreadSummary, selectedAppt?.id)}
              confirmActionLabel={confirmActionLabel}
            />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirm dialog ── */}
      <Dialog open={confirmDialog.open} onOpenChange={v => setConfirmDialog(d => ({ ...d, open: v }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'DM Serif Display', serif" }}>
              Confirm Appointment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
              {appointmentServiceLabel(confirmDialog.appt)} · {confirmDialog.appt?.patient_name} · {formatAppointmentDate(confirmDialog.appt?.appointment_date)}
              {confirmDialog.appt?.appointment_time ? ` · ${formatAppointmentTime(confirmDialog.appt.appointment_time)}` : ""}
            </p>
            <p className="text-xs rounded-xl px-3 py-2" style={{ background: "rgba(250,111,48,0.08)", color: "rgba(30,37,53,0.65)" }}>
              {profileBookingDeposit > 0 ? (
                <>
                  Booking deposit: <strong>${profileBookingDeposit}</strong> from your Practice Profile. The patient will pay via Stripe after their visit. You cannot log treatment or mark done until it is paid. The deposit is deducted from the final treatment checkout.
                  {" "}To change this amount, update <strong>Practice Profile → Booking Deposit</strong>.
                </>
              ) : (
                <>
                  No booking deposit on your Practice Profile — this appointment will confirm immediately.
                  Treatment is billed separately after the visit.
                </>
              )}
            </p>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(30,37,53,0.55)" }}>Set appointment time (optional)</label>
              <input type="time" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none" value={confirmTime} onChange={e => setConfirmTime(e.target.value)}
                style={{ borderColor: "rgba(30,37,53,0.15)", background: "rgba(255,255,255,0.7)" }} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDialog({ open: false, appt: null })}>Back</Button>
              <Button className="flex-1 gap-1.5" style={{ background: "#FA6F30", color: "#fff" }}
                onClick={() => confirmAppt.mutate({ id: confirmDialog.appt?.id })} disabled={confirmAppt.isPending}>
                <CheckCircle className="w-4 h-4" />{confirmAppt.isPending ? "Confirming…" : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Cancel dialog ── */}
      <Dialog open={cancelDialog.open} onOpenChange={v => setCancelDialog(d => ({ ...d, open: v }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle style={{ fontFamily: "'DM Serif Display', serif" }}>{cancelDialog.isDecline ? "Decline Request" : "Cancel Appointment"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>{appointmentServiceLabel(cancelDialog.appt)} · {cancelDialog.appt?.patient_name}</p>
            <Textarea placeholder="Reason (optional)…" rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCancelDialog({ open: false, appt: null })}>Back</Button>
              <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                onClick={() => cancelAppt.mutate({ id: cancelDialog.appt?.id })} disabled={cancelAppt.isPending}>
                {cancelDialog.isDecline ? "Decline" : "Cancel"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Mark complete → document prompt ── */}
      <Dialog open={completePrompt.open} onOpenChange={(v) => !v && setCompletePrompt({ open: false, appt: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'DM Serif Display', serif" }}>Treatment Complete</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.65)" }}>
            Would you like to document this treatment now? Your MD requires a record for every completed session.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setCompletePrompt({ open: false, appt: null })}>Later</Button>
            <Button
              style={{ background: "#FA6F30", color: "#fff" }}
              onClick={() => {
                const appt = completePrompt.appt;
                const existing = findTreatmentRecordForAppointment(treatmentRecords, appt);
                setCompletePrompt({ open: false, appt: null });
                setDocDialog({ open: true, appt, existing: existing || null });
              }}
            >
              Document Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!msgDialog} onOpenChange={() => setMsgDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message {msgDialog?.patient_name || "Patient"}</DialogTitle>
          </DialogHeader>
          {msgDialog && (
            <MessageThread
              appointmentId={msgDialog.id}
              recipientId={msgDialog.patient_id}
              recipientName={msgDialog.patient_name}
              recipientEmail={msgDialog.patient_email}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Treatment doc dialog ── */}
      <TreatmentDocumentDialog
        open={docDialog.open}
        onClose={() => setDocDialog({ open: false, appt: null, existing: null })}
        appointment={docDialog.appt}
        existingRecord={docDialog.existing}
        providerMe={me}
      />
    </div>
  );
}