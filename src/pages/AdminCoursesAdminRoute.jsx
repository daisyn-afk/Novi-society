// @ts-nocheck — checkJs + untyped base44/react-query patterns produce false positives here
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { adminCoursesApi } from "@/api/adminCoursesApi";
import { templateCoursesApi } from "@/api/templateCoursesApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, Users, DollarSign, BookOpen, Award,
  Calendar, Search, CheckCircle, Eye, EyeOff, RefreshCw, CalendarDays, LayoutTemplate, Clock, Package, MapPin, Key
} from "lucide-react";
import { format, parseISO } from "date-fns";
import CourseTemplateForm, { EMPTY_TEMPLATE } from "@/components/admin/CourseTemplateForm";
import ScheduleCourseForm, { EMPTY_SCHEDULED } from "@/components/admin/ScheduleCourseForm";
import TrainingCalendarView from "@/components/admin/TrainingCalendarView";
import TrainerPrepView from "@/components/admin/TrainerPrepView";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const enrollmentStatusColor = {
  pending_payment: "bg-yellow-100 text-yellow-700",
  paid: "bg-blue-100 text-blue-700",
  confirmed: "bg-blue-100 text-blue-700",
  attended: "bg-indigo-100 text-indigo-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-slate-100 text-slate-600",
};

