import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ProviderSalesLock from "@/components/ProviderSalesLock";
import { useProviderAccess } from "@/components/useProviderAccess";
import PracticeProfileTab from "@/components/practice/PracticeProfileTab.jsx";
import PracticeTreatmentsTab from "@/components/practice/PracticeTreatmentsTab.jsx";
import PracticeAppointmentsTab from "@/components/practice/PracticeAppointmentsTab.jsx";
import PracticePatientsTab from "@/components/practice/PracticePatientsTab.jsx";
import PracticeAnalyticsTab from "@/components/practice/PracticeAnalyticsTab.jsx";
import {
  Stethoscope, Calendar, Users, Star, MessageSquare, CheckCircle, TrendingUp,
  FileText, AlertTriangle, Link as LinkIcon,
} from "lucide-react";
import LogTreatmentPickerDialog from "@/components/practice/LogTreatmentPickerDialog.jsx";
import TreatmentDocumentDialog from "@/components/practice/TreatmentDocumentDialog.jsx";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO, isAfter, startOfDay } from "date-fns";

const SECTIONS = ["appointments", "patients", "profile", "treatments", "performance"];

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-4 h-4 ${i <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
      ))}
    </div>
  );
}

function isInjectableBundle(st) {
  return st.category === "injectables" || st.name?.toLowerCase().includes("neurotoxin") || st.name?.toLowerCase().includes("injectable");
}

function countLiveOfferings(serviceTypes, activeServiceIds, offerings) {
  let liveCount = 0;
  let liveWithoutPrice = 0;
  for (const st of serviceTypes) {
    if (!activeServiceIds.has(st.id)) continue;
    if (isInjectableBundle(st)) {
      for (const key of ["tox", "filler"]) {
        const data = offerings[`${st.id}_${key}`] || {};
        if (data.is_live) {
          liveCount++;
          if (!data.price) liveWithoutPrice++;
        }
      }
    } else {
      const data = offerings[st.id] || {};
      if (data.is_live) {
        liveCount++;
        if (!data.price) liveWithoutPrice++;
      }
    }
  }
  return { liveCount, liveWithoutPrice };
}

function appointmentNeedsDocs(appt, treatmentRecords) {
  const record = treatmentRecords.find(r => r.appointment_id === appt.id);
  if (!record) return true;
  return record.status === "draft";
}

