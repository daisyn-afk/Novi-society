import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Eye, EyeOff, RefreshCw, CalendarDays, CheckCircle } from "lucide-react";
import { format } from "date-fns";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function AdminClassSessions() {
  const queryClient = useQueryClient();
  const [showCodes, setShowCodes] = useState({});
  const [open, setOpen] = useState(false);
  const [confirmAttendanceDialog, setConfirmAttendanceDialog] = useState(null);
  const [form, setForm] = useState({ enrollment_id: "", course_id: "", course_title: "", provider_id: "", provider_name: "", provider_email: "", session_date: "", session_code: generateCode() });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["class-sessions"],
    queryFn: () => base44.entities.ClassSession.list("-created_date"),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments"],
    queryFn: () => base44.entities.Enrollment.list("-created_date"),
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: () => base44.entities.Course.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ClassSession.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["class-sessions"] }); setOpen(false); },
  });

  const regenCode = async (session) => {
    const newCode = generateCode();
    await base44.entities.ClassSession.update(session.id, { session_code: newCode });
    queryClient.invalidateQueries({ queryKey: ["class-sessions"] });
  };

  const confirmAttendanceMutation = useMutation({
    mutationFn: (sessionId) =>
      base44.asServiceRole.entities.ClassSession.update(sessionId, {
        attendance_confirmed: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-sessions"] });
      setConfirmAttendanceDialog(null);
    },
  });

  const handleEnrollmentSelect = (enrollmentId) => {
    const enrollment = enrollments.find(e => e.id === enrollmentId);
    const course = courses.find(c => c.id === enrollment?.course_id);
    setForm(f => ({
      ...f,
      enrollment_id: enrollmentId,
      course_id: enrollment?.course_id || "",
      course_title: course?.title || "",
      provider_id: enrollment?.provider_id || "",
      provider_name: enrollment?.provider_name || "",
      provider_email: enrollment?.provider_email || "",
    }));
  };

  const toggleShowCode = (id) => setShowCodes(prev => ({ ...prev, [id]: !prev[id] }));

  const handleConfirmAttendance = async (session) => {
    // Update enrollment to completed if not already
    if (session.enrollment_id) {
      await base44.asServiceRole.entities.Enrollment.update(session.enrollment_id, {
        status: "completed",
      });
    }
    
    // Confirm attendance on session
    confirmAttendanceMutation.mutate(session.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Class Sessions & Codes</h2>
          <p className="text-slate-500 text-sm mt-1">Manage attendance codes — visible only to admins to give out verbally in class</p>
        </div>
        <Button onClick={() => { setForm({ enrollment_id: "", course_id: "", course_title: "", provider_id: "", provider_name: "", provider_email: "", session_date: "", session_code: generateCode() }); setOpen(true); }} style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}>
          <Plus className="w-4 h-4 mr-1" /> Create Session
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="w-10 h-10 mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400">No class sessions yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{s.course_title || "Course"}</p>
                      <Badge className={s.attendance_confirmed ? "bg-green-100 text-green-700" : s.code_used ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}>
                        {s.attendance_confirmed ? "Attended" : s.code_used ? "Code Used" : "Pending"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.provider_name || s.provider_email}
                      {s.session_date ? ` · ${format(new Date(s.session_date), "MMM d, yyyy")}` : ""}
                      {s.code_used_at ? ` · Used ${format(new Date(s.code_used_at), "MMM d h:mm a")}` : ""}
                    </p>
                  </div>

                  {/* Code display & attendance confirmation — admin only */}
                   <div className="flex items-center gap-2 flex-wrap">
                     <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-mono text-lg font-bold tracking-widest transition-all ${s.code_used ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                       {showCodes[s.id] ? s.session_code : "••••••"}
                       <button onClick={() => toggleShowCode(s.id)} className="text-slate-400 hover:text-slate-700">
                         {showCodes[s.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                       </button>
                     </div>
                     {!s.code_used && (
                       <Button variant="ghost" size="icon" title="Regenerate code" onClick={() => regenCode(s)}>
                         <RefreshCw className="w-4 h-4 text-slate-400" />
                       </Button>
                     )}
                     {s.code_used && <CheckCircle className="w-5 h-5 text-green-500" />}

                     {/* Confirm attendance button */}
                     {s.code_used && !s.attendance_confirmed && (
                       <Button
                         size="sm"
                         onClick={() => setConfirmAttendanceDialog(s)}
                         className="bg-blue-600 hover:bg-blue-700 text-white"
                       >
                         Confirm Attendance
                       </Button>
                     )}
                   </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Class Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Link to Enrollment</label>
              <Select value={form.enrollment_id} onValueChange={handleEnrollmentSelect}>
                <SelectTrigger><SelectValue placeholder="Select enrollment..." /></SelectTrigger>
                <SelectContent>
                  {enrollments.filter(e => e.status === "paid" || e.status === "confirmed").map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.provider_name || e.provider_email} — {courses.find(c => c.id === e.course_id)?.title || e.course_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Session Date</label>
              <Input type="date" value={form.session_date} onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Class Code (admin only)</label>
              <div className="flex gap-2">
                <Input value={form.session_code} onChange={e => setForm(f => ({ ...f, session_code: e.target.value.toUpperCase() }))} className="font-mono text-lg tracking-widest text-center" />
                <Button variant="outline" onClick={() => setForm(f => ({ ...f, session_code: generateCode() }))}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-1">This code is only visible here. Give it verbally to the provider in class.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate(form)} disabled={!form.enrollment_id || createMutation.isPending} style={{ background: "var(--novi-gold)", color: "#1A1A2E" }}>
                {createMutation.isPending ? "Creating..." : "Create Session"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Attendance Dialog */}
      <Dialog open={!!confirmAttendanceDialog} onOpenChange={() => setConfirmAttendanceDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Attendance</DialogTitle>
          </DialogHeader>
          {confirmAttendanceDialog && (
            <div className="space-y-4 pt-2">
              <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                <p className="text-sm text-slate-700">
                  <strong>Provider:</strong> {confirmAttendanceDialog.provider_name || confirmAttendanceDialog.provider_email}
                </p>
                <p className="text-sm text-slate-700">
                  <strong>Course:</strong> {confirmAttendanceDialog.course_title}
                </p>
                <p className="text-sm text-slate-700">
                  <strong>Date:</strong> {format(new Date(confirmAttendanceDialog.session_date), "MMM d, yyyy")}
                </p>
                <p className="text-sm text-slate-700">
                  <strong>Code Used:</strong> {format(new Date(confirmAttendanceDialog.code_used_at), "MMM d, h:mm a")}
                </p>
              </div>
              <p className="text-sm text-slate-600">
                This will mark attendance as confirmed and change enrollment status to "completed".
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmAttendanceDialog(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => handleConfirmAttendance(confirmAttendanceDialog)}
                  disabled={confirmAttendanceMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {confirmAttendanceMutation.isPending ? "Confirming..." : "Confirm"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}