import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ProviderSalesLock from "@/components/ProviderSalesLock";
import { useProviderAccess } from "@/components/useProviderAccess";
import PracticeProfileTab from "@/components/practice/PracticeProfileTab.jsx";
import PracticeTreatmentsTab from "@/components/practice/PracticeTreatmentsTab.jsx";
import PracticeAppointmentsTab from "@/components/practice/PracticeAppointmentsTab.jsx";
import PracticePatientsTab from "@/components/practice/PracticePatientsTab.jsx";
import PracticeAnalyticsTab from "@/components/practice/PracticeAnalyticsTab.jsx";
import QuickLogTreatmentDialog from "@/components/practice/QuickLogTreatmentDialog.jsx";
import TreatmentDocumentDialog from "@/components/practice/TreatmentDocumentDialog.jsx";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CheckCircle, Calendar, Users, Star,
  TrendingUp, Stethoscope, Sparkles, ArrowRight,
  MessageSquare, Link, FileText, ClipboardList, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { subscribeAppointmentsRefresh } from "@/lib/appointmentSync";
import { stripeConnectCallbackMessage, refreshStripeConnectStatus } from "@/lib/stripeConnectApi";
import { buildProviderProfileForm, sanitizeProfileSavePayload } from "@/lib/providerProfileForm";
import { useAppointmentMessageUnread, unreadMessagesByPatient } from "@/hooks/useAppointmentMessageUnread";

const PANEL_TABS = new Set(["profile", "treatments", "appointments", "patients", "performance"]);

function getPanelFromSearch(searchParams) {
  const tab = String(searchParams.get("tab") || "").trim();
  return PANEL_TABS.has(tab) ? tab : null;
}

function appointmentForTreatmentRecord(record, appointments) {
  const appt = appointments.find((a) => a.id === record.appointment_id);
  if (appt) return appt;
  return {
    id: record.appointment_id,
    provider_id: record.provider_id,
    provider_name: record.provider_name,
    provider_email: record.provider_email,
    patient_id: record.patient_id,
    patient_name: record.patient_name,
    patient_email: record.patient_email,
    service: record.service,
    appointment_date: record.treatment_date,
    status: "completed",
    gfe_status: record.gfe_status,
    gfe_exam_url: record.gfe_exam_url,
  };
}

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
      ))}
    </div>
  );
}