function SessionRow({ s, showCodes, setShowCodes, regenCode, setConfirmAttendanceDialog, isPast }) {
  return (
    <div className="rounded-2xl px-5 py-4" style={{ background: isPast ? "rgba(255,255,255,0.45)" : "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.03)", opacity: isPast ? 0.85 : 1 }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm" style={{ color: "#1a2540" }}>{s.course_title || "Course"}</p>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.attendance_confirmed ? "bg-green-100 text-green-700" : s.code_used ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
              {s.attendance_confirmed ? "Attended" : s.code_used ? "Code Used" : "Pending"}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "#8891a8" }}>
            {s.provider_name || s.provider_email}
            {s.session_date ? ` · ${format(new Date(s.session_date), "MMM d, yyyy")}` : ""}
            {s.code_used_at ? ` · Used ${format(new Date(s.code_used_at), "MMM d h:mm a")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-base font-bold tracking-widest border-2 ${s.code_used ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            {showCodes[s.id] ? s.session_code : "••••••"}
            <button onClick={() => setShowCodes(p => ({ ...p, [s.id]: !p[s.id] }))} className="text-slate-400 hover:text-slate-700">
              {showCodes[s.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {!s.code_used && (
            <button onClick={() => regenCode(s)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <RefreshCw className="w-4 h-4" style={{ color: "#8891a8" }} />
            </button>
          )}
          {s.code_used && !s.attendance_confirmed && (
            <button className="text-xs font-semibold px-3 py-1.5 rounded-xl text-white" style={{ background: "#4a5fa0" }} onClick={() => setConfirmAttendanceDialog(s)}>
              Confirm Attendance
            </button>
          )}
          {s.attendance_confirmed && <CheckCircle className="w-5 h-5 text-green-500" />}
        </div>
      </div>
    </div>
  );
}

export default function Admincourses() {
  const [tab, setTab] = useState("templates");
  const qc = useQueryClient();
  const { toast } = useToast();

  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(EMPTY_SCHEDULED);
  const [editingSchedule, setEditingSchedule] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [sessionOpen, setSessionOpen] = useState(false);
  const [showCodes, setShowCodes] = useState({});
  const [confirmAttendanceDialog, setConfirmAttendanceDialog] = useState(null);
  const [sessionForm, setSessionForm] = useState({ enrollment_id: "", course_id: "", course_title: "", provider_id: "", provider_name: "", provider_email: "", session_date: "", session_code: generateCode() });

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["template-courses"],
    queryFn: () => templateCoursesApi.list()
  });
  const { data: allCourses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["courses", "admin-api-scheduled"],
    queryFn: () => adminCoursesApi.list(),
  });
  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({ queryKey: ["enrollments"], queryFn: () => base44.entities.Enrollment.list("-created_date") });
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({ queryKey: ["class-sessions"], queryFn: () => base44.entities.ClassSession.list("-created_date") });
  const { data: serviceTypes = [] } = useQuery({ queryKey: ["service-types"], queryFn: () => base44.entities.ServiceType.list() });

  const scheduledCourses = allCourses.filter((c) => c.type === "scheduled");
  const courseMap = Object.fromEntries([...templates, ...scheduledCourses].map((c) => [c.id, c]));
  const enrollCountFor = (id) => enrollments.filter(e => e.course_id === id).length;
  const templateFor = (scheduled) => templates.find(t => t.id === scheduled.template_id);
  const buildScheduledPayload = (data) => {
    const tmpl = templates.find(t => t.id === data.template_id);
    return {
      type: "scheduled",
      template_id: data.template_id,
      title: data.title || tmpl?.title,
      description: tmpl?.description,
      category: tmpl?.category,
      level: tmpl?.level,
      price: data.price ? Number(data.price) : tmpl?.price,
      duration_hours: tmpl?.duration_hours,
      location: data.location || tmpl?.location,
      max_seats: data.max_seats ? Number(data.max_seats) : undefined,
      available_seats: data.max_seats ? Number(data.max_seats) : undefined,
      instructor_name: data.instructor_name || tmpl?.instructor_name,
      instructor_bio: tmpl?.instructor_bio,
      cover_image_url: tmpl?.cover_image_url,
      syllabus: tmpl?.syllabus,
      requirements: tmpl?.requirements,
      certifications_awarded: tmpl?.certifications_awarded,
      linked_service_type_ids: tmpl?.linked_service_type_ids,
      pre_course_materials: tmpl?.pre_course_materials,
      tags: tmpl?.tags,
      getting_ready_info: tmpl?.getting_ready_info,
      what_to_bring: tmpl?.what_to_bring,
      session_dates: data.session_dates,
      is_active: data.is_active,
      is_featured: data.is_featured,
    };
  };

  const saveTemplate = useMutation({
    mutationFn: ({ data, editingId }) => {
      const usedServiceTypeIds = new Set([
        ...(data.linked_service_type_ids || []),
        ...((data.certifications_awarded || []).map((c) => c?.service_type_id).filter(Boolean)),
      ]);
      const relevantServiceTypes = (serviceTypes || [])
        .filter((s) => usedServiceTypeIds.has(s.id))
        .map((s) => ({ id: s.id, name: s.name, category: s.category }));
      const payload = {
        ...data,
        _service_types: relevantServiceTypes,
      };
      delete payload.type;
      return editingId
        ? templateCoursesApi.update(editingId, payload)
        : templateCoursesApi.create(payload);
    },
    onMutate: async ({ data, editingId }) => {
      const isEditing = Boolean(editingId);
      const tempId = `temp-${Date.now()}`;
      await qc.cancelQueries({ queryKey: ["template-courses"] });
      const previousTemplates = qc.getQueryData(["template-courses"]) || [];

      const optimisticTemplate = {
        ...data,
        id: editingId || tempId,
        type: "template",
        template_id: null,
        updated_date: new Date().toISOString(),
      };

      qc.setQueryData(["template-courses"], (current = []) => {
        if (isEditing) {
          return current.map((t) => (t.id === editingId ? { ...t, ...optimisticTemplate } : t));
        }
        return [optimisticTemplate, ...current];
      });

      setTemplateOpen(false);
      setTemplateForm(EMPTY_TEMPLATE);
      setEditingTemplate(null);
      return { previousTemplates, tempId, isEditing, editingId };
    },
    onSuccess: (savedTemplate, _vars, context) => {
      qc.setQueryData(["template-courses"], (current = []) => {
        if (context?.isEditing) {
          return current.map((t) => (t.id === context.editingId ? savedTemplate : t));
        }
        return current.map((t) => (t.id === context?.tempId ? savedTemplate : t));
      });
    },
    onError: (err, _vars, context) => {
      if (context?.previousTemplates) {
        qc.setQueryData(["template-courses"], context.previousTemplates);
      }
      toast({
        title: "Could not save template",
        description: err?.message || "Check that migrations are applied, DATABASE_URL is set, and the admin API is running (port 8787).",
        variant: "destructive",
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["template-courses"] });
    },
  });
  const removeTemplate = useMutation({
    mutationFn: (id) => templateCoursesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["template-courses"] });
    },
    onError: (err) => {
      toast({ title: "Delete failed", description: err?.message || "Try again.", variant: "destructive" });
    },
  });
  const saveScheduled = useMutation({
    mutationFn: (data) => {
      const payload = buildScheduledPayload(data);
      return editingSchedule ? adminCoursesApi.update(editingSchedule, payload) : adminCoursesApi.create(payload);
    },
    onMutate: async (data) => {
      const isEditing = Boolean(editingSchedule);
      const tempId = `temp-scheduled-${Date.now()}`;
      const payload = buildScheduledPayload(data);
      await qc.cancelQueries({ queryKey: ["courses", "admin-api-scheduled"] });
      const previousCourses = qc.getQueryData(["courses", "admin-api-scheduled"]) || [];

      const optimisticCourse = {
        ...payload,
        id: editingSchedule || tempId,
        updated_date: new Date().toISOString(),
      };

      qc.setQueryData(["courses", "admin-api-scheduled"], (current = []) => {
        if (isEditing) {
          return current.map((course) => (course.id === editingSchedule ? { ...course, ...optimisticCourse } : course));
        }
        return [optimisticCourse, ...current];
      });

      setScheduleOpen(false);
      setScheduleForm(EMPTY_SCHEDULED);
      setEditingSchedule(null);
      return { previousCourses, tempId, isEditing, editingId: editingSchedule };
    },
    onSuccess: (savedCourse, _vars, context) => {
      qc.setQueryData(["courses", "admin-api-scheduled"], (current = []) => {
        if (context?.isEditing) {
          return current.map((course) => (course.id === context.editingId ? savedCourse : course));
        }
        return current.map((course) => (course.id === context?.tempId ? savedCourse : course));
      });
    },
    onError: (err, _vars, context) => {
      if (context?.previousCourses) {
        qc.setQueryData(["courses", "admin-api-scheduled"], context.previousCourses);
      }
      toast({
        title: "Could not save scheduled course",
        description: err?.message || "Ensure the scheduled_courses table exists and the admin API is reachable.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["courses", "admin-api-scheduled"] });
    },
  });
  const removeScheduled = useMutation({
    mutationFn: (id) => adminCoursesApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["courses", "admin-api-scheduled"] });
      const previousCourses = qc.getQueryData(["courses", "admin-api-scheduled"]) || [];
      qc.setQueryData(["courses", "admin-api-scheduled"], (current = []) => current.filter((course) => course.id !== id));
      return { previousCourses };
    },
    onError: (err, _id, context) => {
      if (context?.previousCourses) {
        qc.setQueryData(["courses", "admin-api-scheduled"], context.previousCourses);
      }
      toast({ title: "Delete failed", description: err?.message || "Try again.", variant: "destructive" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["courses", "admin-api-scheduled"] });
    },
  });
  const updateEnrollmentStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Enrollment.update(id, { status }),
    onSuccess: () => qc.invalidateQueries(["enrollments"]),
  });
  const createSession = useMutation({
    mutationFn: (data) => base44.entities.ClassSession.create(data),
    onSuccess: () => { qc.invalidateQueries(["class-sessions"]); setSessionOpen(false); },
  });
  const confirmAttendanceMutation = useMutation({
    mutationFn: (sessionId) => base44.entities.ClassSession.update(sessionId, { attendance_confirmed: true }),
    onSuccess: () => { qc.invalidateQueries(["class-sessions"]); setConfirmAttendanceDialog(null); },
  });

  const handleEnrollmentSelect = (enrollmentId) => {
    const enrollment = enrollments.find(e => e.id === enrollmentId);
    const course = allCourses.find(c => c.id === enrollment?.course_id);
    setSessionForm(f => ({ ...f, enrollment_id: enrollmentId, course_id: enrollment?.course_id || "", course_title: course?.title || "", provider_id: enrollment?.provider_id || "", provider_name: enrollment?.provider_name || "", provider_email: enrollment?.provider_email || "" }));
  };
  const regenCode = async (session) => { await base44.entities.ClassSession.update(session.id, { session_code: generateCode() }); qc.invalidateQueries(["class-sessions"]); };
  const handleConfirmAttendance = async (session) => {
    if (session.enrollment_id) await base44.entities.Enrollment.update(session.enrollment_id, { status: "completed" });
    confirmAttendanceMutation.mutate(session.id);
  };

  const filteredEnrollments = enrollments.filter(e => {
    const matchSearch = !search || e.provider_name?.toLowerCase().includes(search.toLowerCase()) || e.provider_email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const isUpcoming = (s) => { try { return s.session_date && parseISO(s.session_date) >= new Date(); } catch { return false; } };
  const isPastSession = (s) => { try { return !s.session_date || parseISO(s.session_date) < new Date(); } catch { return true; } };

  const tabs = [
    { id: "templates", label: "Templates", count: templates.length, icon: LayoutTemplate },
    { id: "scheduled", label: "Scheduled", count: scheduledCourses.length, icon: Calendar },
    { id: "calendar", label: "Calendar", count: null, icon: CalendarDays },
    { id: "trainer_prep", label: "Trainer Prep", count: null, icon: Package },
    { id: "enrollments", label: "Enrollments", count: enrollments.length, icon: Users },
  ];

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#DA6A63", letterSpacing: "0.14em" }}>Admin</p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1a2540", lineHeight: 1.15 }}>Course Management</h1>
        </div>
        <div className="flex gap-2">
          {tab === "templates" && (
            <button onClick={() => { setTemplateForm(EMPTY_TEMPLATE); setEditingTemplate(null); setTemplateOpen(true); }} className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-2xl text-white" style={{ background: "linear-gradient(135deg, #DA6A63, #FA6F30)" }}>
              <Plus className="w-4 h-4" /> New Template
            </button>
          )}
          {tab === "scheduled" && (
            <button onClick={() => { setScheduleForm(EMPTY_SCHEDULED); setEditingSchedule(null); setScheduleOpen(true); }} className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-2xl text-white" style={{ background: "linear-gradient(135deg, #DA6A63, #FA6F30)" }} disabled={templates.length === 0}>
              <Plus className="w-4 h-4" /> Schedule Course
            </button>
          )}

        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl flex-wrap" style={{ background: "rgba(0,0,0,0.05)", display: "inline-flex" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={tab === t.id ? { background: "#fff", color: "#1a2540", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } : { color: "#8891a8" }}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.count !== null && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: tab === t.id ? "rgba(218,106,99,0.12)" : "rgba(0,0,0,0.06)", color: tab === t.id ? "#DA6A63" : "#b0b8cc" }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TEMPLATES TAB ── */}
      {tab === "templates" && (
        loadingTemplates ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-48 rounded-3xl animate-pulse" style={{ background: "rgba(0,0,0,0.05)" }} />)}</div>
        ) : templates.length === 0 ? (
          <div className="rounded-3xl py-16 text-center" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
            <LayoutTemplate className="w-10 h-10 mx-auto mb-3" style={{ color: "#d0d5e0" }} />
            <p className="font-semibold mb-1" style={{ color: "#1a2540" }}>No course templates yet</p>
            <p className="text-sm mb-4" style={{ color: "#b0b8cc" }}>Create templates first, then schedule them with specific dates.</p>
            <button onClick={() => { setTemplateForm(EMPTY_TEMPLATE); setEditingTemplate(null); setTemplateOpen(true); }} className="text-sm font-semibold px-5 py-2.5 rounded-2xl text-white" style={{ background: "linear-gradient(135deg, #DA6A63, #FA6F30)" }}>
              <Plus className="w-4 h-4 inline mr-1" /> New Template
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(c => (
              <div key={c.id} className={`rounded-3xl p-5 relative ${!c.is_active ? "opacity-60" : ""}`} style={{ background: "rgba(255,255,255,0.3)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.6)", boxShadow: "0 4px 24px rgba(30,37,53,0.1)" }}>
                {c.is_featured && <span className="absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(200,230,60,0.18)", color: "#5a7a20", border: "1px solid rgba(200,230,60,0.35)" }}>Featured</span>}
                <div className="flex items-center gap-1.5 mb-2">
                  <LayoutTemplate className="w-4 h-4 flex-shrink-0" style={{ color: "#4a5fa0" }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#4a5fa0" }}>Template</span>
                </div>
                <h3 className="font-semibold text-sm leading-tight mb-2" style={{ color: "#1a2540" }}>{c.title}</h3>
                <div className="flex gap-1.5 flex-wrap mb-3">
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium capitalize" style={{ background: "rgba(74,95,160,0.08)", color: "#4a5fa0" }}>{c.category?.replace("_", " ")}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium capitalize" style={{ background: "rgba(0,0,0,0.05)", color: "#8891a8" }}>{c.level}</span>
                  {!c.is_active && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(218,106,99,0.1)", color: "#DA6A63" }}>Inactive</span>}
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  {c.price && <span className="font-semibold flex items-center gap-1" style={{ color: "#1a2540" }}><DollarSign className="w-3.5 h-3.5" />{Number(c.price || 0).toLocaleString()}</span>}
                  {c.duration_hours && <span className="flex items-center gap-1" style={{ color: "#8891a8", fontSize: 12 }}><Clock className="w-3 h-3" />{c.duration_hours}h</span>}
                </div>
                {c.certifications_awarded?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {c.certifications_awarded.map((cert, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "rgba(218,106,99,0.08)", color: "#DA6A63" }}>
                        <Award className="w-2.5 h-2.5" />{cert.cert_name || cert.service_type_name}
                      </span>
                    ))}
                  </div>
                )}
                {c.linked_service_type_ids?.length > 0 && (
                  <p className="text-xs mb-3" style={{ color: "#8891a8" }}>{c.linked_service_type_ids.length} service(s) linked</p>
                )}
                <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
                  <button className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-xl transition-opacity hover:opacity-70" style={{ background: "rgba(74,95,160,0.08)", color: "#4a5fa0" }}
                    onClick={() => { setTemplateForm({ ...c, certifications_awarded: c.certifications_awarded||[], linked_service_type_ids: c.linked_service_type_ids||[], pre_course_materials: c.pre_course_materials||[], platform_coverage: c.platform_coverage||[] }); setEditingTemplate(c.id); setTemplateOpen(true); }}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button className="py-2 px-3 text-xs font-semibold rounded-xl transition-opacity hover:opacity-70" style={{ background: "rgba(218,106,99,0.08)", color: "#DA6A63" }} onClick={() => removeTemplate.mutate(c.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── SCHEDULED COURSES TAB ── */}
      {tab === "scheduled" && (
        loadingCourses ? (
          <div className="grid md:grid-cols-2 gap-4">{[1,2].map(i => <div key={i} className="h-48 rounded-3xl animate-pulse" style={{ background: "rgba(0,0,0,0.05)" }} />)}</div>
        ) : scheduledCourses.length === 0 ? (
          <div className="rounded-3xl py-16 text-center" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
            <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: "#d0d5e0" }} />
            <p className="font-semibold mb-1" style={{ color: "#1a2540" }}>No courses scheduled yet</p>
            <p className="text-sm mb-4" style={{ color: "#b0b8cc" }}>
              {templates.length === 0 ? "Create a course template first, then schedule it with dates." : "Pick a template and add specific dates for providers to enroll in."}
            </p>
            {templates.length > 0 && (
              <button onClick={() => { setScheduleForm(EMPTY_SCHEDULED); setEditingSchedule(null); setScheduleOpen(true); }} className="text-sm font-semibold px-5 py-2.5 rounded-2xl text-white" style={{ background: "linear-gradient(135deg, #DA6A63, #FA6F30)" }}>
                <Plus className="w-4 h-4 inline mr-1" /> Schedule Course
              </button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {scheduledCourses.map(c => {
              const tmpl = templateFor(c);
              const enrollCount = enrollCountFor(c.id);
              const dates = (c.session_dates || []).sort((a, b) => a.date > b.date ? 1 : -1);
              return (
                <div key={c.id} className={`rounded-3xl p-5 ${!c.is_active ? "opacity-60" : ""}`} style={{ background: "rgba(255,255,255,0.3)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.6)", boxShadow: "0 4px 24px rgba(30,37,53,0.1)" }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#DA6A63" }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#DA6A63" }}>Scheduled</span>
                    {tmpl && <span className="text-xs" style={{ color: "#b0b8cc" }}>from &ldquo;{tmpl.title}&rdquo;</span>}
                  </div>
                  <h3 className="font-semibold text-sm leading-tight mb-2" style={{ color: "#1a2540" }}>{c.title}</h3>
                  <div className="flex items-center gap-3 mb-3 text-sm">
                    {c.price && <span className="font-semibold flex items-center gap-0.5" style={{ color: "#1a2540" }}><DollarSign className="w-3.5 h-3.5" />{Number(c.price||0).toLocaleString()}</span>}
                    <span className="flex items-center gap-1" style={{ color: "#8891a8", fontSize: 12 }}><Users className="w-3 h-3" />{enrollCount} enrolled</span>
                    {c.location && <span style={{ color: "#8891a8", fontSize: 12 }}>{c.location}</span>}
                  </div>
                  {/* Session dates with per-date class codes */}
                  <div className="space-y-2 mb-4">
                    {dates.length === 0 ? (
                      <p className="text-xs italic" style={{ color: "#b0b8cc" }}>No dates scheduled</p>
                    ) : dates.map((d, i) => {
                      // Find a session record keyed by course + date (enrollment_id = "class_date:<courseId>:<date>")
                      const dateKey = `class_date:${c.id}:${d.date}`;
                      const dateSession = sessions.find(s => s.enrollment_id === dateKey);
                      return (
                        <div key={i} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(74,95,160,0.12)" }}>
                          {/* Date header row */}
                          <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: "rgba(74,95,160,0.05)" }}>
                            <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: "#4a5fa0" }} />
                            {d.label && <span className="text-xs font-bold" style={{ color: "#4a5fa0" }}>{d.label}</span>}
                            <span className="text-xs font-medium" style={{ color: "#1a2540" }}>{d.date}</span>
                            {(d.start_time || d.end_time) && <span className="text-xs" style={{ color: "#8891a8" }}>{d.start_time}{d.end_time ? `–${d.end_time}` : ""}</span>}
                            {d.location && <span className="text-xs" style={{ color: "#8891a8" }}>· {d.location}</span>}
                          </div>
                          {/* Code section */}
                          <div className="px-3 py-2.5 flex items-center gap-2">
                            {dateSession ? (
                              <>
                                <Key className="w-3.5 h-3.5 flex-shrink-0" style={{ color: dateSession.code_used ? "#22c55e" : "#FA6F30" }} />
                                <span className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.5)" }}>Class Code:</span>
                                <span className={`font-mono text-base font-bold tracking-[0.2em] px-3 py-1 rounded-lg ${dateSession.code_used ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>
                                  {showCodes[dateSession.id] ? dateSession.session_code : "••••••"}
                                </span>
                                <button onClick={() => setShowCodes(p => ({ ...p, [dateSession.id]: !p[dateSession.id] }))} className="text-slate-400 hover:text-slate-600">
                                  {showCodes[dateSession.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                {!dateSession.code_used && (
                                  <button onClick={() => regenCode(dateSession)} className="p-1 rounded hover:bg-slate-100 transition-colors" title="Regenerate code">
                                    <RefreshCw className="w-3.5 h-3.5" style={{ color: "#8891a8" }} />
                                  </button>
                                )}
                                {dateSession.code_used && !dateSession.attendance_confirmed && (
                                  <button className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-lg text-white" style={{ background: "#4a5fa0" }} onClick={() => setConfirmAttendanceDialog(dateSession)}>
                                    Confirm All
                                  </button>
                                )}
                                {dateSession.attendance_confirmed && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                              </>
                            ) : (
                              <>
                                <Key className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#b0b8cc" }} />
                                <span className="text-xs flex-1" style={{ color: "#b0b8cc" }}>No code generated yet</span>
                                <button
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white whitespace-nowrap"
                                  style={{ background: "linear-gradient(135deg, #DA6A63, #FA6F30)" }}
                                  onClick={() => createSession.mutate({
                                    enrollment_id: dateKey,
                                    course_id: c.id,
                                    course_title: c.title,
                                    provider_id: "",
                                    provider_name: "All enrolled providers",
                                    provider_email: "",
                                    session_date: d.date,
                                    session_code: generateCode(),
                                  })}
                                  disabled={createSession.isPending}
                                >
                                  Generate Code
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
                    <button className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-xl hover:opacity-70 transition-opacity" style={{ background: "rgba(74,95,160,0.08)", color: "#4a5fa0" }}
                      onClick={() => { setScheduleForm({ template_id: c.template_id, title: c.title, price: c.price, location: c.location, max_seats: c.max_seats, instructor_name: c.instructor_name, session_dates: c.session_dates||[], is_active: c.is_active, is_featured: c.is_featured }); setEditingSchedule(c.id); setScheduleOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button className="py-2 px-3 text-xs font-semibold rounded-xl hover:opacity-70 transition-opacity" style={{ background: "rgba(218,106,99,0.08)", color: "#DA6A63" }} onClick={() => removeScheduled.mutate(c.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── TRAINING CALENDAR TAB ── */}
      {tab === "calendar" && (
        <TrainingCalendarView scheduledCourses={scheduledCourses} enrollments={enrollments} />
      )}

      {/* ── TRAINER PREP TAB ── */}
      {tab === "trainer_prep" && (
        <TrainerPrepView scheduledCourses={scheduledCourses} enrollments={enrollments} />
      )}

      {/* ── ENROLLMENTS TAB ── */}
      {tab === "enrollments" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#b0b8cc" }} />
              <Input className="pl-9" placeholder="Search by provider..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {["pending_payment","paid","confirmed","attended","completed","cancelled","no_show"].map(s => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {loadingEnrollments ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "rgba(0,0,0,0.05)" }} />)}</div>
          ) : (
            <div className="space-y-2">
              {filteredEnrollments.map(e => {
                const course = courseMap[e.course_id];
                return (
                  <div key={e.id} className="rounded-3xl px-5 py-4" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm" style={{ color: "#1a2540" }}>{e.provider_name || e.provider_email}</span>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${enrollmentStatusColor[e.status]}`}>{e.status?.replace("_"," ")}</span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "#8891a8" }}>{course?.title || "Unknown Course"}</p>
                        <div className="flex gap-3 text-xs mt-1" style={{ color: "#b0b8cc" }}>
                          {e.amount_paid && <span>${e.amount_paid.toLocaleString()}</span>}
                          {e.created_date && <span>{format(new Date(e.created_date), "MMM d, yyyy")}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {e.status === "paid" && <button className="text-xs font-semibold px-3 py-1.5 rounded-xl border" style={{ borderColor: "rgba(74,95,160,0.3)", color: "#4a5fa0" }} onClick={() => updateEnrollmentStatus.mutate({ id: e.id, status: "confirmed" })}>Confirm</button>}
                        {e.status === "confirmed" && <button className="text-xs font-semibold px-3 py-1.5 rounded-xl border" style={{ borderColor: "rgba(74,95,160,0.3)", color: "#4a5fa0" }} onClick={() => updateEnrollmentStatus.mutate({ id: e.id, status: "attended" })}>Mark Attended</button>}
                        {e.status === "attended" && <button className="text-xs font-semibold px-3 py-1.5 rounded-xl text-white" style={{ background: "linear-gradient(135deg, #DA6A63, #FA6F30)" }} onClick={() => updateEnrollmentStatus.mutate({ id: e.id, status: "completed" })}><CheckCircle className="w-3.5 h-3.5 inline mr-1" />Complete</button>}
                        {!["cancelled","completed","no_show"].includes(e.status) && <button className="text-xs font-semibold px-3 py-1.5 rounded-xl border" style={{ borderColor: "rgba(218,106,99,0.3)", color: "#DA6A63" }} onClick={() => updateEnrollmentStatus.mutate({ id: e.id, status: "cancelled" })}>Cancel</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredEnrollments.length === 0 && <p className="text-center py-10" style={{ color: "#b0b8cc" }}>No enrollments found</p>}
            </div>
          )}
        </div>
      )}

      {/* ── Forms & Dialogs ── */}
      <CourseTemplateForm
        open={templateOpen} onOpenChange={setTemplateOpen}
        form={templateForm} setForm={setTemplateForm}
        onSave={() => saveTemplate.mutate({ data: templateForm, editingId: editingTemplate })}
        saving={saveTemplate.isPending} editing={editingTemplate}
        serviceTypes={serviceTypes}
      />
      <ScheduleCourseForm
        open={scheduleOpen} onOpenChange={setScheduleOpen}
        form={scheduleForm} setForm={setScheduleForm}
        onSave={() => saveScheduled.mutate(scheduleForm)}
        saving={saveScheduled.isPending} editing={editingSchedule}
        templates={templates}
      />

      <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Class Session</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Link to Enrollment</label>
              <Select value={sessionForm.enrollment_id} onValueChange={handleEnrollmentSelect}>
                <SelectTrigger><SelectValue placeholder="Select enrollment..." /></SelectTrigger>
                <SelectContent>
                  {enrollments.filter(e => e.status === "paid" || e.status === "confirmed").map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.provider_name || e.provider_email} — {allCourses.find(c => c.id === e.course_id)?.title || e.course_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Session Date</label>
              <Input type="date" value={sessionForm.session_date} onChange={e => setSessionForm(f => ({ ...f, session_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Class Code (admin only)</label>
              <div className="flex gap-2">
                <Input value={sessionForm.session_code} onChange={e => setSessionForm(f => ({ ...f, session_code: e.target.value.toUpperCase() }))} className="font-mono text-lg tracking-widest text-center" />
                <Button variant="outline" onClick={() => setSessionForm(f => ({ ...f, session_code: generateCode() }))}><RefreshCw className="w-4 h-4" /></Button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Give this verbally to the provider in class.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSessionOpen(false)}>Cancel</Button>
              <Button onClick={() => createSession.mutate(sessionForm)} disabled={!sessionForm.enrollment_id || createSession.isPending} style={{ background: "linear-gradient(135deg, #DA6A63, #FA6F30)", color: "#fff" }}>
                {createSession.isPending ? "Creating..." : "Create Session"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAttendanceDialog} onOpenChange={() => setConfirmAttendanceDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirm Attendance</DialogTitle></DialogHeader>
          {confirmAttendanceDialog && (
            <div className="space-y-4 pt-2">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-sm text-slate-700"><strong>Provider:</strong> {confirmAttendanceDialog.provider_name || confirmAttendanceDialog.provider_email}</p>
                <p className="text-sm text-slate-700"><strong>Course:</strong> {confirmAttendanceDialog.course_title}</p>
                {confirmAttendanceDialog.session_date && <p className="text-sm text-slate-700"><strong>Date:</strong> {format(new Date(confirmAttendanceDialog.session_date), "MMM d, yyyy")}</p>}
              </div>
              <p className="text-sm text-slate-600">This will mark attendance as confirmed and change enrollment status to &ldquo;completed&rdquo;.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmAttendanceDialog(null)}>Cancel</Button>
                <Button onClick={() => handleConfirmAttendance(confirmAttendanceDialog)} disabled={confirmAttendanceMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
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