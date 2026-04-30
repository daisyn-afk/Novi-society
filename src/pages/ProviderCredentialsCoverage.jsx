import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProviderSalesLock from "@/components/ProviderSalesLock";
import { useProviderAccess } from "@/components/useProviderAccess";
import { base44 } from "@/api/base44Client";
import { adminApiRequest } from "@/api/adminApiRequest";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, CheckCircle, CheckCircle2, Clock, AlertTriangle, Plus,
  Calendar, KeyRound, Award, Zap, ChevronRight, RotateCcw, Upload,
  BookOpen, Users, FileText, MapPin, ShieldCheck,
  ChevronDown, ChevronUp, Sparkles, ExternalLink, Star, DollarSign, Info, TrendingUp,
  XCircle, Settings, Trash2, CreditCard, RefreshCw
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { getSessionWindowForDate, isNowWithinSessionRedeemWindow } from "@/lib/classCodeWindow";
import { CLASS_TIME_ZONE } from "@/lib/classCodeWindow";

const LICENSE_TYPES = ["RN", "NP", "PA", "MD", "DO", "esthetician", "other"];
const CERT_TYPES = ["RN", "NP", "PA", "MD", "DO", "esthetician", "other"];
const ACTIVATION_STEPS = ["Verify Training", "Select Service", "Sign & Activate"];
const FIRST_SERVICE_PRICE = 279;
const ADDON_SERVICE_PRICE = 129;
const MAX_SERVICES = 5;
const MAX_MONTHLY_CAP = 795;

function toDateOnly(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}$/.test(raw)) return "";
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return raw.slice(0, 10);
}

function formatSessionDateLabel(value) {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return "Date TBD";
  const [y, m, d] = dateOnly.split("-").map(Number);
  if (!y || !m || !d) return dateOnly;
  return format(new Date(y, m - 1, d), "MMM d, yyyy");
}

const statusColorLicense = {
  pending_review: "bg-yellow-100 text-yellow-700 border-yellow-200",
  verified: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  expired: "bg-slate-100 text-slate-500 border-slate-200",
};

// ─── Small reusable components ────────────────────────────────────────────────

function SectionLabel({ children }) {
  return <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.5)" }}>{children}</p>;
}

function GlassCard({ children, className = "", style = {} }) {
  return (
    <div className={`rounded-2xl overflow-hidden ${className}`} style={{
      background: "rgba(255,255,255,0.82)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.9)",
      boxShadow: "0 2px 16px rgba(30,37,53,0.07)",
      ...style
    }}>
      {children}
    </div>
  );
}

