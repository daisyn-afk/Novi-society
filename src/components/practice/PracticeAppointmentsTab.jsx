import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Calendar, Clock, User, MessageSquare, CheckCircle, X, FileText,
  ShieldCheck, ChevronLeft, ChevronRight, LayoutList, LayoutGrid,
  AlertCircle, DollarSign, Zap, Plus, Phone, Mail, Eye
} from "lucide-react";
import { format, isToday, isTomorrow, startOfWeek, addDays, isSameDay, parseISO, addWeeks, subWeeks } from "date-fns";
import TreatmentDocumentDialog from "@/components/practice/TreatmentDocumentDialog.jsx";
import GFEStatusBadge from "@/components/GFEStatusBadge";

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
  const dt = typeof d === "string" ? parseISO(d) : d;
  if (isToday(dt)) return "Today";
  if (isTomorrow(dt)) return "Tomorrow";
  return format(dt, "EEE, MMM d");
}

function timeToFraction(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  return (h + m / 60 - 7) / 12; // fraction of 7am–7pm
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

// ── Mini appointment pill for calendar ────────────────────────────
function CalApptPill({ appt, onClick }) {
  const sc = STATUS[appt.status] || STATUS.confirmed;
  return (
    <button onClick={() => onClick(appt)}
      className="w-full text-left px-2 py-1 rounded-lg text-[11px] font-semibold truncate transition-all hover:opacity-80"
      style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
      {appt.appointment_time ? `${appt.appointment_time} · ` : ""}{appt.patient_name?.split(" ")[0] || "Patient"}
      <span className="font-normal ml-1 opacity-70 truncate">{appt.service}</span>
    </button>
  );
}

// ── Appointment detail drawer content ────────────────────────────
function ApptDetail({ appt, treatmentRecords, onConfirm, onCancel, onComplete, onNoShow, onSendGFE, gfeSending, onDoc, onClose }) {
  const sc = STATUS[appt.status] || STATUS.confirmed;
  const hasRecord = treatmentRecords.find(r => r.appointment_id === appt.id);
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-lg" style={{ fontFamily: "'DM Serif Display', serif", color: "#1e2535" }}>{appt.service}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{sc.label}</span>
            <GFEStatusBadge status={appt.gfe_status} examUrl={appt.gfe_exam_url} />
            {isToday(parseISO(appt.appointment_date)) && (
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
            <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>{appt.patient_email}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            {dateLabel(appt.appointment_date)}
          </div>
          {appt.appointment_time && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />{appt.appointment_time}
            </div>
          )}
          {appt.duration_minutes && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />{appt.duration_minutes} min
            </div>
          )}
          {appt.total_amount && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>
              <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />${appt.total_amount}
            </div>
          )}
        </div>
      </div>

      {/* Patient notes */}
      {appt.patient_notes && (
        <div className="px-3 py-2.5 rounded-xl text-xs italic" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.18)", color: "rgba(30,37,53,0.6)" }}>
          <span className="font-bold not-italic" style={{ color: "#7B8EC8" }}>Patient note: </span>
          "{appt.patient_notes}"
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
        {appt.status === "requested" && (
          <div className="grid grid-cols-2 gap-2">
            <Button className="w-full gap-1.5" style={{ background: "#FA6F30", color: "#fff" }} onClick={onConfirm}>
              <CheckCircle className="w-4 h-4" />Confirm
            </Button>
            <Button className="w-full gap-1.5" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4" />Decline
            </Button>
          </div>
        )}
        {appt.status === "confirmed" && (
          <div className="grid grid-cols-2 gap-2">
            <Button className="w-full gap-1.5" style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10", border: "1px solid rgba(200,230,60,0.4)" }} onClick={onComplete}>
              <CheckCircle className="w-4 h-4" />Mark Done
            </Button>
            <Button className="w-full gap-1.5" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4" />Cancel
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {(["requested","confirmed"].includes(appt.status)) && (
            <Button className="w-full gap-1.5" style={{ background: "rgba(123,142,200,0.12)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.3)" }}
              onClick={onSendGFE} disabled={gfeSending}>
              <ShieldCheck className="w-4 h-4" />{gfeSending ? "Sending…" : appt.gfe_status === "pending" ? "Resend GFE" : "Send GFE"}
            </Button>
          )}
          <Button className="w-full gap-1.5" style={{ background: "rgba(250,111,48,0.1)", color: "#FA6F30", border: "1px solid rgba(250,111,48,0.3)" }}
            onClick={onDoc}>
            <FileText className="w-4 h-4" />{hasRecord ? "View Record" : "Log Treatment"}
          </Button>
        </div>
        {appt.status === "confirmed" && (
          <Button className="w-full gap-1.5" variant="outline" onClick={onNoShow}>
            No Show
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function PracticeAppointmentsTab({ appointments }) {
  const qc = useQueryClient();
  const [view, setView] = useState("list"); // "list" | "week"
  const [filter, setFilter] = useState("upcoming");
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
  const [gfeSending, setGfeSending] = useState({});

  const { data: treatmentRecords = [] } = useQuery({
    queryKey: ["treatment-records"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.TreatmentRecord.filter({ provider_id: me.id }, "-created_date");
    },
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Appointment.update(id, data),
    onSuccess: () => qc.invalidateQueries(["my-appointments"]),
  });

  const confirmAppt = useMutation({
    mutationFn: ({ id }) => base44.entities.Appointment.update(id, {
      status: "confirmed", confirmed_at: new Date().toISOString(),
      ...(confirmTime ? { appointment_time: confirmTime } : {})
    }),
    onSuccess: () => { qc.invalidateQueries(["my-appointments"]); setConfirmDialog({ open: false, appt: null }); setConfirmTime(""); setDetailOpen(false); },
  });

  const cancelAppt = useMutation({
    mutationFn: ({ id }) => base44.entities.Appointment.update(id, { status: "cancelled", cancellation_reason: cancelReason }),
    onSuccess: () => { qc.invalidateQueries(["my-appointments"]); setCancelDialog({ open: false, appt: null }); setCancelReason(""); setDetailOpen(false); },
  });

  const saveNotes = useMutation({
    mutationFn: ({ id }) => base44.entities.Appointment.update(id, { notes: notesText }),
    onSuccess: () => { qc.invalidateQueries(["my-appointments"]); setNotesDialog({ open: false, appt: null }); },
  });

  const sendGFE = async (appt) => {
    setGfeSending(s => ({ ...s, [appt.id]: true }));
    try {
      const res = await base44.functions.invoke("sendQualiphyGFE", { appointment_id: appt.id });
      if (res.data?.success) qc.invalidateQueries(["my-appointments"]);
    } finally {
      setGfeSending(s => ({ ...s, [appt.id]: false }));
    }
  };

  // Stats
  const todayAppts = appointments.filter(a => a.appointment_date && isToday(parseISO(a.appointment_date)));
  const pendingReqs = appointments.filter(a => a.status === "requested");
  const weekAppts = appointments.filter(a => {
    if (!a.appointment_date) return false;
    const d = parseISO(a.appointment_date);
    return d >= weekStart && d < addDays(weekStart, 7);
  });
  const weekRevenue = weekAppts.filter(a => a.status === "completed").reduce((s, a) => s + (a.total_amount || 0), 0);

  // Week days
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Filtered list
  const filtered = appointments.filter(a => {
    if (filter === "upcoming") return ["confirmed","requested","awaiting_payment","awaiting_consent"].includes(a.status);
    if (filter === "today") return a.appointment_date && isToday(parseISO(a.appointment_date));
    if (filter === "requests") return a.status === "requested";
    if (filter === "completed") return a.status === "completed";
    return true;
  }).sort((a, b) => {
    const da = a.appointment_date || "", db = b.appointment_date || "";
    if (da !== db) return da.localeCompare(db);
    return (a.appointment_time || "").localeCompare(b.appointment_time || "");
  });

  const openDetail = (appt) => { setSelectedAppt(appt); setDetailOpen(true); };

  const tabs = [
    { key: "upcoming", label: "Upcoming", count: appointments.filter(a => ["confirmed","requested"].includes(a.status)).length },
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
                  const key = a.appointment_date || "unscheduled";
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(a);
                  return acc;
                }, {})
              ).sort(([a],[b]) => a.localeCompare(b)).map(([date, appts]) => (
                <div key={date}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2 mt-4 first:mt-0" style={{ color: "rgba(30,37,53,0.4)" }}>
                    {date === "unscheduled" ? "Unscheduled" : dateLabel(date)}
                    {date !== "unscheduled" && isToday(parseISO(date)) && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-black" style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10" }}>TODAY</span>
                    )}
                  </p>
                  {appts.map(a => {
                    const sc = STATUS[a.status] || STATUS.confirmed;
                    return (
                      <button key={a.id} onClick={() => openDetail(a)}
                        className="w-full text-left rounded-2xl mb-2 transition-all hover:shadow-md overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.7)", border: a.status === "requested" ? "1.5px solid rgba(251,191,36,0.5)" : "1px solid rgba(30,37,53,0.07)", boxShadow: "0 1px 8px rgba(30,37,53,0.04)" }}>
                        <div className="p-4 flex items-center gap-3">
                          {/* Status stripe */}
                          <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: sc.dot, minHeight: 40 }} />

                          {/* Time block */}
                          <div className="w-12 text-center flex-shrink-0">
                            {a.appointment_time ? (
                              <>
                                <p className="text-sm font-bold" style={{ color: "#1e2535" }}>{a.appointment_time.slice(0,5)}</p>
                                <p className="text-[10px]" style={{ color: "rgba(30,37,53,0.4)" }}>{a.duration_minutes ? `${a.duration_minutes}m` : ""}</p>
                              </>
                            ) : (
                              <p className="text-xs italic" style={{ color: "rgba(30,37,53,0.3)" }}>TBD</p>
                            )}
                          </div>

                          {/* Patient + service */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm" style={{ color: "#1e2535" }}>{a.patient_name || a.patient_email}</p>
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                              <GFEStatusBadge status={a.gfe_status} examUrl={a.gfe_exam_url} />
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{a.service}</p>
                            {a.patient_notes && (
                              <p className="text-xs mt-1 italic truncate" style={{ color: "rgba(30,37,53,0.4)" }}>"{a.patient_notes}"</p>
                            )}
                          </div>

                          {/* Amount */}
                          {a.total_amount > 0 && (
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-bold" style={{ color: "#1e2535" }}>${a.total_amount}</p>
                              {a.deposit_amount > 0 && <p className="text-[10px]" style={{ color: "rgba(30,37,53,0.4)" }}>${a.deposit_amount} dep</p>}
                            </div>
                          )}

                          {/* Quick action for pending */}
                          {a.status === "requested" && (
                            <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                              <button onClick={e => { e.stopPropagation(); setConfirmDialog({ open: true, appt: a }); setConfirmTime(""); }}
                                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
                                style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10", border: "1px solid rgba(200,230,60,0.4)" }}>
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button onClick={e => { e.stopPropagation(); setCancelDialog({ open: true, appt: a, isDecline: true }); }}
                                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
                                style={{ background: "rgba(218,106,99,0.12)", color: "#DA6A63", border: "1px solid rgba(218,106,99,0.3)" }}>
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          <Eye className="w-4 h-4 flex-shrink-0 opacity-20" />
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
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(30,37,53,0.07)" }}>
            <button onClick={() => setWeekStart(d => subWeeks(d, 1))} className="p-1.5 rounded-lg hover:bg-slate-100" style={{ color: "rgba(30,37,53,0.4)" }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>
              {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </p>
            <button onClick={() => setWeekStart(d => addWeeks(d, 1))} className="p-1.5 rounded-lg hover:bg-slate-100" style={{ color: "rgba(30,37,53,0.4)" }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid" style={{ gridTemplateColumns: "40px repeat(7, 1fr)" }}>
            <div />
            {weekDays.map(d => (
              <div key={d.toISOString()} className="px-2 py-2.5 text-center" style={{ borderLeft: "1px solid rgba(30,37,53,0.06)", background: isToday(d) ? "rgba(200,230,60,0.08)" : "transparent" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isToday(d) ? "#4a6b10" : "rgba(30,37,53,0.4)" }}>{format(d, "EEE")}</p>
                <p className="font-bold text-lg leading-tight" style={{ fontFamily: "'DM Sans', sans-serif", color: isToday(d) ? "#C8E63C" : "#1e2535" }}>{format(d, "d")}</p>
                {appointments.filter(a => a.appointment_date && isSameDay(parseISO(a.appointment_date), d)).length > 0 && (
                  <div className="w-1.5 h-1.5 rounded-full mx-auto mt-0.5" style={{ background: isToday(d) ? "#C8E63C" : "#FA6F30" }} />
                )}
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="overflow-y-auto" style={{ maxHeight: 480 }}>
            {HOURS.map(h => (
              <div key={h} className="grid" style={{ gridTemplateColumns: "40px repeat(7, 1fr)", minHeight: 56 }}>
                <div className="flex items-start justify-end pr-2 pt-1">
                  <span className="text-[10px] font-medium" style={{ color: "rgba(30,37,53,0.3)" }}>
                    {h === 12 ? "12p" : h > 12 ? `${h-12}p` : `${h}a`}
                  </span>
                </div>
                {weekDays.map(d => {
                  const dayAppts = appointments.filter(a => {
                    if (!a.appointment_date || !isSameDay(parseISO(a.appointment_date), d)) return false;
                    if (!a.appointment_time) return h === 9; // default slot for unscheduled
                    const apptH = parseInt(a.appointment_time.split(":")[0]);
                    return apptH === h;
                  });
                  return (
                    <div key={d.toISOString()} className="px-1 py-0.5 space-y-0.5 relative"
                      style={{ borderLeft: "1px solid rgba(30,37,53,0.06)", borderTop: "1px solid rgba(30,37,53,0.04)", background: isToday(d) ? "rgba(200,230,60,0.03)" : "transparent" }}>
                      {dayAppts.map(a => (
                        <CalApptPill key={a.id} appt={a} onClick={openDetail} />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Detail slide-over ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          {selectedAppt && (
            <ApptDetail
              appt={selectedAppt}
              treatmentRecords={treatmentRecords}
              gfeSending={!!gfeSending[selectedAppt?.id]}
              onClose={() => setDetailOpen(false)}
              onConfirm={() => { setConfirmDialog({ open: true, appt: selectedAppt }); setDetailOpen(false); }}
              onCancel={() => { setCancelDialog({ open: true, appt: selectedAppt, isDecline: selectedAppt.status === "requested" }); setDetailOpen(false); }}
              onComplete={() => update.mutate({ id: selectedAppt.id, data: { status: "completed", completed_at: new Date().toISOString() } })}
              onNoShow={() => update.mutate({ id: selectedAppt.id, data: { status: "no_show" } })}
              onSendGFE={() => sendGFE(selectedAppt)}
              onDoc={() => {
                const existing = treatmentRecords.find(r => r.appointment_id === selectedAppt.id);
                setDocDialog({ open: true, appt: selectedAppt, existing: existing || null });
                setDetailOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirm dialog ── */}
      <Dialog open={confirmDialog.open} onOpenChange={v => setConfirmDialog(d => ({ ...d, open: v }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle style={{ fontFamily: "'DM Serif Display', serif" }}>Confirm Appointment</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>{confirmDialog.appt?.service} · {confirmDialog.appt?.patient_name} · {confirmDialog.appt?.appointment_date}</p>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(30,37,53,0.55)" }}>Set appointment time (optional)</label>
              <input type="time" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none" value={confirmTime} onChange={e => setConfirmTime(e.target.value)}
                style={{ borderColor: "rgba(30,37,53,0.15)", background: "rgba(255,255,255,0.7)" }} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDialog({ open: false, appt: null })}>Back</Button>
              <Button className="flex-1 gap-1.5" style={{ background: "#FA6F30", color: "#fff" }}
                onClick={() => confirmAppt.mutate({ id: confirmDialog.appt?.id })} disabled={confirmAppt.isPending}>
                <CheckCircle className="w-4 h-4" />Confirm
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
            <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>{cancelDialog.appt?.service} · {cancelDialog.appt?.patient_name}</p>
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

      {/* ── Treatment doc dialog ── */}
      <TreatmentDocumentDialog
        open={docDialog.open}
        onClose={() => setDocDialog({ open: false, appt: null, existing: null })}
        appointment={docDialog.appt}
        existingRecord={docDialog.existing}
      />
    </div>
  );
}