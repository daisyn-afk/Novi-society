import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentsApi } from "@/api/appointmentsApi";
import { sessionApi } from "@/api/sessionApi";
import { reviewsApi } from "@/api/reviewsApi";
import { treatmentRecordsApi } from "@/api/treatmentRecordsApi";

function sortByAppointmentDate(rows) {
  return [...(rows || [])].sort((a, b) => {
    const av = a.appointment_date || "";
    const bv = b.appointment_date || "";
    return av < bv ? 1 : av > bv ? -1 : 0;
  });
}

function treatmentPaymentSummary(appt) {
  const due =
    String(appt.treatment_payment_status || "").toLowerCase() === "awaiting_payment" &&
    Number(appt.treatment_amount) > 0;
  if (!due) return null;
  const treatment = formatTreatmentChargeLabel(appt.treatment_amount);
  const platformFee =
    Number(appt.platform_fee_amount) > 0 ? formatTreatmentChargeLabel(appt.platform_fee_amount) : null;
  const total = formatTreatmentChargeLabel(appt.treatment_charge_total ?? appt.treatment_amount);
  return { treatment, platformFee, total };
}
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, User, MessageSquare, FileText, DollarSign, Star, Image as ImageIcon } from "lucide-react";
import AppointmentGfePatientBlock from "@/components/appointments/AppointmentGfePatientBlock";
import { appointmentGfeDisplayStatus, gfeReturnNotice } from "@/lib/appointmentGfe";
import { GFE_FEE_LINE_LABEL, formatTreatmentChargeLabel } from "@/lib/gfePlatformFee";
import { format } from "date-fns";
import MessageThread from "@/components/messaging/MessageThread";
import MessageUnreadBadge from "@/components/messaging/MessageUnreadBadge";
import { useAppointmentMessageUnread, unreadCountForThread } from "@/hooks/useAppointmentMessageUnread";
import ConsentFormDialog from "@/components/appointments/ConsentFormDialog";
import { subscribeAppointmentsRefresh, broadcastAppointmentsRefresh } from "@/lib/appointmentSync";
import { redirectToStripeCheckout } from "@/lib/redirectToStripeCheckout";

const statusColor = {
  requested: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-slate-100 text-slate-600",
  awaiting_payment: "bg-purple-100 text-purple-700",
  awaiting_consent: "bg-orange-100 text-orange-700",
};

function formatDepositUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

function appointmentDepositDisplay(appointment) {
  return formatDepositUsd(appointment?.deposit_amount);
}

function patchAppointmentInCache(qc, queryKey, appointmentId, patch) {
  qc.setQueryData(queryKey, (old) => {
    if (!Array.isArray(old)) return old;
    return sortByAppointmentDate(
      old.map((a) => (a.id === appointmentId ? { ...a, ...patch } : a))
    );
  });
}