// ── Control Card ──────────────────────────────────────────────────
function ControlCard({ icon: Icon, iconColor, title, meta, status, statusColor, action, onAction, warning }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 transition-all cursor-default"
      style={{
        borderLeft: warning ? `3px solid ${warning}` : "3px solid transparent",
        borderBottom: "1px solid rgba(30,37,53,0.06)",
      }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: iconColor, opacity: 0.75 }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-sm font-semibold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>{title}</p>
          {status && (
            <span className="text-[10px] font-semibold" style={{ color: statusColor }}>{status}</span>
          )}
        </div>
        {meta && <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.38)" }}>{meta}</p>}
      </div>
      {action && (
        <button onClick={onAction}
          className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-70"
          style={{ background: "rgba(30,37,53,0.05)", color: "rgba(30,37,53,0.55)", border: "1px solid rgba(30,37,53,0.08)", whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
          {action}
        </button>
      )}
    </div>
  );
}

// ── Panel Modal ───────────────────────────────────────────────────
function PanelModal({ open, onClose, title, children }) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        className="w-full max-w-4xl !flex !flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl"
        style={{ maxHeight: "min(95dvh, 900px)", height: "min(95dvh, 900px)" }}
      >
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-3 border-b border-slate-100">
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", color: "#1e2535", fontSize: 20 }}>
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-6 py-4">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProviderPractice() {
  const { status: accessStatus } = useProviderAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [activePanel, setActivePanel] = useState(() => getPanelFromSearch(searchParams));
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [docDialog, setDocDialog] = useState({ open: false, appt: null, existing: null });
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState(() => buildProviderProfileForm());
  const [initialized, setInitialized] = useState(false);
  const [stripeConnectPreferRefresh, setStripeConnectPreferRefresh] = useState(
    () => searchParams.get("stripe_connect") === "return"
  );

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const { data: appointments = [] } = useQuery({
    queryKey: ["my-appointments"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.Appointment.filter({ provider_id: user.id }, "-appointment_date");
    },
    staleTime: 0,
    refetchInterval: (query) => {
      const rows = query.state.data;
      if (!Array.isArray(rows)) return 2000;
      const hasPending =
        rows.some((a) => String(a.status || "").toLowerCase() === "requested") ||
        rows.some((a) => String(a.status || "").toLowerCase() === "awaiting_payment");
      return hasPending ? 800 : 2000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const refetchAppointments = useCallback(() => {
    void qc.refetchQueries({ queryKey: ["my-appointments"], type: "active" });
    void qc.invalidateQueries({ queryKey: ["my-notifications"] });
  }, [qc]);

  useEffect(() => subscribeAppointmentsRefresh(refetchAppointments), [refetchAppointments]);

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

  const { data: reviews = [] } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.Review.filter({ provider_id: user.id }, "-created_date");
    },
  });

  const { data: treatmentRecords = [] } = useQuery({
    queryKey: ["treatment-records"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.TreatmentRecord.filter({ provider_id: user.id }, "-created_date");
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: manufacturerApplications = [] } = useQuery({
    queryKey: ["my-manufacturer-applications-practice"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.ManufacturerApplication.filter({ provider_id: user.id });
    },
    enabled: !!me,
  });

  // Find completed appointments that have no treatment record yet
  const documentedApptIds = new Set(treatmentRecords.map(r => r.appointment_id));
  const undocumentedAppts = appointments.filter(a => a.status === "completed" && !documentedApptIds.has(a.id));

  useEffect(() => {
    setActivePanel(getPanelFromSearch(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const openId = String(searchParams.get("open_message") || "").trim();
    if (!openId) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", "appointments");
    nextParams.delete("open_message");
    setSearchParams(nextParams, { replace: true });
    setActivePanel("appointments");
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const banner = stripeConnectCallbackMessage(searchParams);
    if (!banner) return;
    if (banner.shouldRefresh) {
      setStripeConnectPreferRefresh(true);
      void refreshStripeConnectStatus().then(() => {
        qc.invalidateQueries({ queryKey: ["stripe-connect-status"] });
      });
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("stripe_connect");
    setSearchParams(nextParams, { replace: true });
    if (banner.type === "success") setActivePanel("profile");
  }, [searchParams, setSearchParams, qc]);

  const { data: messageUnreadSummary } = useAppointmentMessageUnread();
  const unreadMessagePatients = unreadMessagesByPatient(appointments, messageUnreadSummary);
  const totalUnreadMessages = Number(messageUnreadSummary?.total || 0);

  useEffect(() => {
    if (me && !initialized) {
      setForm(buildProviderProfileForm(me));
      setInitialized(true);
    }
  }, [me, initialized]);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(sanitizeProfileSavePayload(data)),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["me"] });

      if (Object.prototype.hasOwnProperty.call(variables, "accepts_new_patients")) {
        const me = qc.getQueryData(["me"]);
        if (variables.accepts_new_patients === false && me?.id) {
          qc.setQueryData(["marketplace-catalog"], (old) => {
            if (!old?.providers) return old;
            return {
              ...old,
              providers: old.providers.filter((p) => String(p.id) !== String(me.id)),
            };
          });
        }
      }

      qc.invalidateQueries({ queryKey: ["marketplace-catalog"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.Review.update(id, { response: replyText, responded_at: new Date().toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-reviews"] }); setReplyingTo(null); setReplyText(""); },
  });

  const handleSave = (extra = {}) => saveMutation.mutate({ ...form, ...extra });

  const openFlaggedRecord = (record) => {
    setDocDialog({
      open: true,
      appt: appointmentForTreatmentRecord(record, appointments),
      existing: record,
    });
  };

  const openPanel = (panel, options = {}) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", panel);
    if (options.appointmentsFilter) {
      nextParams.set("appointments_filter", options.appointmentsFilter);
    } else {
      nextParams.delete("appointments_filter");
    }
    setSearchParams(nextParams);
    setActivePanel(panel);
  };

  const closePanel = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("tab");
    nextParams.delete("appointments_filter");
    setSearchParams(nextParams, { replace: true });
    setActivePanel(null);
  };

  const activeServiceIds = new Set(mdSubs.filter(s => s.status === "active").map(s => s.service_type_id));
  const pendingCount = appointments.filter(a => a.status === "requested").length;
  const appointmentsPanelFilter = (() => {
    const raw = String(searchParams.get("appointments_filter") || "").trim();
    if (raw === "requests" || raw === "upcoming" || raw === "today" || raw === "completed" || raw === "all") {
      return raw;
    }
    return activePanel === "appointments" && pendingCount > 0 ? "requests" : "upcoming";
  })();
  const flaggedRecords = treatmentRecords.filter(r => r.status === "flagged" || r.status === "changes_requested");
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
  const completedCount = appointments.filter(a => a.status === "completed").length;
  const bookingUrl = me ? `${window.location.origin}/PatientMarketplace?provider=${me.id}` : "";

  const patients = Object.values(
    appointments.reduce((acc, a) => {
      const key = a.patient_id || a.patient_email;
      if (!acc[key]) acc[key] = { id: a.patient_id, name: a.patient_name, email: a.patient_email, appointments: [] };
      acc[key].appointments.push(a);
      return acc;
    }, {})
  );

  // ── Determine primary focus ──────────────────────────────────────
  const primaryIssue = (() => {
    if (flaggedRecords.length) return {
      color: "#DA6A63",
      label: "Needs Attention",
      title: `${flaggedRecords.length} record${flaggedRecords.length > 1 ? "s" : ""} need MD follow-up`,
      why: "Your medical director flagged a record or requested changes. Fix and resubmit below.",
      action: "Fix Records",
      panel: null,
      onAction: () => flaggedRecords[0] && openFlaggedRecord(flaggedRecords[0]),
    };
    if (pendingCount) return {
      color: "#DA6A63",
      label: "Don't Leave Them Waiting",
      title: `${pendingCount} patient${pendingCount > 1 ? "s" : ""} waiting to hear back`,
      why: "Patients book whoever responds first. A quick confirm goes a long way.",
      action: "Respond Now",
      panel: "appointments",
      appointmentsFilter: "requests",
    };
    if (!form.bio) return {
      color: "#DA6A63",
      label: "You're Almost There",
      title: "Add a quick bio to your profile",
      why: "Patients book people, not credentials. A couple sentences about you = more bookings.",
      action: "Add Bio",
      panel: "profile",
    };
    if (!form.consultation_fee && activeServiceIds.size > 0) return {
      color: "#DA6A63",
      label: "Set Your Prices",
      title: "Patients can't see your consultation fee",
      why: "Transparency builds trust. Add a starting price and watch the bookings come in.",
      action: "Set Pricing",
      panel: "treatments",
    };
    return null;
  })();

  const practiceContent = (
    <div className="max-w-3xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest mb-0.5" style={{ color: "#DA6A63", letterSpacing: "0.15em" }}>Provider</p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: "#1e2535", lineHeight: 1, fontStyle: "italic", fontWeight: 400 }}>Practice Hub</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Accepting toggle */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "#f5f4f2", border: "1px solid rgba(30,37,53,0.1)" }}>
            <Switch
              checked={form.accepts_new_patients}
              onCheckedChange={val => { setForm(f => ({ ...f, accepts_new_patients: val })); saveMutation.mutate({ accepts_new_patients: val }); }}
            />
            <span className="text-xs font-semibold" style={{ color: form.accepts_new_patients ? "#16a34a" : "rgba(30,37,53,0.4)" }}>
              {form.accepts_new_patients ? "Accepting" : "Closed"}
            </span>
          </div>
          {/* Log Treatment button */}
          <button
            onClick={() => setQuickLogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-80"
            style={{ background: "linear-gradient(135deg, #FA6F30, #DA6A63)", color: "#fff" }}>
            <FileText className="w-3.5 h-3.5" /> Log Treatment
          </button>
          {/* Booking link */}
          {bookingUrl && (
            <button
              onClick={() => { navigator.clipboard.writeText(bookingUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
              style={{ background: copied ? "rgba(200,230,60,0.15)" : "#f5f4f2", color: copied ? "#4a6b10" : "rgba(30,37,53,0.6)", border: "1px solid rgba(30,37,53,0.1)" }}>
              {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Booking Link"}
            </button>
          )}
        </div>
      </div>

      {/* ── Primary Focus Block ──────────────────────────────────── */}
      {primaryIssue ? (
        <div className="mb-6" style={{ borderLeft: `2px solid ${primaryIssue.color}`, paddingLeft: 16 }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: primaryIssue.color, letterSpacing: "0.16em" }}>{primaryIssue.label}</p>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17, color: "#1e2535", lineHeight: 1.35, marginBottom: 6, fontStyle: "italic", fontWeight: 400 }}>{primaryIssue.title}</p>
          <p className="text-xs mb-3 leading-relaxed" style={{ color: "rgba(30,37,53,0.45)" }}>{primaryIssue.why}</p>
          <button
            onClick={() => {
              if (primaryIssue.onAction) primaryIssue.onAction();
              else openPanel(primaryIssue.panel, { appointmentsFilter: primaryIssue.appointmentsFilter });
            }}
            className="flex items-center gap-1.5 text-xs font-bold transition-all hover:opacity-70"
            style={{ color: primaryIssue.color }}>
            {primaryIssue.action} <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="mb-6" style={{ borderLeft: "2px solid rgba(200,230,60,0.6)", paddingLeft: 16 }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "#4a6b10", letterSpacing: "0.16em" }}>All Clear</p>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17, color: "#1e2535", lineHeight: 1.35, fontStyle: "italic", fontWeight: 400 }}>Practice is running clean</p>
          <button onClick={() => openPanel("performance")}
            className="mt-2 flex items-center gap-1.5 text-xs font-bold transition-all hover:opacity-70"
            style={{ color: "#4a6b10" }}>
            View Performance <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── Control Cards ────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(30,37,53,0.07)", backdropFilter: "blur(10px)" }}>

        {/* Appointments */}
        <ControlCard
          icon={Calendar}
          iconColor="#FA6F30"
          title="Appointments"
          meta={`${appointments.filter(a => ["confirmed","requested"].includes(a.status)).length} upcoming · ${completedCount} completed all-time`}
          status={
            totalUnreadMessages > 0
              ? `${totalUnreadMessages} unread message${totalUnreadMessages !== 1 ? "s" : ""}`
              : pendingCount > 0
                ? `${pendingCount} pending`
                : "Up to date"
          }
          statusColor={totalUnreadMessages > 0 ? "#FA6F30" : pendingCount > 0 ? "#DA6A63" : "#4a6b10"}
          warning={totalUnreadMessages > 0 ? "#FA6F30" : pendingCount > 0 ? "#DA6A63" : undefined}
          action="Manage"
          onAction={() => openPanel("appointments")}
        />

        {/* Patients */}
        <ControlCard
          icon={Users}
          iconColor="#DA6A63"
          title="Patients"
          meta={`${patients.length} total · ${treatmentRecords.length} treatment records`}
          status={flaggedRecords.length > 0 ? `${flaggedRecords.length} flagged` : `${patients.length} patients`}
          statusColor={flaggedRecords.length > 0 ? "#DA6A63" : "#7B8EC8"}
          warning={flaggedRecords.length > 0 ? "#DA6A63" : undefined}
          action="View"
          onAction={() => openPanel("patients")}
        />

        {/* Profile */}
        <ControlCard
          icon={Sparkles}
          iconColor="#7B8EC8"
          title="Practice Profile"
          meta={`${form.practice_name || me?.full_name || "—"} · ${[form.city, form.state].filter(Boolean).join(", ") || "Location not set"}`}
          status={!form.bio ? "Bio missing" : "Complete"}
          statusColor={!form.bio ? "#DA6A63" : "#4a6b10"}
          warning={!form.bio ? "#DA6A63" : undefined}
          action="Edit"
          onAction={() => openPanel("profile")}
        />

        {/* Treatments */}
        <ControlCard
          icon={Stethoscope}
          iconColor="#2D6B7F"
          title="Treatment Menu"
          meta={`${activeServiceIds.size} active service${activeServiceIds.size !== 1 ? "s" : ""} · ${form.consultation_fee ? `Consult $${form.consultation_fee}` : "No pricing set"}`}
          status={!form.consultation_fee && activeServiceIds.size > 0 ? "Pricing missing" : `${activeServiceIds.size} live`}
          statusColor={!form.consultation_fee && activeServiceIds.size > 0 ? "#DA6A63" : "#4a6b10"}
          warning={!form.consultation_fee && activeServiceIds.size > 0 ? "#DA6A63" : undefined}
          action="Edit"
          onAction={() => openPanel("treatments")}
        />

        {/* Performance */}
        <ControlCard
          icon={TrendingUp}
          iconColor="#C8E63C"
          title="Performance"
          meta={avgRating ? `${avgRating}★ avg · ${reviews.length} review${reviews.length !== 1 ? "s" : ""}` : "No data yet"}
          status={completedCount > 0 ? `${completedCount} visits` : "No visits yet"}
          statusColor={completedCount > 0 ? "#4a6b10" : "rgba(30,37,53,0.35)"}
          action="Analyze"
          onAction={() => openPanel("performance")}
        />

      </div>

      {unreadMessagePatients.length > 0 && (
        <div className="mt-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4" style={{ color: "#FA6F30" }} />
            <p className="text-sm font-bold" style={{ color: "#1e2535" }}>
              Patient Messages
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "rgba(250,111,48,0.15)", color: "#FA6F30" }}>
                {totalUnreadMessages}
              </span>
            </p>
          </div>
          <p className="text-xs mb-2" style={{ color: "rgba(30,37,53,0.45)" }}>
            Pre-booking inquiries open in Messages. Booked visits — reply from Appointments.
          </p>
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.65)", border: "1.5px solid rgba(250,111,48,0.25)" }}>
            {unreadMessagePatients.map((p, i) => (
              <button
                key={p.key}
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-orange-50/30"
                style={{ borderBottom: i < unreadMessagePatients.length - 1 ? "1px solid rgba(30,37,53,0.06)" : "none" }}
                onClick={() => {
                  if (p.isPreBooking) {
                    const qs = new URLSearchParams({ tab: "patient_queries" });
                    if (p.thread_id) qs.set("thread_id", p.thread_id);
                    navigate(`${createPageUrl("ProviderMessaging")}?${qs.toString()}`);
                    return;
                  }
                  openPanel("appointments");
                }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(250,111,48,0.1)" }}>
                  <MessageSquare className="w-4 h-4" style={{ color: "#FA6F30" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#1e2535" }}>
                    {p.patient_name || p.patient_email || "Patient"}
                  </p>
                  {p.patient_email && p.patient_name && (
                    <p className="text-xs truncate" style={{ color: "rgba(30,37,53,0.45)" }}>{p.patient_email}</p>
                  )}
                  {p.isPreBooking && (
                    <p className="text-[11px] mt-0.5" style={{ color: "rgba(30,37,53,0.4)" }}>Pre-booking inquiry</p>
                  )}
                </div>
                <span
                  className="flex-shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center text-white"
                  style={{ background: "#FA6F30" }}
                >
                  {p.unread > 9 ? "9+" : p.unread}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── MD flagged / changes requested ─────────────────────────── */}
      {flaggedRecords.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" style={{ color: "#DA6A63" }} />
            <p className="text-sm font-bold" style={{ color: "#1e2535" }}>
              MD Review — Action Required
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "rgba(218,106,99,0.15)", color: "#DA6A63" }}>
                {flaggedRecords.length}
              </span>
            </p>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.65)", border: "1.5px solid rgba(218,106,99,0.35)" }}>
            {flaggedRecords.map((r, i) => (
              <div
                key={r.id}
                className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-red-50/30 transition-colors"
                style={{ borderBottom: i < flaggedRecords.length - 1 ? "1px solid rgba(30,37,53,0.06)" : "none" }}
                onClick={() => openFlaggedRecord(r)}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(218,106,99,0.12)" }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: "#DA6A63" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate" style={{ color: "#1e2535" }}>{r.service}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                      style={{
                        background: r.status === "flagged" ? "rgba(248,113,113,0.12)" : "rgba(250,111,48,0.12)",
                        color: r.status === "flagged" ? "#dc2626" : "#c2440a",
                      }}>
                      {r.status === "flagged" ? "Flagged" : "Changes Requested"}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                    {r.patient_name || r.patient_email}
                    {r.treatment_date ? ` · ${format(new Date(r.treatment_date), "MMM d, yyyy")}` : ""}
                  </p>
                  {r.md_review_notes && (
                    <p className="text-xs mt-1.5 line-clamp-2 italic" style={{ color: "#c2440a" }}>
                      MD: {r.md_review_notes}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0 mt-1"
                  style={{ background: "rgba(218,106,99,0.12)", color: "#DA6A63", border: "1px solid rgba(218,106,99,0.3)" }}
                  onClick={(e) => { e.stopPropagation(); openFlaggedRecord(r); }}
                >
                  Fix & Resubmit →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Undocumented appointments ─────────────────────────────── */}
      {undocumentedAppts.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" style={{ color: "#FA6F30" }} />
              <p className="text-sm font-bold" style={{ color: "#1e2535" }}>
                Needs Documentation
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "rgba(250,111,48,0.15)", color: "#FA6F30" }}>
                  {undocumentedAppts.length}
                </span>
              </p>
            </div>
            <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>Log these to satisfy MD review</p>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.65)", border: "1.5px solid rgba(250,111,48,0.25)" }}>
            {undocumentedAppts.slice(0, 5).map((a, i) => (
              <div key={a.id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-orange-50/30 transition-colors"
                style={{ borderBottom: i < Math.min(undocumentedAppts.length, 5) - 1 ? "1px solid rgba(30,37,53,0.06)" : "none" }}
                onClick={() => setDocDialog({ open: true, appt: a, existing: null })}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(250,111,48,0.1)" }}>
                  <FileText className="w-4 h-4" style={{ color: "#FA6F30" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#1e2535" }}>{a.service}</p>
                  <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>
                    {a.patient_name || a.patient_email} · {a.appointment_date}
                  </p>
                </div>
                <button
                  className="text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0"
                  style={{ background: "rgba(250,111,48,0.12)", color: "#FA6F30", border: "1px solid rgba(250,111,48,0.3)" }}>
                  Document →
                </button>
              </div>
            ))}
            {undocumentedAppts.length > 5 && (
              <div className="px-4 py-2.5 text-center">
                <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>+{undocumentedAppts.length - 5} more — open Patients to see all</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Panel Modals ─────────────────────────────────────────── */}

      <PanelModal open={activePanel === "appointments"} onClose={closePanel} title="Appointments">
        <PracticeAppointmentsTab
          appointments={appointments}
          initialFilter={appointmentsPanelFilter}
          defaultBookingDeposit={me?.booking_deposit}
        />
      </PanelModal>

      <PanelModal open={activePanel === "patients"} onClose={closePanel} title="Patients">
        <PracticePatientsTab patients={patients} appointments={appointments} treatmentRecords={treatmentRecords} />
      </PanelModal>

      <PanelModal open={activePanel === "profile"} onClose={closePanel} title="Practice Profile">
        <PracticeProfileTab
          form={form} setForm={setForm} me={me}
          onSave={handleSave} saving={saveMutation.isPending} saved={saved}
          serviceTypes={serviceTypes} activeServiceIds={activeServiceIds}
          manufacturerApplications={manufacturerApplications}
          focusSection={String(searchParams.get("step") || "").trim() || undefined}
          stripeConnectPreferRefresh={stripeConnectPreferRefresh}
        />
      </PanelModal>

      <PanelModal open={activePanel === "treatments"} onClose={closePanel} title="Treatment Menu">
        <PracticeTreatmentsTab
          me={me} serviceTypes={serviceTypes}
          activeServiceIds={activeServiceIds} mdSubs={mdSubs}
          onSave={handleSave} saving={saveMutation.isPending} saved={saved}
        />
      </PanelModal>

      {/* ── Quick Log + direct doc dialogs ────────────────────────── */}
      <QuickLogTreatmentDialog
        open={quickLogOpen}
        onClose={() => setQuickLogOpen(false)}
        appointments={appointments}
        treatmentRecords={treatmentRecords}
        onStartDocumenting={(appt, existing) => {
          setQuickLogOpen(false);
          setDocDialog({ open: true, appt, existing: existing || null });
        }}
      />
      <TreatmentDocumentDialog
        open={docDialog.open}
        onClose={() => { setDocDialog({ open: false, appt: null, existing: null }); qc.invalidateQueries(["treatment-records"]); }}
        appointment={docDialog.appt}
        existingRecord={docDialog.existing}
        providerMe={me}
      />

      <PanelModal open={activePanel === "performance"} onClose={closePanel} title="Performance">
        <div className="space-y-8">
          <PracticeAnalyticsTab appointments={appointments} reviews={reviews} />

          {/* Reviews */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.35)" }}>Patient Reviews</p>
            {avgRating && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3" style={{ background: "#f9f8f6", border: "1px solid rgba(30,37,53,0.08)" }}>
                <div className="text-center">
                  <p style={{ fontWeight: 700, fontSize: 28, color: "#1e2535", lineHeight: 1 }}>{avgRating}</p>
                  <StarRating rating={Math.round(avgRating)} />
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
            {reviews.length === 0 ? (
              <div className="text-center py-10 rounded-xl" style={{ background: "#f9f8f6", border: "1px solid rgba(30,37,53,0.08)" }}>
                <Star className="w-7 h-7 mx-auto mb-2" style={{ color: "rgba(30,37,53,0.2)" }} />
                <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>No reviews yet</p>
                <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.45)" }}>Reviews appear after patients complete appointments.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map(r => (
                  <div key={r.id} className="rounded-xl p-3" style={{ background: "#fff", border: "1px solid rgba(30,37,53,0.09)" }}>
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
                          <Button size="sm" style={{ background: "#1e2535", color: "#fff" }} onClick={() => replyMutation.mutate({ id: r.id })} disabled={!replyText.trim() || replyMutation.isPending}>
                            {replyMutation.isPending ? "Posting..." : "Post Reply"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setReplyingTo(null); setReplyText(""); }}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <button className="mt-1.5 text-[10px] font-semibold flex items-center gap-1 hover:underline" style={{ color: "rgba(30,37,53,0.4)" }} onClick={() => { setReplyingTo(r.id); setReplyText(""); }}>
                        <MessageSquare className="w-3 h-3" /> Reply
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PanelModal>

    </div>
  );

  return (
    <ProviderSalesLock feature="practice" applicationStatus={accessStatus} requiredTier="full">
      {practiceContent}
    </ProviderSalesLock>
  );
}