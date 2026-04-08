import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, MessageSquare, FileUser } from "lucide-react";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ServiceLockGate from "@/components/ServiceLockGate";
import MessageThread from "@/components/messaging/MessageThread";
import PatientChartView from "@/components/provider/PatientChartView";

const statusColor = {
  requested: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-slate-100 text-slate-600",
};

export default function ProviderAppointments() {
  const qc = useQueryClient();
  const [notesDialog, setNotesDialog] = useState({ open: false, appointment: null });
  const [notesText, setNotesText] = useState("");
  const [msgDialog, setMsgDialog] = useState(null);
  const [chartDialog, setChartDialog] = useState(null);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["my-appointments"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Appointment.filter({ provider_id: me.id }, "-appointment_date");
    },
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Appointment.update(id, data),
    onSuccess: () => qc.invalidateQueries(["my-appointments"]),
  });

  const saveNotes = useMutation({
    mutationFn: ({ id }) => base44.entities.Appointment.update(id, { notes: notesText }),
    onSuccess: () => {
      qc.invalidateQueries(["my-appointments"]);
      setNotesDialog({ open: false, appointment: null });
    },
  });

  return (
    <ServiceLockGate feature="appointments" bypass>
      <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Appointments</h2>
        <p className="text-slate-500 text-sm mt-1">{appointments.filter(a => a.status === "confirmed").length} upcoming</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <Card key={i} className="h-24 animate-pulse bg-slate-100" />)}</div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400">No appointments yet. Patients will book from the marketplace once your practice is active.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map(a => (
            <Card key={a.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{a.service}</span>
                      <Badge className={statusColor[a.status]}>{a.status}</Badge>
                    </div>
                    <div className="flex gap-3 text-sm text-slate-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{a.patient_name || a.patient_email}</span>
                      {a.patient_email && <span className="flex items-center gap-1 text-xs">{a.patient_email}</span>}
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />
                        {a.appointment_date ? format(new Date(a.appointment_date), "MMM d, yyyy") : ""}
                      </span>
                      {a.appointment_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{a.appointment_time}</span>}
                    </div>
                    {a.patient_notes && <p className="text-xs text-slate-400 mt-1">Patient notes: {a.patient_notes}</p>}
                    {a.notes && <p className="text-xs text-blue-600 mt-1">Your notes: {a.notes}</p>}
                    {!a.consent_signed && a.status === "confirmed" && (
                      <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs mt-1">Awaiting consent form</Badge>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap">
                    <Button size="sm" variant="outline" className="gap-1"
                      onClick={() => setChartDialog(a)}>
                      <FileUser className="w-3.5 h-3.5" /> Patient Chart
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1"
                      onClick={() => setMsgDialog(a)}>
                      <MessageSquare className="w-3.5 h-3.5" /> Message
                    </Button>
                    {a.status === "requested" && (
                      <>
                        <Button size="sm" style={{ background: "#FA6F30", color: "#fff" }}
                          onClick={async () => {
                            await update.mutateAsync({ id: a.id, data: { status: "awaiting_payment", confirmed_at: new Date().toISOString() } });
                            // Notify patient
                            await base44.entities.Notification.create({
                              user_id: a.patient_id,
                              user_email: a.patient_email,
                              type: 'general',
                              message: `Your appointment with ${a.provider_name} has been confirmed! Please complete payment.`,
                              link_page: 'PatientAppointments'
                            });
                          }}>
                          Confirm & Request Payment
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-500"
                          onClick={async () => {
                            await update.mutateAsync({ id: a.id, data: { status: "cancelled", cancellation_reason: "Declined by provider" } });
                            // Notify patient
                            await base44.entities.Notification.create({
                              user_id: a.patient_id,
                              user_email: a.patient_email,
                              type: 'general',
                              message: `Your appointment request for ${a.service} was declined. Please try another provider or time.`,
                              link_page: 'PatientAppointments'
                            });
                          }}>
                          Decline
                        </Button>
                      </>
                    )}
                    {a.status === "confirmed" && (
                      <>
                        <Button size="sm" variant="outline"
                          onClick={() => update.mutate({ id: a.id, data: { status: "completed", completed_at: new Date().toISOString() } })}>
                          Mark Complete
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-500"
                          onClick={() => update.mutate({ id: a.id, data: { status: "cancelled" } })}>
                          Cancel
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="gap-1 text-slate-400"
                      onClick={() => { setNotesDialog({ open: true, appointment: a }); setNotesText(a.notes || ""); }}>
                      Notes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>

      <Dialog open={notesDialog.open} onOpenChange={v => setNotesDialog(d => ({ ...d, open: v }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Appointment Notes</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-slate-500">
              {notesDialog.appointment?.service} — {notesDialog.appointment?.patient_name}
            </p>
            <Textarea
              placeholder="Add your notes for this appointment..."
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              rows={5}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setNotesDialog({ open: false, appointment: null })}>Cancel</Button>
              <Button style={{ background: "#FA6F30", color: "#fff" }}
                onClick={() => saveNotes.mutate({ id: notesDialog.appointment?.id })}
                disabled={saveNotes.isPending}>
                Save Notes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!msgDialog} onOpenChange={() => setMsgDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Message {msgDialog?.patient_name}</DialogTitle></DialogHeader>
          {msgDialog && (
            <MessageThread
              appointmentId={msgDialog.id}
              recipientId={msgDialog.patient_id}
              recipientName={msgDialog.patient_name}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!chartDialog} onOpenChange={() => setChartDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Patient Chart - {chartDialog?.patient_name}</DialogTitle></DialogHeader>
          {chartDialog && <PatientChartView patientId={chartDialog.patient_id} />}
        </DialogContent>
      </Dialog>
    </ServiceLockGate>
  );
}