export default function PatientAppointments() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [msgDialog, setMsgDialog] = useState(null);
  const { data: unreadSummary } = useAppointmentMessageUnread();
  const [consentDialog, setConsentDialog] = useState(null);
  const [reviewDialog, setReviewDialog] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [recordDialog, setRecordDialog] = useState(null);
  const [paymentNotice, setPaymentNotice] = useState(null);
  const [gfeNotice, setGfeNotice] = useState(null);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["patient-appointments"],
    queryFn: async () => sortByAppointmentDate(await appointmentsApi.listMine()),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const rows = query.state.data;
      if (!Array.isArray(rows)) return false;
      if (rows.some((a) => String(a.status || "").toLowerCase() === "awaiting_payment")) return 1500;
      if (rows.some((a) => String(a.treatment_payment_status || "").toLowerCase() === "awaiting_payment")) {
        return 1500;
      }
      return rows.some(
        (a) =>
          a.requires_gfe === true &&
          ["pending", "not_sent"].includes(appointmentGfeDisplayStatus(a))
      )
        ? 15000
        : false;
    },
  });

  useEffect(() => {
    const openId = String(searchParams.get("open_message") || "").trim();
    if (!openId) return;
    const appt = (appointments || []).find((a) => String(a.id) === openId);
    if (appt) setMsgDialog(appt);
    const next = new URLSearchParams(searchParams);
    next.delete("open_message");
    setSearchParams(next, { replace: true });
  }, [searchParams, appointments, setSearchParams]);

  useEffect(() => {
    return subscribeAppointmentsRefresh(() => {
      void qc.refetchQueries({ queryKey: ["patient-appointments"] });
    });
  }, [qc]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (!payment) return;

    const appointmentId = params.get("appointment_id");

    const finish = async () => {
      if (payment === "treatment_success" && appointmentId) {
        try {
          const updated = await appointmentsApi.syncTreatmentPayment(appointmentId);
          patchAppointmentInCache(qc, ["patient-appointments"], appointmentId, updated);
          broadcastAppointmentsRefresh();
          setPaymentNotice({ type: "success", message: "Treatment payment received. Thank you!" });
        } catch (err) {
          console.warn("[appointments] treatment sync after redirect:", err?.message || err);
          setPaymentNotice({ type: "success", message: "Payment received — refreshing status…" });
          void qc.refetchQueries({ queryKey: ["patient-appointments"] });
        }
      } else if (payment === "success" && appointmentId) {
        try {
          const updated = await appointmentsApi.syncDepositPayment(appointmentId);
          patchAppointmentInCache(qc, ["patient-appointments"], appointmentId, {
            ...updated,
            status: "confirmed",
            payment_status: "paid",
          });
          broadcastAppointmentsRefresh();
          setPaymentNotice({ type: "success", message: "Deposit received. Your appointment is confirmed." });
        } catch (err) {
          console.warn("[appointments] deposit sync after redirect:", err?.message || err);
          setPaymentNotice({
            type: "success",
            message: "Deposit received — refreshing appointment status…",
          });
          void qc.refetchQueries({ queryKey: ["patient-appointments"] });
        }
      } else if (payment === "treatment_cancelled" || payment === "cancelled") {
        setPaymentNotice({ type: "cancelled", message: "Payment was cancelled. You can try again when ready." });
      }

      params.delete("payment");
      params.delete("appointment_id");
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
      window.history.replaceState({}, "", nextUrl);
    };

    void finish();
  }, [qc]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gfe = params.get("gfe");
    if (!gfe) return;

    const message = gfeReturnNotice(gfe);
    if (message) {
      setGfeNotice({ type: gfe === "approved" ? "success" : "info", message });
      void qc.refetchQueries({ queryKey: ["patient-appointments"] });
      void qc.invalidateQueries({ queryKey: ["my-notifications"] });
    }

    params.delete("gfe");
    params.delete("appointment_id");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [qc]);

  const { data: records = [] } = useQuery({
    queryKey: ["my-treatment-records"],
    queryFn: () => treatmentRecordsApi.listMine(),
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: () => reviewsApi.listMine(),
  });

  const cancel = useMutation({
    mutationFn: (id) =>
      appointmentsApi.update(id, { status: "cancelled", cancellation_reason: "Cancelled by patient" }),
    onSuccess: () => {
      qc.invalidateQueries(["patient-appointments"]);
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
    },
  });

  const payTreatment = useMutation({
    mutationFn: async (appointmentId) => {
      const result = await appointmentsApi.createTreatmentCheckout(appointmentId);
      const checkoutUrl = result?.sessionUrl || result?.checkout_url;
      if (checkoutUrl) {
        redirectToStripeCheckout(checkoutUrl);
        return;
      }
      throw new Error(result?.error || "Payment system did not return a checkout URL.");
    },
    onError: (error) => {
      alert(error?.message || "Payment system temporarily unavailable. Please contact your provider.");
      console.error("Treatment payment error:", error);
    },
  });

  const payDeposit = useMutation({
    mutationFn: async (appointmentId) => {
      const result = await appointmentsApi.createDepositCheckout(appointmentId);
      if (result?.deposit_amount != null) {
        patchAppointmentInCache(qc, ["patient-appointments"], appointmentId, {
          deposit_amount: result.deposit_amount,
        });
      }
      const checkoutUrl = result?.sessionUrl || result?.checkout_url;
      if (checkoutUrl) {
        redirectToStripeCheckout(checkoutUrl);
        return;
      }
      throw new Error(result?.error || "Payment system did not return a checkout URL.");
    },
    onError: (error) => {
      alert(error?.message || "Payment system temporarily unavailable. Please contact the provider directly.");
      console.error("Payment error:", error);
    },
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      const me = await sessionApi.getMe();
      await reviewsApi.create({
        patient_id: me.id,
        patient_name: me.full_name,
        provider_id: reviewDialog.provider_id,
        appointment_id: reviewDialog.id,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(["my-reviews"]);
      qc.invalidateQueries(["patient-appointments"]);
      qc.invalidateQueries({ queryKey: ["marketplace-catalog"] });
      setReviewDialog(null);
      setReviewForm({ rating: 5, comment: "" });
    },
  });

  const upcoming = appointments.filter(
    (a) =>
      ["requested", "confirmed", "awaiting_payment", "awaiting_consent"].includes(a.status) ||
      String(a.treatment_payment_status || "").toLowerCase() === "awaiting_payment"
  );
  const past = appointments.filter(a => ["completed", "cancelled", "no_show"].includes(a.status));

  const hasReviewed = (apptId) => reviews.some(r => r.appointment_id === apptId);
  const getRecord = (apptId) => records.find(r => r.appointment_id === apptId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Appointments</h2>
        <p className="text-slate-500 text-sm mt-1">{upcoming.length} upcoming</p>
      </div>

      {paymentNotice && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={
            paymentNotice.type === "success"
              ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.35)", color: "#166534" }
              : { background: "rgba(254,226,226,0.85)", border: "1px solid rgba(220,38,38,0.35)", color: "#991b1b" }
          }
        >
          {paymentNotice.message}
        </div>
      )}

      {gfeNotice && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={
            gfeNotice.type === "success"
              ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.35)", color: "#166534" }
              : { background: "rgba(123,142,200,0.1)", border: "1px solid rgba(123,142,200,0.3)", color: "#4a5fa8" }
          }
        >
          {gfeNotice.message}
        </div>
      )}

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
            upcoming.map(a => {
              const depositLabel = appointmentDepositDisplay(a);
              const paymentSummary = treatmentPaymentSummary(a);
              const treatmentDue = Boolean(paymentSummary);
              return (
              <Card key={a.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{a.service}</span>
                          <Badge className={statusColor[a.status]}>{a.status.replace(/_/g, " ")}</Badge>
                        </div>
                        <AppointmentGfePatientBlock appointment={a} />
                        <div className="flex gap-3 text-sm text-slate-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{a.provider_name}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />
                            {a.appointment_date ? format(new Date(a.appointment_date), "MMM d, yyyy") : ""}
                          </span>
                          {a.appointment_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{a.appointment_time}</span>}
                          {a.status === "awaiting_payment" && Number(a.deposit_amount) > 0 && depositLabel && (
                            <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />${depositLabel} booking deposit</span>
                          )}
                        </div>
                        {a.status === "awaiting_payment" && Number(a.deposit_amount) > 0 && (
                          <p className="text-xs text-purple-700 mt-2">
                            Your provider requires a ${depositLabel} booking deposit to confirm this visit.
                          </p>
                        )}
                        {treatmentDue && paymentSummary && (
                          <div className="text-xs mt-2 space-y-0.5 font-medium" style={{ color: "#FA6F30" }}>
                            <p>Treatment balance due: ${paymentSummary.treatment}</p>
                            {paymentSummary.platformFee && (
                              <p>{GFE_FEE_LINE_LABEL}: ${paymentSummary.platformFee}</p>
                            )}
                            <p className="font-semibold">Total due: ${paymentSummary.total}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {treatmentDue && paymentSummary && (
                        <Button
                          size="sm"
                          style={{ background: "#FA6F30", color: "#fff" }}
                          onClick={() => payTreatment.mutate(a.id)}
                          disabled={payTreatment.isPending}
                          className="gap-1"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          {payTreatment.isPending ? "Redirecting…" : `Pay $${paymentSummary.total}`}
                        </Button>
                      )}
                      {a.status === "awaiting_payment" && Number(a.deposit_amount) > 0 && (
                        <Button size="sm" style={{ background: "#7B8EC8", color: "#fff" }} onClick={() => payDeposit.mutate(a.id)} disabled={payDeposit.isPending} className="gap-1">
                          <DollarSign className="w-3.5 h-3.5" /> {payDeposit.isPending ? "Redirecting…" : `Pay $${depositLabel} Deposit`}
                        </Button>
                      )}
                      {a.status === "awaiting_consent" && (
                        <Button size="sm" style={{ background: "#FA6F30", color: "#fff" }} onClick={() => setConsentDialog(a)} className="gap-1">
                          <FileText className="w-3.5 h-3.5" /> Sign Consent Form
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setMsgDialog(a)} className="gap-1 relative">
                        <MessageSquare className="w-3.5 h-3.5" /> Message Provider
                        <MessageUnreadBadge count={unreadCountForThread(unreadSummary, a.id)} />
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
            );
            })
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-3">
          {past.length === 0 ? (
            <div className="text-center py-16 text-slate-400">No past appointments</div>
          ) : (
            past.map(a => {
              const record = getRecord(a.id);
              const reviewed = hasReviewed(a.id);
              const paymentSummary = treatmentPaymentSummary(a);
              const treatmentDue = Boolean(paymentSummary);
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
                          {treatmentDue && paymentSummary && (
                            <div className="text-xs mt-2 space-y-0.5 font-medium" style={{ color: "#FA6F30" }}>
                              <p>Treatment balance due: ${paymentSummary.treatment}</p>
                              {paymentSummary.platformFee && (
                                <p>{GFE_FEE_LINE_LABEL}: ${paymentSummary.platformFee}</p>
                              )}
                              <p className="font-semibold">Total due: ${paymentSummary.total}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {treatmentDue && paymentSummary && (
                          <Button
                            size="sm"
                            style={{ background: "#FA6F30", color: "#fff" }}
                            onClick={() => payTreatment.mutate(a.id)}
                            disabled={payTreatment.isPending}
                            className="gap-1"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            {payTreatment.isPending ? "Redirecting…" : `Pay $${paymentSummary.total}`}
                          </Button>
                        )}
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
              recipientEmail={msgDialog.provider_email}
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