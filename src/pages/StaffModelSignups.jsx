import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { adminApiRequest } from "@/api/adminApiRequest";
import { adminCoursesApi } from "@/api/adminCoursesApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, Calendar, Phone, Mail, BookOpen, ExternalLink, RefreshCw, CheckCircle2, Clock, AlertCircle, ArrowUpCircle, Send, CheckSquare } from "lucide-react";

const STATUS_CONFIG = {
  pending:   { label: "Pending",   color: "rgba(250,111,48,0.12)", text: "#c45a10", border: "rgba(250,111,48,0.3)" },
  confirmed: { label: "Confirmed", color: "rgba(200,230,60,0.12)", text: "#4a6b10", border: "rgba(200,230,60,0.35)" },
  completed: { label: "Completed", color: "rgba(45,107,127,0.1)",  text: "#2D6B7F", border: "rgba(45,107,127,0.25)" },
  cancelled: { label: "Cancelled", color: "rgba(218,106,99,0.1)",  text: "#DA6A63", border: "rgba(218,106,99,0.3)" },
  rejected:  { label: "Rejected",  color: "rgba(0,0,0,0.06)",      text: "rgba(30,37,53,0.4)", border: "rgba(0,0,0,0.1)" },
};

const GFE_CONFIG = {
  pending:       { label: "GFE Pending",  icon: Clock,        color: "#FA6F30" },
  approved:      { label: "GFE Approved", icon: CheckCircle2, color: "#5a7a20" },
  deferred:      { label: "GFE Deferred", icon: AlertCircle,  color: "#7B8EC8" },
  not_available: { label: "GFE N/A",      icon: AlertCircle,  color: "rgba(30,37,53,0.35)" },
};

function fmt(value, options) {
  if (!value) return "TBA";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleDateString("en-US", options || { month: "short", day: "numeric", year: "numeric" });
}

function fmtDt(value) {
  if (!value) return "TBA";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleString();
}

const TIME_SLOTS = [
  { label: "2:00 PM", value: "14:00" },
  { label: "3:00 PM", value: "15:00" },
  { label: "4:00 PM", value: "16:00" },
  { label: "5:00 PM", value: "17:00" },
];

