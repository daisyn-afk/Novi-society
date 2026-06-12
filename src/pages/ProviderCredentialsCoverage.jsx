import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProviderSalesLock from "@/components/ProviderSalesLock";
import { useProviderAccess } from "@/components/useProviderAccess";
import { base44 } from "@/api/base44Client";
import { adminApiRequest } from "@/api/adminApiRequest";
import { useNavigate, useLocation } from "react-router-dom";
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
  ChevronDown, ChevronUp, Sparkles, ExternalLink, Download, Star, DollarSign, Info, TrendingUp,
  XCircle, Settings, Trash2, CreditCard, X
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import {
  describeSessionWindowForProvider,
  formatProviderWindowRange,
  isNowWithinSessionRedeemWindow,
} from "@/lib/classCodeWindow";
import { resolveProviderTimeZone } from "@/lib/providerTimezone";
import { downloadCertificateDocument, hasCertificateDocument, openCertificateDocument } from "@/lib/certificateDocument";
import {
  getMdContractUrl,
  getMdContractDisplayName,
  getSignedMdContractFileName,
  getMdContractPreviewFileName,
  findServiceTypeForSubscription,
  resolveProtocolDocumentsFromServiceType,
  buildServiceWiseDocumentBundles,
  subscriptionHasMdAgreement,
  pickGlobalMdContractUrl,
  filterProtocolDocuments,
  isUsableDocumentUrl,
} from "@/lib/serviceTypeDocuments";
import MdAgreementDocument from "@/components/provider/MdAgreementDocument";
import SupervisingMdCoveragePanel from "@/components/provider/SupervisingMdCoveragePanel";
import {
  buildAgreementContextFromProfile,
  mergeAgreementContext,
} from "@/lib/mdAgreementTemplate";
import {
  isMdPurchasablePlan,
  servicesInMembership,
  servicesUnlockedForSubscription,
  serviceDisplayName,
} from "@/lib/serviceTypeMembershipModel";
import {
  buildProviderAttestationContext,
  evaluateServiceAttestation,
  isMembershipReadyForMdApply,
  membershipAttestationSummary,
} from "@/lib/serviceAttestation";
import ServiceAttestationStatus from "@/components/provider/ServiceAttestationStatus";
import {
  MD_FIRST_SERVICE_MONTHLY_FEE as FIRST_SERVICE_PRICE,
  MD_ADDON_SERVICE_MONTHLY_FEE as ADDON_SERVICE_PRICE,
  MD_MAX_COVERED_SERVICES as MAX_SERVICES,
  MD_MAX_MONTHLY_CAP as MAX_MONTHLY_CAP,
  calcMdCoverageMonthlyTotal,
  buildMdCoverageCheckoutBillingPreview,
  formatMdCoverageUsd,
  mdCoverageCapErrorMessage,
  resolveMdCoverageMonthlyFee,
  isMdCoverageTestPricingActiveForProvider,
} from "@/lib/mdMembershipPricing";

const LICENSE_TYPES = ["RN", "NP", "PA", "MD", "DO", "esthetician", "other"];
const CERT_TYPES = ["RN", "NP", "PA", "MD", "DO", "esthetician", "other"];
const ACTIVATION_STEPS = ["Verify Training", "Select Service", "Sign & Activate"];

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

const mdCoveragePendingKey = (serviceTypeId) => `md_coverage_pending:${serviceTypeId}`;