function CertRow({ cert: c, muted = false }) {
  const configs = {
    active: { label: "Active", bg: "rgba(200,230,60,0.15)", color: "#4a6b10", border: "rgba(200,230,60,0.4)" },
    pending: { label: "Under Review", bg: "rgba(250,111,48,0.1)", color: "#FA6F30", border: "rgba(250,111,48,0.25)" },
    expired: { label: "Expired", bg: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.4)", border: "rgba(30,37,53,0.1)" },
    revoked: { label: "Revoked", bg: "rgba(218,106,99,0.1)", color: "#DA6A63", border: "rgba(218,106,99,0.25)" },
  };
  const cfg = configs[c.status] || configs.pending;
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${muted ? "opacity-50" : ""}`} style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.08)" }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${cfg.bg}` }}>
        <Award className="w-4.5 h-4.5" style={{ color: cfg.color, width: 18, height: 18 }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: "#1e2535" }}>{c.certification_name}</p>
        {c.service_type_name && <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{c.service_type_name}</p>}
        {c.issued_by && <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.4)" }}>Issued by {c.issued_by}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
        {c.certificate_url && (
          <a href={c.certificate_url} target="_blank" rel="noreferrer">
            <ExternalLink className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} />
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProviderCredentialsCoverage() {
  const { status: accessStatus } = useProviderAccess();
  const [activeTab, setActiveTab] = useState("overview");
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [licenseForm, setLicenseForm] = useState({ license_type: "RN" });
  const [uploading, setUploading] = useState(false);
  const [certSubmitOpen, setCertSubmitOpen] = useState(false);
  const [certSubmitStep, setCertSubmitStep] = useState(0);
  const [extCertForm, setExtCertForm] = useState({ cert_name: "", issuing_school: "", cert_type: "RN", service_type_id: "", service_type_name: "" });
  const [extCertFileUrl, setExtCertFileUrl] = useState("");
  const [extLicenseFileUrl, setExtLicenseFileUrl] = useState("");
  const [uploadingExtCert, setUploadingExtCert] = useState(false);
  const [uploadingExtLicense, setUploadingExtLicense] = useState(false);
  const [uploadExtCertError, setUploadExtCertError] = useState("");
  const [uploadExtLicenseError, setUploadExtLicenseError] = useState("");
  const [activateDialog, setActivateDialog] = useState(false);
  const [step, setStep] = useState(-1);
  const [classCode, setClassCode] = useState("");
  const [selectedCoverageCourseKey, setSelectedCoverageCourseKey] = useState("");
  const [attendedWindowKeys, setAttendedWindowKeys] = useState(new Set());
  const [codeError, setCodeError] = useState("");
  const [verifiedSession, setVerifiedSession] = useState(null);
  const [useExternalCert, setUseExternalCert] = useState(false);
  const [certForm, setCertForm] = useState({ cert_type: "RN", issuing_school: "", cert_name: "" });
  const [certFileUrl, setCertFileUrl] = useState("");
  const [uploadingCert, setUploadingCert] = useState(false);
  const [uploadCertError, setUploadCertError] = useState("");
  const [submitCertError, setSubmitCertError] = useState("");
  const [submitExtCertError, setSubmitExtCertError] = useState("");
  const [certSubmitted, setCertSubmitted] = useState(false);
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState(null);
  const [hasSigned, setHasSigned] = useState(false);
  const [expandedService, setExpandedService] = useState(null);
  const [stripeHandled, setStripeHandled] = useState(false);
  const [cancelDialog, setCancelDialog] = useState({ open: false, sub: null });
  const [cancelForm, setCancelForm] = useState({ reason: "", notes: "", confirmation_name: "" });
  const [cancelStep, setCancelStep] = useState(0); // 0=form, 1=confirm, 2=done
  const [cancelLoading, setCancelLoading] = useState(false);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  // URL param handling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab")) setActiveTab(params.get("tab"));
    const promptService = params.get("prompt_service");
    if (promptService) {
      setActiveTab("coverage");
      setActivateDialog(true);
      setSelectedServiceTypeId(promptService);
      setStep(2);
    }
  }, []);

  // Data queries
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  const { data: licenses = [], isLoading: loadingLicenses } = useQuery({
    queryKey: ["my-licenses"],
    queryFn: async () => { const u = await base44.auth.me(); return base44.entities.License.filter({ provider_id: u.id }); },
  });
  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });
  const { data: myCerts = [] } = useQuery({
    queryKey: ["my-certs"],
    queryFn: async () => { const u = await base44.auth.me(); return base44.entities.Certification.filter({ provider_id: u.id }, "-issued_at"); },
    enabled: !!me,
  });
  const { data: mySubscriptions = [] } = useQuery({
    queryKey: ["my-md-subscriptions"],
    queryFn: async () => { const u = await base44.auth.me(); return base44.entities.MDSubscription.filter({ provider_id: u.id }); },
    enabled: !!me,
  });
  const { data: myEnrollments = [], isLoading: loadingMyEnrollments, isFetching: fetchingMyEnrollments } = useQuery({
    queryKey: ["my-enrollments-coverage"],
    queryFn: async () => {
      const u = await base44.auth.me();
      const [byProviderIdResult, byEmailResult, preOrdersResult] = await Promise.allSettled([
        u?.id ? base44.entities.Enrollment.filter({ provider_id: u.id }) : Promise.resolve([]),
        u?.email ? base44.entities.Enrollment.filter({ provider_email: u.email }) : Promise.resolve([]),
        base44.entities.PreOrder.list("-created_date", 500),
      ]);
      const byProviderId = byProviderIdResult.status === "fulfilled" ? (byProviderIdResult.value || []) : [];
      const byEmail = byEmailResult.status === "fulfilled" ? (byEmailResult.value || []) : [];
      const preOrders = preOrdersResult.status === "fulfilled" ? (preOrdersResult.value || []) : [];
      const email = String(u?.email || "").toLowerCase();
      const derivedFromPreOrders = preOrders
        .filter((p) => String(p?.order_type || "").toLowerCase() === "course")
        .filter((p) => ["paid", "confirmed", "completed"].includes(String(p?.status || "").toLowerCase()))
        .filter((p) => String(p?.customer_email || "").toLowerCase() === email)
        .map((p) => ({
          id: `preorder-${p.id}`,
          pre_order_id: p.id,
          course_id: p.course_id,
          provider_id: u?.id || null,
          provider_email: p.customer_email || u?.email || null,
          provider_name: p.customer_name || null,
          status: String(p?.status || "").toLowerCase() === "completed" ? "attended" : String(p?.status || "").toLowerCase(),
          session_date: p.course_date || p.session_date || null,
          amount_paid: p.amount_paid,
          created_date: p.created_date || p.created_at || null,
        }));
      const map = new Map();
      [...byProviderId, ...byEmail, ...derivedFromPreOrders].forEach((row) => {
        const dedupeKey = row?.pre_order_id || row?.id || `${row?.course_id || ""}:${row?.session_date || ""}`;
        if (dedupeKey) map.set(String(dedupeKey), row);
      });
      return Array.from(map.values());
    },
    enabled: !!me,
  });
  const { data: mySessions = [], isLoading: loadingMySessions, isFetching: fetchingMySessions } = useQuery({
    queryKey: ["my-sessions-coverage", myEnrollments.map((e) => `${e.id}:${e.course_id}:${e.session_date || ""}`).join("|")],
    queryFn: async () => {
      const u = await base44.auth.me();
      const allSessions = await base44.entities.ClassSession.list("-created_date");
      const enrollmentIds = new Set(myEnrollments.map((e) => String(e.id)));
      const classDateKeys = new Set(
        myEnrollments
          .filter((e) => e.course_id && e.session_date)
          .map((e) => `class_date:${e.course_id}:${String(e.session_date).slice(0, 10)}`)
      );
      const meId = String(u?.id || "");
      const meEmail = String(u?.email || "").toLowerCase();
      return (allSessions || []).filter((session) => {
        const providerId = String(session?.provider_id || "");
        const providerEmail = String(session?.provider_email || "").toLowerCase();
        const enrollmentId = String(session?.enrollment_id || "");
        const sessionCourseId = String(session?.course_id || "");
        if (providerId && providerId === meId) return true;
        if (providerEmail && providerEmail === meEmail) return true;
        if (enrollmentIds.has(enrollmentId)) return true;
        if (classDateKeys.has(enrollmentId)) return true;
        return false;
      });
    },
    enabled: !!me,
  });
  const { data: courses = [] } = useQuery({
    queryKey: ["courses-coverage"],
    queryFn: () => base44.entities.Course.list(),
  });
  const { data: relationships = [] } = useQuery({
    queryKey: ["my-md-relationships"],
    queryFn: async () => { if (!me) return []; return base44.entities.MedicalDirectorRelationship.filter({ provider_id: me.id }); },
    enabled: !!me,
  });

  // Stripe return
  useEffect(() => {
    if (stripeHandled || !me?.id || serviceTypes.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const mdStatus = params.get("md_payment_status");
    const stId = params.get("service_type_id");
    const enrollId = params.get("enrollment_id");
    if (mdStatus === "success" && stId) {
      setStripeHandled(true);
      const now = new Date().toISOString();
      const NOVI_MD_ID = "699c9815c81b2b13b2643a49";
      const NOVI_MD_NAME = "ashlan.brookes.lane";
      const NOVI_MD_EMAIL = "ashlan.brookes.lane@gmail.com";

      base44.entities.MDSubscription.create({
      provider_id: me.id, provider_email: me.email, provider_name: me.full_name,
      service_type_id: stId, service_type_name: serviceTypes.find(s => s.id === stId)?.name,
      status: "active", signed_at: now, signed_by_name: me.full_name, activated_at: now, enrollment_id: enrollId || null,
      }).then(async () => {
      qc.invalidateQueries({ queryKey: ["my-md-subscriptions"] });
      // Auto-assign NOVI Board MD if not already assigned
      const existing = await base44.entities.MedicalDirectorRelationship.filter({ provider_id: me.id, medical_director_id: NOVI_MD_ID });
      if (existing.length === 0) {
        await base44.entities.MedicalDirectorRelationship.create({
          provider_id: me.id, provider_email: me.email, provider_name: me.full_name,
          medical_director_id: NOVI_MD_ID, medical_director_email: NOVI_MD_EMAIL, medical_director_name: NOVI_MD_NAME,
          status: "active", start_date: now.split("T")[0],
          supervision_notes: "Assigned automatically by NOVI Board of Medical Directors.",
        });
        qc.invalidateQueries({ queryKey: ["my-md-relationships"] });
      }
      // Provider is now fully active — redirect to Launch Pad
      navigate(createPageUrl("ProviderLaunchPad"));
      });
    }
  }, [me, serviceTypes, stripeHandled]);

  // Keep Novi Class status fresh whenever Apply dialog opens.
  useEffect(() => {
    if (!activateDialog) return;
    qc.invalidateQueries({ queryKey: ["my-enrollments-coverage"] });
    qc.invalidateQueries({ queryKey: ["my-sessions-coverage"] });
  }, [activateDialog, qc]);

  // Computed
  const activeCerts = myCerts.filter(c => c.status === "active");
  const pendingCerts = myCerts.filter(c => c.status === "pending");
  const otherCerts = myCerts.filter(c => c.status !== "active" && c.status !== "pending");
  const activeSubscriptions = mySubscriptions.filter(s => s.status === "active");
  const alreadyActiveServices = activeSubscriptions.map(s => s.service_type_id);
  const activeRelationships = relationships.filter(r => r.status === "active");
  const pendingRelationships = relationships.filter(r => r.status === "pending");
  const verifiedLicenses = licenses.filter(l => l.status === "verified");
  const pendingLicenses = licenses.filter(l => l.status === "pending_review");
  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));
  const hasActiveClassCodeWindow = myEnrollments.some((enrollment) => {
    if (!["confirmed", "paid"].includes(String(enrollment?.status || "").toLowerCase())) return false;
    if (!enrollment?.session_date) return false;
    const course = courseMap[enrollment.course_id];
    if (!course) return false;
    return isNowWithinSessionRedeemWindow(course, enrollment.session_date);
  });
  const getMembershipPrice = () => alreadyActiveServices.length === 0 ? FIRST_SERVICE_PRICE : ADDON_SERVICE_PRICE;
  const isAtCap = alreadyActiveServices.length >= MAX_SERVICES;
  const calcMonthlyTotal = (count) => {
    if (count <= 0) return 0;
    if (count >= MAX_SERVICES) return MAX_MONTHLY_CAP;
    return FIRST_SERVICE_PRICE + (count - 1) * ADDON_SERVICE_PRICE;
  };
  const completedEnrollments = myEnrollments.filter((e) => ["completed", "attended"].includes(String(e?.status || "").toLowerCase()));
  const unlockedCourseIds = new Set(
    completedEnrollments
      .map((e) => String(e?.course_id || ""))
      .filter(Boolean)
  );
  (mySessions || [])
    .filter((session) => Boolean(session?.code_used))
    .forEach((session) => {
      const enrollmentKey = String(session?.enrollment_id || "");
      const classDateParts = enrollmentKey.startsWith("class_date:") ? enrollmentKey.split(":") : [];
      const courseId = String(session?.course_id || (classDateParts.length >= 3 ? classDateParts[1] : "") || "");
      if (courseId) unlockedCourseIds.add(courseId);
    });
  const earnedServiceTypeIds = new Set(
    Array.from(unlockedCourseIds).flatMap((courseId) => courseMap[courseId]?.linked_service_type_ids || [])
  );
  const activeCertServiceTypeIds = new Set(
    (myCerts || [])
      .filter((cert) => String(cert?.status || "").toLowerCase() === "active")
      .map((cert) => String(cert?.service_type_id || ""))
      .filter(Boolean)
  );
  const unlockedServiceTypeIds = new Set([...earnedServiceTypeIds, ...activeCertServiceTypeIds]);
  const availableServices = serviceTypes.filter((s) => !alreadyActiveServices.includes(s.id) && unlockedServiceTypeIds.has(s.id));
  const selectedService = serviceTypes.find(s => s.id === selectedServiceTypeId);
  const activeServices = serviceTypes.filter(s => alreadyActiveServices.includes(s.id));
  const approvedCertsWithoutCoverage = myCerts.filter(c => c.status === "active" && c.service_type_id && !alreadyActiveServices.includes(c.service_type_id));
  const classCodeEligibleEnrollments = Array.from(
    [...myEnrollments, ...mySessions.map((session) => {
      const rawEnrollmentKey = String(session?.enrollment_id || "");
      const classDateParts = rawEnrollmentKey.startsWith("class_date:") ? rawEnrollmentKey.split(":") : [];
      const classDateCourseId = classDateParts.length >= 3 ? String(classDateParts[1] || "") : "";
      const classDateSessionDate = classDateParts.length >= 3 ? toDateOnly(classDateParts[2]) : "";
      return {
        id: session?.enrollment_id || `class-session:${session?.id || ""}`,
        course_id: session?.course_id || classDateCourseId || null,
        session_date: classDateSessionDate || toDateOnly(session?.session_date) || null,
        status: session?.code_used ? "attended" : "paid",
        course_title: session?.course_title || null,
      };
    })]
      .filter((e) => e?.course_id && e?.session_date && ["paid", "confirmed", "attended"].includes(String(e.status || "").toLowerCase()))
      .reduce((acc, enrollment) => {
        const dateOnly = toDateOnly(enrollment.session_date);
        const dedupeKey = `${enrollment.course_id}:${dateOnly}`;
        const normalized = { ...enrollment, session_date: dateOnly };
        const existing = acc.get(dedupeKey);
        const existingStatus = String(existing?.status || "").toLowerCase();
        const incomingStatus = String(normalized?.status || "").toLowerCase();
        if (!existing || (existingStatus !== "attended" && incomingStatus === "attended")) {
          acc.set(dedupeKey, normalized);
        }
        return acc;
      }, new Map())
      .values()
  );
  const formatEstClockTime = (dateValue) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: CLASS_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dateValue);
  const redeemedSessionKeys = new Set(
    (mySessions || [])
      .filter((session) => Boolean(session?.code_used))
      .map((session) => {
        const classDateParts = String(session?.enrollment_id || "").startsWith("class_date:")
          ? String(session.enrollment_id).split(":")
          : [];
        const sessionDate = toDateOnly(session?.session_date) || (classDateParts.length >= 3 ? toDateOnly(classDateParts[2]) : "");
        const sessionCourseId = String(session?.course_id || (classDateParts.length >= 3 ? classDateParts[1] : "") || "");
        if (!sessionCourseId || !sessionDate) return "";
        return `${sessionCourseId}:${sessionDate}`;
      })
      .filter(Boolean)
  );
  const attendedEnrollmentKeys = new Set(
    (myEnrollments || [])
      .filter((enrollment) => ["attended", "completed"].includes(String(enrollment?.status || "").toLowerCase()))
      .map((enrollment) => {
        const courseId = String(enrollment?.course_id || "");
        const sessionDate = toDateOnly(enrollment?.session_date);
        if (!courseId || !sessionDate) return "";
        return `${courseId}:${sessionDate}`;
      })
      .filter(Boolean)
  );
  const hasRedeemedSessionForWindow = (enrollment) => {
    const courseId = String(enrollment?.course_id || "");
    const sessionDate = toDateOnly(enrollment?.session_date);
    const classDateKey = courseId && sessionDate ? `class_date:${courseId}:${sessionDate}` : "";

    return (mySessions || []).some((session) => {
      if (!session?.code_used) return false;
      const sessionEnrollmentId = String(session?.enrollment_id || "");
      const classDateParts = sessionEnrollmentId.startsWith("class_date:") ? sessionEnrollmentId.split(":") : [];
      const sessionCourseId = String(session?.course_id || (classDateParts.length >= 3 ? classDateParts[1] : "") || "");
      const sessionDateOnly = toDateOnly(session?.session_date) || (classDateParts.length >= 3 ? toDateOnly(classDateParts[2]) : "");
      if (!courseId || !sessionDate) return false;
      if (classDateKey && sessionEnrollmentId === classDateKey) return true;
      return sessionCourseId === courseId && sessionDateOnly === sessionDate;
    });
  };
  const classCodeEnrollmentWindows = classCodeEligibleEnrollments.map((enrollment) => {
    const course = courseMap[enrollment.course_id];
    const sessionDate = toDateOnly(enrollment.session_date);
    const window = getSessionWindowForDate(course, sessionDate);
    const isOpen = window ? isNowWithinSessionRedeemWindow(course, sessionDate) : false;
    const key = `${enrollment.course_id}:${sessionDate}`;
    const isAttended =
      redeemedSessionKeys.has(key) ||
      attendedEnrollmentKeys.has(key) ||
      attendedWindowKeys.has(key) ||
      hasRedeemedSessionForWindow(enrollment);
    return { key, enrollment, course, window, isOpen, isAttended };
  });
  const selectedCoverageWindow = classCodeEnrollmentWindows.find((entry) => entry.key === selectedCoverageCourseKey) || null;

  // Mutations
  const resetActivation = () => {
    setStep(-1); setClassCode(""); setCodeError(""); setVerifiedSession(null);
    setAttendedWindowKeys(new Set());
    setUseExternalCert(false); setCertForm({ cert_type: "RN", issuing_school: "", cert_name: "" });
    setCertFileUrl(""); setUploadCertError(""); setSubmitCertError(""); setCertSubmitted(false); setSelectedServiceTypeId(null); setHasSigned(false);
  };
  const resetExtCertForm = () => {
    setCertSubmitStep(0);
    setExtCertForm({ cert_name: "", issuing_school: "", cert_type: "RN", service_type_id: "", service_type_name: "" });
    setExtCertFileUrl(""); setExtLicenseFileUrl("");
    setUploadExtCertError(""); setUploadExtLicenseError(""); setSubmitExtCertError("");
  };

  const createLicense = useMutation({
    mutationFn: async () => { const u = await base44.auth.me(); return base44.entities.License.create({ ...licenseForm, provider_id: u.id, provider_email: u.email }); },
    onSuccess: () => { qc.invalidateQueries(["my-licenses"]); setLicenseOpen(false); setLicenseForm({ license_type: "RN" }); },
  });
  const uploadLicenseFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setLicenseForm((f) => ({ ...f, document_url: file_url }));
    } finally {
      setUploading(false);
    }
  };
  const uploadExtCertFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploadingExtCert(true);
    setUploadExtCertError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setExtCertFileUrl(file_url);
    } catch (err) {
      setUploadExtCertError(err?.message || "Could not upload certification file. Please try again.");
    } finally {
      setUploadingExtCert(false);
    }
  };
  const uploadExtLicenseFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploadingExtLicense(true);
    setUploadExtLicenseError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setExtLicenseFileUrl(file_url);
    } catch (err) {
      setUploadExtLicenseError(err?.message || "Could not upload license file. Please try again.");
    } finally {
      setUploadingExtLicense(false);
    }
  };
  const uploadCertFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploadingCert(true);
    setUploadCertError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCertFileUrl(file_url);
    } catch (err) {
      setUploadCertError(err?.message || "Could not upload certification file. Please try again.");
    } finally {
      setUploadingCert(false);
    }
  };
  const isUsableUploadedUrl = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return false;
    if (raw === "/N/A" || raw.toUpperCase() === "N/A") return false;
    return /^https?:\/\//i.test(raw);
  };
  const certDebugEnabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("certdebug") === "1";
  const buildSubmitterAuditNote = (existingNotes, user) => {
    const note = `[submitter] name=${user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || "n/a"}; email=${user?.email || "n/a"}; id=${user?.id || "n/a"}`;
    return [String(existingNotes || "").trim(), note].filter(Boolean).join("\n");
  };
  const buildCertificationPayload = (payload, user) => {
    const submitterName = user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.email || null;
    const submitterEmail = user?.email || null;
    const submitterId = user?.id || null;
    return {
      ...payload,
      provider_id: payload.provider_id || submitterId,
      provider_email: payload.provider_email || submitterEmail,
      provider_name: payload.provider_name || submitterName,
      user_id: payload.user_id || submitterId,
      user_email: payload.user_email || submitterEmail,
      user_name: payload.user_name || submitterName,
      submitted_by_name: payload.submitted_by_name || submitterName,
      submitted_by_email: payload.submitted_by_email || submitterEmail,
      created_by: payload.created_by || submitterId || submitterEmail,
      created_by_email: payload.created_by_email || submitterEmail,
      certification_url: payload.certification_url || payload.certificate_url || null,
      certification_file_url: payload.certification_file_url || payload.certificate_url || null,
      document_url: payload.document_url || payload.certificate_url || null,
      file_url: payload.file_url || payload.certificate_url || null,
      attachment_url: payload.attachment_url || payload.certificate_url || null,
      notes: buildSubmitterAuditNote(payload.notes, user),
    };
  };
  const createCertificationWithFallback = async (rawPayload, user, debugTag) => {
    const payload = buildCertificationPayload(rawPayload, user);
    try {
      const created = await adminApiRequest("/admin/certifications", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (certDebugEnabled) console.info(`[cert-debug][${debugTag}] created-via-admin-api`, created);
      return created;
    } catch (adminErr) {
      if (certDebugEnabled) console.warn(`[cert-debug][${debugTag}] admin-api-failed-fallback-base44`, adminErr);
      const created = await base44.entities.Certification.create(payload);
      if (certDebugEnabled) console.info(`[cert-debug][${debugTag}] created-via-base44`, created);
      const createdId = created?.id;
      if (createdId) {
        // Force critical ownership/doc fields in case create path drops sparse keys.
        try {
          await base44.entities.Certification.update(createdId, {
            provider_id: payload.provider_id,
            provider_email: payload.provider_email,
            provider_name: payload.provider_name,
            service_type_id: payload.service_type_id,
            service_type_name: payload.service_type_name,
            certificate_url: payload.certificate_url,
            notes: payload.notes,
          });
        } catch (patchErr) {
          if (certDebugEnabled) console.warn(`[cert-debug][${debugTag}] post-create-patch-failed`, patchErr);
        }
      }
      return created;
    }
  };
  const submitExtCertMutation = useMutation({
    mutationFn: async () => {
      const u = await base44.auth.me();
      if (!u?.id || !u?.email) throw new Error("Your session is not ready. Please refresh and try again.");
      if (!isUsableUploadedUrl(extCertFileUrl) || !isUsableUploadedUrl(extLicenseFileUrl)) {
        throw new Error("Please upload valid certification and license files before submit.");
      }
      const payload = {
      provider_id: u.id,
      provider_email: u.email,
      provider_name: u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.email,
      certification_name: extCertForm.cert_name, issued_by: extCertForm.issuing_school,
      category: extCertForm.cert_type, certificate_url: extCertFileUrl, status: "pending",
      service_type_id: extCertForm.service_type_id, service_type_name: extCertForm.service_type_name,
      issued_at: new Date().toISOString(),
      notes: extLicenseFileUrl ? `License document: ${extLicenseFileUrl}` : undefined,
      };
      if (certDebugEnabled) console.info("[cert-debug][provider-submit-ext] payload", payload);
      const created = await createCertificationWithFallback(payload, u, "provider-submit-ext");
      if (certDebugEnabled) console.info("[cert-debug][provider-submit-ext] created", created);
      return created;
    },
    onSuccess: () => { setSubmitExtCertError(""); qc.invalidateQueries({ queryKey: ["my-certs"] }); setCertSubmitStep(2); },
    onError: (err) => { setSubmitExtCertError(err?.message || "Could not submit external certification."); },
  });
  const submitExternalCertMutation = useMutation({
    mutationFn: async () => {
      const u = await base44.auth.me();
      if (!u?.id || !u?.email) throw new Error("Your session is not ready. Please refresh and try again.");
      if (!isUsableUploadedUrl(certFileUrl)) throw new Error("Please upload a valid certification file before submit.");
      const payload = {
      provider_id: u.id,
      provider_email: u.email,
      provider_name: u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.email,
      certification_name: certForm.cert_name, issued_by: certForm.issuing_school,
      category: certForm.cert_type, certificate_url: certFileUrl, status: "pending",
      service_type_id: certForm.service_type_id, service_type_name: certForm.service_type_name,
      issued_at: new Date().toISOString(),
      };
      if (certDebugEnabled) console.info("[cert-debug][provider-submit-standard] payload", payload);
      const created = await createCertificationWithFallback(payload, u, "provider-submit-standard");
      if (certDebugEnabled) console.info("[cert-debug][provider-submit-standard] created", created);
      return created;
    },
    onSuccess: () => { setSubmitCertError(""); qc.invalidateQueries({ queryKey: ["my-certs"] }); setCertSubmitted(true); },
    onError: (err) => { setSubmitCertError(err?.message || "Could not submit external certification."); },
  });
  const verifyCodeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCoverageWindow) throw new Error("Select your enrolled course first.");
      if (!selectedCoverageWindow.isOpen) throw new Error("Selected course window is closed. You can enter code only during its active time.");
      const normalizedCode = String(classCode || "").trim().toUpperCase();
      const selectedCourseId = String(selectedCoverageWindow.enrollment.course_id || "");
      const selectedDate = String(selectedCoverageWindow.enrollment.session_date || "").slice(0, 10);
      const codeMatches = mySessions.filter((session) => String(session.session_code || "").toUpperCase() === normalizedCode);
      if (codeMatches.length === 0) throw new Error("This code does not match any session assigned to you.");
      const sessionMeta = codeMatches.map((session) => {
        const sessionCourseId = String(session.course_id || "");
        const classDateKey = String(session.enrollment_id || "");
        const classDateParts = classDateKey.startsWith("class_date:") ? classDateKey.split(":") : [];
        const classDateCourseId = classDateParts.length >= 3 ? String(classDateParts[1] || "") : "";
        const classDateSessionDate = classDateParts.length >= 3 ? String(classDateParts[2] || "").slice(0, 10) : "";
        const enrollmentForSession = myEnrollments.find((enrollment) => enrollment.id === session.enrollment_id);
        const sessionDateOnly = String(
          session.session_date ||
          enrollmentForSession?.session_date ||
          classDateSessionDate ||
          ""
        ).slice(0, 10);
        const effectiveSessionCourseId = sessionCourseId || classDateCourseId || String(enrollmentForSession?.course_id || "");
        return { session, enrollmentForSession, sessionDateOnly, effectiveSessionCourseId };
      });
      const selectedMatch = sessionMeta.find(({ effectiveSessionCourseId, sessionDateOnly }) =>
        (!selectedCourseId || !effectiveSessionCourseId || effectiveSessionCourseId === selectedCourseId) &&
        (!selectedDate || !sessionDateOnly || sessionDateOnly === selectedDate)
      );
      const matchingSession = (selectedMatch || sessionMeta[0]).session;
      if (matchingSession.code_used) throw new Error("This class code was already redeemed.");
      const enrollmentForSession = (selectedMatch || sessionMeta[0]).enrollmentForSession;
      let res;
      try {
        res = await base44.functions.invoke('redeemClassCode', {
          session_code: normalizedCode,
          selected_course_id: selectedCoverageWindow?.enrollment?.course_id || null,
          selected_session_date: String(selectedCoverageWindow?.enrollment?.session_date || "").slice(0, 10) || null,
        });
      } catch (err) {
        throw err;
      }
      if (!res.data.success) {
        const debugWindow = res.data?.debug_window;
        const debugText = debugWindow
          ? `\nNow: ${debugWindow.now || "n/a"}\nStart: ${debugWindow.start_at || "n/a"}\nEnd: ${debugWindow.end_at || "n/a"}\nExpires: ${debugWindow.expires_at || "n/a"}\nSelected Course: ${debugWindow.selected_course_id || "n/a"}\nSelected Session Date: ${debugWindow.selected_session_date || "n/a"}\nMatched Course: ${debugWindow.matched_course_id || "n/a"}\nMatched Session Date: ${debugWindow.matched_session_date || "n/a"}`
          : "";
        throw new Error(`${res.data.error || "Invalid class code"}${debugText}`);
      }
      return res.data;
    },
    onSuccess: async (data) => {
      setVerifiedSession({ id: data.session_id, enrollment_id: data.enrollment_id, certifications: data.certifications });
      if (selectedCoverageWindow?.key) {
        setAttendedWindowKeys((prev) => new Set([...prev, selectedCoverageWindow.key]));
      }
      setCodeError("");
      // Move forward immediately; refresh data in background.
      setStep(1);
      Promise.all([
        qc.invalidateQueries({ queryKey: ["my-certs"] }),
        qc.invalidateQueries({ queryKey: ["my-enrollments-coverage"] }),
        qc.invalidateQueries({ queryKey: ["my-sessions-coverage"] }),
      ]);
    },
    onError: (err) => setCodeError(err.message),
  });
  const activateMutation = useMutation({
    mutationFn: async () => {
      const canvas = canvasRef.current;
      const signatureData = canvas.toDataURL("image/png");
      const res = await base44.functions.invoke("createMDSubscriptionCheckout", {
        service_type_id: selectedServiceTypeId,
        service_type_name: serviceTypes.find(s => s.id === selectedServiceTypeId)?.name,
        amount: isAtCap ? 0 : getMembershipPrice(),
        enrollment_id: verifiedSession?.enrollment_id || null,
        signature_data: signatureData,
      });
      if (res.data?.url) { window.location.href = res.data.url; }
      else if (res.data?.success) {
        qc.invalidateQueries({ queryKey: ["my-md-subscriptions"] });
        setActivateDialog(false);
        resetActivation();
        // Provider is now fully active — redirect to Launch Pad
        navigate(createPageUrl("ProviderLaunchPad"));
      }
    },
  });

  const openCancelDialog = (sub) => {
    setCancelDialog({ open: true, sub });
    setCancelForm({ reason: "", notes: "", confirmation_name: "" });
    setCancelStep(0);
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      const res = await base44.functions.invoke("cancelMDSubscription", {
        subscription_id: cancelDialog.sub.id,
        reason: cancelForm.reason,
        notes: cancelForm.notes,
        confirmation_name: cancelForm.confirmation_name,
      });
      if (res.data?.success) {
        qc.invalidateQueries({ queryKey: ["my-md-subscriptions"] });
        setCancelStep(2);
      }
    } catch (e) {
      console.error(e);
    }
    setCancelLoading(false);
  };

  // Canvas drawing
  useEffect(() => {
    if (!activateDialog || step !== 2) return;
    setTimeout(() => {
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.strokeStyle = "#1A1A2E"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    }, 100);
  }, [activateDialog, step]);
  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.touches ? e.touches[0].clientX : e.clientX) - rect.left, y: (e.touches ? e.touches[0].clientY : e.clientY) - rect.top };
  };
  const startDraw = (e) => { const canvas = canvasRef.current; const ctx = canvas.getContext("2d"); isDrawing.current = true; ctx.beginPath(); const p = getPos(e, canvas); ctx.moveTo(p.x, p.y); e.preventDefault(); };
  const draw = (e) => { if (!isDrawing.current) return; const canvas = canvasRef.current; const ctx = canvas.getContext("2d"); const p = getPos(e, canvas); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasSigned(true); e.preventDefault(); };
  const endDraw = () => { isDrawing.current = false; };
  const clearSignature = () => { const canvas = canvasRef.current; if (!canvas) return; canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height); setHasSigned(false); };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  const pageContent = (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#DA6A63" }}>My Credentials & Coverage</p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, color: "#1e2535", lineHeight: 1.15 }}>
            Practice with Full Protection
          </h1>
          <p className="mt-1 text-sm" style={{ color: "rgba(30,37,53,0.6)", maxWidth: 480 }}>
            Manage your licenses, certifications, and NOVI Board of Medical Directors coverage — everything needed to practice legally and confidently.
          </p>
        </div>
        <Button onClick={() => { setActivateDialog(true); resetActivation(); }} className="font-bold gap-2 flex-shrink-0" style={{ background: "#FA6F30", color: "#fff", borderRadius: 12 }}>
          <Zap className="w-4 h-4" /> Apply for MD Coverage
        </Button>
      </div>

      {/* Alerts */}
      {approvedCertsWithoutCoverage.map(c => (
        <div key={c.id} className="flex items-center gap-3 px-5 py-4 rounded-2xl" style={{ background: "rgba(200,230,60,0.15)", border: "1px solid rgba(200,230,60,0.4)" }}>
          <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#C8E63C" }} />
          <div className="flex-1">
            <p className="font-semibold text-sm" style={{ color: "#3D5600" }}>Your <strong>{c.service_type_name || c.certification_name}</strong> certification was approved!</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(61,86,0,0.8)" }}>You can now apply for MD Board coverage to start offering this service.</p>
          </div>
          <Button size="sm" onClick={() => { setActivateDialog(true); resetActivation(); }} style={{ background: "#FA6F30", color: "#fff" }} className="flex-shrink-0 gap-1 h-8 text-xs">
            <Zap className="w-3.5 h-3.5" /> Apply
          </Button>
        </div>
      ))}

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Licenses", value: licenses.length, sub: `${verifiedLicenses.length} verified`, icon: FileText, color: "#7B8EC8", tab: "licenses" },
          { label: "Certifications", value: activeCerts.length, sub: `${pendingCerts.length} under review`, icon: Award, color: "#FA6F30", tab: "certifications" },
          { label: "MD Coverage", value: activeSubscriptions.length, sub: `services active`, icon: Shield, color: "#C8E63C", tab: "coverage" },
          { label: "Assigned MD", value: activeRelationships.length > 0 ? "✓" : "—", sub: activeRelationships[0]?.medical_director_name || "Not yet assigned", icon: Users, color: "#DA6A63", tab: "coverage" },
        ].map(({ label, value, sub, icon: Icon, color, tab }) => (
          <button key={label} onClick={() => setActiveTab(tab)} className="text-left rounded-2xl px-4 py-4 transition-all hover:scale-[1.02]" style={{ background: "rgba(255,255,255,0.3)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)", boxShadow: "0 8px 32px rgba(31,38,135,0.15)", border: activeTab === tab ? `2px solid ${color}` : "1px solid rgba(255,255,255,0.4)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${color}22` }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p style={{ fontSize: 26, fontWeight: 700, color: "#1e2535", lineHeight: 1 }}>{value}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: "#1e2535" }}>{label}</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{sub}</p>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-5 h-auto p-1" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.8)" }}>
          {[
            { value: "overview", label: "Overview" },
            { value: "licenses", label: "Licenses" },
            { value: "certifications", label: "Certifications" },
            { value: "coverage", label: "MD Coverage" },
            { value: "documents", label: "Documents" },
          ].map(t => (
            <TabsTrigger key={t.value} value={t.value} className="rounded-xl text-sm font-semibold transition-all" style={{ color: activeTab === t.value ? "#FA6F30" : "rgba(30,37,53,0.55)" }}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── OVERVIEW TAB ── */}
        <TabsContent value="overview" className="pt-5 space-y-5">
          {/* What is MD Board Coverage */}
          <GlassCard>
            {/* Gradient texture header */}
            <div className="relative overflow-hidden" style={{ height: 160, borderRadius: "16px 16px 0 0", background: "linear-gradient(135deg, #2D6B7F 0%, #7B8EC8 45%, #C8E63C 100%)" }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse at 20% 50%, rgba(200,230,60,0.25) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(45,107,127,0.4) 0%, transparent 55%), radial-gradient(ellipse at 60% 80%, rgba(218,106,99,0.2) 0%, transparent 50%)" }} />
              <div className="absolute bottom-4 left-6">
                <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: "rgba(200,230,60,0.95)", letterSpacing: "0.18em" }}>How NOVI Coverage Works</p>
                <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#fff", fontStyle: "italic", fontWeight: 400 }}>The NOVI Board of Medical Directors</h3>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.75)" }}>
                NOVI maintains a Board of Medical Directors — licensed physicians who provide clinical oversight and legal supervision for all providers.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { icon: Shield, title: "You don't find an MD", desc: "NOVI assigns a Board MD to you automatically upon approval" },
                  { icon: FileText, title: "Signed Protocols", desc: "Your assigned MD signs your service agreements and clinical scope docs" },
                  { icon: ShieldCheck, title: "Legal Compliance", desc: "Full medical directorship coverage as required by your state" },
                  { icon: CheckCircle2, title: "Per-Service Coverage", desc: "Each service you offer requires its own MD coverage membership" },
                ].map(({ icon: Icon, title, desc }, i) => (
                  <div key={i} className="flex gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.06)" }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(250,111,48,0.12)" }}>
                      <Icon className="w-4.5 h-4.5" style={{ color: "#FA6F30", width: 18, height: 18 }} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.6)" }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* Pricing */}
          {(() => {
            const [pricingOpen, setPricingOpen] = useState(false);
            return (
              <GlassCard>
                <button className="w-full px-6 py-5 flex items-center justify-between text-left" onClick={() => setPricingOpen(v => !v)} style={{ borderBottom: pricingOpen ? "1px solid rgba(30,37,53,0.08)" : "none" }}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#4a6b10" }}>Pricing</p>
                    <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#1e2535" }}>MD Coverage Membership</h3>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-semibold" style={{ color: "rgba(30,37,53,0.4)" }}>from $279/mo</span>
                    {pricingOpen ? <ChevronUp className="w-5 h-5" style={{ color: "rgba(30,37,53,0.4)" }} /> : <ChevronDown className="w-5 h-5" style={{ color: "rgba(30,37,53,0.4)" }} />}
                  </div>
                </button>
                {pricingOpen && (
                  <div className="px-6 py-5">
                    <div className="grid sm:grid-cols-2 gap-4 mb-5">
                      {/* First service */}
                      <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(250,111,48,0.25) 0%, rgba(218,106,99,0.2) 100%)", border: "1px solid rgba(250,111,48,0.4)" }}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#FA6F30" }}>Base Service (Injectables)</p>
                        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 38, color: "#1e2535", lineHeight: 1 }}>${FIRST_SERVICE_PRICE}</p>
                        <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.6)" }}>per month · required</p>
                        <div className="mt-4 space-y-1.5">
                          {["Board MD assigned to you", "Signed protocol documents", "Clinical scope coverage", "State compliance included"].map(f => (
                            <div key={f} className="flex items-center gap-2">
                              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#FA6F30" }} />
                              <span className="text-xs" style={{ color: "rgba(30,37,53,0.8)" }}>{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Each additional */}
                      <div className="rounded-2xl p-5" style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.08)" }}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(30,37,53,0.5)" }}>Each Additional Service</p>
                        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 38, color: "#1e2535", lineHeight: 1 }}>${ADDON_SERVICE_PRICE}</p>
                        <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.6)" }}>per month, per service</p>
                        <div className="mt-4 space-y-1.5">
                          {["Microneedling, laser, etc.", "Same Board MD covers all", "Capped at 5 services max"].map(f => (
                            <div key={f} className="flex items-center gap-2">
                              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(30,37,53,0.4)" }} />
                              <span className="text-xs" style={{ color: "rgba(30,37,53,0.7)" }}>{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Pricing breakdown table */}
                    <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1px solid rgba(30,37,53,0.1)" }}>
                      <div className="px-4 py-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-widest" style={{ background: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.5)" }}>
                        <span>Services</span><span>Monthly Total</span>
                      </div>
                      {[
                        { label: "1 Service (Injectables only)", total: 279 },
                        { label: "2 Services", total: 408 },
                        { label: "3 Services", total: 537 },
                        { label: "4 Services", total: 666 },
                        { label: "5 Services (Maximum — all services covered)", total: 795 },
                      ].map(({ label, total }, i) => (
                        <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm" style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.7)" : "rgba(30,37,53,0.02)", borderTop: "1px solid rgba(30,37,53,0.06)" }}>
                          <span style={{ color: "rgba(30,37,53,0.75)" }}>{label}</span>
                          <span className="font-bold" style={{ color: total === 795 ? "#FA6F30" : "#1e2535" }}>${total}/mo{total === 795 ? " 🔒 cap" : ""}</span>
                        </div>
                      ))}
                    </div>

                    {/* Service cap notice */}
                    <div className="rounded-xl px-4 py-3 mb-4 flex items-start gap-3" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.3)" }}>
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#5a7a20" }} />
                      <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.7)" }}>
                        <strong>5-Service Cap:</strong> Once you reach 5 services, you're fully covered for all services within your scope at <strong>$795/mo</strong> — no additional fees ever.
                      </p>
                    </div>

                    {/* Current bill if active */}
                    {activeSubscriptions.length > 0 && (
                      <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "rgba(200,230,60,0.12)", border: "1px solid rgba(200,230,60,0.3)" }}>
                        <div>
                          <p className="text-sm font-bold text-white">Your Current Monthly</p>
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{activeSubscriptions.length} service{activeSubscriptions.length > 1 ? "s" : ""} covered{activeSubscriptions.length >= MAX_SERVICES ? " · Fully capped" : ""}</p>
                        </div>
                        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: "#C8E63C" }}>
                          ${calcMonthlyTotal(activeSubscriptions.length)}/mo
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            );
          })()}

          {/* Eligibility Requirements */}
          <GlassCard>
            <div className="relative overflow-hidden" style={{ height: 140, borderRadius: "16px 16px 0 0", background: "linear-gradient(135deg, #1e2535 0%, #7B8EC8 50%, #DA6A63 100%)" }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse at 75% 30%, rgba(200,230,60,0.2) 0%, transparent 55%), radial-gradient(ellipse at 25% 70%, rgba(123,142,200,0.35) 0%, transparent 50%), radial-gradient(ellipse at 90% 80%, rgba(218,106,99,0.25) 0%, transparent 45%)" }} />
              <div className="absolute bottom-4 left-6">
                <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: "rgba(200,230,60,0.95)", letterSpacing: "0.18em" }}>Requirements</p>
                <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#fff", fontStyle: "italic", fontWeight: 400 }}>How to Qualify for Coverage</h3>
              </div>
            </div>
            <div className="px-6 py-5 grid sm:grid-cols-2 gap-4">
              {[
                { step: "1", title: "Upload Your License", desc: "Submit your professional license (RN, NP, PA, MD, etc.) for verification by our admin team.", done: licenses.length > 0, page: "licenses" },
                { step: "2", title: "Get License Verified", desc: "NOVI verifies your credentials. This typically takes 1–2 business days.", done: verifiedLicenses.length > 0, page: "licenses" },
                { step: "3", title: "Complete Training or Submit Cert", desc: "Attend a NOVI course and enter your class code, or submit an existing certification for review.", done: activeCerts.length > 0, page: "certifications" },
                { step: "4", title: "Apply & Sign Agreement", desc: "Apply for coverage on a per-service basis. Sign the MD Board agreement and activate your membership.", done: activeSubscriptions.length > 0, page: "coverage" },
              ].map(({ step: s, title, desc, done, page }) => (
                <button key={s} onClick={() => setActiveTab(page)} className="text-left flex gap-3 px-4 py-4 rounded-xl transition-all hover:scale-[1.01]" style={{ background: done ? "rgba(200,230,60,0.1)" : "rgba(30,37,53,0.03)", border: `1px solid ${done ? "rgba(200,230,60,0.35)" : "rgba(30,37,53,0.08)"}` }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold" style={{ background: done ? "#C8E63C" : "rgba(30,37,53,0.1)", color: done ? "#1a2540" : "rgba(30,37,53,0.4)" }}>
                    {done ? <CheckCircle className="w-4 h-4" style={{ color: "#1a2540" }} /> : s}
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.6)" }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </GlassCard>
        </TabsContent>

        {/* ── LICENSES TAB ── */}
        <TabsContent value="licenses" className="pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <SectionLabel>Your Licenses</SectionLabel>
            <Button size="sm" onClick={() => setLicenseOpen(true)} style={{ background: "#FA6F30", color: "#fff", borderRadius: 10 }} className="gap-1.5 h-8 text-xs font-bold">
              <Plus className="w-3.5 h-3.5" /> Add License
            </Button>
          </div>
          {loadingLicenses ? (
            <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.08)" }} />)}</div>
          ) : licenses.length === 0 ? (
            <GlassCard className="py-16 text-center">
              <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.2)" }} />
              <p className="font-semibold" style={{ color: "#1e2535" }}>No licenses uploaded yet</p>
              <p className="text-sm mt-1 mb-5" style={{ color: "rgba(30,37,53,0.5)" }}>Upload your professional license to begin the verification process.</p>
              <Button onClick={() => setLicenseOpen(true)} style={{ background: "#FA6F30", color: "#fff" }} className="gap-2">
                <Plus className="w-4 h-4" /> Upload License
              </Button>
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {licenses.map(l => {
                const isExpiredOrRejected = l.status === "expired" || l.status === "rejected";
                const cfgKey = statusColorLicense[l.status] || "bg-slate-100 text-slate-500";
                return (
                  <div key={l.id} className="flex items-center gap-4 px-5 py-4 rounded-xl" style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${isExpiredOrRejected ? "rgba(218,106,99,0.3)" : "rgba(30,37,53,0.08)"}` }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(123,142,200,0.15)" }}>
                      <FileText className="w-5 h-5" style={{ color: "#7B8EC8" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold" style={{ color: "#1e2535" }}>{l.license_type} — {l.license_number}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfgKey}`}>{l.status?.replace("_", " ")}</span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{l.issuing_state}{l.expiration_date ? ` · Expires ${format(new Date(l.expiration_date), "MMM d, yyyy")}` : ""}</p>
                      {l.rejection_reason && <p className="text-xs text-red-400 mt-1">Rejected: {l.rejection_reason}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {l.document_url && <a href={l.document_url} target="_blank" rel="noreferrer" className="text-xs font-medium hover:underline" style={{ color: "#7B8EC8" }}>View</a>}
                      {isExpiredOrRejected && (
                        <button className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: "#FA6F30", color: "#fff" }}
                          onClick={() => { setLicenseForm({ license_type: l.license_type, issuing_state: l.issuing_state }); setLicenseOpen(true); }}>
                          {l.status === "expired" ? "Renew" : "Resubmit"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setLicenseOpen(true)} className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-95" style={{ background: "rgba(255,255,255,0.5)", border: "1px dashed rgba(30,37,53,0.2)", color: "rgba(30,37,53,0.55)" }}>
                + Add Another License
              </button>
            </div>
          )}
        </TabsContent>

        {/* ── CERTIFICATIONS TAB ── */}
        <TabsContent value="certifications" className="pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <SectionLabel>Your Certifications</SectionLabel>
            <Button size="sm" onClick={() => { setCertSubmitOpen(true); resetExtCertForm(); }} style={{ background: "#FA6F30", color: "#fff", borderRadius: 10 }} className="gap-1.5 h-8 text-xs font-bold">
              <Plus className="w-3.5 h-3.5" /> Submit External Cert
            </Button>
          </div>

          {myCerts.length === 0 ? (
            <GlassCard className="py-16 text-center">
              <Sparkles className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.2)" }} />
              <p className="font-semibold" style={{ color: "#1e2535" }}>No certifications yet</p>
              <p className="text-sm mt-1 mb-5" style={{ color: "rgba(30,37,53,0.5)" }}>Complete a NOVI course to earn a certification, or submit an existing cert for review.</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Link to={createPageUrl("ProviderEnrollments")}>
                  <Button style={{ background: "rgba(30,37,53,0.08)", color: "#1e2535", border: "1px solid rgba(30,37,53,0.15)" }} className="gap-2">
                    <BookOpen className="w-4 h-4" /> Browse NOVI Courses
                  </Button>
                </Link>
                <Button style={{ background: "#FA6F30", color: "#fff" }} className="gap-2" onClick={() => { setCertSubmitOpen(true); resetExtCertForm(); }}>
                  <Award className="w-4 h-4" /> Submit External Cert
                </Button>
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-4">
              {activeCerts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#C8E63C" }}>Active</p>
                  {activeCerts.map(c => <CertRow key={c.id} cert={c} />)}
                </div>
              )}
              {pendingCerts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#FA6F30" }}>Under Review</p>
                  {pendingCerts.map(c => <CertRow key={c.id} cert={c} />)}
                </div>
              )}
              {otherCerts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Other</p>
                  {otherCerts.map(c => <CertRow key={c.id} cert={c} muted />)}
                </div>
              )}
              <button onClick={() => { setCertSubmitOpen(true); resetExtCertForm(); }} className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-95" style={{ background: "rgba(255,255,255,0.5)", border: "1px dashed rgba(30,37,53,0.2)", color: "rgba(30,37,53,0.55)" }}>
                + Submit Another External Cert
              </button>
            </div>
          )}
        </TabsContent>

        {/* ── MD COVERAGE TAB ── */}
        <TabsContent value="coverage" className="pt-5 space-y-5">

          {/* Assigned MD Board */}
          <GlassCard>
            <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "rgba(30,37,53,0.08)" }}>
              <Users className="w-4 h-4" style={{ color: "#DA6A63" }} />
              <p className="font-bold text-sm" style={{ color: "#1e2535" }}>Your Assigned Medical Director</p>
            </div>
            <div className="px-5 py-5">
              {activeRelationships.length > 0 ? (
                activeRelationships.map(rel => (
                  <div key={rel.id} className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(218,106,99,0.2)" }}>
                      <Users className="w-6 h-6" style={{ color: "#DA6A63" }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold" style={{ color: "#1e2535" }}>{rel.medical_director_name}</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(200,230,60,0.2)", color: "#C8E63C", border: "1px solid rgba(200,230,60,0.3)" }}>Active</span>
                      </div>
                      <p className="text-sm mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{rel.medical_director_email}</p>
                      <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.4)" }}>Assigned by NOVI Board · supervising {activeSubscriptions.length} service{activeSubscriptions.length > 1 ? "s" : ""}</p>
                      {rel.supervision_notes && (
                        <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(30,37,53,0.05)", color: "rgba(30,37,53,0.65)" }}>
                          {rel.supervision_notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : pendingRelationships.length > 0 ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(250,111,48,0.1)", border: "1px solid rgba(250,111,48,0.2)" }}>
                  <Clock className="w-5 h-5 flex-shrink-0" style={{ color: "#FA6F30" }} />
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>MD Assignment Pending</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>NOVI is assigning a Board Medical Director to your account. This typically takes 1–2 business days.</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <Users className="w-6 h-6" style={{ color: "rgba(255,255,255,0.3)" }} />
                  </div>
                  <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>No MD Assigned Yet</p>
                  <p className="text-xs mt-1 mb-4" style={{ color: "rgba(30,37,53,0.5)", maxWidth: 320, margin: "8px auto 16px" }}>
                    When you apply for MD Coverage, NOVI will assign a Board Medical Director to supervise your practice. You don't select them — we match you.
                  </p>
                  <Button onClick={() => { setActivateDialog(true); resetActivation(); }} style={{ background: "#FA6F30", color: "#fff" }} className="gap-2">
                    <Zap className="w-4 h-4" /> Apply for Coverage
                  </Button>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Active Service Coverage */}
          {activeSubscriptions.length > 0 && (
          <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Active Service Coverage</SectionLabel>
            <Button size="sm" onClick={() => { setActivateDialog(true); resetActivation(); }} style={{ background: "#FA6F30", color: "#fff", borderRadius: 10 }} className="gap-1.5 h-8 text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> Add Service
            </Button>
          </div>
              {activeSubscriptions.map((sub, idx) => {
                const st = serviceTypes.find(s => s.id === sub.service_type_id);
                const isExp = expandedService === sub.id;
                return (
                  <GlassCard key={sub.id}>
                    <button className="w-full flex items-center gap-4 px-5 py-4 text-left hover:brightness-110 transition-all" onClick={() => setExpandedService(isExp ? null : sub.id)}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.15)" }}>
                        <CheckCircle2 className="w-5 h-5" style={{ color: "#C8E63C" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold" style={{ color: "#1e2535" }}>{sub.service_type_name}</p>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(200,230,60,0.2)", color: "#C8E63C" }}>Active</span>
                        </div>
                        <p className="text-xs mt-0.5 capitalize" style={{ color: "rgba(30,37,53,0.5)" }}>{st?.category?.replace("_", " ")}</p>
                      </div>
                      <div className="text-right mr-3">
                        <p className="font-bold" style={{ color: "#1e2535" }}>${idx === 0 ? FIRST_SERVICE_PRICE : ADDON_SERVICE_PRICE}<span className="text-xs font-normal" style={{ color: "rgba(30,37,53,0.4)" }}>/mo</span></p>
                        {activeSubscriptions.length >= MAX_SERVICES && idx === MAX_SERVICES - 1 && <p className="text-xs font-semibold" style={{ color: "#FA6F30" }}>All services covered</p>}
                        {sub.activated_at && <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.4)" }}>Since {format(new Date(sub.activated_at), "MMM d, yyyy")}</p>}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); openCancelDialog(sub); }}
                        className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all hover:opacity-80"
                        style={{ background: "rgba(218,106,99,0.12)", color: "#DA6A63", border: "1px solid rgba(218,106,99,0.25)" }}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Cancel
                      </button>
                      {isExp ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)" }} /> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)" }} />}
                    </button>
                    {isExp && st && (() => {
                      const currentTierNum = sub.coverage_tier || 1;
                      const tiers = st.coverage_tiers || [];
                      const hasTiers = tiers.length > 0;
                      const currentTierDef = tiers.find(t => t.tier_number === currentTierNum);
                      const nextTierDef = tiers.find(t => t.tier_number === currentTierNum + 1);
                      // Effective scope: use tier def if tiers exist, else fall back to service type top-level
                      const effectiveAreas = hasTiers ? (currentTierDef?.allowed_areas || []) : (st.allowed_areas || []);
                      const effectiveUnits = hasTiers ? currentTierDef?.max_units_per_session : st.max_units_per_session;
                      const effectiveRules = hasTiers ? (currentTierDef?.scope_rules || []) : (st.scope_rules || []);
                      const effectiveDocs = hasTiers ? (currentTierDef?.protocol_document_urls || []) : (st.protocol_document_urls || []);
                      return (
                        <div className="px-5 pb-5 space-y-3 border-t" style={{ borderColor: "rgba(30,37,53,0.08)", paddingTop: 16 }}>

                          {/* ── Billing Details ── */}
                          {(() => {
                            const activatedDate = sub.activated_at ? new Date(sub.activated_at) : null;
                            const monthlyAmount = idx === 0 ? FIRST_SERVICE_PRICE : ADDON_SERVICE_PRICE;
                            const capNote = activeSubscriptions.length >= MAX_SERVICES ? " (capped — all services included)" : "";
                            const today = new Date();
                            // Next billing = 1st of next month
                            const nextBilling = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                            // Proration: if activated_at is not the 1st, calculate prorated amount for first month
                            let proratedAmount = null;
                            let proratedNote = null;
                            if (activatedDate) {
                              const dayOfMonth = activatedDate.getDate();
                              const daysInMonth = new Date(activatedDate.getFullYear(), activatedDate.getMonth() + 1, 0).getDate();
                              if (dayOfMonth !== 1) {
                                const daysRemaining = daysInMonth - dayOfMonth + 1;
                                proratedAmount = ((monthlyAmount / daysInMonth) * daysRemaining).toFixed(2);
                                proratedNote = `${daysRemaining} of ${daysInMonth} days in ${format(activatedDate, "MMMM")}`;
                              }
                            }
                            return (
                              <div className="rounded-xl overflow-hidden" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)" }}>
                                <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(123,142,200,0.15)" }}>
                                  <CreditCard className="w-3.5 h-3.5" style={{ color: "#7B8EC8" }} />
                                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7B8EC8" }}>Billing Details</p>
                                </div>
                                <div className="px-4 py-3 space-y-2.5">
                                  {/* Monthly rate */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>Monthly rate</span>
                                    <span className="text-xs font-bold" style={{ color: "#1e2535" }}>${monthlyAmount}.00/mo</span>
                                  </div>
                                  {/* Billing cycle */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>Billing cycle</span>
                                    <span className="text-xs font-semibold" style={{ color: "#1e2535" }}>1st of each month</span>
                                  </div>
                                  {/* Next billing date */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>Next billing date</span>
                                    <span className="text-xs font-semibold" style={{ color: "#1e2535" }}>{format(nextBilling, "MMMM 1, yyyy")}</span>
                                  </div>
                                  {/* Coverage start */}
                                  {activatedDate && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>Coverage started</span>
                                      <span className="text-xs font-semibold" style={{ color: "#1e2535" }}>{format(activatedDate, "MMMM d, yyyy")}</span>
                                    </div>
                                  )}
                                  {/* Proration note */}
                                  {proratedAmount && (
                                    <div className="mt-1 pt-2 rounded-lg px-3 py-2.5" style={{ background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.2)", borderTop: "none", marginLeft: -4, marginRight: -4 }}>
                                      <div className="flex items-start gap-2">
                                        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#FA6F30" }} />
                                        <div>
                                          <p className="text-xs font-bold" style={{ color: "#FA6F30" }}>First month prorated</p>
                                          <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.65)" }}>
                                            Your coverage started mid-month ({proratedNote}), so your first charge was <strong>${proratedAmount}</strong>. All subsequent billing is ${monthlyAmount}.00 on the 1st.
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {/* No proration note if started on the 1st */}
                                  {activatedDate && activatedDate.getDate() === 1 && (
                                    <div className="flex items-center gap-1.5 pt-0.5">
                                      <RefreshCw className="w-3 h-3" style={{ color: "rgba(30,37,53,0.35)" }} />
                                      <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>Started on the 1st — no proration applied</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Tier indicator */}
                          {hasTiers && (
                            <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(200,230,60,0.12)", border: "1px solid rgba(200,230,60,0.3)" }}>
                              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: "#C8E63C", color: "#1a2540" }}>
                                {currentTierNum}
                              </div>
                              <div className="flex-1">
                                <p className="font-bold text-sm" style={{ color: "#1e2535" }}>
                                  {currentTierDef?.tier_name || `Tier ${currentTierNum}`}
                                </p>
                                {currentTierDef?.description && <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.6)" }}>{currentTierDef.description}</p>}
                              </div>
                              <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10" }}>Current</span>
                            </div>
                          )}

                          {/* Allowed Areas */}
                          {effectiveAreas.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: "rgba(30,37,53,0.5)" }}><MapPin className="w-3 h-3" /> Allowed Areas</p>
                              <div className="flex flex-wrap gap-1.5">
                                {effectiveAreas.map((a, i) => <span key={i} className="text-xs px-2.5 py-1 rounded-full capitalize" style={{ background: "rgba(30,37,53,0.07)", color: "rgba(30,37,53,0.7)", border: "1px solid rgba(30,37,53,0.1)" }}>{a}</span>)}
                              </div>
                            </div>
                          )}
                          {effectiveUnits && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(123,142,200,0.1)", color: "rgba(30,37,53,0.8)" }}>
                              <Zap className="w-4 h-4 flex-shrink-0" style={{ color: "#7B8EC8" }} />
                              Max {effectiveUnits} units per session
                            </div>
                          )}
                          {effectiveRules.length > 0 && effectiveRules.map((r, i) => (
                            <div key={i} className="px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(30,37,53,0.04)", color: "rgba(30,37,53,0.7)" }}>
                              <span className="font-bold">{r.rule_name}: </span>{r.rule_value} {r.unit}
                            </div>
                          ))}
                          {effectiveDocs.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {effectiveDocs.map((doc, i) => (
                                <a key={i} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs" style={{ background: "rgba(123,142,200,0.15)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.25)" }}>
                                  <FileText className="w-3 h-3" /> {doc.name}
                                </a>
                              ))}
                            </div>
                          )}
                          {st.protocol_notes && !hasTiers && (
                            <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(250,180,50,0.1)", color: "rgba(140,100,0,0.9)", border: "1px solid rgba(250,180,50,0.25)" }}>
                              <span className="font-bold">Protocol Note: </span>{st.protocol_notes}
                            </div>
                          )}

                          {/* Next tier unlock preview */}
                          {hasTiers && nextTierDef && (
                            <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(30,37,53,0.04)", border: "1px dashed rgba(30,37,53,0.15)" }}>
                              <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "rgba(30,37,53,0.5)" }}>
                                <Sparkles className="w-3.5 h-3.5" /> Unlock Next: {nextTierDef.tier_name || `Tier ${nextTierDef.tier_number}`}
                              </p>
                              {nextTierDef.description && <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>{nextTierDef.description}</p>}
                              {nextTierDef.allowed_areas?.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {nextTierDef.allowed_areas.filter(a => !effectiveAreas.includes(a)).map((a, i) => (
                                    <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(200,230,60,0.15)", color: "#5a7a20", border: "1px dashed rgba(200,230,60,0.4)" }}>+ {a}</span>
                                  ))}
                                </div>
                              )}
                              <p className="text-xs font-semibold" style={{ color: "#FA6F30" }}>
                                Complete the required NOVI course to unlock this tier — same membership fee.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </GlassCard>
                );
              })}
            </div>
          )}

          {/* No coverage CTA */}
          {activeSubscriptions.length === 0 && (
            <GlassCard>
              <div className="px-6 py-10 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(250,111,48,0.15)" }}>
                  <Shield className="w-7 h-7" style={{ color: "#FA6F30" }} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#FA6F30" }}>No Active Coverage</p>
                <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#1e2535", marginBottom: 8 }}>Get Covered by the NOVI Board</h3>
                <p className="text-sm mb-6" style={{ color: "rgba(30,37,53,0.6)", maxWidth: 380, margin: "0 auto 24px" }}>
                  Apply for MD Board coverage for each service you offer. NOVI assigns a Board MD to supervise your practice — no searching, no negotiating.
                </p>
                <Button onClick={() => { setActivateDialog(true); resetActivation(); }} style={{ background: "#FA6F30", color: "#fff" }} className="font-bold gap-2">
                  <Zap className="w-4 h-4" /> Apply for MD Coverage — starts at ${FIRST_SERVICE_PRICE}/mo
                </Button>
                <p className="mt-3 text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>+${ADDON_SERVICE_PRICE}/mo per additional service · capped at ${MAX_MONTHLY_CAP}/mo (5 services)</p>
              </div>
            </GlassCard>
          )}
        </TabsContent>

        {/* ── DOCUMENTS & CONTRACTS TAB ── */}
        <TabsContent value="documents" className="pt-5 space-y-5">

          {/* MD Agreement Contracts */}
          <GlassCard>
            <div className="px-6 py-5 border-b flex items-center gap-2" style={{ borderColor: "rgba(30,37,53,0.08)" }}>
              <FileText className="w-4 h-4" style={{ color: "#FA6F30" }} />
              <p className="font-bold text-sm" style={{ color: "#1e2535" }}>MD Board Agreements</p>
            </div>
            <div className="px-6 py-5">
              {activeSubscriptions.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.2)" }} />
                  <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>No active MD agreements</p>
                  <p className="text-xs mt-1 mb-4" style={{ color: "rgba(30,37,53,0.5)" }}>Once you activate MD coverage, your signed agreements will appear here.</p>
                  <Button size="sm" onClick={() => { setActivateDialog(true); resetActivation(); }} style={{ background: "#FA6F30", color: "#fff" }} className="gap-2">
                    <Zap className="w-3.5 h-3.5" /> Apply for Coverage
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSubscriptions.map((sub) => {
                    const st = serviceTypes.find(s => s.id === sub.service_type_id);
                    return (
                      <div key={sub.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(30,37,53,0.08)" }}>
                        <div className="px-4 py-3 flex items-center gap-3" style={{ background: "rgba(30,37,53,0.03)" }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.15)" }}>
                            <Shield className="w-4 h-4" style={{ color: "#4a6b10" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm" style={{ color: "#1e2535" }}>{sub.service_type_name}</p>
                            <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
                              Signed {sub.signed_at ? format(new Date(sub.signed_at), "MMMM d, yyyy") : "—"} · MD: {activeRelationships[0]?.medical_director_name || "NOVI Board"}
                            </p>
                          </div>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(200,230,60,0.15)", color: "#4a6b10" }}>Active</span>
                        </div>
                        <div className="px-4 py-3 space-y-2">
                          {/* MD Agreement text preview */}
                          {st?.md_agreement_text && (
                            <div className="rounded-lg px-3 py-2 text-xs leading-relaxed" style={{ background: "rgba(30,37,53,0.03)", color: "rgba(30,37,53,0.65)", border: "1px solid rgba(30,37,53,0.06)", maxHeight: 72, overflow: "hidden" }}>
                              {st.md_agreement_text}
                            </div>
                          )}
                          {/* Protocol docs */}
                          {(() => {
                            const tiers = st?.coverage_tiers || [];
                            const tierNum = sub.coverage_tier || 1;
                            const tierDef = tiers.find(t => t.tier_number === tierNum);
                            const docs = tiers.length > 0 ? (tierDef?.protocol_document_urls || []) : (st?.protocol_document_urls || []);
                            return docs.length > 0 ? (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(30,37,53,0.45)" }}>Protocol Documents</p>
                                <div className="flex flex-wrap gap-2">
                                  {docs.map((doc, i) => (
                                    <a key={i} href={doc.url} target="_blank" rel="noreferrer"
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-95"
                                      style={{ background: "rgba(123,142,200,0.12)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.25)" }}>
                                      <FileText className="w-3 h-3" /> {doc.name}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ) : null;
                          })()}
                          {/* Signed by */}
                          {sub.signed_by_name && (
                            <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
                              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#C8E63C" }} />
                              Signed by <strong className="ml-1">{sub.signed_by_name}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </GlassCard>

          {/* Certification Documents */}
          <GlassCard>
            <div className="px-6 py-5 border-b flex items-center gap-2" style={{ borderColor: "rgba(30,37,53,0.08)" }}>
              <Award className="w-4 h-4" style={{ color: "#FA6F30" }} />
              <p className="font-bold text-sm" style={{ color: "#1e2535" }}>Certification Documents</p>
            </div>
            <div className="px-6 py-5">
              {activeCerts.length === 0 ? (
                <div className="text-center py-6">
                  <Award className="w-8 h-8 mx-auto mb-2" style={{ color: "rgba(30,37,53,0.2)" }} />
                  <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>No certification documents yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeCerts.map(c => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.08)" }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.15)" }}>
                        <Award className="w-4 h-4" style={{ color: "#4a6b10" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: "#1e2535" }}>{c.certification_name}</p>
                        <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
                          {c.service_type_name && `${c.service_type_name} · `}
                          {c.issued_by && `Issued by ${c.issued_by}`}
                          {c.issued_at && ` · ${format(new Date(c.issued_at), "MMM d, yyyy")}`}
                        </p>
                      </div>
                      {c.certificate_url ? (
                        <a href={c.certificate_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:brightness-95"
                          style={{ background: "rgba(123,142,200,0.12)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.25)" }}>
                          <ExternalLink className="w-3 h-3" /> View
                        </a>
                      ) : (
                        <span className="text-xs" style={{ color: "rgba(30,37,53,0.35)" }}>No file</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlassCard>

          {/* License Documents */}
          <GlassCard>
            <div className="px-6 py-5 border-b flex items-center gap-2" style={{ borderColor: "rgba(30,37,53,0.08)" }}>
              <FileText className="w-4 h-4" style={{ color: "#7B8EC8" }} />
              <p className="font-bold text-sm" style={{ color: "#1e2535" }}>License Documents</p>
            </div>
            <div className="px-6 py-5">
              {licenses.filter(l => l.document_url).length === 0 ? (
                <div className="text-center py-6">
                  <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: "rgba(30,37,53,0.2)" }} />
                  <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>No license documents uploaded</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {licenses.filter(l => l.document_url).map(l => (
                    <div key={l.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.08)" }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(123,142,200,0.15)" }}>
                        <FileText className="w-4 h-4" style={{ color: "#7B8EC8" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{l.license_type} — {l.license_number}</p>
                        <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
                          {l.issuing_state}{l.expiration_date ? ` · Expires ${format(new Date(l.expiration_date), "MMM d, yyyy")}` : ""}
                        </p>
                      </div>
                      <a href={l.document_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:brightness-95"
                        style={{ background: "rgba(123,142,200,0.12)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.25)" }}>
                        <ExternalLink className="w-3 h-3" /> View
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlassCard>

        </TabsContent>
      </Tabs>

      {/* ─── DIALOGS ────────────────────────────────────────────────────────── */}

      {/* Add License */}
      <Dialog open={licenseOpen} onOpenChange={setLicenseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Professional License</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>License Type</Label>
                <Select value={licenseForm.license_type} onValueChange={v => setLicenseForm({ ...licenseForm, license_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LICENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>License Number *</Label>
                <Input value={licenseForm.license_number || ""} onChange={e => setLicenseForm({ ...licenseForm, license_number: e.target.value })} />
              </div>
              <div>
                <Label>Issuing State</Label>
                <Input value={licenseForm.issuing_state || ""} onChange={e => setLicenseForm({ ...licenseForm, issuing_state: e.target.value })} placeholder="TX" />
              </div>
              <div>
                <Label>Issue Date</Label>
                <Input type="date" value={licenseForm.issue_date || ""} onChange={e => setLicenseForm({ ...licenseForm, issue_date: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Expiration Date</Label>
                <Input type="date" value={licenseForm.expiration_date || ""} onChange={e => setLicenseForm({ ...licenseForm, expiration_date: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed rounded-xl p-4 hover:bg-slate-50 transition-colors">
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500">{uploading ? "Uploading..." : licenseForm.document_url ? "Document uploaded ✓" : "Upload document (PDF, JPG, PNG)"}</span>
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={uploadLicenseFile} />
            </label>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setLicenseOpen(false)}>Cancel</Button>
              <Button style={{ background: "#FA6F30", color: "#fff" }} onClick={() => createLicense.mutate()} disabled={!licenseForm.license_number || createLicense.isPending || uploading}>
                {createLicense.isPending ? "Submitting..." : "Submit License"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply for Coverage */}
      <Dialog open={activateDialog} onOpenChange={(v) => { if (!v) resetActivation(); setActivateDialog(v); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>Apply for MD Board Coverage</DialogTitle>
          </DialogHeader>

          {/* ── Step -1: Info / intro screen ── */}
          {step === -1 && (
            <div className="space-y-4 pt-1">
              {/* Current status */}
              <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.25)" }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7B8EC8" }}>Your Current Status</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "License", ok: verifiedLicenses.length > 0, value: verifiedLicenses.length > 0 ? "Verified ✓" : pendingLicenses.length > 0 ? "Pending review" : "Not uploaded" },
                    { label: "Certification", ok: activeCerts.length > 0, value: activeCerts.length > 0 ? `${activeCerts.length} active` : pendingCerts.length > 0 ? "Under review" : "None yet" },
                    { label: "MD Coverage", ok: activeSubscriptions.length > 0, value: activeSubscriptions.length > 0 ? `${activeSubscriptions.length} active` : "Not applied" },
                  ].map(({ label, ok, value }) => (
                    <div key={label} className="rounded-lg px-3 py-2.5 text-center" style={{ background: ok ? "rgba(200,230,60,0.12)" : "rgba(255,255,255,0.06)", border: `1px solid ${ok ? "rgba(200,230,60,0.3)" : "rgba(255,255,255,0.12)"}` }}>
                      <p className="text-xs font-bold" style={{ color: ok ? "#C8E63C" : "rgba(255,255,255,0.4)" }}>{label}</p>
                      <p className="text-xs mt-0.5 font-semibold" style={{ color: ok ? "#fff" : "rgba(255,255,255,0.5)" }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* What is MD Coverage */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.2)" }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#FA6F30" }}>What is MD Board Coverage?</p>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(0,0,0,0.7)" }}>
                  NOVI maintains a Board of Medical Directors — licensed physicians who provide clinical oversight and legal supervision. When approved, NOVI assigns you a Board MD who signs your protocols. <strong>You don't find an MD yourself — we handle it.</strong>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: Shield, text: "Board MD auto-assigned to you" },
                    { icon: FileText, text: "Signed protocol documents included" },
                    { icon: ShieldCheck, text: "State compliance coverage" },
                    { icon: DollarSign, text: `$${FIRST_SERVICE_PRICE}/mo base · $${ADDON_SERVICE_PRICE}/mo per add-on · $${MAX_MONTHLY_CAP} cap` },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs" style={{ color: "rgba(0,0,0,0.65)" }}>
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#FA6F30" }} />
                      {text}
                    </div>
                  ))}
                </div>
              </div>

              {/* Two paths */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: "rgba(0,0,0,0.5)" }}>Two Paths to Coverage</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.25)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(200,230,60,0.2)" }}>
                      <KeyRound className="w-4 h-4" style={{ color: "#5a7a20" }} />
                    </div>
                    <p className="font-bold text-sm" style={{ color: "#1e2535" }}>NOVI Class Code</p>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(0,0,0,0.55)" }}>
                      Attended a NOVI course? Enter the class code given by your instructor on the day of class to instantly verify your training.
                    </p>
                    <div className="text-xs font-semibold px-2 py-1 rounded-full inline-block" style={{ background: "rgba(200,230,60,0.2)", color: "#5a7a20" }}>Fastest path</div>
                  </div>
                  <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.25)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(123,142,200,0.2)" }}>
                      <Award className="w-4 h-4" style={{ color: "#7B8EC8" }} />
                    </div>
                    <p className="font-bold text-sm" style={{ color: "#1e2535" }}>External Certification</p>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(0,0,0,0.55)" }}>
                      Certified by another school? Submit your certificate and license for review. Our team will verify and approve within 1–3 business days.
                    </p>
                    <div className="text-xs font-semibold px-2 py-1 rounded-full inline-block" style={{ background: "rgba(123,142,200,0.15)", color: "#7B8EC8" }}>1–3 day review</div>
                  </div>
                </div>
              </div>

              {/* Requirement check */}
              {verifiedLicenses.length === 0 && (
                <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "rgba(218,106,99,0.1)", border: "1px solid rgba(218,106,99,0.3)" }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#DA6A63" }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#DA6A63" }}>License verification required first</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(0,0,0,0.55)" }}>You need a verified professional license before applying for MD coverage. Go to the Licenses tab to upload yours.</p>
                  </div>
                </div>
              )}

              <Button
                onClick={() => setStep(0)}
                disabled={verifiedLicenses.length === 0}
                className="w-full font-bold"
                style={{ background: verifiedLicenses.length > 0 ? "#FA6F30" : "rgba(0,0,0,0.1)", color: verifiedLicenses.length > 0 ? "#fff" : "rgba(0,0,0,0.35)" }}
              >
                <Zap className="w-4 h-4 mr-2" />
                Continue to Apply
              </Button>
            </div>
          )}

          {/* Step indicators (steps 0-2) */}
          {step >= 0 && (
            <div className="flex items-center gap-2 py-2">
              {ACTIVATION_STEPS.map((label, i) => (
                <div key={i} className="flex items-center gap-1.5 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i < step ? "bg-green-500 text-white" : i === step ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                    {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${i <= step ? "text-slate-800" : "text-slate-400"}`}>{label}</span>
                  {i < ACTIVATION_STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 ml-auto" />}
                </div>
              ))}
            </div>
          )}

          {step === 0 && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <button onClick={() => setUseExternalCert(false)} className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all text-left ${!useExternalCert ? "border-orange-400 bg-orange-50 text-orange-900" : "border-slate-200 text-slate-500"}`}>
                  <KeyRound className="w-4 h-4 mb-1" />
                  NOVI Class Code
                  <p className="text-xs font-normal mt-0.5 text-slate-500">Attended a NOVI course? Enter your class code.</p>
                </button>
                <button onClick={() => setUseExternalCert(true)} className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all text-left ${useExternalCert ? "border-orange-400 bg-orange-50 text-orange-900" : "border-slate-200 text-slate-500"}`}>
                  <Award className="w-4 h-4 mb-1" />
                  External Cert
                  <p className="text-xs font-normal mt-0.5 text-slate-500">Certified elsewhere? Submit for review.</p>
                </button>
              </div>

              {!useExternalCert ? (
                (loadingMyEnrollments || loadingMySessions || fetchingMyEnrollments || fetchingMySessions) ? (
                  <div className="rounded-xl p-5 space-y-2 text-center" style={{ background: "rgba(123,142,200,0.07)", border: "1px solid rgba(123,142,200,0.2)" }}>
                    <p className="text-sm font-semibold text-slate-900">Loading your course windows...</p>
                    <p className="text-xs text-slate-500">Please wait while we refresh your enrollment and class session data.</p>
                  </div>
                ) : (
                myEnrollments.length === 0 ? (
                  <div className="rounded-xl p-5 space-y-3 text-center" style={{ background: "rgba(250,111,48,0.06)", border: "1px solid rgba(250,111,48,0.2)" }}>
                    <BookOpen className="w-8 h-8 mx-auto" style={{ color: "#FA6F30" }} />
                    <p className="font-bold text-slate-900">Purchase a NOVI Course First</p>
                    <p className="text-sm text-slate-500">The class code is given by your instructor on the day of your purchased class. You must enroll in a course before you can use this path.</p>
                    <Link to={createPageUrl("ProviderEnrollments")} onClick={() => setActivateDialog(false)}>
                      <Button style={{ background: "#FA6F30", color: "#fff" }} className="w-full font-bold">
                        <BookOpen className="w-4 h-4 mr-2" /> Browse & Purchase Courses
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(123,142,200,0.07)", border: "1px solid rgba(123,142,200,0.2)" }}>
                      <p className="text-sm font-semibold text-slate-900">Select your enrolled course and date</p>
                    </div>
                    <div className="rounded-lg divide-y divide-slate-100 overflow-hidden border border-slate-100">
                      {classCodeEnrollmentWindows.map(({ key, enrollment, course, window, isOpen, isAttended }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setSelectedCoverageCourseKey(key); setCodeError(""); }}
                          className={`w-full text-left px-4 py-3 text-sm border-l-4 transition-all ${selectedCoverageCourseKey === key ? "bg-orange-100 border-l-orange-500 shadow-sm" : "bg-white border-l-transparent"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-slate-800">{course?.title || enrollment.course_title || "Course"}</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              isAttended
                                ? "bg-blue-100 text-blue-700"
                                : isOpen
                                  ? "bg-green-100 text-green-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}>
                              {isAttended ? "Attended" : isOpen ? "Class is on" : "Class not started"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {formatSessionDateLabel(enrollment.session_date)}
                          </p>
                          {window ? (
                            <p className="text-xs text-slate-500 mt-1">
                              Time (EST): {formatEstClockTime(window.startAt)} - {formatEstClockTime(window.endAt)}
                            </p>
                          ) : (
                            <p className="text-xs text-amber-700 mt-1">Session timing not configured by admin yet.</p>
                          )}
                          {!isAttended && (
                            <p className={`text-xs mt-1 ${isOpen ? "text-green-700" : "text-slate-500"}`}>
                              {isOpen ? "Class is on for this course. Enter code below." : "Class not started for this course yet."}
                            </p>
                          )}
                          {isOpen && !isAttended && (
                            <p className="text-xs mt-1 text-green-700">
                              The course window to enter code will be open for 24 hours after the course end time, in case you missed to enter code during class, you can enter within this timeframe.
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                    {selectedCoverageWindow ? (
                      <p className="text-xs text-slate-600">
                        Selected: {selectedCoverageWindow.course?.title || selectedCoverageWindow.enrollment.course_title || "Course"} ({formatSessionDateLabel(selectedCoverageWindow.enrollment.session_date)}) - {selectedCoverageWindow.isAttended ? "Attended" : selectedCoverageWindow.isOpen ? "Class is on" : "Class not started"}
                      </p>
                    ) : (
                      <div className="rounded-lg px-3 py-2.5 border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        Select a course row first to enable code entry.
                      </div>
                    )}
                    <Input placeholder="Enter class code..." value={classCode} onChange={e => { setClassCode(e.target.value.toUpperCase()); setCodeError(""); }} className="text-lg font-mono tracking-widest text-center" disabled={!selectedCoverageWindow || selectedCoverageWindow.isAttended || !selectedCoverageWindow.isOpen} />
                    {codeError && <p className="text-sm text-red-500 whitespace-pre-line">{codeError}</p>}
                    <Button onClick={() => verifyCodeMutation.mutate()} disabled={!selectedCoverageWindow || selectedCoverageWindow.isAttended || !selectedCoverageWindow.isOpen || !classCode || verifyCodeMutation.isPending} className="w-full" style={{ background: "#FA6F30", color: "#fff" }}>
                      {selectedCoverageWindow?.isAttended ? "Already Attended" : verifyCodeMutation.isPending ? "Verifying..." : "Verify Code"}
                    </Button>
                    <p className="text-xs text-center" style={{ color: "rgba(0,0,0,0.4)" }}>Don't have a class yet? <Link to={createPageUrl("ProviderEnrollments")} onClick={() => setActivateDialog(false)} className="underline font-semibold" style={{ color: "#FA6F30" }}>Browse courses →</Link></p>
                  </div>
                ))
              ) : certSubmitted ? (
                <div className="border border-green-200 bg-green-50 rounded-xl p-6 text-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="font-bold text-green-800">Submitted for Review!</p>
                  <p className="text-sm text-green-700 mt-1">Once approved, you'll be notified to complete your MD Coverage membership.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Certification Name *</label><Input value={certForm.cert_name} onChange={e => setCertForm(f => ({ ...f, cert_name: e.target.value }))} /></div>
                    <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Issuing School *</label><Input value={certForm.issuing_school} onChange={e => setCertForm(f => ({ ...f, issuing_school: e.target.value }))} /></div>
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Service Applying For *</label>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {serviceTypes.map(s => (
                          <button key={s.id} onClick={() => setCertForm(f => ({ ...f, service_type_id: s.id, service_type_name: s.name }))} className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${certForm.service_type_id === s.id ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:border-slate-300"}`}>
                            <p className="text-sm font-medium text-slate-900">{s.name}</p>
                            <p className="text-xs text-slate-400 capitalize">{s.category?.replace("_", " ")}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed rounded-lg p-4 hover:bg-slate-50">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-500">{uploadingCert ? "Uploading..." : certFileUrl ? "Certificate uploaded ✓" : "Upload certification PDF or image"}</span>
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={uploadCertFile} />
                  </label>
                  {uploadCertError && <p className="text-xs text-red-500">{uploadCertError}</p>}
                  {submitCertError && <p className="text-xs text-red-500">{submitCertError}</p>}
                  {!isUsableUploadedUrl(certFileUrl) && !uploadingCert && !uploadCertError && (
                    <p className="text-xs text-slate-500">Certification file is required before submit.</p>
                  )}
                  <Button onClick={() => submitExternalCertMutation.mutate()} disabled={!certForm.cert_name || !certForm.issuing_school || !isUsableUploadedUrl(certFileUrl) || !certForm.service_type_id || submitExternalCertMutation.isPending} className="w-full" style={{ background: "#FA6F30", color: "#fff" }}>
                    {submitExternalCertMutation.isPending ? "Submitting..." : "Submit for Review"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Select the service you want MD Board coverage for.</p>
              {availableServices.length === 0 ? (
                <div className="text-center py-4 space-y-3">
                  <p className="font-semibold text-slate-900">No eligible services yet</p>
                  <p className="text-sm text-slate-500">
                    {verifiedSession
                      ? "Code verified. No service is unlocked yet for MD coverage from this course."
                      : "Complete a NOVI course to unlock specific services."}
                  </p>
                  {!verifiedSession && (
                    <Link to={createPageUrl("ProviderEnrollments")}><Button style={{ background: "#FA6F30", color: "#fff" }} className="w-full">Browse Courses</Button></Link>
                  )}
                </div>
              ) : availableServices.map(s => (
                <div key={s.id} onClick={() => setSelectedServiceTypeId(s.id)} className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${selectedServiceTypeId === s.id ? "border-orange-400 bg-orange-50" : "border-slate-100 hover:border-slate-300"}`}>
                  <div className="flex items-center justify-between">
                    <div><p className="font-semibold text-slate-900">{s.name}</p><p className="text-xs text-slate-500 capitalize">{s.category?.replace("_", " ")}</p></div>
                    <div className="flex items-center gap-3">
                      <div className="text-right"><span className="font-bold text-slate-900">${getMembershipPrice()}</span><span className="text-xs text-slate-400">/mo</span></div>
                      {selectedServiceTypeId === s.id && <CheckCircle className="w-5 h-5 text-orange-500" />}
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={() => setStep(2)} disabled={!selectedServiceTypeId} className="w-full" style={{ background: "#FA6F30", color: "#fff" }}>Continue to Sign Agreement</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-orange-200 p-4 flex items-center justify-between bg-orange-50">
                <div><p className="font-semibold text-slate-900">{selectedService?.name} — MD Board Coverage</p><p className="text-xs text-slate-500 mt-0.5">{alreadyActiveServices.length === 0 ? "First service" : "Add-on service"} · NOVI Board MD assigned</p></div>
                <div className="text-right"><p className="text-2xl font-bold text-slate-900">${getMembershipPrice()}</p><p className="text-xs text-slate-400">/month</p></div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-40 overflow-y-auto text-sm text-slate-700 leading-relaxed">
                {selectedService?.md_agreement_text || `By signing below, I acknowledge that I have completed the required NOVI training for ${selectedService?.name}, agree to operate within the approved service scope and clinical protocols, and accept supervision by the NOVI Board of Medical Directors as required by my state's regulations.`}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Your Signature</p>
                <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white relative">
                  <canvas ref={canvasRef} width={520} height={120} className="w-full touch-none cursor-crosshair"
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
                  {!hasSigned && <p className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm pointer-events-none">Sign here</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={clearSignature} className="mt-1 text-slate-400"><RotateCcw className="w-3.5 h-3.5 mr-1" /> Clear</Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                Signing as <strong className="mx-1">{me?.full_name}</strong> · {format(new Date(), "MMMM d, yyyy")}
              </div>
              <Button onClick={() => activateMutation.mutate()} disabled={!hasSigned || activateMutation.isPending} className="w-full" style={{ background: "#2d3d66", color: "white" }}>
                {activateMutation.isPending ? "Activating..." : "Sign & Activate MD Board Coverage"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Cancel MD Coverage Offboarding Dialog ─── */}
      <Dialog open={cancelDialog.open} onOpenChange={(v) => { if (!v) setCancelDialog({ open: false, sub: null }); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#1e2535" }}>
              Cancel MD Coverage — {cancelDialog.sub?.service_type_name}
            </DialogTitle>
          </DialogHeader>

          {cancelStep === 0 && (
            <div className="space-y-4 pt-1">
              {/* Warning banner */}
              <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "rgba(218,106,99,0.1)", border: "1px solid rgba(218,106,99,0.3)" }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#DA6A63" }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: "#DA6A63" }}>This action cannot be undone</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.65)" }}>
                    Cancelling will immediately deactivate your <strong>{cancelDialog.sub?.service_type_name}</strong> MD coverage. 
                    All manufacturer accounts opened under NOVI supervision will be notified that you are no longer authorized.
                  </p>
                </div>
              </div>

              {/* What gets notified */}
              <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.08)" }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(30,37,53,0.45)" }}>What Happens When You Cancel</p>
                {[
                  "Your MD Board coverage is deactivated immediately",
                  "NOVI admin team is notified of your cancellation",
                  "All manufacturers you applied to are notified you can no longer order product under NOVI oversight",
                  "Your certifications and licenses remain on file",
                  "You can reapply for coverage in the future",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: "rgba(30,37,53,0.4)" }} />
                    <p className="text-xs" style={{ color: "rgba(30,37,53,0.65)" }}>{item}</p>
                  </div>
                ))}
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.7)" }}>Reason for cancelling *</label>
                <div className="space-y-2">
                  {["No longer practicing this service", "Switching to a different MD oversight provider", "Taking a break / closing practice", "Cost concerns", "Other"].map(r => (
                    <button key={r} onClick={() => setCancelForm(f => ({ ...f, reason: r }))}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all"
                      style={{ background: cancelForm.reason === r ? "rgba(218,106,99,0.12)" : "rgba(255,255,255,0.6)", border: cancelForm.reason === r ? "1.5px solid rgba(218,106,99,0.4)" : "1px solid rgba(30,37,53,0.1)", color: "#1e2535", fontWeight: cancelForm.reason === r ? 600 : 400 }}>
                      {cancelForm.reason === r && <CheckCircle className="w-3.5 h-3.5 inline mr-2" style={{ color: "#DA6A63" }} />}
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.7)" }}>Additional notes (optional)</label>
                <Textarea
                  placeholder="Anything else you'd like to share with the NOVI team..."
                  value={cancelForm.notes}
                  onChange={e => setCancelForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="text-sm"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setCancelDialog({ open: false, sub: null })}>Keep Coverage</Button>
                <Button
                  className="flex-1"
                  style={{ background: "rgba(218,106,99,0.15)", color: "#DA6A63", border: "1px solid rgba(218,106,99,0.35)" }}
                  disabled={!cancelForm.reason}
                  onClick={() => setCancelStep(1)}
                >
                  Continue to Confirm
                </Button>
              </div>
            </div>
          )}

          {cancelStep === 1 && (
            <div className="space-y-4 pt-1">
              <div className="rounded-xl px-4 py-4 text-center space-y-2" style={{ background: "rgba(218,106,99,0.08)", border: "1px solid rgba(218,106,99,0.3)" }}>
                <XCircle className="w-10 h-10 mx-auto" style={{ color: "#DA6A63" }} />
                <p className="font-bold text-base" style={{ color: "#1e2535" }}>Final Confirmation</p>
                <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
                  You are about to cancel <strong>{cancelDialog.sub?.service_type_name}</strong> MD coverage. 
                  Type your full name below to confirm this action.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.7)" }}>Type your full name to confirm *</label>
                <input
                  type="text"
                  placeholder={me?.full_name || "Your full name"}
                  value={cancelForm.confirmation_name}
                  onChange={e => setCancelForm(f => ({ ...f, confirmation_name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.15)", color: "#1e2535" }}
                />
                <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>Must match: <strong>{me?.full_name}</strong></p>
              </div>

              <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(30,37,53,0.04)", color: "rgba(30,37,53,0.55)" }}>
                Reason: <strong>{cancelForm.reason}</strong>
                {cancelForm.notes && ` · "${cancelForm.notes}"`}
              </p>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setCancelStep(0)}>Back</Button>
                <Button
                  className="flex-1 gap-2"
                  style={{ background: "#DA6A63", color: "#fff" }}
                  disabled={cancelForm.confirmation_name !== me?.full_name || cancelLoading}
                  onClick={handleCancelSubscription}
                >
                  <Trash2 className="w-4 h-4" />
                  {cancelLoading ? "Cancelling..." : "Confirm Cancellation"}
                </Button>
              </div>
            </div>
          )}

          {cancelStep === 2 && (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(200,230,60,0.15)" }}>
                <CheckCircle className="w-7 h-7" style={{ color: "#4a6b10" }} />
              </div>
              <p className="font-bold text-lg" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>Cancellation Processed</p>
              <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
                Your <strong>{cancelDialog.sub?.service_type_name}</strong> MD coverage has been cancelled. 
                NOVI admin and any applicable manufacturers have been notified.
              </p>
              <Button style={{ background: "#FA6F30", color: "#fff" }} onClick={() => { setCancelDialog({ open: false, sub: null }); setCancelStep(0); }}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Submit External Cert Dialog */}
      <Dialog open={certSubmitOpen} onOpenChange={(v) => { setCertSubmitOpen(v); if (!v) resetExtCertForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Submit External Certification</DialogTitle></DialogHeader>
          {certSubmitStep < 2 && (
            <div className="flex items-center gap-2 pb-1">
              {["Upload Credentials", "Select Service"].map((label, i) => (
                <div key={i} className="flex items-center gap-1.5 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i < certSubmitStep ? "bg-green-500 text-white" : i === certSubmitStep ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                    {i < certSubmitStep ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium ${i <= certSubmitStep ? "text-slate-800" : "text-slate-400"}`}>{label}</span>
                  {i < 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 ml-auto" />}
                </div>
              ))}
            </div>
          )}
          {certSubmitStep === 0 && (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-slate-500">Upload your existing certification and professional license for verification.</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Cert Name *</label><Input value={extCertForm.cert_name} onChange={e => setExtCertForm(f => ({ ...f, cert_name: e.target.value }))} placeholder="e.g. Botox Certification" /></div>
                <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Issuing School *</label><Input value={extCertForm.issuing_school} onChange={e => setExtCertForm(f => ({ ...f, issuing_school: e.target.value }))} /></div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">License Type</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CERT_TYPES.map(t => (<button key={t} onClick={() => setExtCertForm(f => ({ ...f, cert_type: t }))} className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${extCertForm.cert_type === t ? "border-orange-400 bg-orange-50 text-orange-800" : "border-slate-200 text-slate-600"}`}>{t}</button>))}
                  </div>
                </div>
              </div>
              {[
                { key: "cert", label: "Upload Certification *", uploading: uploadingExtCert, url: extCertFileUrl, icon: Award, onChange: uploadExtCertFile },
                { key: "lic", label: "Upload Professional License *", uploading: uploadingExtLicense, url: extLicenseFileUrl, icon: FileText, onChange: uploadExtLicenseFile },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">{f.label}</label>
                  <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed rounded-lg p-4 hover:bg-slate-50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${f.url ? "bg-green-100" : "bg-slate-100"}`}>
                      <f.icon className={`w-4 h-4 ${f.url ? "text-green-600" : "text-slate-400"}`} />
                    </div>
                    <div className="flex-1"><p className="text-sm font-medium text-slate-700">{f.uploading ? "Uploading..." : f.url ? "Uploaded ✓" : "Choose file (PDF, JPG, PNG)"}</p></div>
                    <Upload className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={f.onChange} />
                  </label>
                </div>
              ))}
              {uploadExtCertError && <p className="text-xs text-red-500">{uploadExtCertError}</p>}
              {uploadExtLicenseError && <p className="text-xs text-red-500">{uploadExtLicenseError}</p>}
              {submitExtCertError && <p className="text-xs text-red-500">{submitExtCertError}</p>}
              {(!isUsableUploadedUrl(extCertFileUrl) || !isUsableUploadedUrl(extLicenseFileUrl)) && !uploadExtCertError && !uploadExtLicenseError && (
                <p className="text-xs text-slate-500">Upload both certification and license files to continue.</p>
              )}
              <Button onClick={() => setCertSubmitStep(1)} disabled={!extCertForm.cert_name || !extCertForm.issuing_school || !isUsableUploadedUrl(extCertFileUrl) || !isUsableUploadedUrl(extLicenseFileUrl)} className="w-full" style={{ background: "#FA6F30", color: "#fff" }}>
                Continue — Select Service <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
          {certSubmitStep === 1 && (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-slate-500">Which service are you applying to provide on NOVI?</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {serviceTypes.map(s => (
                  <button key={s.id} onClick={() => setExtCertForm(f => ({ ...f, service_type_id: s.id, service_type_name: s.name }))} className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between ${extCertForm.service_type_id === s.id ? "border-orange-400 bg-orange-50" : "border-slate-100 hover:border-slate-300"}`}>
                    <div><p className="text-sm font-semibold text-slate-900">{s.name}</p><p className="text-xs text-slate-400 capitalize">{s.category?.replace("_", " ")}</p></div>
                    {extCertForm.service_type_id === s.id && <CheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCertSubmitStep(0)} className="flex-1">Back</Button>
                <Button onClick={() => submitExtCertMutation.mutate()} disabled={!extCertForm.service_type_id || submitExtCertMutation.isPending} className="flex-1" style={{ background: "#FA6F30", color: "#fff" }}>
                  {submitExtCertMutation.isPending ? "Submitting..." : "Submit for Review"}
                </Button>
              </div>
            </div>
          )}
          {certSubmitStep === 2 && (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-green-500" /></div>
              <p className="font-bold text-slate-900 text-lg">Submitted!</p>
              <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">We'll verify your <strong>{extCertForm.cert_name}</strong> and notify you once approved so you can activate MD Board coverage for <strong>{extCertForm.service_type_name}</strong>.</p>
              <Button className="mt-5" onClick={() => { setCertSubmitOpen(false); resetExtCertForm(); }} style={{ background: "#FA6F30", color: "#fff" }}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <ProviderSalesLock feature="credentials" applicationStatus={accessStatus} requiredTier="courses_only">
      {pageContent}
    </ProviderSalesLock>
  );
}