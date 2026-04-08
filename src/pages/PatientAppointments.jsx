import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, User, MessageSquare, FileText, DollarSign, Star, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import MessageThread from "@/components/messaging/MessageThread";
import ConsentFormDialog from "@/components/appointments/ConsentFormDialog";

const statusColor = {
  requested: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-slate-100 text-slate-600",
  awaiting_payment: "bg-purple-100 text-purple-700",
  awaiting_consent: "bg-orange-100 text-orange-700",
};

export default function PatientAppointments() {
  const qc = useQueryClient();
  const [msgDialog, setMsgDialog] = useState(null);
  const [consentDialog, setConsentDialog] = useState(null);
  const [reviewDialog, setReviewDialog] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [recordDialog, setRecordDialog] = useState(null);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["patient-appointments"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Appointment.filter({ patient_id: me.id }, "-appointment_date");
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["my-treatment-records"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.TreatmentRecord.filter({ patient_id: me.id }, "-treatment_date");
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Review.filter({ patient_id: me.id });
    },
  });

  const cancel = useMutation({
    mutationFn: (id) => base44.entities.Appointment.update(id, { status: "cancelled", cancellation_reason: "Cancelled by patient" }),
    onSuccess: () => qc.invalidateQueries(["patient-appointments"]),
  });

  const payDeposit = useMutation({
    mutationFn: async (appointmentId) => {
      try {
        const res = await base44.functions.invoke("createAppointmentPayment", { appointment_id: appointmentId });
        if (res.data?.sessionUrl) {
          window.location.href = res.data.sessionUrl;
        } else if (res.data?.error) {
          alert(`Payment unavailable: ${res.data.error}`);
        }
      } catch (error) {
        alert('Payment system temporarily unavailable. Please contact the provider directly.');
        console.error('Payment error:', error);
      }
    },
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      const me = await base44.auth.me();
      await base44.entities.Review.create({
        patient_id: me.id,
        patient_name: me.full_name,
        provider_id: reviewDialog.provider_id,
        appointment_id: reviewDialog.id,
        ...reviewForm,
        is_verified: true,
      });
      await base44.entities.Appointment.update(reviewDialog.id, {
        review_requested_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(["my-reviews"]);
      qc.invalidateQueries(["patient-appointments"]);
      setReviewDialog(null);
      setReviewForm({ rating: 5, comment: "" });
    },
  });

  const upcoming = appointments.filter(a => ["requested", "confirmed", "awaiting_payment", "awaiting_consent"].includes(a.status));
  const past = appointments.filter(a => ["completed", "cancelled", "no_show"].includes(a.status));

  const hasReviewed = (apptId) => reviews.some(r => r.appointment_id === apptId);
  const getRecord = (apptId) => records.find(r => r.appointment_id === apptId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Appointments</h2>
        <p className="text-slate-500 text-sm mt-1">{upcoming.length} upcoming</p>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          <TabsTrigger value="records">Treatment Records ({records.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-3">
          {upcoming.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-12 h-12 mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400">No upcoming appointments</p>
            </div>
          ) : (
            upcoming.map(a => (
              <Card key={a.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{a.service}</span>
                          <Badge className={statusColor[a.status]}>{a.status.replace(/_/g, " ")}</Badge>
                        </div>
                        <div className="flex gap-3 text-sm text-slate-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{a.provider_name}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />
                            {a.appointment_date ? format(new Date(a.appointment_date), "MMM d, yyyy") : ""}
                          </span>
                          {a.appointment_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{a.appointment_time}</span>}
                          {a.deposit_amount && <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />${a.deposit_amount} deposit</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {a.status === "awaiting_payment" && (
                        <Button size="sm" style={{ background: "#7B8EC8", color: "#fff" }} onClick={() => payDeposit.mutate(a.id)} className="gap-1">
                          <DollarSign className="w-3.5 h-3.5" /> Pay Deposit
                        </Button>
                      )}
                      {a.status === "awaiting_consent" && (
                        <Button size="sm" style={{ background: "#FA6F30", color: "#fff" }} onClick={() => setConsentDialog(a)} className="gap-1">
                          <FileText className="w-3.5 h-3.5" /> Sign Consent Form
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setMsgDialog(a)} className="gap-1">
                        <MessageSquare className="w-3.5 h-3.5" /> Message Provider
                      </Button>
                      {["requested", "confirmed", "awaiting_payment", "awaiting_consent"].includes(a.status) && (
                        <Button size="sm" variant="outline" className="text-red-500" onClick={() => cancel.mutate(a.id)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-3">
          {past.length === 0 ? (
            <div className="text-center py-16 text-slate-400">No past appointments</div>
          ) : (
            past.map(a => {
              const record = getRecord(a.id);
              const reviewed = hasReviewed(a.id);
              return (
                <Card key={a.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900">{a.service}</span>
                            <Badge className={statusColor[a.status]}>{a.status}</Badge>
                          </div>
                          <div className="flex gap-3 text-sm text-slate-500 mt-1 flex-wrap">
                            <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{a.provider_name}</span>
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />
                              {a.appointment_date ? format(new Date(a.appointment_date), "MMM d, yyyy") : ""}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {record && (
                          <Button size="sm" variant="outline" onClick={() => setRecordDialog(record)} className="gap-1">
                            <ImageIcon className="w-3.5 h-3.5" /> View Treatment Record
                          </Button>
                        )}
                        {a.status === "completed" && !reviewed && (
                          <Button size="sm" style={{ background: "#C8E63C", color: "#1e2535" }} onClick={() => setReviewDialog(a)} className="gap-1">
                            <Star className="w-3.5 h-3.5" /> Leave Review
                          </Button>
                        )}
                        {reviewed && <Badge variant="outline" className="text-xs">✓ Reviewed</Badge>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="records" className="space-y-3">
          {records.length === 0 ? (
            <div className="text-center py-16 text-slate-400">No treatment records yet</div>
          ) : (
            records.map(r => (
              <Card key={r.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setRecordDialog(r)}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{r.service}</p>
                      <div className="flex gap-3 text-sm text-slate-500 mt-1 flex-wrap">
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{r.provider_name}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />
                          {r.treatment_date ? format(new Date(r.treatment_date), "MMM d, yyyy") : ""}
                        </span>
                        {r.areas_treated && <span className="text-xs">{r.areas_treated.join(", ")}</span>}
                      </div>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {(r.before_photo_urls?.length || 0) + (r.after_photo_urls?.length || 0)} photos
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Message Dialog */}
      <Dialog open={!!msgDialog} onOpenChange={() => setMsgDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Message {msgDialog?.provider_name}</DialogTitle></DialogHeader>
          {msgDialog && (
            <MessageThread
              appointmentId={msgDialog.id}
              recipientId={msgDialog.provider_id}
              recipientName={msgDialog.provider_name}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Consent Form Dialog */}
      {consentDialog && (
        <ConsentFormDialog
          open={!!consentDialog}
          onClose={() => setConsentDialog(null)}
          appointment={consentDialog}
          onComplete={() => qc.invalidateQueries(["patient-appointments"])}
        />
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Leave a Review</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">{reviewDialog?.service}</p>
              <p className="text-sm text-slate-500">{reviewDialog?.provider_name}</p>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Rating</p>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setReviewForm({...reviewForm, rating: n})} className="text-3xl transition-all hover:scale-110">
                    {n <= reviewForm.rating ? "⭐" : "☆"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Your Experience</p>
              <textarea
                value={reviewForm.comment}
                onChange={e => setReviewForm({...reviewForm, comment: e.target.value})}
                placeholder="Share your experience with this provider..."
                rows={4}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReviewDialog(null)}>Cancel</Button>
              <Button style={{ background: "#C8E63C", color: "#1e2535" }} onClick={() => submitReview.mutate()} disabled={submitReview.isPending}>
                Submit Review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Treatment Record Dialog */}
      <Dialog open={!!recordDialog} onOpenChange={() => setRecordDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Treatment Record</DialogTitle></DialogHeader>
          {recordDialog && (
            <div className="space-y-4 pt-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">{recordDialog.service}</p>
                <p className="text-sm text-slate-500">{recordDialog.provider_name} | {recordDialog.treatment_date ? format(new Date(recordDialog.treatment_date), "MMM d, yyyy") : ""}</p>
              </div>
              {recordDialog.areas_treated && recordDialog.areas_treated.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-1">Areas Treated</p>
                  <div className="flex gap-1 flex-wrap">
                    {recordDialog.areas_treated.map(area => (
                      <Badge key={area} variant="outline">{area}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {recordDialog.clinical_notes && (
                <div>
                  <p className="text-sm font-semibold mb-1">Clinical Notes</p>
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl">{recordDialog.clinical_notes}</p>
                </div>
              )}
              {recordDialog.before_photo_urls && recordDialog.before_photo_urls.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Before Photos</p>
                  <div className="grid grid-cols-2 gap-2">
                    {recordDialog.before_photo_urls.map((url, i) => (
                      <img key={i} src={url} alt="Before" className="rounded-xl w-full h-48 object-cover border" />
                    ))}
                  </div>
                </div>
              )}
              {recordDialog.after_photo_urls && recordDialog.after_photo_urls.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">After Photos</p>
                  <div className="grid grid-cols-2 gap-2">
                    {recordDialog.after_photo_urls.map((url, i) => (
                      <img key={i} src={url} alt="After" className="rounded-xl w-full h-48 object-cover border" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}