function readMdCoveragePending(serviceTypeId) {
  try {
    const raw = sessionStorage.getItem(mdCoveragePendingKey(serviceTypeId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeMdCoveragePending(serviceTypeId, payload) {
  try {
    sessionStorage.setItem(mdCoveragePendingKey(serviceTypeId), JSON.stringify(payload || {}));
  } catch { /* ignore */ }
}

function clearMdCoveragePending(serviceTypeId) {
  try {
    sessionStorage.removeItem(mdCoveragePendingKey(serviceTypeId));
    sessionStorage.removeItem(`md_coverage_signature:${serviceTypeId}`);
  } catch { /* ignore */ }
}

function upsertMdSubscriptionInCache(qc, entry) {
  const stId = String(entry?.service_type_id || "").trim();
  if (!stId) return;
  qc.setQueryData(["my-md-subscriptions"], (old = []) => {
    const rows = Array.isArray(old) ? old : [];
    const idx = rows.findIndex((s) => String(s.service_type_id) === stId);
    const merged = {
      ...(idx >= 0 ? rows[idx] : {}),
      ...entry,
      service_type_id: stId,
      status: entry.status || "active",
    };
    const next = idx >= 0 ? [...rows] : [merged, ...rows];
    if (idx >= 0) next[idx] = merged;
    return mergeMdSubscriptionsWithPending(next);
  });
}

function readAllMdCoveragePending() {
  const entries = [];
  try {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith("md_coverage_pending:")) continue;
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.service_type_id) entries.push(parsed);
    }
  } catch {
    /* ignore */
  }
  return entries;
}

/** Keep signed PDF + active status visible while Stripe checkout is finishing server-side. */
function mergeMdSubscriptionsWithPending(rows = []) {
  const list = Array.isArray(rows) ? [...rows] : [];
  for (const pending of readAllMdCoveragePending()) {
    const stId = String(pending.service_type_id || "").trim();
    if (!stId) continue;
    const idx = list.findIndex((s) => String(s.service_type_id) === stId);
    const merged = {
      ...(idx >= 0 ? list[idx] : {}),
      ...pending,
      service_type_id: stId,
      status: "active",
    };
    if (idx >= 0) list[idx] = merged;
    else list.unshift(merged);
  }
  return list;
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

function ServiceWiseDocumentsBlock({ bundles = [] }) {
  if (!bundles.length) return null;
  return (
    <div className="space-y-3">
      {bundles.map((bundle) => (
        <div
          key={bundle.serviceId}
          className="rounded-lg px-3 py-3"
          style={{ background: "rgba(30,37,53,0.02)", border: "1px solid rgba(30,37,53,0.07)" }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#1e2535" }}>
            {bundle.serviceName}
          </p>
          {bundle.mdContractUrl && (
            <div className="mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                MD Contract
              </p>
              <a
                href={bundle.mdContractUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-95"
                style={{ background: "rgba(123,142,200,0.12)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.25)" }}
              >
                <FileText className="w-3 h-3" />
                {bundle.mdContractLabel}
              </a>
            </div>
          )}
          {bundle.protocols.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                Protocol Documents
              </p>
              <div className="flex flex-wrap gap-2">
                {bundle.protocols.map((doc, i) => (
                  <a
                    key={`${bundle.serviceId}-${i}`}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-95"
                    style={{ background: "rgba(123,142,200,0.12)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.25)" }}
                  >
                    <FileText className="w-3 h-3" />
                    {doc.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CertRow({ cert: c, muted = false }) {
  const canViewCertificate = hasCertificateDocument(c);
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
        {canViewCertificate && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => openCertificateDocument(c)}
              className="inline-flex items-center justify-center rounded-md p-1.5 transition-all hover:brightness-95"
              style={{ background: "rgba(123,142,200,0.12)", border: "1px solid rgba(123,142,200,0.25)" }}
              title="Open certificate"
            >
              <ExternalLink className="w-3.5 h-3.5" style={{ color: "#7B8EC8" }} />
            </button>
            <button
              type="button"
              onClick={() => downloadCertificateDocument(c, `${c.certification_name || "certificate"}.pdf`)}
              className="inline-flex items-center justify-center rounded-md p-1.5 transition-all hover:brightness-95"
              style={{ background: "rgba(123,142,200,0.12)", border: "1px solid rgba(123,142,200,0.25)" }}
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5" style={{ color: "#7B8EC8" }} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProviderCredentialsCoverage() {
  const readUiCache = (key, fallback = []) => {
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem(`pcache:${key}`);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  };
  const writeUiCache = (key, value) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(`pcache:${key}`, JSON.stringify(Array.isArray(value) ? value : []));
    } catch {
      // ignore storage errors
    }
  };

  const { status: accessStatus } = useProviderAccess();
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab")) return params.get("tab");
      if (params.get("md_payment_status") === "success") return "documents";
    } catch {
      /* ignore */
    }
    return "overview";
  });
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [licenseForm, setLicenseForm] = useState({ license_type: "RN" });
  const [licenseExpiryError, setLicenseExpiryError] = useState("");
  const [licenseDocumentError, setLicenseDocumentError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [certSubmitOpen, setCertSubmitOpen] = useState(false);
  const [certSubmitStep, setCertSubmitStep] = useState(0);
  const [extCertForm, setExtCertForm] = useState({ cert_name: "", issuing_school: "", cert_type: "RN", service_type_id: "", service_type_name: "", certificate_number: "" });
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
  const [dismissedApprovedAlertIds, setDismissedApprovedAlertIds] = useState([]);
  const [expandedServiceCard, setExpandedServiceCard] = useState(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [activateError, setActivateError] = useState("");
  const [filledContractLoading, setFilledContractLoading] = useState(false);
  const [agreementContext, setAgreementContext] = useState(null);
  const [providerSigPreview, setProviderSigPreview] = useState("");
  const [openingFullPdf, setOpeningFullPdf] = useState(false);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  // Data queries
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });
  const browserTimeZone = typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "";
  const providerTimeZone = resolveProviderTimeZone(me, browserTimeZone);
  const { data: licenses = [], isLoading: loadingLicenses } = useQuery({
    queryKey: ["my-licenses"],
    queryFn: async () => { const u = await base44.auth.me(); return base44.entities.License.filter({ provider_id: u.id }); },
    initialData: () => readUiCache("my-licenses", []),
    staleTime: 120000,
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });
  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });
  const { data: myCerts = [] } = useQuery({
    queryKey: ["my-certs"],
    queryFn: async () => {
      const u = await base44.auth.me();
      return base44.entities.Certification.filter({
        provider_id: u.id,
        provider_email: u.email,
      });
    },
    enabled: !!me,
    initialData: () => readUiCache("my-certs", []),
    staleTime: 120000,
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });
  const { data: mySubscriptions = [] } = useQuery({
    queryKey: ["my-md-subscriptions"],
    queryFn: async () => {
      const u = await base44.auth.me();
      const rows = await base44.entities.MDSubscription.filter({ provider_id: u.id });
      return mergeMdSubscriptionsWithPending(rows);
    },
    enabled: !!me,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const { data: myEnrollments = [], isLoading: loadingMyEnrollments, isFetching: fetchingMyEnrollments } = useQuery({
    queryKey: ["my-enrollments-coverage"],
    queryFn: async () => {
      const u = await base44.auth.me();
      const [byProviderIdResult, byEmailResult, preOrdersResult] = await Promise.allSettled([
        u?.id ? base44.entities.Enrollment.filter({ provider_id: u.id }) : Promise.resolve([]),
        u?.email ? base44.entities.Enrollment.filter({ provider_email: u.email }) : Promise.resolve([]),
        u?.email
          ? base44.entities.PreOrder.list("-created_date", 500, { customer_email: u.email })
          : Promise.resolve([]),
      ]);
      const byProviderId = byProviderIdResult.status === "fulfilled" ? (byProviderIdResult.value || []) : [];
      const byEmail = byEmailResult.status === "fulfilled" ? (byEmailResult.value || []) : [];
      const preOrders = preOrdersResult.status === "fulfilled" ? (preOrdersResult.value || []) : [];
      const email = String(u?.email || "").trim().toLowerCase();
      const derivedFromPreOrders = email
        ? preOrders
          .filter((p) => String(p?.order_type || "").toLowerCase() === "course")
          .filter((p) => Boolean(p?.course_id))
          .filter((p) => ["paid", "confirmed", "completed"].includes(String(p?.status || "").toLowerCase()))
          .filter((p) => String(p?.customer_email || "").trim().toLowerCase() === email)
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
          }))
        : [];
      const map = new Map();
      [...byProviderId, ...byEmail, ...derivedFromPreOrders].forEach((row) => {
        const dedupeKey = row?.pre_order_id || row?.id || `${row?.course_id || ""}:${row?.session_date || ""}`;
        if (dedupeKey) map.set(String(dedupeKey), row);
      });
      return Array.from(map.values());
    },
    enabled: !!me,
    initialData: () => readUiCache("my-enrollments-coverage", []),
    staleTime: 60000,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
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
    initialData: () => readUiCache("my-sessions-coverage", []),
    staleTime: 60000,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });
  useEffect(() => { writeUiCache("my-licenses", licenses || []); }, [licenses]);
  useEffect(() => { writeUiCache("my-certs", myCerts || []); }, [myCerts]);
  useEffect(() => { writeUiCache("my-enrollments-coverage", myEnrollments || []); }, [myEnrollments]);
  useEffect(() => { writeUiCache("my-sessions-coverage", mySessions || []); }, [mySessions]);
  useEffect(() => {
    if (!me?.id || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`pcache:dismissed-approved-alerts:${me.id}`);
      const parsed = raw ? JSON.parse(raw) : [];
      setDismissedApprovedAlertIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDismissedApprovedAlertIds([]);
    }
  }, [me?.id]);
  const { data: courses = [] } = useQuery({
    queryKey: ["courses-coverage"],
    queryFn: () => base44.entities.Course.list(),
  });
  const { data: supervisingMdCoverage } = useQuery({
    queryKey: ["supervising-md-coverage", me?.id],
    queryFn: () => adminApiRequest("/admin/md-relationships/supervising-md-coverage", { method: "GET" }),
    enabled: !!me?.id,
    staleTime: 0,
  });
  const { data: relationships = [] } = useQuery({
    queryKey: ["my-md-relationships"],
    queryFn: async () => { if (!me) return []; return base44.entities.MedicalDirectorRelationship.filter({ provider_id: me.id }); },
    enabled: !!me,
  });

  /** After Stripe success or $0 signup: server activates subscription + MD assignment (idempotent). */
  async function finalizeActiveMdCoverageAndAssignMd({ stId, enrollId, signatureData }) {
    if (!me?.id || !stId) return null;
    const serviceTypeName = serviceTypes.find((s) => s.id === stId)?.name;
    const res = await base44.functions.invoke("finalizeMdBoardCoverage", {
      service_type_id: stId,
      service_type_name: serviceTypeName || "",
      enrollment_id: enrollId || null,
      signature_data: signatureData || null,
    });
    const data = res?.data;
    if (!data?.success && !data?.ok) {
      throw new Error(data?.error || "Unable to activate MD coverage.");
    }
    const pending = readMdCoveragePending(stId);
    const st = serviceTypes.find((s) => s.id === stId);
    upsertMdSubscriptionInCache(qc, {
      id: data.md_subscription_id || pending?.id,
      service_type_id: stId,
      service_type_name: serviceTypeName || pending?.service_type_name,
      signed_contract_url: data.signed_contract_url || pending?.signed_contract_url || null,
      signed_by_name: me?.full_name || pending?.signed_by_name,
      signed_at: pending?.signed_at || new Date().toISOString(),
      status: "active",
      md_contract_url: pending?.md_contract_url || getMdContractUrl(st, { allServiceTypes: serviceTypes }) || null,
      md_agreement_text: pending?.md_agreement_text || st?.md_agreement_text || null,
      protocol_document_urls: pending?.protocol_document_urls || [],
    });
    clearMdCoveragePending(stId);
    qc.invalidateQueries({ queryKey: ["my-md-relationships"] });
    qc.invalidateQueries({ queryKey: ["my-md-subscriptions"] });
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["marketplace-catalog"] });
    return data;
  }

  // Open MD coverage apply flow when arriving from cert-approval notification (?prompt_service=)
  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    if (params.get("tab")) setActiveTab(params.get("tab"));
    const promptService = params.get("prompt_service");
    if (!promptService || serviceTypes.length === 0) return;
    const activeMdCount = mySubscriptions.filter((s) => s.status === "active").length;
    if (activeMdCount >= MAX_SERVICES) {
      setActiveTab("coverage");
      setActivateError(mdCoverageCapErrorMessage());
      params.delete("prompt_service");
      const qsEarly = params.toString();
      navigate({ pathname: createPageUrl("ProviderCredentialsCoverage"), search: qsEarly ? `?${qsEarly}` : "" }, { replace: true });
      return;
    }
    setActiveTab("coverage");
    setActivateDialog(true);
    setSelectedServiceTypeId(promptService);
    setStep(2);
    params.delete("prompt_service");
    if (params.get("tab") === "coverage") params.delete("tab");
    const qs = params.toString();
    navigate({ pathname: createPageUrl("ProviderCredentialsCoverage"), search: qs ? `?${qs}` : "" }, { replace: true });
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      setHasSigned(false);
    }, 150);
  }, [location.search, serviceTypes.length, mySubscriptions, navigate]);

  // Stripe return: hydrate Documents tab before paint so signed PDF link appears immediately.
  useLayoutEffect(() => {
    if (!me?.id) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("md_payment_status") !== "success") return;
    const stId = params.get("service_type_id");
    if (!stId) return;

    const pending = readMdCoveragePending(stId);
    if (pending?.signed_contract_url) {
      upsertMdSubscriptionInCache(qc, {
        ...pending,
        service_type_id: stId,
        status: "active",
        signed_by_name: pending.signed_by_name || me?.full_name,
      });
      setActiveTab("documents");
      setActivateDialog(false);
    }
  }, [me?.id, me?.full_name, qc]);

  // Stripe return: finalize subscription + MD assignment in background.
  useEffect(() => {
    if (stripeHandled || !me?.id || serviceTypes.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const mdStatus = params.get("md_payment_status");
    const stId = params.get("service_type_id");
    const enrollId = params.get("enrollment_id");
    if (mdStatus === "success" && stId) {
      setStripeHandled(true);
      let signatureData = null;
      try {
        signatureData = sessionStorage.getItem(`md_coverage_signature:${stId}`);
      } catch { /* ignore */ }

      const pending = readMdCoveragePending(stId);
      navigate(`${createPageUrl("ProviderCredentialsCoverage")}?tab=documents`, { replace: true });

      finalizeActiveMdCoverageAndAssignMd({ stId, enrollId: enrollId || null, signatureData })
        .then(async () => {
          try { window.localStorage.removeItem("pcache:my-md-subscriptions"); } catch { /* ignore */ }
          qc.invalidateQueries({ queryKey: ["my-md-subscriptions"] });
        })
        .catch((err) => {
          console.error("[md-coverage] finalize after Stripe failed:", err);
          if (!pending?.signed_contract_url) {
            navigate(createPageUrl("ProviderLaunchPad"));
          }
        });
    }
  }, [me, serviceTypes, stripeHandled, navigate, qc]);

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
  const activeSubscriptions = mySubscriptions.filter((s) => s.status === "active");
  const globalMdContractUrl = pickGlobalMdContractUrl(serviceTypes);
  const documentSubscriptions = mySubscriptions.filter((s) => subscriptionHasMdAgreement(s));

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
  const feeForMdSlot = (activeServiceCountBeforeAdd) =>
    resolveMdCoverageMonthlyFee({
      providerId: me?.id,
      providerEmail: me?.email,
      activeServiceCountBeforeAdd,
    });
  const getMembershipPrice = () => feeForMdSlot(alreadyActiveServices.length);
  const isAtCap = alreadyActiveServices.length >= MAX_SERVICES;
  const calcMonthlyTotal = (count) => calcMdCoverageMonthlyTotal(count, feeForMdSlot);
  const attestationContext = useMemo(
    () =>
      buildProviderAttestationContext({
        certifications: myCerts,
        enrollments: myEnrollments,
        sessions: mySessions,
        courses,
      }),
    [myCerts, myEnrollments, mySessions, courses]
  );
  const mdCoveragePlans = serviceTypes.filter(isMdPurchasablePlan);
  const applyableServiceTypes = mdCoveragePlans.filter((s) => !alreadyActiveServices.includes(s.id));
  const availableServices = applyableServiceTypes.filter((s) =>
    isMembershipReadyForMdApply(s, serviceTypes, attestationContext)
  );
  const certSubmissionServices = useMemo(() => {
    return serviceTypes
      .filter((st) => st.is_membership !== true && st.is_active !== false)
      .filter((st) => {
        const evaluation = evaluateServiceAttestation(st, attestationContext, serviceTypes);
        if (evaluation.complete || evaluation.pending) return false;
        return st.allow_external_cert || st.requires_additional_provider_cert;
      });
  }, [serviceTypes, attestationContext]);
  const selectedService = serviceTypes.find(s => s.id === selectedServiceTypeId);
  const agreementFields = useMemo(
    () => mergeAgreementContext(buildAgreementContextFromProfile(me), agreementContext),
    [me, agreementContext]
  );
  const activeServices = serviceTypes.filter(s => alreadyActiveServices.includes(s.id));
  const approvedCertsWithoutCoverage = myCerts.filter(c => c.status === "active" && c.service_type_id && !alreadyActiveServices.includes(c.service_type_id));
  const visibleApprovedCertsWithoutCoverage = approvedCertsWithoutCoverage.filter((c) => !dismissedApprovedAlertIds.includes(c.id));
  const dismissApprovedAlert = (certId) => {
    const normalizedId = String(certId || "").trim();
    if (!normalizedId) return;
    setDismissedApprovedAlertIds((prev) => {
      if (prev.includes(normalizedId)) return prev;
      const next = [...prev, normalizedId];
      if (typeof window !== "undefined" && me?.id) {
        try {
          window.localStorage.setItem(`pcache:dismissed-approved-alerts:${me.id}`, JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
      }
      return next;
    });
  };
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
    const window = describeSessionWindowForProvider(course, sessionDate, providerTimeZone);
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
    setProviderSigPreview("");
    setAgreementContext(null);
  };
  const openApplyForCoverage = ({ serviceTypeId = null, jumpToSign = false } = {}) => {
    if (isAtCap) {
      setActivateError(mdCoverageCapErrorMessage());
      setActiveTab("coverage");
      return;
    }
    setActivateError("");
    resetActivation();
    if (serviceTypeId) {
      const membership = serviceTypes.find((s) => s.id === serviceTypeId);
      if (membership && !isMembershipReadyForMdApply(membership, serviceTypes, attestationContext)) {
        setActivateError("Complete required training or certification for all included services before applying for MD coverage.");
        setActiveTab("coverage");
        return;
      }
      setSelectedServiceTypeId(serviceTypeId);
      setStep(jumpToSign ? 2 : 1);
    }
    setActivateDialog(true);
  };
  const resetExtCertForm = () => {
    setCertSubmitStep(0);
    setExtCertForm({ cert_name: "", issuing_school: "", cert_type: "RN", service_type_id: "", service_type_name: "", certificate_number: "" });
    setExtCertFileUrl(""); setExtLicenseFileUrl("");
    setUploadExtCertError(""); setUploadExtLicenseError(""); setSubmitExtCertError("");
  };
  const openSubmitCertForService = (evaluation) => {
    const st = serviceTypes.find((s) => String(s.id) === String(evaluation?.serviceTypeId || ""));
    if (!st) return;
    resetExtCertForm();
    setCertSubmitOpen(true);
    setExtCertForm({
      cert_type: "RN",
      issuing_school: "",
      cert_name: st.additional_cert_label || evaluation.serviceName || st.name,
      service_type_id: st.id,
      service_type_name: serviceDisplayName(st, serviceTypes),
      certificate_number: "",
    });
  };
  const isExpiredLicenseDate = (dateValue) => {
    const raw = String(dateValue || "").trim();
    if (!raw) return false;
    const exp = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(exp.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return exp < today;
  };
  const handleSubmitLicense = () => {
    if (isExpiredLicenseDate(licenseForm.expiration_date)) {
      setLicenseExpiryError("Your license has already expired");
      return;
    }
    setLicenseExpiryError("");
    if (!licenseForm.document_url) {
      setLicenseDocumentError("License document is required.");
      return;
    }
    setLicenseDocumentError("");
    createLicense.mutate();
  };

  const createLicense = useMutation({
    mutationFn: async () => { const u = await base44.auth.me(); return base44.entities.License.create({ ...licenseForm, provider_id: u.id, provider_email: u.email }); },
    onSuccess: () => {
      qc.invalidateQueries(["my-licenses"]);
      setLicenseOpen(false);
      setLicenseForm({ license_type: "RN" });
      setLicenseExpiryError("");
      setLicenseDocumentError("");
    },
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
        timeoutMs: 4500,
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
            certificate_number: payload.certificate_number,
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
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["my-certs"] });
      const previous = qc.getQueryData(["my-certs"]);
      const tempId = `temp-cert-${Date.now()}`;
      qc.setQueryData(["my-certs"], (old = []) => ([
        {
          id: tempId,
          certification_name: extCertForm.cert_name,
          service_type_id: extCertForm.service_type_id,
          service_type_name: extCertForm.service_type_name,
          issued_by: extCertForm.issuing_school,
          certificate_url: extCertFileUrl,
          status: "pending",
          created_at: new Date().toISOString(),
        },
        ...(Array.isArray(old) ? old : []),
      ]));
      setCertSubmitStep(2);
      return { previous };
    },
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
      const extNum = String(extCertForm.certificate_number || "").trim();
      if (extNum) payload.certificate_number = extNum;
      if (certDebugEnabled) console.info("[cert-debug][provider-submit-ext] payload", payload);
      const created = await createCertificationWithFallback(payload, u, "provider-submit-ext");
      if (certDebugEnabled) console.info("[cert-debug][provider-submit-ext] created", created);
      return created;
    },
    onSuccess: () => {
      setSubmitExtCertError(""); qc.invalidateQueries({ queryKey: ["my-certs"] }); setCertSubmitStep(2);
    },
    onError: (err, _vars, context) => {
      if (context?.previous) qc.setQueryData(["my-certs"], context.previous);
      setCertSubmitStep(1);
      setSubmitExtCertError(err?.message || "Could not submit external certification.");
    },
  });
  const submitExternalCertMutation = useMutation({
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["my-certs"] });
      const previous = qc.getQueryData(["my-certs"]);
      const tempId = `temp-cert-${Date.now()}`;
      qc.setQueryData(["my-certs"], (old = []) => ([
        {
          id: tempId,
          certification_name: certForm.cert_name,
          service_type_id: certForm.service_type_id,
          service_type_name: certForm.service_type_name,
          issued_by: certForm.issuing_school,
          certificate_url: certFileUrl,
          status: "pending",
          created_at: new Date().toISOString(),
        },
        ...(Array.isArray(old) ? old : []),
      ]));
      setCertSubmitted(true);
      return { previous };
    },
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
    onSuccess: () => {
      setSubmitCertError(""); qc.invalidateQueries({ queryKey: ["my-certs"] }); setCertSubmitted(true);
    },
    onError: (err, _vars, context) => {
      if (context?.previous) qc.setQueryData(["my-certs"], context.previous);
      setCertSubmitted(false);
      setSubmitCertError(err?.message || "Could not submit external certification.");
    },
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
      setActivateError("");
      if (isAtCap) {
        throw new Error(mdCoverageCapErrorMessage());
      }
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Signature pad is not ready. Close the dialog and try again.");
      const signatureData = canvas.toDataURL("image/png");
      const res = await base44.functions.invoke("createMDSubscriptionCheckout", {
        service_type_id: selectedServiceTypeId,
        service_type_name: serviceTypes.find(s => s.id === selectedServiceTypeId)?.name,
        amount: getMembershipPrice(),
        enrollment_id: verifiedSession?.enrollment_id || null,
        signature_data: signatureData,
        frontend_origin: typeof window !== "undefined" ? window.location.origin : "",
      });
      if (res.data?.url) {
        const st = serviceTypes.find((s) => s.id === selectedServiceTypeId);
        try {
          sessionStorage.setItem(
            `md_coverage_signature:${selectedServiceTypeId}`,
            signatureData
          );
          writeMdCoveragePending(selectedServiceTypeId, {
            id: res.data.md_subscription_id,
            service_type_id: selectedServiceTypeId,
            service_type_name: res.data.service_type_name || st?.name,
            signed_contract_url: res.data.signed_contract_url || null,
            signed_by_name: me?.full_name,
            signed_at: new Date().toISOString(),
            md_contract_url: getMdContractUrl(st, { allServiceTypes: serviceTypes }) || null,
            md_agreement_text: st?.md_agreement_text || null,
            protocol_document_urls: resolveProtocolDocumentsFromServiceType(st, serviceTypes),
          });
        } catch { /* ignore */ }
        window.location.href = res.data.url;
        return;
      }
      if (res.data?.success || res.data?.ok) {
        await finalizeActiveMdCoverageAndAssignMd({
          stId: selectedServiceTypeId,
          enrollId: verifiedSession?.enrollment_id || null,
          signatureData,
        });
        try { window.localStorage.removeItem("pcache:my-md-subscriptions"); } catch { /* ignore */ }
        setActivateDialog(false);
        resetActivation();
        setActiveTab("documents");
        navigate(`${createPageUrl("ProviderCredentialsCoverage")}?tab=documents`);
        return;
      }
      throw new Error(res.data?.error || "Unable to activate MD coverage.");
    },
    onError: (err) => setActivateError(err?.message || "Something went wrong. Please try again."),
  });

  // Load the provider's token context (name/practice/state/address) so the
  // code-rendered agreement can be personalized in the review/sign step.
  useEffect(() => {
    if (!activateDialog || step !== 2 || !selectedServiceTypeId || !me?.id) return undefined;
    let cancelled = false;
    setFilledContractLoading(true);
    (async () => {
      try {
        const res = await base44.functions.invoke("mdAgreementContext", {});
        if (cancelled) return;
        if (res?.data?.context) setAgreementContext(res.data.context);
      } catch {
        // Fall back to profile fields from `me` if the API can't be loaded.
      } finally {
        if (!cancelled) setFilledContractLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activateDialog, step, selectedServiceTypeId, me?.id]);

  // Generate and download the full agreement PDF with a readable filename.
  const openFullAgreementPdf = async () => {
    if (openingFullPdf) return;
    setOpeningFullPdf(true);
    const previewWin = window.open("", "_blank");
    try {
      const res = await base44.functions.invoke("previewMdBoardContract", {
        service_type_id: selectedServiceTypeId,
        service_type_name: selectedService?.name || "",
      });
      const base64 = res?.data?.pdf_base64;
      if (!base64) throw new Error("Unable to build the agreement PDF.");
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const filename = getMdContractPreviewFileName(selectedService, me?.full_name);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      if (previewWin) previewWin.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      if (previewWin) previewWin.close();
    } finally {
      setOpeningFullPdf(false);
    }
  };

  const downloadSignedMdContract = async (sub, contractMeta) => {
    const filename = getSignedMdContractFileName(contractMeta, sub.signed_by_name);
    let url = isUsableDocumentUrl(sub.signed_contract_url) ? sub.signed_contract_url : null;
    try {
      const refreshed = await adminApiRequest(`/admin/md-subscriptions/${sub.id}/signed-contract`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (isUsableDocumentUrl(refreshed?.signed_contract_url)) {
        url = refreshed.signed_contract_url;
        qc.invalidateQueries({ queryKey: ["my-md-subscriptions"] });
      }
    } catch {
      // Fall back to the stored URL when refresh is unavailable.
    }
    if (!url) return;
    await downloadCertificateDocument(url, filename);
  };

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
        qc.invalidateQueries({ queryKey: ["me"] });
        qc.invalidateQueries({ queryKey: ["marketplace-catalog"] });
        setCancelStep(2);
      } else {
        console.error(res.data?.error || "Cancellation failed.");
      }
    } catch (e) {
      console.error(e);
    }
    setCancelLoading(false);
  };

  // Canvas drawing — scale internal resolution to displayed size so strokes align with cursor
  const setupSignatureCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    const displayWidth = Math.max(container?.clientWidth || 520, 280);
    const displayHeight = 120;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#1A1A2E";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  useEffect(() => {
    if (!activateDialog || step !== 2) return;
    const t = setTimeout(setupSignatureCanvas, 50);
    window.addEventListener("resize", setupSignatureCanvas);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", setupSignatureCanvas);
    };
  }, [activateDialog, step, selectedServiceTypeId]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };
  const startDraw = (e) => { const canvas = canvasRef.current; const ctx = canvas.getContext("2d"); isDrawing.current = true; ctx.beginPath(); const p = getPos(e, canvas); ctx.moveTo(p.x, p.y); e.preventDefault(); };
  const draw = (e) => { if (!isDrawing.current) return; const canvas = canvasRef.current; const ctx = canvas.getContext("2d"); const p = getPos(e, canvas); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasSigned(true); e.preventDefault(); };
  const endDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      try { setProviderSigPreview(canvas.toDataURL("image/png")); } catch { /* ignore */ }
    }
  };
  const clearSignature = () => { setupSignatureCanvas(); setHasSigned(false); setProviderSigPreview(""); };

  /** Opens apply dialog on Sign & Activate (step 2) for a known service — e.g. approved-cert banner or deep-link parity. */
  const openApplyDialogToSignForService = (serviceTypeId) => {
    const raw = String(serviceTypeId || "").trim();
    const stId = raw && serviceTypes.some((s) => s.id === raw) ? raw : "";
    if (isAtCap) {
      setActivateError(mdCoverageCapErrorMessage());
      setActiveTab("coverage");
      return;
    }
    setActivateError("");
    setClassCode("");
    setCodeError("");
    setVerifiedSession(null);
    setAttendedWindowKeys(new Set());
    setUseExternalCert(false);
    setCertForm({ cert_type: "RN", issuing_school: "", cert_name: "" });
    setCertFileUrl("");
    setUploadCertError("");
    setSubmitCertError("");
    setCertSubmitted(false);
    setSelectedCoverageCourseKey(null);
    setHasSigned(false);
    setActiveTab("coverage");
    if (stId) {
      setSelectedServiceTypeId(stId);
      setStep(2);
    } else {
      setSelectedServiceTypeId(null);
      setStep(-1);
    }
    setActivateDialog(true);
    setTimeout(() => clearSignature(), 150);
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  const pageContent = (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div style={{ borderLeft: "2px solid #DA6A63", paddingLeft: 16 }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: "#DA6A63", letterSpacing: "0.18em" }}>My Credentials & Coverage</p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", lineHeight: 1.1, fontStyle: "italic", fontWeight: 400 }}>
            Practice with Full Protection
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "rgba(30,37,53,0.5)", maxWidth: 440, lineHeight: 1.6 }}>
            Licenses, certifications, and NOVI Board coverage — everything needed to practice legally.
          </p>
        </div>
        {!isAtCap ? (
          <button onClick={() => openApplyForCoverage()}
            className="flex items-center gap-2 text-sm font-bold transition-all hover:opacity-75 flex-shrink-0"
            style={{ color: "#FA6F30" }}>
            <Zap className="w-4 h-4" /> Apply for MD Coverage
          </button>
        ) : (
          <p className="text-xs font-semibold max-w-[200px] text-right" style={{ color: "rgba(30,37,53,0.55)" }}>
            {MAX_SERVICES} services max · ${MAX_MONTHLY_CAP}/mo cap
          </p>
        )}
      </div>

      {isMdCoverageTestPricingActiveForProvider(me?.id, me?.email) && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-2xl"
          style={{ background: "rgba(123,142,200,0.12)", border: "1px solid rgba(123,142,200,0.35)" }}
        >
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#5a6fa8" }} />
          <p className="text-sm" style={{ color: "#243257" }}>
            <strong>Test pricing active:</strong> your MD Board checkout uses the configured test
            monthly fee (${getMembershipPrice()}/mo). Disable test pricing in production when
            finished.
          </p>
        </div>
      )}

      {activateError && !activateDialog && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-2xl" style={{ background: "rgba(250,111,48,0.1)", border: "1px solid rgba(250,111,48,0.3)" }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#FA6F30" }} />
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>MD coverage limit</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.65)" }}>{activateError}</p>
          </div>
          <button type="button" onClick={() => setActivateError("")} className="text-xs font-semibold" style={{ color: "#FA6F30" }}>Dismiss</button>
        </div>
      )}

      {/* Alerts */}
      {visibleApprovedCertsWithoutCoverage.map(c => (
        <div key={c.id} className="flex items-center gap-3 px-5 py-4 rounded-2xl" style={{ background: "rgba(200,230,60,0.15)", border: "1px solid rgba(200,230,60,0.4)" }}>
          <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#C8E63C" }} />
          <div className="flex-1">
            <p className="font-semibold text-sm" style={{ color: "#3D5600" }}>Your <strong>{c.service_type_name || c.certification_name}</strong> certification was approved!</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(61,86,0,0.8)" }}>You can now apply for MD Board coverage to start offering this service.</p>
          </div>
          {!isAtCap && (
            <Button size="sm" onClick={() => openApplyDialogToSignForService(c.service_type_id)} style={{ background: "#FA6F30", color: "#fff" }} className="flex-shrink-0 gap-1 h-8 text-xs">
              <Zap className="w-3.5 h-3.5" /> Apply
            </Button>
          )}
          <button
            onClick={() => dismissApprovedAlert(c.id)}
            className="p-1 rounded-md hover:bg-black/5 transition-colors"
            aria-label="Dismiss alert"
            title="Dismiss"
          >
            <X className="w-4 h-4" style={{ color: "rgba(61,86,0,0.7)" }} />
          </button>
        </div>
      ))}

      {/* Stats Row — editorial inline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(30,37,53,0.07)" }}>
        {[
          { label: "Licenses", value: licenses.length, sub: `${verifiedLicenses.length} verified`, tab: "credentials" },
          { label: "Certifications", value: activeCerts.length, sub: `${pendingCerts.length} under review`, tab: "credentials" },
          { label: "MD Coverage", value: activeSubscriptions.length, sub: "services active", tab: "coverage" },
          {
            label: "Assigned MD",
            value: activeRelationships.length > 0 ? "✓" : "—",
            sub: activeRelationships[0]?.medical_director_name || "Not yet assigned",
            tab: "coverage",
            subIsError: activeRelationships.length === 0,
          },
        ].map(({ label, value, sub, tab, subIsError }, i) => (
          <button key={label} onClick={() => setActiveTab(tab)}
            className="text-left px-4 py-4 transition-all hover:bg-white/50 min-w-0"
            style={{ borderLeft: i % 2 === 0 ? "none" : "1px solid rgba(30,37,53,0.07)", borderTop: i >= 2 ? "1px solid rgba(30,37,53,0.07)" : "none" }}>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#1e2535", lineHeight: 1, fontWeight: 400 }}>{value}</p>
            <p className="text-xs font-semibold mt-1" style={{ color: "#1e2535" }}>{label}</p>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: subIsError ? "#DC2626" : "rgba(30,37,53,0.4)" }}>{sub}</p>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex gap-0 overflow-x-auto" style={{ borderBottom: "1px solid rgba(30,37,53,0.1)", scrollbarWidth: "none" }}>
          {[
            { value: "overview", label: "Overview" },
            { value: "credentials", label: "Credentials" },
            { value: "coverage", label: "MD Coverage" },
            { value: "documents", label: "Documents" },
          ].map(({ value, label }) => (
            <button key={value} onClick={() => setActiveTab(value)}
              className="px-4 pb-3 pt-1 text-sm font-semibold transition-all flex-shrink-0"
              style={{ color: activeTab === value ? "#1e2535" : "rgba(30,37,53,0.38)", borderBottom: activeTab === value ? "2px solid #FA6F30" : "2px solid transparent", marginBottom: -1 }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        <TabsContent value="overview" className="pt-5 space-y-5">
          <GlassCard>
            <div className="px-6 pt-6 pb-2">
              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.18em" }}>How NOVI Coverage Works</p>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#1e2535", fontStyle: "italic", fontWeight: 400, lineHeight: 1.2 }}>The NOVI Board of Medical Directors</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.65)", borderLeft: "2px solid rgba(30,37,53,0.1)", paddingLeft: 14 }}>
                NOVI maintains a Board of Medical Directors — licensed physicians who provide clinical oversight and legal supervision for all providers.
              </p>
              <div className="divide-y" style={{ borderTop: "1px solid rgba(30,37,53,0.06)", borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
                {[
                  { title: "You don't find an MD", desc: "NOVI assigns a Board MD to you automatically upon approval" },
                  { title: "Signed Protocols", desc: "Your assigned MD signs your service agreements and clinical scope docs" },
                  { title: "Legal Compliance", desc: "Full medical directorship coverage as required by your state" },
                  { title: "Per-Service Coverage", desc: "Each service you offer requires its own MD coverage membership" },
                ].map(({ title, desc }, i) => (
                  <div key={i} className="flex items-baseline gap-4 py-3">
                    <p className="text-sm font-semibold flex-shrink-0 w-44" style={{ color: "#1e2535" }}>{title}</p>
                    <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)", lineHeight: 1.6 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <button className="w-full px-6 py-5 flex items-center justify-between text-left" onClick={() => setPricingOpen(v => !v)} style={{ borderBottom: pricingOpen ? "1px solid rgba(30,37,53,0.08)" : "none" }}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.18em" }}>Pricing</p>
                <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#1e2535", fontStyle: "italic", fontWeight: 400 }}>MD Coverage Membership</h3>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm" style={{ color: "rgba(30,37,53,0.35)" }}>from $279/mo</span>
                {pricingOpen ? <ChevronUp className="w-4 h-4" style={{ color: "rgba(30,37,53,0.3)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "rgba(30,37,53,0.3)" }} />}
              </div>
            </button>
            {pricingOpen && (
              <div className="px-6 py-5">
                <div className="grid sm:grid-cols-2 gap-4 mb-5">
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
                <div className="rounded-xl px-4 py-3 mb-4 flex items-start gap-3" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.3)" }}>
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#5a7a20" }} />
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.7)" }}>
                    <strong>5-Service Cap:</strong> Once you reach 5 services, you're fully covered for all services within your scope at <strong>$795/mo</strong> — no additional fees ever.
                  </p>
                </div>
                {activeSubscriptions.length > 0 && (
                  <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "rgba(200,230,60,0.12)", border: "1px solid rgba(200,230,60,0.3)" }}>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "#1e2535" }}>Your Current Monthly</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>{activeSubscriptions.length} service{activeSubscriptions.length > 1 ? "s" : ""} covered{activeSubscriptions.length >= MAX_SERVICES ? " · Fully capped" : ""}</p>
                    </div>
                    <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: "#4a6b10" }}>
                      ${calcMonthlyTotal(activeSubscriptions.length)}/mo
                    </p>
                  </div>
                )}
              </div>
            )}
          </GlassCard>

          <GlassCard>
            <div className="px-6 pt-6 pb-2">
              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.18em" }}>Requirements</p>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#1e2535", fontStyle: "italic", fontWeight: 400, lineHeight: 1.2 }}>How to Qualify for Coverage</h3>
            </div>
            <div className="px-6 py-5 grid sm:grid-cols-2 gap-3">
              {[
                { step: "1", title: "Upload Your License", desc: "Submit your professional license (RN, NP, PA, MD, etc.) for verification by our admin team.", done: licenses.length > 0, page: "credentials" },
                { step: "2", title: "Get License Verified", desc: "NOVI verifies your credentials. This typically takes 1–2 business days.", done: verifiedLicenses.length > 0, page: "credentials" },
                { step: "3", title: "Complete Training or Submit Cert", desc: "Attend a NOVI course and enter your class code, or submit an existing certification for review.", done: activeCerts.length > 0, page: "credentials" },
                { step: "4", title: "Apply & Sign Agreement", desc: "Apply for coverage on a per-service basis. Sign the MD Board agreement and activate your membership.", done: activeSubscriptions.length > 0, page: "coverage" },
              ].map(({ step: s, title, desc, done, page }) => (
                <button key={s} onClick={() => setActiveTab(page)}
                  className="text-left flex gap-3 px-4 py-4 rounded-xl transition-all hover:scale-[1.01]"
                  style={{ borderLeft: done ? "2px solid rgba(200,230,60,0.6)" : "2px solid rgba(30,37,53,0.12)", background: done ? "rgba(200,230,60,0.06)" : "rgba(30,37,53,0.02)", border: `1px solid ${done ? "rgba(200,230,60,0.2)" : "rgba(30,37,53,0.07)"}`, borderLeftWidth: 2, borderLeftColor: done ? "rgba(200,230,60,0.5)" : "rgba(30,37,53,0.15)" }}>
                  <div className="text-xs font-black mt-0.5 flex-shrink-0" style={{ color: done ? "#4a6b10" : "rgba(30,37,53,0.25)", fontFamily: "'DM Serif Display', serif", fontSize: 16, fontStyle: "italic" }}>{done ? "✓" : s}</div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)", lineHeight: 1.55 }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </GlassCard>
        </TabsContent>

        {/* ── CREDENTIALS TAB (Licenses + Certifications) ── */}
        <TabsContent value="credentials" className="pt-5 space-y-4">
          {/* Licenses */}
          <div className="flex items-baseline justify-between mb-4">
            <div style={{ borderLeft: "2px solid rgba(30,37,53,0.15)", paddingLeft: 12 }}>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.18em" }}>Your Licenses</p>
            </div>
            <button onClick={() => setLicenseOpen(true)}
              className="text-xs font-bold transition-all hover:opacity-70"
              style={{ color: "#FA6F30" }}>+ Add License</button>
          </div>
          {loadingLicenses ? (
            <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-14 animate-pulse rounded-xl" style={{ background: "rgba(255,255,255,0.5)" }} />)}</div>
          ) : licenses.length === 0 ? (
            <div className="py-10 text-center rounded-2xl" style={{ background: "rgba(255,255,255,0.5)", border: "1px dashed rgba(30,37,53,0.12)" }}>
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>No licenses uploaded yet</p>
              <p className="text-xs mt-1 mb-4" style={{ color: "rgba(30,37,53,0.4)" }}>Upload your professional license to begin the verification process.</p>
              <button onClick={() => setLicenseOpen(true)} className="text-xs font-bold" style={{ color: "#FA6F30" }}>+ Upload License</button>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(30,37,53,0.07)" }}>
              {licenses.map((l, i) => {
                const isExpiredOrRejected = l.status === "expired" || l.status === "rejected";
                const statusStyles = {
                  verified: { color: "#4a6b10", label: "verified" },
                  pending_review: { color: "#FA6F30", label: "pending" },
                  rejected: { color: "#DA6A63", label: "rejected" },
                  expired: { color: "rgba(30,37,53,0.4)", label: "expired" },
                };
                const st = statusStyles[l.status] || statusStyles.pending_review;
                return (
                  <div key={l.id} className="flex items-center gap-4 px-5 py-4"
                    style={{ borderLeft: isExpiredOrRejected ? "2px solid #DA6A63" : l.status === "verified" ? "2px solid rgba(200,230,60,0.5)" : "2px solid rgba(250,111,48,0.35)", borderBottom: i < licenses.length - 1 ? "1px solid rgba(30,37,53,0.06)" : "none" }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3">
                        <p className="font-semibold text-sm" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>{l.license_type} — {l.license_number}</p>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: st.color }}>{st.label}</span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.4)" }}>{l.issuing_state}{l.expiration_date ? ` · Expires ${format(new Date(l.expiration_date), "MMM d, yyyy")}` : ""}</p>
                      {l.rejection_reason && <p className="text-xs mt-0.5" style={{ color: "#DA6A63" }}>Rejected: {l.rejection_reason}</p>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {l.document_url && <a href={l.document_url} target="_blank" rel="noreferrer" className="text-xs font-semibold hover:underline" style={{ color: "rgba(30,37,53,0.4)" }}>View</a>}
                      {isExpiredOrRejected && (
                        <button className="text-xs font-bold" style={{ color: "#FA6F30" }}
                          onClick={() => { setLicenseForm({ license_type: l.license_type, issuing_state: l.issuing_state }); setLicenseOpen(true); }}>
                          {l.status === "expired" ? "Renew" : "Resubmit"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setLicenseOpen(true)} className="w-full py-3 text-xs font-semibold text-center transition-all hover:bg-white/60"
                style={{ color: "rgba(30,37,53,0.4)", borderTop: "1px dashed rgba(30,37,53,0.1)" }}>
                + Add Another License
              </button>
            </div>
          )}

          {/* Certifications */}
          <div className="space-y-4">
            <div className="flex items-baseline justify-between mb-4">
              <div style={{ borderLeft: "2px solid rgba(30,37,53,0.15)", paddingLeft: 12 }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.18em" }}>Your Certifications</p>
              </div>
              <button onClick={() => { setCertSubmitOpen(true); resetExtCertForm(); }}
                className="text-xs font-bold transition-all hover:opacity-70"
                style={{ color: "#FA6F30" }}>+ Submit External Cert</button>
            </div>
            {/* cert list rendered inline */}
            {myCerts.length === 0 ? (
              <div className="py-10 text-center rounded-2xl" style={{ background: "rgba(255,255,255,0.5)", border: "1px dashed rgba(30,37,53,0.12)" }}>
                <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>No certifications yet</p>
                <p className="text-xs mt-1 mb-4" style={{ color: "rgba(30,37,53,0.4)" }}>Complete a NOVI course, or submit an existing cert for review.</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(30,37,53,0.07)" }}>
                {[...activeCerts, ...pendingCerts, ...otherCerts].map((c, i, arr) => {
                  const cfg = {
                    active: { color: "#4a6b10", label: "active", accent: "rgba(200,230,60,0.5)" },
                    pending: { color: "#FA6F30", label: "under review", accent: "rgba(250,111,48,0.35)" },
                    expired: { color: "rgba(30,37,53,0.35)", label: "expired", accent: "rgba(30,37,53,0.15)" },
                    revoked: { color: "#DA6A63", label: "revoked", accent: "#DA6A63" },
                  }[c.status] || { color: "#FA6F30", label: c.status, accent: "rgba(250,111,48,0.35)" };
                  return (
                    <div key={c.id} className="flex items-center gap-4 px-5 py-4"
                      style={{ borderLeft: `2px solid ${cfg.accent}`, borderBottom: i < arr.length - 1 ? "1px solid rgba(30,37,53,0.06)" : "none", opacity: c.status === "expired" || c.status === "revoked" ? 0.55 : 1 }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-3">
                          <p className="font-semibold text-sm" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>{c.certification_name}</p>
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</span>
                        </div>
                        {c.service_type_name && <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{c.service_type_name}</p>}
                        {c.issued_by && <p className="text-xs" style={{ color: "rgba(30,37,53,0.35)" }}>Issued by {c.issued_by}</p>}
                      </div>
                      {c.certificate_url && (
                        <a href={c.certificate_url} target="_blank" rel="noreferrer" className="text-xs font-semibold hover:underline flex-shrink-0" style={{ color: "rgba(30,37,53,0.4)" }}>View</a>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => { setCertSubmitOpen(true); resetExtCertForm(); }} className="w-full py-3 text-xs font-semibold text-center transition-all hover:bg-white/60"
                  style={{ color: "rgba(30,37,53,0.4)", borderTop: "1px dashed rgba(30,37,53,0.1)" }}>
                  + Submit Another External Cert
                </button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="coverage" className="pt-6 space-y-6">

          {supervisingMdCoverage && (
            <SupervisingMdCoveragePanel
              coverage={supervisingMdCoverage}
              hasActiveMdCoverage={activeSubscriptions.length > 0}
            />
          )}

          {/* MD Assignment — editorial strip */}
          {activeRelationships.length > 0 ? (
            <div className="flex items-baseline gap-4 px-5 py-3 rounded-xl" style={{ borderLeft: "2px solid rgba(200,230,60,0.5)", background: "rgba(255,255,255,0.55)" }}>
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Board MD</p>
              <p className="text-sm" style={{ color: "#4a6b10", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>{activeRelationships[0].medical_director_name}</p>
              <p className="text-xs ml-auto flex-shrink-0" style={{ color: "rgba(30,37,53,0.4)" }}>supervising {activeSubscriptions.length} service{activeSubscriptions.length !== 1 ? "s" : ""}</p>
            </div>
          ) : pendingRelationships.length > 0 ? (
            <div className="flex items-baseline gap-3 px-5 py-3 rounded-xl" style={{ borderLeft: "2px solid rgba(250,111,48,0.4)", background: "rgba(255,255,255,0.55)" }}>
              <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>MD assignment in progress — typically 1–2 business days.</p>
            </div>
          ) : null}

          {/* ── Active Services ── */}
          {activeSubscriptions.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between mb-4">
                <div style={{ borderLeft: "2px solid rgba(30,37,53,0.15)", paddingLeft: 12 }}>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.18em" }}>Active MD Coverage</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>Monthly total: <strong style={{ color: "#1e2535" }}>${calcMonthlyTotal(activeSubscriptions.length)}/mo</strong>{activeSubscriptions.length >= MAX_SERVICES ? " (capped)" : ""}</p>
                </div>
                {!isAtCap && (
                  <button onClick={() => openApplyForCoverage()}
                    className="text-xs font-bold transition-all hover:opacity-70" style={{ color: "#FA6F30" }}>+ Add Service</button>
                )}
              </div>
              {isAtCap && (
                <div className="rounded-xl px-4 py-3" style={{ background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.22)" }}>
                  <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Maximum MD coverage reached</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.6)" }}>
                    You have {MAX_SERVICES} active services (${formatMdCoverageUsd(MAX_MONTHLY_CAP)}/mo total, capped). No additional $129 add-ons are available — cancel a service to switch coverage.
                  </p>
                </div>
              )}
              {activeSubscriptions.map((sub, idx) => {
                const st = findServiceTypeForSubscription(sub, serviceTypes);
                const isExp = expandedService === sub.id;
                return (
                  <GlassCard key={sub.id}>
                    <button className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all" onClick={() => setExpandedService(isExp ? null : sub.id)}
                      style={{ borderLeft: "2px solid rgba(200,230,60,0.5)" }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-3">
                          <p className="font-semibold text-sm" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>{sub.service_type_name}</p>
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: String(sub.status).toLowerCase() === "suspended" ? "#FA6F30" : "#4a6b10" }}>{String(sub.status).toLowerCase() === "suspended" ? "Payment issue" : "Active"}</span>
                        </div>
                        <p className="text-xs mt-0.5 capitalize" style={{ color: "rgba(30,37,53,0.4)" }}>{st?.category?.replace("_", " ")}{sub.activated_at ? ` · Since ${format(new Date(sub.activated_at), "MMM d, yyyy")}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <p className="text-sm font-bold" style={{ color: "#1e2535" }}>${Number(sub.service_type_monthly_fee ?? (idx === 0 ? FIRST_SERVICE_PRICE : ADDON_SERVICE_PRICE))}<span className="text-xs font-normal" style={{ color: "rgba(30,37,53,0.35)" }}>/mo</span></p>
                        {isExp ? <ChevronUp className="w-3.5 h-3.5" style={{ color: "rgba(30,37,53,0.3)" }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: "rgba(30,37,53,0.3)" }} />}
                      </div>
                    </button>
                    {isExp && st && (() => {
                      const includedServices = servicesUnlockedForSubscription(sub, st, serviceTypes);
                      const serviceWiseDocs = buildServiceWiseDocumentBundles(sub, serviceTypes, {
                        globalContractUrl: globalMdContractUrl,
                      });
                      const activatedDate = sub.activated_at ? new Date(sub.activated_at) : null;
                      const monthlyAmount = Number(sub.service_type_monthly_fee ?? (idx === 0 ? FIRST_SERVICE_PRICE : ADDON_SERVICE_PRICE));
                      const checkoutPaid = sub.checkout_amount_paid != null ? Number(sub.checkout_amount_paid) : null;
                      const lastPaid = sub.last_amount_paid != null ? Number(sub.last_amount_paid) : null;
                      const lastPaidAt = sub.last_amount_paid_at ? new Date(sub.last_amount_paid_at) : null;
                      const today = new Date();
                      const nextBilling = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                      return (
                        <div className="border-t" style={{ borderColor: "rgba(30,37,53,0.08)" }}>
                          <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ background: "rgba(123,142,200,0.05)", borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
                            <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: "rgba(30,37,53,0.55)" }}>
                              <span><strong style={{ color: "#1e2535" }}>${formatMdCoverageUsd(monthlyAmount)}/mo</strong> · billed 1st</span>
                              {activatedDate && <span>Active since {format(activatedDate, "MMM d, yyyy")}</span>}
                              <span>Next: {format(nextBilling, "MMM 1, yyyy")}</span>
                              {checkoutPaid != null && Number.isFinite(checkoutPaid) && (
                                <span>First charge: ${formatMdCoverageUsd(checkoutPaid)}</span>
                              )}
                              {lastPaid != null && Number.isFinite(lastPaid) && lastPaidAt && (
                                <span>Last paid: ${formatMdCoverageUsd(lastPaid)} · {format(lastPaidAt, "MMM d, yyyy")}</span>
                              )}
                            </div>
                            <button onClick={e => { e.stopPropagation(); openCancelDialog(sub); }} className="text-xs font-semibold hover:opacity-70" style={{ color: "#DA6A63" }}>Cancel</button>
                          </div>

                          <div className="px-5 py-4 space-y-3">
                            {includedServices.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(30,37,53,0.4)" }}>
                                  Services included ({includedServices.length})
                                </p>
                                <div className="space-y-2">
                                  {includedServices.map((svc) => {
                                    const svcAttestation = evaluateServiceAttestation(svc, attestationContext, serviceTypes);
                                    return (
                                      <div key={svc.id} className="rounded-xl px-3 py-2.5 space-y-2" style={{ background: "rgba(30,37,53,0.03)", border: "1px solid rgba(30,37,53,0.07)" }}>
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="text-sm font-bold" style={{ color: "#1e2535" }}>{serviceDisplayName(svc, serviceTypes)}</p>
                                          <ServiceAttestationStatus evaluation={svcAttestation} compact />
                                        </div>
                                        {svc.description && <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>{svc.description}</p>}
                                        {svc.allowed_areas?.length > 0 && (
                                          <p className="text-xs font-medium" style={{ color: "#2D6B7F" }}>{svc.allowed_areas.join(", ")}</p>
                                        )}
                                        {!svcAttestation.complete && (
                                          <ServiceAttestationStatus
                                            evaluation={svcAttestation}
                                            onSubmitCert={openSubmitCertForService}
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {serviceWiseDocs.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(30,37,53,0.4)" }}>
                                  Service documents
                                </p>
                                <ServiceWiseDocumentsBlock bundles={serviceWiseDocs} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </GlassCard>
                );
              })}
            </div>
          ) : (
            /* No active coverage — CTA */
            <GlassCard className="py-12 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(250,111,48,0.1)" }}>
                <Shield className="w-7 h-7" style={{ color: "#FA6F30" }} />
              </div>
              <p className="font-bold text-lg" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>No MD Coverage Yet</p>
              <p className="text-sm mt-2 mb-5" style={{ color: "rgba(30,37,53,0.55)", maxWidth: 340, margin: "8px auto 20px" }}>
                Apply for NOVI Board of Medical Directors coverage to legally practice. We'll assign you a Board MD — you don't need to find one yourself.
              </p>
              <Button onClick={() => openApplyForCoverage()} style={{ background: "#FA6F30", color: "#fff" }} className="gap-2 font-bold">
                <Zap className="w-4 h-4" /> Apply for Coverage
              </Button>
            </GlassCard>
          )}

          {/* ── Add More Services (only non-active services) ── */}
          {!isAtCap && mdCoveragePlans.filter(s => !alreadyActiveServices.includes(s.id)).length > 0 && (
            <div className="space-y-3">
              <SectionLabel>{activeSubscriptions.length === 0 ? "Available Coverage Plans" : "Add More Services"}</SectionLabel>
              {mdCoveragePlans.filter(s => !alreadyActiveServices.includes(s.id)).map(service => {
                const attestationSummary = membershipAttestationSummary(service, serviceTypes, attestationContext);
                const isEligible = attestationSummary.complete;
                const includedServices = servicesInMembership(service, serviceTypes);
                const hasIncludedServices = includedServices.length > 0;
                const isExpanded = expandedServiceCard === service.id;
                const price = activeSubscriptions.length === 0 ? FIRST_SERVICE_PRICE : ADDON_SERVICE_PRICE;
                return (
                  <GlassCard key={service.id}>
                    <div className="px-5 py-4 flex items-start gap-4">
                      {/* Left: icon */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: isEligible ? "rgba(200,230,60,0.12)" : "rgba(123,142,200,0.1)" }}>
                        <Shield className="w-5 h-5" style={{ color: isEligible ? "#5a7a20" : "#7B8EC8" }} />
                      </div>
                      {/* Middle: info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <h4 className="font-bold text-base" style={{ color: "#1e2535" }}>{service.name}</h4>
                        </div>
                        <p className="text-xs capitalize mb-2" style={{ color: "rgba(30,37,53,0.5)" }}>
                          {service.category?.replace("_", " ")}
                          {hasIncludedServices ? ` · ${includedServices.length} service${includedServices.length !== 1 ? "s" : ""} included` : ""}
                        </p>
                        {/* Status + CTA */}
                        {isEligible ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(200,230,60,0.15)", color: "#5a7a20", border: "1px solid rgba(200,230,60,0.35)" }}>✓ Training Complete — Ready to Apply</span>
                            <Button size="sm" className="font-bold gap-1.5 h-8" style={{ background: "#FA6F30", color: "#fff" }}
                              onClick={() => openApplyForCoverage({ serviceTypeId: service.id, jumpToSign: false })}>
                              <Zap className="w-3.5 h-3.5" /> Apply for Coverage
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>
                              Complete attestation for all included services before applying:
                            </p>
                            <div className="space-y-2">
                              {attestationSummary.services.map((row) => (
                                <div key={row.serviceTypeId}>
                                  <p className="text-xs font-semibold mb-1" style={{ color: "#1e2535" }}>{row.serviceName}</p>
                                  <ServiceAttestationStatus
                                    evaluation={row}
                                    onSubmitCert={openSubmitCertForService}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Right: price */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold" style={{ color: "#1e2535" }}>${price}<span className="text-xs font-normal" style={{ color: "rgba(30,37,53,0.4)" }}>/mo</span></p>
                        {activeSubscriptions.length > 0 && <p className="text-xs font-semibold" style={{ color: "#5a7a20" }}>add-on</p>}
                      </div>
                    </div>
                    {hasIncludedServices && (
                      <div style={{ borderTop: "1px solid rgba(30,37,53,0.07)" }}>
                        <button
                          onClick={() => setExpandedServiceCard(isExpanded ? null : service.id)}
                          className="w-full px-5 py-2.5 flex items-center justify-between text-xs font-semibold"
                          style={{ color: "rgba(30,37,53,0.5)" }}
                        >
                          <span>{includedServices.length} Service{includedServices.length !== 1 ? "s" : ""} Included</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        {isExpanded && (
                          <div className="px-5 pb-4 space-y-2">
                            {includedServices.map((svc) => {
                              const svcAttestation = evaluateServiceAttestation(svc, attestationContext, serviceTypes);
                              return (
                                <div key={svc.id} className="rounded-xl px-3 py-2.5 space-y-2" style={{ background: "rgba(30,37,53,0.03)", border: "1px solid rgba(30,37,53,0.07)" }}>
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{serviceDisplayName(svc, serviceTypes)}</p>
                                    <ServiceAttestationStatus evaluation={svcAttestation} compact />
                                  </div>
                                  {svc.allowed_areas?.length > 0 && (
                                    <p className="text-xs font-medium" style={{ color: "#2D6B7F" }}>{svc.allowed_areas.join(", ")}</p>
                                  )}
                                  {!svcAttestation.complete && (
                                    <ServiceAttestationStatus
                                      evaluation={svcAttestation}
                                      onSubmitCert={openSubmitCertForService}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── DOCUMENTS TAB ── */}
        <TabsContent value="documents" className="pt-6 space-y-6">

          {/* MD Board Agreements */}
          <GlassCard>
            <div className="px-6 pt-5 pb-3" style={{ borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
              <div style={{ borderLeft: "2px solid rgba(30,37,53,0.15)", paddingLeft: 12 }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.18em" }}>MD Board Agreements</p>
              </div>
            </div>
            <div className="px-6 py-5">
              {documentSubscriptions.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>No MD agreements yet</p>
                  <p className="text-xs mt-1 mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>After you sign MD coverage for a service, your agreement and protocol documents appear here.</p>
                  <button onClick={() => openApplyForCoverage()} className="text-xs font-bold" style={{ color: "#FA6F30" }}>Apply for Coverage</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {documentSubscriptions.map((sub) => {
                    const st = findServiceTypeForSubscription(sub, serviceTypes);
                    const contractMeta = {
                      ...(st || {}),
                      name: st?.name || sub.service_type_name,
                      md_contract_url: sub.md_contract_url || st?.md_contract_url || globalMdContractUrl,
                      md_agreement_text: st?.md_agreement_text || sub.md_agreement_text,
                    };
                    const agreementText = contractMeta.md_agreement_text || sub.md_agreement_text;
                    const signedPdfUrl = isUsableDocumentUrl(sub.signed_contract_url)
                      ? sub.signed_contract_url
                      : null;
                    const contractLabel = getMdContractDisplayName(contractMeta);
                    const serviceWiseDocs = buildServiceWiseDocumentBundles(sub, serviceTypes, {
                      globalContractUrl: globalMdContractUrl,
                    });
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
                          {agreementText && (
                            <div
                              className="rounded-lg px-3 py-2 text-xs leading-relaxed"
                              style={{
                                background: "rgba(30,37,53,0.03)",
                                color: "rgba(30,37,53,0.65)",
                                border: "1px solid rgba(30,37,53,0.06)",
                                maxHeight: 72,
                                overflow: "hidden",
                              }}
                            >
                              {agreementText}
                            </div>
                          )}
                          {signedPdfUrl && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(30,37,53,0.45)" }}>
                                Signed membership agreement
                              </p>
                              <button
                                type="button"
                                onClick={() => downloadSignedMdContract(sub, contractMeta)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-95"
                                style={{ background: "rgba(123,142,200,0.12)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.25)" }}
                              >
                                <FileText className="w-3 h-3" />
                                {contractLabel} — signed by {sub.signed_by_name || "you"}
                              </button>
                            </div>
                          )}
                          {serviceWiseDocs.length > 0 ? (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(30,37,53,0.45)" }}>
                                Documents by service
                              </p>
                              <ServiceWiseDocumentsBlock bundles={serviceWiseDocs} />
                            </div>
                          ) : null}
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
            <div className="px-6 pt-5 pb-3" style={{ borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
              <div style={{ borderLeft: "2px solid rgba(30,37,53,0.15)", paddingLeft: 12 }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.18em" }}>Certification Documents</p>
              </div>
            </div>
            <div className="px-6 py-5">
              {activeCerts.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>No certification documents yet</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderTop: "1px solid rgba(30,37,53,0.06)", borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
                  {activeCerts.map(c => {
                    const canViewCertificate = hasCertificateDocument(c);
                    return (
                    <div key={c.id} className="py-3 flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>{c.certification_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.4)" }}>{c.service_type_name && `${c.service_type_name} · `}{c.issued_by && `Issued by ${c.issued_by}`}{c.issued_at && ` · ${format(new Date(c.issued_at), "MMM d, yyyy")}`}</p>
                      </div>
                      {canViewCertificate ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button type="button" onClick={() => openCertificateDocument(c)} className="text-xs font-semibold hover:underline" style={{ color: "rgba(30,37,53,0.4)" }}>View</button>
                          <button type="button" onClick={() => downloadCertificateDocument(c, `${c.certification_name || "certificate"}.pdf`)} className="text-xs font-semibold hover:underline" style={{ color: "rgba(30,37,53,0.4)" }}>PDF</button>
                        </div>
                      ) : (
                        <span className="text-xs flex-shrink-0" style={{ color: "rgba(30,37,53,0.25)" }}>No file</span>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </GlassCard>

          {/* License Documents */}
          <GlassCard>
            <div className="px-6 pt-5 pb-3" style={{ borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
              <div style={{ borderLeft: "2px solid rgba(30,37,53,0.15)", paddingLeft: 12 }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.35)", letterSpacing: "0.18em" }}>License Documents</p>
              </div>
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
      <Dialog open={licenseOpen} onOpenChange={(open) => {
        setLicenseOpen(open);
        if (!open) { setLicenseExpiryError(""); setLicenseDocumentError(""); }
      }}>
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
                <Input
                  type="date"
                  value={licenseForm.expiration_date || ""}
                  onChange={e => {
                    const nextExpirationDate = e.target.value;
                    setLicenseForm({ ...licenseForm, expiration_date: nextExpirationDate });
                    setLicenseExpiryError(isExpiredLicenseDate(nextExpirationDate) ? "Your license has already expired" : "");
                  }}
                />
                {licenseExpiryError && <p className="text-xs text-red-500 mt-1">{licenseExpiryError}</p>}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                License Document *
              </Label>
              <label className={`flex items-center gap-2 cursor-pointer border-2 border-dashed rounded-xl p-4 hover:bg-slate-50 transition-colors ${licenseDocumentError ? "border-red-400 bg-red-50" : licenseForm.document_url ? "border-green-400 bg-green-50" : ""}`}>
                <Upload className={`w-4 h-4 ${licenseDocumentError ? "text-red-400" : "text-slate-400"}`} />
                <span className={`text-sm ${licenseDocumentError ? "text-red-500" : licenseForm.document_url ? "text-green-700" : "text-slate-500"}`}>
                  {uploading ? "Uploading..." : licenseForm.document_url ? "Document uploaded ✓" : "Upload document (PDF, JPG, PNG)"}
                </span>
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { setLicenseDocumentError(""); uploadLicenseFile(e); }} />
              </label>
              {licenseDocumentError && <p className="text-xs text-red-500 mt-1">{licenseDocumentError}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setLicenseOpen(false)}>Cancel</Button>
              <Button
                style={{ background: "#FA6F30", color: "#fff" }}
                onClick={handleSubmitLicense}
                disabled={!licenseForm.license_number || !licenseForm.document_url || createLicense.isPending || uploading || isExpiredLicenseDate(licenseForm.expiration_date)}
              >
                {createLicense.isPending ? "Submitting..." : "Submit License"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply for Coverage */}
      <Dialog open={activateDialog} onOpenChange={(v) => { if (!v) resetActivation(); setActivateDialog(v); }}>
        <DialogContent className={`${step === 2 ? "max-w-2xl" : "max-w-xl"} w-[calc(100vw-2rem)] max-h-[92vh] overflow-y-auto overflow-x-hidden`}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>Apply for MD Board Coverage</DialogTitle>
          </DialogHeader>

          {isAtCap ? (
            <div className="space-y-4 pt-1">
              <div className="rounded-xl px-4 py-4" style={{ background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.22)" }}>
                <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Cannot add another service</p>
                <p className="text-sm mt-2" style={{ color: "rgba(30,37,53,0.65)" }}>{mdCoverageCapErrorMessage()}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { resetActivation(); setActivateDialog(false); }}>
                Close
              </Button>
            </div>
          ) : (
          <>
          {/* ── Step -1: Info / intro screen ── */}
          {step === -1 && (
            <div className="space-y-4 pt-1">
              {/* Current status */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(123,142,200,0.07)", border: "1px solid rgba(123,142,200,0.2)" }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7B8EC8" }}>Your Current Status</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "License", ok: verifiedLicenses.length > 0, value: verifiedLicenses.length > 0 ? "Verified ✓" : pendingLicenses.length > 0 ? "Pending review" : "Not uploaded" },
                    { label: "Certification", ok: activeCerts.length > 0, value: activeCerts.length > 0 ? `${activeCerts.length} active` : pendingCerts.length > 0 ? "Under review" : "None yet" },
                    { label: "MD Coverage", ok: activeSubscriptions.length > 0, value: activeSubscriptions.length > 0 ? `${activeSubscriptions.length} active` : "Not applied" },
                  ].map(({ label, ok, value }) => (
                    <div key={label} className="rounded-lg px-3 py-3 text-center" style={{
                      background: ok ? "rgba(90,122,0,0.08)" : "rgba(0,0,0,0.04)",
                      border: `1px solid ${ok ? "rgba(90,122,0,0.2)" : "rgba(0,0,0,0.1)"}`,
                    }}>
                      <p className="text-xs font-semibold" style={{ color: ok ? "#4a6b00" : "rgba(0,0,0,0.45)" }}>{label}</p>
                      <p className="text-xs mt-1 font-bold" style={{ color: ok ? "#2d4200" : "rgba(0,0,0,0.6)" }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* What is MD Coverage */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(250,111,48,0.06)", border: "1px solid rgba(250,111,48,0.18)" }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#FA6F30" }}>What is MD Board Coverage?</p>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(0,0,0,0.72)" }}>
                  NOVI maintains a Board of Medical Directors — licensed physicians who provide clinical oversight and legal supervision. When approved, NOVI assigns you a Board MD who signs your protocols. <strong>You don't find an MD yourself — we handle it.</strong>
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {[
                    { icon: Shield, text: "Board MD auto-assigned to you" },
                    { icon: FileText, text: "Signed protocol documents included" },
                    { icon: ShieldCheck, text: "State compliance coverage" },
                    { icon: DollarSign, text: `$${FIRST_SERVICE_PRICE}/mo base · $${ADDON_SERVICE_PRICE}/mo per add-on · $${MAX_MONTHLY_CAP} cap` },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm" style={{ color: "rgba(0,0,0,0.68)" }}>
                      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#FA6F30" }} />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Two paths */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: "rgba(0,0,0,0.45)" }}>Two Paths to Coverage</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-4 space-y-2.5" style={{ background: "rgba(200,230,60,0.07)", border: "1px solid rgba(90,122,0,0.18)" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(200,230,60,0.18)" }}>
                      <KeyRound className="w-4 h-4" style={{ color: "#5a7a20" }} />
                    </div>
                    <p className="font-bold text-sm" style={{ color: "#1e2535" }}>NOVI Class Code</p>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(0,0,0,0.58)" }}>
                      Attended a NOVI course? Enter the class code from your instructor to instantly verify your training.
                    </p>
                    <div className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block" style={{ background: "rgba(200,230,60,0.22)", color: "#4a6b00" }}>Fastest path</div>
                  </div>
                  <div className="rounded-xl p-4 space-y-2.5" style={{ background: "rgba(123,142,200,0.07)", border: "1px solid rgba(123,142,200,0.22)" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(123,142,200,0.18)" }}>
                      <Award className="w-4 h-4" style={{ color: "#5a6eaa" }} />
                    </div>
                    <p className="font-bold text-sm" style={{ color: "#1e2535" }}>External Certification</p>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(0,0,0,0.58)" }}>
                      Certified elsewhere? Submit your certificate for review. Our team verifies and approves within 1–3 business days.
                    </p>
                    <div className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block" style={{ background: "rgba(123,142,200,0.15)", color: "#5a6eaa" }}>1–3 day review</div>
                  </div>
                </div>
              </div>

              {/* Requirement check */}
              {verifiedLicenses.length === 0 && (
                <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "rgba(218,106,99,0.08)", border: "1px solid rgba(218,106,99,0.25)" }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#c0544e" }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#c0544e" }}>License verification required first</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(0,0,0,0.58)" }}>You need a verified professional license before applying for MD coverage. Go to the Licenses tab to upload yours.</p>
                  </div>
                </div>
              )}

              <Button
                onClick={() => setStep(0)}
                disabled={verifiedLicenses.length === 0}
                className="w-full font-bold py-5"
                style={{ background: verifiedLicenses.length > 0 ? "#FA6F30" : "rgba(0,0,0,0.08)", color: verifiedLicenses.length > 0 ? "#fff" : "rgba(0,0,0,0.3)" }}
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
                              Your time: {formatProviderWindowRange(window)}
                              <br />
                              Class schedule (US Eastern): {window.startLabelAdmin} – {window.endLabelAdmin}
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
                        {certSubmissionServices.length === 0 ? (
                          <p className="text-xs text-slate-500 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50">
                            No services need certificate submission right now.
                          </p>
                        ) : certSubmissionServices.map(s => (
                          <button key={s.id} onClick={() => setCertForm(f => ({ ...f, service_type_id: s.id, service_type_name: serviceDisplayName(s, serviceTypes) }))} className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${certForm.service_type_id === s.id ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:border-slate-300"}`}>
                            <p className="text-sm font-medium text-slate-900">{serviceDisplayName(s, serviceTypes)}</p>
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
                  <Button onClick={() => submitExternalCertMutation.mutate()} disabled={!certForm.cert_name || !certForm.issuing_school || !isUsableUploadedUrl(certFileUrl) || !certForm.service_type_id || certSubmissionServices.length === 0 || submitExternalCertMutation.isPending} className="w-full" style={{ background: "#FA6F30", color: "#fff" }}>
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
                      ? "Code verified. Finish any remaining attestation steps for included services before applying."
                      : "Complete required training and certification for each included service in a membership plan."}
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
                      <div className="text-right"><span className="font-bold text-slate-900">${formatMdCoverageUsd(getMembershipPrice())}</span><span className="text-xs text-slate-400">/mo</span></div>
                      {selectedServiceTypeId === s.id && <CheckCircle className="w-5 h-5 text-orange-500" />}
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={() => setStep(2)} disabled={!selectedServiceTypeId} className="w-full" style={{ background: "#FA6F30", color: "#fff" }}>Continue to Sign Agreement</Button>
            </div>
          )}

          {step === 2 && (() => {
            const billing = buildMdCoverageCheckoutBillingPreview({
              activeServiceCountBeforeAdd: alreadyActiveServices.length,
              providerId: me?.id,
              providerEmail: me?.email,
            });
            const { proration } = billing;
            const showPaidCheckout = billing.thisServiceMonthly > 0;
            return (
            <div className="space-y-4 min-w-0">
              <div className="rounded-xl border-2 border-orange-200 p-4 flex items-center justify-between gap-3 bg-orange-50">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{selectedService?.name} — MD Board Coverage</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {billing.isFirstService ? "First service" : "Add-on service"} · NOVI assigns a Board MD automatically
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-bold text-slate-900">${formatMdCoverageUsd(billing.thisServiceMonthly)}</p>
                  <p className="text-xs text-slate-400">/month from next cycle</p>
                </div>
              </div>

              {showPaidCheckout && (
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-slate-500" />
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Billing summary</p>
                  </div>
                  <div className="px-4 py-3 space-y-2.5 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-600">
                        This service (monthly)
                        <span className="block text-xs text-slate-400 mt-0.5 line-clamp-2">
                          {selectedService?.name}
                          {billing.isFirstService ? " · first membership" : " · add-on"}
                        </span>
                      </span>
                      <span className="font-semibold text-slate-900 whitespace-nowrap">
                        ${formatMdCoverageUsd(billing.thisServiceMonthly)}/mo
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-600">
                        New total monthly charge
                        <span className="block text-xs text-slate-400 mt-0.5">
                          From {format(proration.nextBillingDate, "MMMM d, yyyy")} · {billing.totalBreakdownLabel}
                        </span>
                      </span>
                      <span
                        className="font-bold whitespace-nowrap"
                        style={{ color: billing.hitsCap ? "#FA6F30" : "#1e2535" }}
                      >
                        ${formatMdCoverageUsd(billing.newTotalMonthlyFromNextCycle)}/mo
                        {billing.hitsCap ? " (capped)" : ""}
                      </span>
                    </div>
                    <div className="border-t border-slate-100 pt-2.5 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">Due today (prorated)</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {format(proration.periodStart, "MMM d")} – {format(proration.periodEnd, "MMM d, yyyy")}
                          {" "}({proration.daysRemaining} day{proration.daysRemaining === 1 ? "" : "s"} in {proration.currentMonthLabel})
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Only this service · ${formatMdCoverageUsd(billing.thisServiceMonthly)} ÷ {proration.daysInMonth} × {proration.daysRemaining}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-slate-900 whitespace-nowrap">
                        ${formatMdCoverageUsd(billing.dueTodayProrated)}
                      </span>
                    </div>
                  </div>
                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs text-slate-500">
                      You pay <strong className="text-slate-700">${formatMdCoverageUsd(billing.dueTodayProrated)}</strong> today for this service through the end of {proration.currentMonthLabel}.
                      {" "}Starting <strong className="text-slate-700">{format(proration.nextBillingDate, "MMMM d, yyyy")}</strong>, this service bills{" "}
                      <strong className="text-slate-700">${formatMdCoverageUsd(billing.thisServiceMonthly)}/mo</strong> on the 1st
                      {billing.newActiveCount > 1
                        ? ` and your combined active MD coverage total is $${formatMdCoverageUsd(billing.newTotalMonthlyFromNextCycle)}/mo.`
                        : "."}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white min-w-0">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Review agreement</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {filledContractLoading
                        ? "Personalizing the agreement with your details…"
                        : `Read the MD Board agreement for ${selectedService?.name || "this service"}.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openFullAgreementPdf}
                    disabled={openingFullPdf || filledContractLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 whitespace-nowrap disabled:opacity-60"
                    style={{ background: "rgba(123,142,200,0.12)", color: "#5a6fa8", border: "1px solid rgba(123,142,200,0.25)" }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> {openingFullPdf ? "Preparing…" : "Open full PDF"}
                  </button>
                </div>
                <div
                  className="px-4 py-4 bg-white overflow-y-auto overflow-x-hidden min-w-0"
                  style={{ maxHeight: "min(46vh, 400px)" }}
                >
                  <MdAgreementDocument
                    context={{
                      ...agreementFields,
                      serviceName: selectedService?.name || "",
                      effectiveDate: new Date(),
                    }}
                    providerSignatureUrl={providerSigPreview}
                  />
                </div>
                <div className="px-4 py-4 border-t border-slate-200 bg-white">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Your signature</p>
                  <p className="text-xs text-slate-500 mb-3">
                    Sign as the Manager. Your signature is placed in the Manager block (left) on the signature page above; Dr. James Otis Hill, II is the Practice Owner (right).
                  </p>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white relative w-full">
                    <canvas ref={canvasRef} className="block w-full touch-none cursor-crosshair"
                      style={{ height: 120 }}
                      onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                      onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
                    {!hasSigned && <p className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm pointer-events-none">Sign here</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearSignature} className="mt-1 text-slate-400 px-0"><RotateCcw className="w-3.5 h-3.5 mr-1" /> Clear signature</Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                Signing as <strong className="mx-1">{me?.full_name}</strong> · {format(new Date(), "MMMM d, yyyy")}
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 space-y-1.5">
                <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  What happens next
                </p>
                <ol className="text-[11px] text-slate-600 space-y-1 list-decimal list-inside leading-snug">
                  <li>We start your recurring monthly MD Board coverage (Stripe may open for payment when applicable).</li>
                  <li>When checkout completes, your coverage subscription is set to active and a signed contract PDF is saved to your Documents tab.</li>
                  <li>NOVI assigns exactly one Board Medical Director for this service using supported-service matching and sequential round-robin. You do not pick a doctor.</li>
                  <li>NOVI assigns a Board Medical Director and supervision becomes <strong>active automatically</strong>. You and your MD receive a confirmation notification.</li>
                </ol>
              </div>
              {(activateError || activateMutation.isError || activateMutation.error) && (
                <p className="text-xs text-red-600 whitespace-pre-wrap">
                  {activateError || activateMutation.error?.message || "Could not start checkout. Check your connection or try again."}
                </p>
              )}
              <Button
                onClick={() => {
                  activateMutation.reset();
                  activateMutation.mutate();
                }}
                disabled={!hasSigned || activateMutation.isPending}
                className="w-full"
                style={{ background: "#2d3d66", color: "white" }}
              >
                {activateMutation.isPending ? "Activating..." : "Sign & Activate MD Board Coverage"}
              </Button>
            </div>
            );
          })()}
          </>
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
                  "Monthly billing stops — you will not be charged again next month for this membership",
                  "NOVI admin team is notified of your cancellation",
                  "All manufacturers you applied to are notified you can no longer order product under NOVI oversight",
                  "Your certifications and licenses remain on file",
                  "You can reapply anytime — first membership is $279/mo, each additional is $129/mo",
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
                Monthly billing for this membership has been stopped. NOVI admin and any applicable manufacturers have been notified.
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
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Certificate number (optional)</label>
                  <Input
                    value={extCertForm.certificate_number}
                    onChange={e => setExtCertForm(f => ({ ...f, certificate_number: e.target.value }))}
                    placeholder="If your credential already has a number, enter it. Otherwise NOVI assigns NOVI-EXT-… when approved."
                  />
                </div>
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
              {(!isUsableUploadedUrl(extCertFileUrl) || !isUsableUploadedUrl(extLicenseFileUrl)) && !uploadExtCertError && !uploadExtLicenseError && (
                <p className="text-xs text-slate-500">Upload both certification and license files to continue.</p>
              )}
              <Button onClick={() => { setSubmitExtCertError(""); setCertSubmitStep(1); }} disabled={!extCertForm.cert_name || !extCertForm.issuing_school || !isUsableUploadedUrl(extCertFileUrl) || !isUsableUploadedUrl(extLicenseFileUrl)} className="w-full" style={{ background: "#FA6F30", color: "#fff" }}>
                Continue — Select Service <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
          {certSubmitStep === 1 && (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-slate-500">Which service are you applying to provide on NOVI?</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {certSubmissionServices.length === 0 ? (
                  <p className="text-sm text-slate-500 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50">
                    No services need certificate submission right now.
                  </p>
                ) : certSubmissionServices.map(s => (
                  <button key={s.id} onClick={() => { setSubmitExtCertError(""); setExtCertForm(f => ({ ...f, service_type_id: s.id, service_type_name: serviceDisplayName(s, serviceTypes) })); }} className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between ${extCertForm.service_type_id === s.id ? "border-orange-400 bg-orange-50" : "border-slate-100 hover:border-slate-300"}`}>
                    <div><p className="text-sm font-semibold text-slate-900">{serviceDisplayName(s, serviceTypes)}</p><p className="text-xs text-slate-400 capitalize">{s.category?.replace("_", " ")}</p></div>
                    {extCertForm.service_type_id === s.id && <CheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />}
                  </button>
                ))}
              </div>
              {submitExtCertError && <p className="text-xs text-red-500">{submitExtCertError}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setSubmitExtCertError(""); setCertSubmitStep(0); }} className="flex-1">Back</Button>
                <Button onClick={() => submitExtCertMutation.mutate()} disabled={!extCertForm.service_type_id || certSubmissionServices.length === 0 || submitExtCertMutation.isPending} className="flex-1" style={{ background: "#FA6F30", color: "#fff" }}>
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
    <ProviderSalesLock feature="credentials" applicationStatus={accessStatus} requiredTier="none">
      {pageContent}
    </ProviderSalesLock>
  );
}