export default function StaffModelSignups() {
  const [search, setSearch] = useState("");
  const [selectedModel, setSelectedModel] = useState(null);
  const [sendingGFE, setSendingGFE] = useState(null);
  const [promotingId, setPromotingId] = useState(null);
  const [promoteSlot, setPromoteSlot] = useState("");
  const [resendingEmail, setResendingEmail] = useState(null);
  const [markingAttendance, setMarkingAttendance] = useState(null);
  const queryClient = useQueryClient();

  const { data: signupsRaw, isLoading, isError: signupsError, error: signupsErrorObj } = useQuery({
    queryKey: ["staff-model-signups"],
    queryFn: async () => {
      const rows = await adminApiRequest("/admin/pre-orders?limit=500");
      const list = Array.isArray(rows) ? rows : [];
      return list.filter(row => String(row?.order_type || "").toLowerCase() === "model");
    },
  });

  const { data: coursesRaw, isError: coursesError, error: coursesErrorObj } = useQuery({
    queryKey: ["staff-courses-all"],
    queryFn: () => adminCoursesApi.list("scheduled"),
  });

  const signups = (Array.isArray(signupsRaw) ? signupsRaw : []).filter(r => r && typeof r === "object");
  const courses = (Array.isArray(coursesRaw) ? coursesRaw : []).filter(r => r && typeof r === "object");
  const courseMap = Object.fromEntries(courses.filter(c => c?.id != null).map(c => [c.id, c]));

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) =>
      adminApiRequest(`/admin/pre-orders/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-model-signups"] }),
  });

  const searchText = String(search || "").toLowerCase();
  const filtered = signups.filter(s => {
    if (!searchText) return true;
    return (
      String(s?.customer_name || "").toLowerCase().includes(searchText) ||
      String(s?.customer_email || "").toLowerCase().includes(searchText) ||
      String(courseMap[s?.course_id]?.title || "").toLowerCase().includes(searchText)
    );
  });

  const handleSendGFE = async (signup) => {
    setSendingGFE(signup.id);
    try {
      const res = await base44.functions.invoke("sendModelGFE", {
        course_id: signup.course_id,
        customer_name: signup.customer_name,
        customer_email: signup.customer_email,
        phone: signup.phone,
        pre_order_id: signup.id,
        treatment_type: signup.treatment_type || null,
        date_of_birth: signup.date_of_birth || null,
      });
      if (res.data?.success) {
        queryClient.invalidateQueries({ queryKey: ["staff-model-signups"] });
        if (selectedModel?.id === signup.id) {
          setSelectedModel({ ...selectedModel, gfe_status: "pending", gfe_meeting_url: res.data.meeting_url });
        }
      } else {
        alert("GFE Error: " + (res.data?.error || "Unknown error"));
      }
    } catch (e) {
      alert("Failed to send GFE: " + e.message);
    }
    setSendingGFE(null);
  };

  const handlePromote = async (signup) => {
    if (!promoteSlot) return alert("Please select a time slot first.");
    setPromotingId(signup.id);
    try {
      await base44.functions.invoke("promoteFromWaitlist", { pre_order_id: signup.id, time_slot: promoteSlot });
      queryClient.invalidateQueries({ queryKey: ["staff-model-signups"] });
      setSelectedModel(null);
      setPromoteSlot("");
    } catch (e) {
      alert("Error: " + e.message);
    }
    setPromotingId(null);
  };

  const handleResendEmail = async (signup, emailType) => {
    setResendingEmail({ id: signup.id, type: emailType });
    try {
      if (emailType === "confirmation") {
        const course = courseMap[signup.course_id];
        await base44.functions.invoke("sendModelConfirmationEmail", {
          customer_email: signup.customer_email,
          customer_name: signup.customer_name,
          course_date: signup.course_date,
          time_slot: signup.model_time_slot || null,
          treatment_type: signup.treatment_type,
          course_title: course?.title || "NOVI Training Course",
        });
      } else if (emailType === "gfe") {
        await base44.functions.invoke("sendModelGFEEmail", {
          customer_email: signup.customer_email,
          customer_name: signup.customer_name,
          gfe_url: signup.gfe_meeting_url,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["staff-model-signups"] });
    } catch (e) {
      alert("Failed to resend email: " + e.message);
    }
    setResendingEmail(null);
  };

  const handleMarkAttendance = async (signup) => {
    setMarkingAttendance(signup.id);
    try {
      await adminApiRequest(`/admin/pre-orders/${encodeURIComponent(signup.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ attendance_confirmed: true, attendance_confirmed_at: new Date().toISOString() }),
      });
      queryClient.invalidateQueries({ queryKey: ["staff-model-signups"] });
      setSelectedModel({ ...selectedModel, attendance_confirmed: true, attendance_confirmed_at: new Date().toISOString() });
    } catch (e) {
      alert("Error: " + e.message);
    }
    setMarkingAttendance(null);
  };

  const stats = {
    total: signups.length,
    confirmed: signups.filter(s => s.status === "confirmed").length,
    gfePending: signups.filter(s => !s.gfe_status || s.gfe_status === "not_available").length,
    gfeApproved: signups.filter(s => s.gfe_status === "approved").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.75rem", color: "#1e2535", fontStyle: "italic" }}>
          Model Sign-Ups
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>Manage course models, GFE status, and waitlist promotions</p>
      </div>

      {(signupsError || coursesError) && (
        <div className="rounded-2xl px-4 py-3 text-sm font-medium" style={{ background: "rgba(218,106,99,0.12)", border: "1px solid rgba(218,106,99,0.35)", color: "#8a2f28" }}>
          {signupsError && <p className="mb-1">Could not load model sign-ups: {signupsErrorObj?.message || "Request failed"}</p>}
          {coursesError && <p>Could not load courses: {coursesErrorObj?.message || "Request failed"}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Models",  value: stats.total,       icon: Users,        color: "#2D6B7F" },
          { label: "Confirmed",     value: stats.confirmed,   icon: CheckCircle2, color: "#5a7a20" },
          { label: "GFE Not Sent",  value: stats.gfePending,  icon: Clock,        color: "#FA6F30" },
          { label: "GFE Approved",  value: stats.gfeApproved, icon: CheckCircle2, color: "#C8E63C" },
        ].map((stat, i) => (
          <div key={i} className="p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.07)" }}>
            <stat.icon className="w-5 h-5 mb-2" style={{ color: stat.color }} />
            <p className="text-2xl font-bold" style={{ color: "#1e2535" }}>{stat.value}</p>
            <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(30,37,53,0.35)" }} />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or course..." className="pl-9 h-10 rounded-xl" style={{ border: "1px solid rgba(0,0,0,0.1)", background: "rgba(255,255,255,0.7)" }} />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.07)" }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-4 rounded-full animate-spin" style={{ borderColor: "rgba(45,107,127,0.2)", borderTopColor: "#2D6B7F" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p style={{ color: "rgba(30,37,53,0.4)" }}>No model sign-ups yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.02)" }}>
                  {["Name", "Course", "Date", "Status", "GFE", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: "rgba(30,37,53,0.5)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(signup => {
                  const statusCfg = STATUS_CONFIG[signup.status] || STATUS_CONFIG.pending;
                  const gfeCfg = signup.gfe_status ? GFE_CONFIG[signup.gfe_status] : null;
                  const course = courseMap[signup.course_id];
                  return (
                    <tr key={signup.id} className="cursor-pointer hover:bg-black/[0.02] transition-colors" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }} onClick={() => setSelectedModel(signup)}>
                      <td className="px-4 py-3">
                        <p className="font-semibold" style={{ color: "#1e2535" }}>{signup.customer_name}</p>
                        <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>{signup.customer_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: "#1e2535" }}>{course?.title || "—"}</p>
                      </td>
                      <td className="px-4 py-3" style={{ color: "rgba(30,37,53,0.7)" }}>{fmt(signup.course_date, { month: "short", day: "numeric", year: "numeric" })}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: statusCfg.color, color: statusCfg.text, border: `1px solid ${statusCfg.border}` }}>{statusCfg.label}</span>
                          {signup.is_waitlist && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "rgba(218,106,99,0.12)", color: "#DA6A63", border: "1px solid rgba(218,106,99,0.3)" }}>Waitlist</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {gfeCfg ? (
                          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: gfeCfg.color }}>
                            <gfeCfg.icon className="w-3.5 h-3.5" /> {gfeCfg.label}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "rgba(30,37,53,0.3)" }}>Not sent</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {(!signup.gfe_status || signup.gfe_status === "not_available") && (
                          <button
                            onClick={() => handleSendGFE(signup)}
                            disabled={sendingGFE === signup.id || !signup.course_id}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                            style={{ background: "rgba(45,107,127,0.1)", color: "#2D6B7F", border: "1px solid rgba(45,107,127,0.2)" }}
                          >
                            {sendingGFE === signup.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Send GFE"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!selectedModel} onOpenChange={() => setSelectedModel(null)}>
        <DialogContent className="max-w-md">
          {selectedModel && (
            <>
              <DialogHeader>
                <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", color: "#1e2535" }}>
                  {selectedModel.customer_name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>
                    <Mail className="w-4 h-4 flex-shrink-0" style={{ color: "#2D6B7F" }} />
                    {selectedModel.customer_email}
                  </div>
                  {selectedModel.phone && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>
                      <Phone className="w-4 h-4 flex-shrink-0" style={{ color: "#2D6B7F" }} />
                      {selectedModel.phone}
                    </div>
                  )}
                  {selectedModel.course_id && courseMap[selectedModel.course_id] && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>
                      <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: "#2D6B7F" }} />
                      {courseMap[selectedModel.course_id].title}
                      {selectedModel.course_date && (
                        <span className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>· {fmt(selectedModel.course_date)}</span>
                      )}
                    </div>
                  )}
                </div>

                {selectedModel.notes && (
                  <div className="p-3 rounded-xl text-sm" style={{ background: "rgba(0,0,0,0.03)", color: "rgba(30,37,53,0.65)" }}>
                    {selectedModel.notes}
                  </div>
                )}

                <div className="pt-3 border-t" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Good Faith Exam (GFE)</p>
                  {selectedModel.gfe_status === "approved" && (
                    <div className="mb-3 px-4 py-3 rounded-xl" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.35)" }}>
                      <p className="text-sm font-bold" style={{ color: "#5a7a20" }}>✓ GFE Approved</p>
                      {selectedModel.gfe_completed_at && <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>Completed {fmtDt(selectedModel.gfe_completed_at)}</p>}
                    </div>
                  )}
                  {selectedModel.gfe_status === "deferred" && (
                    <div className="mb-3 px-4 py-3 rounded-xl" style={{ background: "rgba(218,106,99,0.08)", border: "1px solid rgba(218,106,99,0.3)" }}>
                      <p className="text-sm font-bold" style={{ color: "#DA6A63" }}>✗ GFE Deferred</p>
                    </div>
                  )}
                  {selectedModel.gfe_status === "pending" && (
                    <div className="mb-3 px-4 py-3 rounded-xl" style={{ background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.25)" }}>
                      <p className="text-sm font-bold" style={{ color: "#FA6F30" }}>⏳ GFE In Progress</p>
                      {selectedModel.gfe_sent_at && <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>Sent {fmtDt(selectedModel.gfe_sent_at)}</p>}
                    </div>
                  )}
                  <div className="space-y-2">
                    {selectedModel.gfe_meeting_url && (
                      <a href={selectedModel.gfe_meeting_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "rgba(45,107,127,0.08)", color: "#2D6B7F", border: "1px solid rgba(45,107,127,0.15)" }}>
                        <ExternalLink className="w-4 h-4" /> Open GFE Portal Link
                      </a>
                    )}
                    {(!selectedModel.gfe_status || selectedModel.gfe_status === "not_available") && (
                      <button onClick={() => handleSendGFE(selectedModel)} disabled={sendingGFE === selectedModel.id || !selectedModel.course_id} className="w-full px-4 py-3 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: "rgba(45,107,127,0.1)", color: "#2D6B7F", border: "1px solid rgba(45,107,127,0.2)" }}>
                        {sendingGFE === selectedModel.id ? <><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Sending GFE...</> : "Send GFE via Qualiphy"}
                      </button>
                    )}
                  </div>
                </div>

                {selectedModel.is_waitlist && (
                  <div className="pt-3 border-t" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#DA6A63" }}>Promote from Waitlist</p>
                    <div className="flex gap-2">
                      <Select value={promoteSlot} onValueChange={setPromoteSlot}>
                        <SelectTrigger className="h-9 rounded-xl flex-1" style={{ border: "1px solid rgba(0,0,0,0.12)" }}>
                          <SelectValue placeholder="Select time slot..." />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_SLOTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button onClick={() => handlePromote(selectedModel)} disabled={!promoteSlot || promotingId === selectedModel.id} className="h-9 px-4 rounded-xl text-xs font-bold flex-shrink-0" style={{ background: "#C8E63C", color: "#1a2540", border: "none" }}>
                        {promotingId === selectedModel.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><ArrowUpCircle className="w-3.5 h-3.5 mr-1" />Promote</>}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t space-y-3" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>Actions</p>
                  {!selectedModel.attendance_confirmed && selectedModel.status === "confirmed" && (
                    <button onClick={() => handleMarkAttendance(selectedModel)} disabled={markingAttendance === selectedModel.id} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "rgba(200,230,60,0.1)", color: "#4a6b10", border: "1px solid rgba(200,230,60,0.3)" }}>
                      {markingAttendance === selectedModel.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                      {markingAttendance === selectedModel.id ? "Marking..." : "Mark Attendance"}
                    </button>
                  )}
                  {selectedModel.attendance_confirmed && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm" style={{ background: "rgba(200,230,60,0.1)", color: "#4a6b10", border: "1px solid rgba(200,230,60,0.3)" }}>
                      <CheckCircle2 className="w-4 h-4" /><span className="font-semibold">Attendance Confirmed</span>
                    </div>
                  )}
                  {selectedModel.gfe_meeting_url && (
                    <button onClick={() => handleResendEmail(selectedModel, "gfe")} disabled={resendingEmail?.id === selectedModel.id} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "rgba(45,107,127,0.1)", color: "#2D6B7F", border: "1px solid rgba(45,107,127,0.2)" }}>
                      {resendingEmail?.id === selectedModel.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Resend GFE Email
                    </button>
                  )}
                  {selectedModel.status === "confirmed" && (
                    <button onClick={() => handleResendEmail(selectedModel, "confirmation")} disabled={resendingEmail?.id === selectedModel.id} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "rgba(45,107,127,0.1)", color: "#2D6B7F", border: "1px solid rgba(45,107,127,0.2)" }}>
                      {resendingEmail?.id === selectedModel.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Resend Confirmation Email
                    </button>
                  )}
                </div>

                <div className="pt-3 border-t" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Status</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <button key={key} onClick={() => { updateStatus.mutate({ id: selectedModel.id, status: key }); setSelectedModel({ ...selectedModel, status: key }); }}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                        style={{ background: selectedModel.status === key ? cfg.color : "transparent", color: selectedModel.status === key ? cfg.text : "rgba(30,37,53,0.5)", border: `1px solid ${selectedModel.status === key ? cfg.border : "rgba(0,0,0,0.1)"}` }}>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
