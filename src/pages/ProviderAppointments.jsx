import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { appointmentsApi } from "@/api/appointmentsApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar, Clock, User, MessageSquare, FileUser, AlertTriangle, Mail,
} from "lucide-react";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ServiceLockGate from "@/components/ServiceLockGate";
import MessageThread from "@/components/messaging/MessageThread";
import MessageUnreadBadge from "@/components/messaging/MessageUnreadBadge";
import { useAppointmentMessageUnread, unreadCountForThread } from "@/hooks/useAppointmentMessageUnread";
import PatientChartView from "@/components/provider/PatientChartView";
import { subscribeAppointmentsRefresh } from "@/lib/appointmentSync";
import { appointmentServiceLabel, formatAppointmentDate } from "@/lib/appointmentDisplay";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { legacyPreBookingThreadId } from "@/lib/appointmentMessageThreads";

const STATUS_STYLES = {
  requested: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  no_show: "bg-slate-100 text-slate-700 border-slate-200",
  awaiting_payment: "bg-purple-100 text-purple-800 border-purple-200",
  awaiting_consent: "bg-orange-100 text-orange-800 border-orange-200",
};

const STATUS_LABELS = {
  requested: "Requested",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
  awaiting_payment: "Awaiting Payment",
  awaiting_consent: "Awaiting Consent",
};

function sortAppointmentsNewestFirst(rows) {
  return [...(rows || [])].sort((a, b) => {
    const av = String(a.appointment_date || "");
    const bv = String(b.appointment_date || "");
    if (av !== bv) return av < bv ? 1 : av > bv ? -1 : 0;
    const ac = String(a.created_at || a.created_date || "");
    const bc = String(b.created_at || b.created_date || "");
    if (ac !== bc) return ac < bc ? 1 : ac > bc ? -1 : 0;
    return String(b.appointment_time || "").localeCompare(String(a.appointment_time || ""));
  });
}

function StatusBadge({ status }) {
  const key = String(status || "").toLowerCase();
  return (
    <Badge variant="outline" className={STATUS_STYLES[key] || "bg-slate-100 text-slate-600"}>
      {STATUS_LABELS[key] || status || "—"}
    </Badge>
  );
}