function HubRow({ icon: Icon, iconColor, title, status, statusColor, subtext, actionLabel, onAction, alert }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-black/[0.02] cursor-pointer"
      style={{ borderLeft: alert ? "3px solid #DA6A63" : "3px solid transparent" }}
      onClick={onAction}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onAction(); }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${iconColor}18` }}>
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm" style={{ color: "#1e2535" }}>{title}</p>
        <p className="text-xs font-semibold mt-0.5" style={{ color: statusColor }}>{status}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(30,37,53,0.45)" }}>{subtext}</p>
      </div>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onAction(); }}
        className="text-xs font-semibold px-3.5 py-2 rounded-lg flex-shrink-0 transition-opacity hover:opacity-80"
        style={{ background: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.55)" }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function SectionModal({ open, onOpenChange, title, children }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!left-5 !right-5 !top-[50%] !w-auto !max-w-none !-translate-x-0 !translate-y-[-50%] sm:!left-[50%] sm:!right-auto sm:!w-full sm:!max-w-5xl sm:!-translate-x-1/2 max-h-[90vh] sm:max-h-[92vh] overflow-y-auto overflow-x-hidden p-0 gap-0 rounded-2xl sm:rounded-lg">
        <DialogHeader className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b sticky top-0 z-10 bg-white rounded-t-2xl sm:rounded-t-lg" style={{ borderColor: "rgba(30,37,53,0.08)" }}>
          <DialogTitle className="pr-10" style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: "#1e2535", lineHeight: 1.15 }}>
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="px-4 sm:px-6 pb-6 sm:pb-8 pt-2 min-w-0 max-w-full overflow-x-hidden">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProviderPractice() {
  const { status: accessStatus } = useProviderAccess();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [saved, setSaved] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [openSection, setOpenSection] = useState(null);
  const [logPickerOpen, setLogPickerOpen] = useState(false);
  const [docDialog, setDocDialog] = useState({ open: false, appt: null, existing: null });
  const [bookingCopied, setBookingCopied] = useState(false);
  const [form, setForm] = useState({
    practice_name: "", bio: "", city: "", state: "", phone: "",
    consultation_fee: "", starting_price: "", accepts_new_patients: true, avatar_url: "",
    instagram_handle: "", website_url: "",
  });
  const [initialized, setInitialized] = useState(false);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const { data: appointments = [] } = useQuery({
    queryKey: ["my-appointments"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.Appointment.filter({ provider_id: user.id }, "-appointment_date");
    },
  });

  const { data: mdSubs = [] } = useQuery({
    queryKey: ["my-md-subscriptions"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.MDSubscription.filter({ provider_id: user.id });
    },
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });

  useEffect(() => {
    if (me && !initialized) {
      setForm({
        practice_name: me.practice_name || "",
        bio: me.bio || "",
        city: me.city || "",
        state: me.state || "",
        phone: me.phone || "",
        consultation_fee: me.consultation_fee || "",
        starting_price: me.starting_price || "",
        accepts_new_patients: me.accepts_new_patients ?? true,
        avatar_url: me.avatar_url || "",
        instagram_handle: me.instagram_handle || "",
        website_url: me.website_url || "",
      });
      setInitialized(true);
    }
  }, [me, initialized]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && SECTIONS.includes(tab)) setOpenSection(tab);
  }, [searchParams]);

  const openModal = (section) => {
    setOpenSection(section);
    setSearchParams({ tab: section }, { replace: true });
  };

  const closeModal = () => {
    setOpenSection(null);
    setSearchParams({}, { replace: true });
  };

  const saveMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      qc.invalidateQueries(["me"]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const handleSave = (extra = {}) => saveMutation.mutate({ ...form, ...extra });

  const toggleAccepting = (val) => {
    setForm(prev => ({ ...prev, accepts_new_patients: val }));
    saveMutation.mutate({ accepts_new_patients: val });
  };

  const bookingUrl = me ? `${window.location.origin}/PatientMarketplace?provider=${me.id}` : "";
  const copyBookingLink = () => {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl);
    setBookingCopied(true);
    setTimeout(() => setBookingCopied(false), 2000);
  };

  const { data: reviews = [], isLoading: loadingReviews } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.Review.filter({ provider_id: user.id }, "-created_date");
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.Review.update(id, {
      response: replyText,
      responded_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-reviews"] });
      setReplyingTo(null);
      setReplyText("");
    },
  });

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  const activeServiceIds = new Set(
    mdSubs.filter(s => s.status === "active").map(s => s.service_type_id)
  );

  const pendingCount = appointments.filter(a => a.status === "requested").length;

  const { data: treatmentRecords = [] } = useQuery({
    queryKey: ["treatment-records"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.TreatmentRecord.filter({ provider_id: user.id }, "-created_date");
    },
  });

  const { data: manufacturerApplications = [] } = useQuery({
    queryKey: ["my-manufacturer-applications-practice"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.ManufacturerApplication.filter({ provider_id: user.id });
    },
    enabled: !!me,
  });

  const flaggedRecords = treatmentRecords.filter(r => r.status === "flagged" || r.status === "changes_requested");

  const patients = Object.values(
    appointments.reduce((acc, a) => {
      const key = a.patient_id || a.patient_email;
      if (!acc[key]) {
        acc[key] = { id: a.patient_id, name: a.patient_name, email: a.patient_email, appointments: [] };
      }
      acc[key].appointments.push(a);
      return acc;
    }, {})
  );

  const today = startOfDay(new Date());
  const upcomingCount = appointments.filter(a => {
    if (!["confirmed", "requested", "awaiting_payment", "awaiting_consent"].includes(a.status)) return false;
    if (!a.appointment_date) return true;
    try {
      return !isAfter(today, startOfDay(parseISO(a.appointment_date)));
    } catch {
      return true;
    }
  }).length;
  const completedCount = appointments.filter(a => a.status === "completed").length;
  const profileComplete = !!(form.practice_name && form.city && form.state);
  const offerings = me?.service_offerings_v2 || {};
  const { liveCount, liveWithoutPrice } = countLiveOfferings(serviceTypes, activeServiceIds, offerings);
  const missingConsultationFee = !form.consultation_fee && !form.starting_price;
  const treatmentsPricingMissing = liveWithoutPrice > 0 || (liveCount > 0 && missingConsultationFee);

  const needsDocumentation = useMemo(() => {
    return appointments
      .filter(a => a.status === "completed")
      .filter(a => appointmentNeedsDocs(a, treatmentRecords))
      .sort((a, b) => (b.appointment_date || "").localeCompare(a.appointment_date || ""));
  }, [appointments, treatmentRecords]);

  const practiceContent = (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-0">

      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#DA6A63" }}>Provider</p>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, color: "#1e2535", lineHeight: 1.15 }}>Practice Hub</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 rounded-full" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.1)" }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: form.accepts_new_patients ? "#22c55e" : "#94a3b8" }} />
              <span className="text-xs font-semibold" style={{ color: "#1e2535" }}>Accepting</span>
              <Switch checked={form.accepts_new_patients} onCheckedChange={toggleAccepting} />
            </div>
            <Button
              className="gap-2 rounded-xl font-bold"
              style={{ background: "#FA6F30", color: "#fff" }}
              onClick={() => setLogPickerOpen(true)}
            >
              <FileText className="w-4 h-4" />
              Log Treatment
            </Button>
            <Button
              variant="outline"
              className="gap-2 rounded-xl font-semibold"
              style={{ borderColor: "rgba(30,37,53,0.15)", color: "rgba(30,37,53,0.65)" }}
              onClick={copyBookingLink}
              disabled={!bookingUrl}
            >
              <LinkIcon className="w-4 h-4" />
              {bookingCopied ? "Copied!" : "Booking Link"}
            </Button>
          </div>
        </div>
      </div>

      {missingConsultationFee && (
        <div
          className="rounded-2xl px-5 py-4 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(30,37,53,0.08)", borderLeft: "3px solid #DA6A63" }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#DA6A63" }}>Set your prices</p>
            <p className="font-bold text-sm" style={{ fontFamily: "'DM Serif Display', serif", color: "#1e2535" }}>Patients can&apos;t see your consultation fee</p>
            <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>
              Transparency builds trust. Add a starting price and watch the bookings come in.
            </p>
          </div>
          <button type="button" onClick={() => openModal("profile")} className="text-sm font-bold flex-shrink-0 hover:opacity-80" style={{ color: "#DA6A63" }}>
            Set Pricing →
          </button>
        </div>
      )}

      {flaggedRecords.length > 0 && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-2xl mb-5" style={{ background: "rgba(250,111,48,0.1)", border: "1px solid rgba(250,111,48,0.35)" }}>
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#FA6F30" }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>
              Action Required: {flaggedRecords.length} treatment record{flaggedRecords.length > 1 ? "s" : ""} need{flaggedRecords.length === 1 ? "s" : ""} attention
            </p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>
              Your MD has flagged or requested changes. Open Patients to review and resubmit.
            </p>
          </div>
        </div>
      )}

      {/* Hub list */}
      <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(30,37,53,0.08)", boxShadow: "0 2px 20px rgba(30,37,53,0.06)" }}>
        <HubRow
          icon={Calendar}
          iconColor="#FA6F30"
          title="Appointments"
          status={pendingCount > 0 ? `${pendingCount} need a response` : "Up to date"}
          statusColor={pendingCount > 0 ? "#d97706" : "#16a34a"}
          subtext={`${upcomingCount} upcoming · ${completedCount} completed all-time`}
          actionLabel="Manage"
          onAction={() => openModal("appointments")}
        />
        <div style={{ borderTop: "1px solid rgba(30,37,53,0.06)" }} />
        <HubRow
          icon={Users}
          iconColor="#DA6A63"
          title="Patients"
          status={`${patients.length} patient${patients.length !== 1 ? "s" : ""}`}
          statusColor="#3b82f6"
          subtext={`${patients.length} total · ${treatmentRecords.length} treatment record${treatmentRecords.length !== 1 ? "s" : ""}`}
          actionLabel="View"
          onAction={() => openModal("patients")}
          alert={flaggedRecords.length > 0}
        />
        <div style={{ borderTop: "1px solid rgba(30,37,53,0.06)" }} />
        <HubRow
          icon={Star}
          iconColor="#7B8EC8"
          title="Practice Profile"
          status={profileComplete ? "Complete" : "Incomplete"}
          statusColor={profileComplete ? "#16a34a" : "#d97706"}
          subtext={[form.practice_name, form.city && form.state ? `${form.city}, ${form.state}` : form.city].filter(Boolean).join(" · ") || "Add your practice details"}
          actionLabel="Edit"
          onAction={() => openModal("profile")}
        />
        <div style={{ borderTop: "1px solid rgba(30,37,53,0.06)" }} />
        <HubRow
          icon={Stethoscope}
          iconColor="#2D6B7F"
          title="Treatment Menu"
          status={treatmentsPricingMissing ? "Pricing missing" : liveCount > 0 ? `${liveCount} live` : "No services live"}
          statusColor={treatmentsPricingMissing ? "#DA6A63" : "#16a34a"}
          subtext={
            liveCount > 0
              ? `${liveCount} active service${liveCount !== 1 ? "s" : ""}${liveWithoutPrice > 0 ? " · No pricing set" : ""}`
              : "Turn on at least one service to accept bookings"
          }
          actionLabel="Edit"
          onAction={() => openModal("treatments")}
          alert={treatmentsPricingMissing}
        />
        <div style={{ borderTop: "1px solid rgba(30,37,53,0.06)" }} />
        <HubRow
          icon={TrendingUp}
          iconColor="#4a6b10"
          title="Performance"
          status={`${completedCount} visit${completedCount !== 1 ? "s" : ""}`}
          statusColor="#16a34a"
          subtext={avgRating ? `${avgRating}★ avg · ${reviews.length} review${reviews.length !== 1 ? "s" : ""}` : "No reviews yet"}
          actionLabel="Analyze"
          onAction={() => openModal("performance")}
        />
      </div>

      {/* Needs documentation */}
      {needsDocumentation.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(30,37,53,0.08)", boxShadow: "0 2px 20px rgba(30,37,53,0.06)" }}>
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 flex-wrap" style={{ borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: "#FA6F30" }} />
              <p className="font-bold text-sm" style={{ color: "#1e2535" }}>Needs Documentation</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.25rem] text-center" style={{ background: "#FA6F30", color: "#fff" }}>
                {needsDocumentation.length}
              </span>
            </div>
            <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>Log these to satisfy MD review</p>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(30,37,53,0.06)" }}>
            {needsDocumentation.slice(0, 5).map(appt => (
              <div
                key={appt.id}
                className="flex items-center gap-3 px-5 py-3.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#1e2535" }}>{appt.service || "Treatment"}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                    {appt.patient_name || "Patient"}
                    {appt.appointment_date ? ` · ${format(parseISO(appt.appointment_date), "MMM d")}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const existing = treatmentRecords.find(r => r.appointment_id === appt.id) || null;
                    setDocDialog({ open: true, appt, existing });
                  }}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0 transition-opacity hover:opacity-80"
                  style={{ background: "rgba(250,111,48,0.12)", color: "#FA6F30", border: "1px solid rgba(250,111,48,0.25)" }}
                >
                  Document →
                </button>
              </div>
            ))}
          </div>
          {needsDocumentation.length > 5 && (
            <button
              type="button"
              onClick={() => openModal("patients")}
              className="w-full py-3 text-xs font-semibold hover:opacity-70"
              style={{ color: "#7B8EC8" }}
            >
              +{needsDocumentation.length - 5} more — open Patients to see all
            </button>
          )}
        </div>
      )}

      {/* Section modals */}
      <SectionModal open={openSection === "appointments"} onOpenChange={v => !v && closeModal()} title="Appointments">
        <PracticeAppointmentsTab appointments={appointments} />
      </SectionModal>

      <SectionModal open={openSection === "patients"} onOpenChange={v => !v && closeModal()} title="Patients">
        <PracticePatientsTab patients={patients} appointments={appointments} />
      </SectionModal>

      <SectionModal open={openSection === "profile"} onOpenChange={v => !v && closeModal()} title="Practice Profile">
        <PracticeProfileTab form={form} setForm={setForm} me={me} onSave={handleSave} saving={saveMutation.isPending} saved={saved} serviceTypes={serviceTypes} activeServiceIds={activeServiceIds} manufacturerApplications={manufacturerApplications} />
      </SectionModal>

      <SectionModal open={openSection === "treatments"} onOpenChange={v => !v && closeModal()} title="Treatment Menu">
        <PracticeTreatmentsTab me={me} serviceTypes={serviceTypes} activeServiceIds={activeServiceIds} mdSubs={mdSubs} onSave={handleSave} saving={saveMutation.isPending} saved={saved} />
      </SectionModal>

      <SectionModal open={openSection === "performance"} onOpenChange={v => !v && closeModal()} title="Performance">
        <div className="space-y-8 w-full">
          <PracticeAnalyticsTab appointments={appointments} reviews={reviews} />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(30,37,53,0.35)" }}>Patient Reviews</p>
            {avgRating && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.08)" }}>
                <div className="text-center">
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 28, color: "#1e2535", lineHeight: 1 }}>{avgRating}</p>
                  <StarRating rating={Math.round(Number(avgRating))} />
                </div>
                <div className="h-8 w-px" style={{ background: "rgba(30,37,53,0.1)" }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: "#1e2535" }}>{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                    {reviews.filter(r => r.response).length} responded · {reviews.filter(r => r.is_verified).length} verified
                  </p>
                </div>
              </div>
            )}
            {loadingReviews ? (
              <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.4)" }} />)}</div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-10 rounded-2xl" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(30,37,53,0.08)" }}>
                <Star className="w-7 h-7 mx-auto mb-2" style={{ color: "rgba(30,37,53,0.2)" }} />
                <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>No reviews yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map(r => (
                  <div key={r.id} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(30,37,53,0.07)" }}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "rgba(123,142,200,0.15)", color: "#7B8EC8" }}>{(r.patient_name || "A")[0]}</div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "#1e2535" }}>{r.patient_name || "Anonymous"}</p>
                          <StarRating rating={r.rating} />
                        </div>
                      </div>
                      <span className="text-[10px]" style={{ color: "rgba(30,37,53,0.35)" }}>{r.created_date ? format(new Date(r.created_date), "MMM d") : ""}</span>
                    </div>
                    {r.comment && <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>{r.comment}</p>}
                    {r.response ? (
                      <div className="mt-2 rounded-lg px-2.5 py-2" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.15)" }}>
                        <p className="text-[10px] font-bold mb-0.5" style={{ color: "#7B8EC8" }}>Your response</p>
                        <p className="text-xs" style={{ color: "rgba(30,37,53,0.65)" }}>{r.response}</p>
                      </div>
                    ) : replyingTo === r.id ? (
                      <div className="mt-2 space-y-2">
                        <Textarea placeholder="Write a response..." value={replyText} onChange={e => setReplyText(e.target.value)} rows={2} className="text-xs" />
                        <div className="flex gap-2">
                          <Button size="sm" style={{ background: "#FA6F30", color: "#fff" }} onClick={() => replyMutation.mutate({ id: r.id })} disabled={!replyText.trim() || replyMutation.isPending}>
                            {replyMutation.isPending ? "Posting..." : "Post Reply"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setReplyingTo(null); setReplyText(""); }}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="mt-1.5 text-[10px] font-semibold flex items-center gap-1 hover:underline" style={{ color: "rgba(30,37,53,0.4)" }} onClick={() => { setReplyingTo(r.id); setReplyText(""); }}>
                        <MessageSquare className="w-3 h-3" /> Reply
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SectionModal>

      <LogTreatmentPickerDialog
        open={logPickerOpen}
        onClose={() => setLogPickerOpen(false)}
        patients={patients}
        appointments={appointments}
        treatmentRecords={treatmentRecords}
        onStartDocumenting={(appt, existing) => setDocDialog({ open: true, appt, existing })}
      />

      <TreatmentDocumentDialog
        open={docDialog.open}
        onClose={() => setDocDialog({ open: false, appt: null, existing: null })}
        appointment={docDialog.appt}
        existingRecord={docDialog.existing}
      />
    </div>
  );

  return (
    <ProviderSalesLock feature="practice" applicationStatus={accessStatus} requiredTier="full">
      {practiceContent}
    </ProviderSalesLock>
  );
}