function AppointmentCard({
  appointment: a,
  messageUnread,
  onChart,
  onMessage,
  onNotes,
  onConfirmDeposit,
  onDecline,
  onComplete,
  onCancel,
  actionsPending,
}) {
  const service = appointmentServiceLabel(a);
  const dateLabel = formatAppointmentDate(a.appointment_date, "MMM d, yyyy");

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900">{service || "Appointment"}</span>
              <StatusBadge status={a.status} />
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span className="flex items-center gap-1 font-medium text-slate-800">
                <User className="w-3.5 h-3.5 shrink-0" />
                {a.patient_name || "Patient"}
              </span>
              {a.patient_email && (
                <span className="flex items-center gap-1 text-slate-500">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  {a.patient_email}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-slate-500">
              {a.appointment_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {dateLabel}
                </span>
              )}
              {a.appointment_time && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {String(a.appointment_time).slice(0, 5)}
                </span>
              )}
            </div>

            {a.patient_notes && (
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Patient notes</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.patient_notes}</p>
              </div>
            )}

            {a.notes && (
              <div className="rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500 mb-0.5">Your private notes</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.notes}</p>
              </div>
            )}

            {!a.consent_signed && a.status === "confirmed" && (
              <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Awaiting consent form
              </div>
            )}

            {a.status === "awaiting_payment" && (
              <p className="text-xs text-purple-700 font-medium">
                Waiting for patient deposit{a.deposit_amount ? ` ($${a.deposit_amount})` : ""}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0 w-full lg:w-auto">
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={!a.patient_id}
                onClick={() => onChart(a)}
              >
                <FileUser className="w-3.5 h-3.5" /> Patient Chart
              </Button>
              <Button size="sm" variant="outline" className="gap-1 relative" onClick={() => onMessage(a)}>
                <MessageSquare className="w-3.5 h-3.5" /> Message
                <MessageUnreadBadge count={messageUnread} />
              </Button>
              <Button size="sm" variant="ghost" className="text-slate-500" onClick={() => onNotes(a)}>
                Notes
              </Button>
            </div>

            {a.status === "requested" && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  className="h-auto min-h-9 py-2 whitespace-normal text-center leading-snug"
                  style={{ background: "#FA6F30", color: "#fff" }}
                  onClick={() => onConfirmDeposit(a.id)}
                  disabled={actionsPending}
                >
                  Confirm &amp; Request Payment
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200"
                  onClick={() => onDecline(a.id)}
                  disabled={actionsPending}
                >
                  Decline
                </Button>
              </div>
            )}

            {a.status === "confirmed" && (
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => onComplete(a.id)} disabled={actionsPending}>
                  Mark Complete
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600"
                  onClick={() => onCancel(a.id)}
                  disabled={actionsPending}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProviderAppointments() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notesDialog, setNotesDialog] = useState({ open: false, appointment: null });
  const [notesText, setNotesText] = useState("");
  const [msgDialog, setMsgDialog] = useState(null);
  const [chartDialog, setChartDialog] = useState(null);
  const { data: unreadSummary } = useAppointmentMessageUnread();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const legacyPreThreadId = me?.id ? legacyPreBookingThreadId(me.id) : null;
  const preUnread = useMemo(() => {
    const by = unreadSummary?.by_thread || {};
    return Object.entries(by).reduce(
      (sum, [tid, count]) =>
        tid.startsWith("pre-") || tid.startsWith("pre:") ? sum + Number(count || 0) : sum,
      0
    );
  }, [unreadSummary]);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["my-appointments"],
    queryFn: async () => sortAppointmentsNewestFirst(await appointmentsApi.listMine()),
    staleTime: 0,
    refetchInterval: (query) => {
      const rows = query.state.data;
      if (!Array.isArray(rows)) return 2000;
      return rows.some((a) => {
        const st = String(a.status || "").toLowerCase();
        return st === "requested" || st === "awaiting_payment";
      })
        ? 800
        : 2000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const openId = String(searchParams.get("open_message") || "").trim();
    if (!openId || !me?.id) return;

    if (openId.startsWith("pre-") || openId.startsWith("pre:")) {
      window.location.href = `${createPageUrl("ProviderMessaging")}?tab=patient_queries&thread_id=${encodeURIComponent(openId)}`;
      return;
    } else {
      const appt = (appointments || []).find((a) => String(a.id) === openId);
      if (appt) setMsgDialog(appt);
    }

    const next = new URLSearchParams(searchParams);
    next.delete("open_message");
    setSearchParams(next, { replace: true });
  }, [searchParams, appointments, setSearchParams, me?.id]);

  useEffect(() => {
    return subscribeAppointmentsRefresh(() => {
      void qc.refetchQueries({ queryKey: ["my-appointments"] });
    });
  }, [qc]);

  const update = useMutation({
    mutationFn: ({ id, data }) => appointmentsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-appointments"] }),
  });

  const requestDeposit = useMutation({
    mutationFn: (id) => appointmentsApi.requestDeposit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-appointments"] });
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
    },
  });

  const saveNotes = useMutation({
    mutationFn: ({ id }) => appointmentsApi.update(id, { notes: notesText }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-appointments"] });
      setNotesDialog({ open: false, appointment: null });
    },
  });

  const actionsPending = update.isPending || requestDeposit.isPending;

  const upcomingCount = useMemo(
    () => appointments.filter((a) => a.status === "confirmed").length,
    [appointments]
  );

  const handleDecline = (id) => {
    update.mutate({
      id,
      data: { status: "cancelled", cancellation_reason: "Declined by provider" },
    });
  };

  const handleComplete = (id) => {
    update.mutate({
      id,
      data: { status: "completed", completed_at: new Date().toISOString() },
    });
  };

  const handleCancel = (id) => {
    update.mutate({ id, data: { status: "cancelled" } });
  };

  return (
    <ServiceLockGate feature="appointments" bypass>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Appointments</h2>
          <p className="text-slate-500 text-sm mt-1">
            {appointments.length} total · {upcomingCount} confirmed upcoming
          </p>
        </div>

        {me?.id && (
          <Card className="border-indigo-100 bg-indigo-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                Pre-Appointment Messages
              </CardTitle>
              <p className="text-sm text-slate-500 font-normal">
                Patients can message you from the marketplace before booking. Manage all inquiries in Messages.
              </p>
            </CardHeader>
            <CardContent className="pt-0 flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-1 relative bg-white" asChild>
                <Link to={`${createPageUrl("ProviderMessaging")}?tab=patient_queries`}>
                  <MessageSquare className="w-3.5 h-3.5" />
                  Open pre-booking inbox
                  {preUnread > 0 && (
                    <span
                      className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center text-white"
                      style={{ background: "#FA6F30" }}
                    >
                      {preUnread > 9 ? "9+" : preUnread}
                    </span>
                  )}
                </Link>
              </Button>
              {legacyPreThreadId && unreadCountForThread(unreadSummary, legacyPreThreadId) > 0 && (
                <Button size="sm" variant="ghost" className="text-xs" asChild>
                  <Link
                    to={`${createPageUrl("ProviderMessaging")}?tab=patient_queries&thread_id=${encodeURIComponent(legacyPreThreadId)}`}
                  >
                    Legacy thread ({unreadCountForThread(unreadSummary, legacyPreThreadId)} unread)
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-28 animate-pulse bg-slate-100" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-dashed border-slate-200">
            <Calendar className="w-12 h-12 mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">No appointments yet</p>
            <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
              Patients will book from the marketplace once your practice is active. Pre-booking messages appear above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((a) => (
              <AppointmentCard
                key={a.id}
                appointment={a}
                messageUnread={unreadCountForThread(unreadSummary, a.id)}
                onChart={setChartDialog}
                onMessage={setMsgDialog}
                onNotes={(appt) => {
                  setNotesDialog({ open: true, appointment: appt });
                  setNotesText(appt.notes || "");
                }}
                onConfirmDeposit={(id) => requestDeposit.mutate(id)}
                onDecline={handleDecline}
                onComplete={handleComplete}
                onCancel={handleCancel}
                actionsPending={actionsPending}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={notesDialog.open} onOpenChange={(v) => setNotesDialog((d) => ({ ...d, open: v }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Private appointment notes</DialogTitle>
            <DialogDescription>Only you can see these — not shared with the patient.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-slate-500">
              {appointmentServiceLabel(notesDialog.appointment)} — {notesDialog.appointment?.patient_name}
            </p>
            <Textarea
              placeholder="Add your notes for this appointment..."
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              rows={5}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setNotesDialog({ open: false, appointment: null })}>
                Cancel
              </Button>
              <Button
                style={{ background: "#FA6F30", color: "#fff" }}
                onClick={() => saveNotes.mutate({ id: notesDialog.appointment?.id })}
                disabled={saveNotes.isPending}
              >
                Save Notes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!msgDialog} onOpenChange={() => setMsgDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message {msgDialog?.patient_name || "Patient"}</DialogTitle>
            <DialogDescription>
              Thread tied to this appointment ({msgDialog?.id}). For pre-booking chats, use marketplace inquiries above.
            </DialogDescription>
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

      <Dialog open={!!chartDialog} onOpenChange={() => setChartDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Patient chart — {chartDialog?.patient_name || "Patient"}</DialogTitle>
            <DialogDescription>
              Full history for this patient across appointments, treatments, consent, and journey data.
            </DialogDescription>
          </DialogHeader>
          {chartDialog?.patient_id && <PatientChartView patientId={chartDialog.patient_id} />}
        </DialogContent>
      </Dialog>
    </ServiceLockGate>
  );
}
