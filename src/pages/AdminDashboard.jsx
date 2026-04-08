import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Users, BookOpen, Award, TrendingUp, Clock, AlertTriangle, ArrowRight,
  Stethoscope, ShieldCheck, Star, Calendar, Activity, FileText,
  CheckCircle2, XCircle, UserCheck, HeartPulse, DollarSign, ClipboardList
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, subDays, isAfter } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const CARD = { background: "rgba(255,255,255,0.22)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.35)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" };

function StatCard({ label, value, icon: Icon, color, bg, sub }) {
  return (
    <div className="rounded-2xl p-4" style={CARD}>
      <div className="flex items-center justify-between mb-3">
        <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon style={{ width: 15, height: 15, color }} />
        </div>
      </div>
      <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: "#1e2535", lineHeight: 1, fontWeight: 400, wordBreak: "break-all" }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: "rgba(30,37,53,0.6)", marginTop: 3, fontWeight: 500 }}>{label}</p>
      {sub && <p style={{ fontSize: 10, color: "rgba(30,37,53,0.45)", marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

function SectionHeader({ icon: Icon, label, color, linkTo, linkLabel }) {
  return (
    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(30,37,53,0.1)" }}>
      <div className="flex items-center gap-2.5">
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon style={{ width: 13, height: 13, color }} />
        </div>
        <span className="font-semibold text-sm" style={{ color: "#1e2535" }}>{label}</span>
      </div>
      {linkTo && (
        <Link to={createPageUrl(linkTo)} className="flex items-center gap-1 text-xs font-semibold hover:opacity-70 transition-opacity" style={{ color }}>
          View all <ArrowRight style={{ width: 11, height: 11 }} />
        </Link>
      )}
    </div>
  );
}

function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span style={{ color: "rgba(30,37,53,0.6)" }}>{label}</span>
        <span style={{ color: "#1e2535", fontWeight: 600 }}>{value}</span>
      </div>
      <div className="rounded-full h-1.5" style={{ background: "rgba(30,37,53,0.1)" }}>
        <div className="rounded-full h-1.5 transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  completed: { bg: "rgba(200,230,60,0.15)", color: "#a8cc20" },
  paid: { bg: "rgba(74,95,160,0.15)", color: "#7B8EC8" },
  confirmed: { bg: "rgba(74,95,160,0.15)", color: "#7B8EC8" },
  cancelled: { bg: "rgba(218,106,99,0.15)", color: "#DA6A63" },
  pending_payment: { bg: "rgba(250,111,48,0.15)", color: "#FA6F30" },
  active: { bg: "rgba(200,230,60,0.15)", color: "#a8cc20" },
  attended: { bg: "rgba(200,230,60,0.15)", color: "#a8cc20" },
  no_show: { bg: "rgba(218,106,99,0.15)", color: "#DA6A63" },
  verified: { bg: "rgba(200,230,60,0.15)", color: "#a8cc20" },
  pending_review: { bg: "rgba(250,111,48,0.15)", color: "#FA6F30" },
  rejected: { bg: "rgba(218,106,99,0.15)", color: "#DA6A63" },
  expired: { bg: "rgba(150,150,150,0.15)", color: "#aaa" },
};

function StatusBadge({ status, label }) {
  const s = STATUS_COLORS[status] || { bg: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, background: s.bg, color: s.color, borderRadius: 20, padding: "3px 10px", textTransform: "capitalize", whiteSpace: "nowrap" }}>
      {label || status?.replace(/_/g, " ")}
    </span>
  );
}

const PIE_COLORS = ["#7B8EC8", "#C8E63C", "#FA6F30", "#DA6A63", "#2D6B7F", "#a8cc20"];

export default function AdminDashboard() {
  const { data: preOrders = [] } = useQuery({ queryKey: ["pre-orders-dash"], queryFn: () => base44.entities.PreOrder.list("-created_date", 100) });
  const { data: enrollments = [] } = useQuery({ queryKey: ["enrollments"], queryFn: () => base44.entities.Enrollment.list() });
  const { data: courses = [] } = useQuery({ queryKey: ["courses"], queryFn: () => base44.entities.Course.list() });
  const { data: licenses = [] } = useQuery({ queryKey: ["licenses"], queryFn: () => base44.entities.License.list() });
  const { data: certifications = [] } = useQuery({ queryKey: ["certifications"], queryFn: () => base44.entities.Certification.list() });
  const { data: users = [] } = useQuery({ queryKey: ["all-users"], queryFn: () => base44.entities.User.list() });
  const { data: appointments = [] } = useQuery({ queryKey: ["all-appointments"], queryFn: () => base44.entities.Appointment.list() });
  const { data: reviews = [] } = useQuery({ queryKey: ["all-reviews"], queryFn: () => base44.entities.Review.list() });
  const { data: mdRels = [] } = useQuery({ queryKey: ["md-relationships"], queryFn: () => base44.entities.MedicalDirectorRelationship.list() });
  const { data: mdSubs = [] } = useQuery({ queryKey: ["md-subs"], queryFn: () => base44.entities.MDSubscription.list() });
  const { data: treatmentRecords = [] } = useQuery({ queryKey: ["treatment-records"], queryFn: () => base44.entities.TreatmentRecord.list() });
  const { data: complianceLogs = [] } = useQuery({ queryKey: ["compliance-logs"], queryFn: () => base44.entities.ComplianceLog.list() });
  const { data: patientJourneys = [] } = useQuery({ queryKey: ["patient-journeys"], queryFn: () => base44.entities.PatientJourney.list() });
  const { data: serviceTypes = [] } = useQuery({ queryKey: ["service-types"], queryFn: () => base44.entities.ServiceType.list() });

  // ── Derived: Users ──────────────────────────────────────────────
  const providers = users.filter(u => u.role === "provider");
  const patients = users.filter(u => u.role === "patient");
  const mds = users.filter(u => u.role === "medical_director");
  const newUsersLast30 = users.filter(u => u.created_date && isAfter(new Date(u.created_date), subDays(new Date(), 30)));

  // ── Derived: Licenses ────────────────────────────────────────────
  const pendingLicenses = licenses.filter(l => l.status === "pending_review");
  const verifiedLicenses = licenses.filter(l => l.status === "verified");
  const rejectedLicenses = licenses.filter(l => l.status === "rejected");
  const expiredLicenses = licenses.filter(l => l.status === "expired");

  // License type breakdown
  const licenseTypeMap = {};
  licenses.forEach(l => { licenseTypeMap[l.license_type] = (licenseTypeMap[l.license_type] || 0) + 1; });
  const licenseTypeData = Object.entries(licenseTypeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // ── Derived: Enrollments / Revenue ──────────────────────────────
  const revenue = enrollments.filter(e => e.status !== "cancelled").reduce((sum, e) => sum + (e.amount_paid || 0), 0);
  const enrollmentsByStatus = {
    completed: enrollments.filter(e => e.status === "completed").length,
    paid: enrollments.filter(e => e.status === "paid" || e.status === "confirmed").length,
    cancelled: enrollments.filter(e => e.status === "cancelled").length,
    pending: enrollments.filter(e => e.status === "pending_payment").length,
    attended: enrollments.filter(e => e.status === "attended").length,
  };

  // Enrollments per course (top 5)
  const courseEnrollMap = {};
  enrollments.forEach(e => {
    const course = courses.find(c => c.id === e.course_id);
    const name = course?.title || "Unknown";
    courseEnrollMap[name] = (courseEnrollMap[name] || 0) + 1;
  });
  const topCourses = Object.entries(courseEnrollMap).map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, count })).sort((a, b) => b.count - a.count).slice(0, 5);

  // ── Derived: Certifications ──────────────────────────────────────
  const activeCerts = certifications.filter(c => c.status === "active");
  const expiredCerts = certifications.filter(c => c.status === "expired");
  const certCategoryMap = {};
  certifications.forEach(c => { certCategoryMap[c.category || "other"] = (certCategoryMap[c.category || "other"] || 0) + 1; });
  const certCategoryData = Object.entries(certCategoryMap).map(([name, value]) => ({ name, value }));

  // ── Derived: Appointments ────────────────────────────────────────
  const apptCompleted = appointments.filter(a => a.status === "completed").length;
  const apptRequested = appointments.filter(a => a.status === "requested").length;
  const apptCancelled = appointments.filter(a => a.status === "cancelled").length;
  const apptConfirmed = appointments.filter(a => a.status === "confirmed").length;
  const recentAppts = [...appointments].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);

  // ── Derived: Reviews ─────────────────────────────────────────────
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "—";
  const flaggedReviews = reviews.filter(r => r.is_flagged).length;
  const verifiedReviews = reviews.filter(r => r.is_verified).length;
  const ratingDist = [5, 4, 3, 2, 1].map(n => ({ star: `${n}★`, count: reviews.filter(r => r.rating === n).length }));

  // ── Derived: MD Relationships ────────────────────────────────────
  const activeMDRels = mdRels.filter(r => r.status === "active").length;
  const pendingMDRels = mdRels.filter(r => r.status === "pending").length;
  const activeMDSubs = mdSubs.filter(s => s.status === "active").length;

  // ── Derived: Treatments ──────────────────────────────────────────
  const treatmentsByService = {};
  treatmentRecords.forEach(t => { treatmentsByService[t.service || "Other"] = (treatmentsByService[t.service || "Other"] || 0) + 1; });
  const topServices = Object.entries(treatmentsByService).map(([name, count]) => ({ name: name.length > 18 ? name.slice(0, 18) + "…" : name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  const adverseReactions = treatmentRecords.filter(t => t.adverse_reaction).length;
  const submittedRecords = treatmentRecords.filter(t => t.status === "submitted" || t.status === "approved").length;

  // ── Derived: Compliance ──────────────────────────────────────────
  const complianceActionRequired = complianceLogs.filter(l => l.action_required && !l.resolved_at).length;
  const complianceByType = {};
  complianceLogs.forEach(l => { complianceByType[l.log_type] = (complianceByType[l.log_type] || 0) + 1; });

  // ── Derived: Patients ────────────────────────────────────────────
  const premiumPatients = patientJourneys.filter(j => j.tier === "premium").length;
  const onboardedPatients = patientJourneys.filter(j => j.onboarding_completed).length;
  const patientsWithScans = patientJourneys.filter(j => j.scans?.length > 0).length;
  const patientsWithRoadmap = patientJourneys.filter(j => j.roadmap).length;

  return (
    <div className="space-y-6 max-w-6xl w-full overflow-x-hidden">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(218,106,99,0.9)", letterSpacing: "0.14em" }}>Admin</p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", lineHeight: 1.15 }}>Dashboard</h1>
        <p style={{ color: "rgba(30,37,53,0.6)", fontSize: 13, marginTop: 4 }}>Full platform analytics — providers, patients, MDs, treatments & compliance</p>
      </div>

      {/* ── Pre-Order Alert ── */}
      {(() => {
        const pending = preOrders.filter(o => o.status === "pending_approval");
        if (pending.length === 0) return null;
        return (
          <Link to={createPageUrl("AdminPreOrders")} className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl transition-all hover:opacity-90" style={{ background: "rgba(250,111,48,0.15)", border: "1px solid rgba(250,111,48,0.35)" }}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: "#FA6F30" }} />
              <div>
                <p className="text-sm font-bold" style={{ color: "#1e2535" }}>
                  {pending.length} Pre-Order Application{pending.length > 1 ? "s" : ""} Awaiting Approval
                </p>
                <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>Review licenses and send payment links</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: "#FA6F30" }} />
          </Link>
        );
      })()}

      {/* ── Section: Platform Overview ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Platform Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Providers" value={providers.length} icon={Stethoscope} color="#7B8EC8" bg="rgba(123,142,200,0.12)" sub={`${newUsersLast30.filter(u => u.role === "provider").length} new this month`} />
          <StatCard label="Total Patients" value={patients.length} icon={HeartPulse} color="#DA6A63" bg="rgba(218,106,99,0.12)" sub={`${premiumPatients} premium`} />
          <StatCard label="Medical Directors" value={mds.length} icon={UserCheck} color="#FA6F30" bg="rgba(250,111,48,0.12)" sub={`${activeMDRels} active supervisions`} />
          <StatCard label="Total Revenue" value={`$${revenue.toLocaleString()}`} icon={DollarSign} color="#C8E63C" bg="rgba(200,230,60,0.12)" sub={`${enrollments.filter(e => e.status !== "cancelled").length} paid enrollments`} />
        </div>
      </div>

      {/* ── Section: Providers & Licenses ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Providers & Licenses</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Verified Licenses" value={verifiedLicenses.length} icon={CheckCircle2} color="#a8cc20" bg="rgba(200,230,60,0.1)" />
          <StatCard label="Pending Review" value={pendingLicenses.length} icon={AlertTriangle} color="#FA6F30" bg="rgba(250,111,48,0.1)" />
          <StatCard label="Rejected" value={rejectedLicenses.length} icon={XCircle} color="#DA6A63" bg="rgba(218,106,99,0.1)" />
          <StatCard label="Expired" value={expiredLicenses.length} icon={Clock} color="#aaa" bg="rgba(150,150,150,0.1)" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pending Licenses */}
          <div className="rounded-2xl overflow-hidden" style={CARD}>
            <SectionHeader icon={AlertTriangle} label="Pending Licenses" color="#FA6F30" linkTo="AdminLicenses" linkLabel="View all" />
            <div className="p-4">
              {pendingLicenses.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "rgba(30,37,53,0.4)" }}>All licenses reviewed ✓</p>
              ) : (
                <div className="space-y-1.5">
                  {pendingLicenses.slice(0, 5).map(l => (
                    <div key={l.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: "rgba(30,37,53,0.05)" }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: "#1e2535" }}>{l.provider_email}</p>
                        <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>{l.license_type} · {l.issuing_state}</p>
                      </div>
                      <StatusBadge status="pending_review" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* License type breakdown */}
          <div className="rounded-2xl overflow-hidden" style={CARD}>
            <SectionHeader icon={FileText} label="License Types" color="#7B8EC8" />
            <div className="p-4 space-y-3">
              {licenseTypeData.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "rgba(30,37,53,0.4)" }}>No license data yet</p>
              ) : (
                licenseTypeData.map(d => (
                  <MiniBar key={d.name} label={d.name} value={d.value} max={licenses.length} color="#7B8EC8" />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section: Courses & Enrollments ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Courses & Enrollments</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Total Courses" value={courses.length} icon={BookOpen} color="#7B8EC8" bg="rgba(123,142,200,0.12)" />
          <StatCard label="Total Enrollments" value={enrollments.length} icon={ClipboardList} color="#FA6F30" bg="rgba(250,111,48,0.12)" />
          <StatCard label="Completed" value={enrollmentsByStatus.completed} icon={CheckCircle2} color="#a8cc20" bg="rgba(200,230,60,0.1)" />
          <StatCard label="Cancelled" value={enrollmentsByStatus.cancelled} icon={XCircle} color="#DA6A63" bg="rgba(218,106,99,0.1)" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Enrollments per course */}
          <div className="rounded-2xl overflow-hidden" style={CARD}>
            <SectionHeader icon={BookOpen} label="Top Courses by Enrollment" color="#7B8EC8" linkTo="AdminCourses" />
            <div className="p-4">
              {topCourses.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "rgba(30,37,53,0.4)" }}>No enrollment data yet</p>
              ) : (
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={topCourses} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{ fill: "rgba(30,37,53,0.4)", fontSize: 9 }} />
                      <YAxis tick={{ fill: "rgba(30,37,53,0.4)", fontSize: 9 }} />
                      <Tooltip contentStyle={{ background: "#1e2535", border: "none", borderRadius: 8, fontSize: 11 }} labelStyle={{ color: "white" }} itemStyle={{ color: "#7B8EC8" }} />
                      <Bar dataKey="count" fill="#7B8EC8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Enrollment status breakdown */}
          <div className="rounded-2xl overflow-hidden" style={CARD}>
            <SectionHeader icon={ClipboardList} label="Enrollment Status Breakdown" color="#FA6F30" linkTo="AdminEnrollments" />
            <div className="p-4 space-y-3">
              {[
                { label: "Completed", value: enrollmentsByStatus.completed, color: "#a8cc20" },
                { label: "Paid / Confirmed", value: enrollmentsByStatus.paid, color: "#7B8EC8" },
                { label: "Attended", value: enrollmentsByStatus.attended, color: "#2D6B7F" },
                { label: "Pending Payment", value: enrollmentsByStatus.pending, color: "#FA6F30" },
                { label: "Cancelled", value: enrollmentsByStatus.cancelled, color: "#DA6A63" },
              ].map(d => (
                <MiniBar key={d.label} label={d.label} value={d.value} max={enrollments.length} color={d.color} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section: Certifications ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Certifications</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Total Certs" value={certifications.length} icon={Award} color="#C8E63C" bg="rgba(200,230,60,0.12)" />
          <StatCard label="Active" value={activeCerts.length} icon={CheckCircle2} color="#a8cc20" bg="rgba(200,230,60,0.1)" />
          <StatCard label="Expired" value={expiredCerts.length} icon={Clock} color="#aaa" bg="rgba(150,150,150,0.1)" />
          <StatCard label="Service Types" value={serviceTypes.length} icon={Activity} color="#7B8EC8" bg="rgba(123,142,200,0.12)" />
        </div>

        <div className="rounded-2xl overflow-hidden" style={CARD}>
          <SectionHeader icon={Award} label="Certifications by Category" color="#C8E63C" linkTo="AdminCertifications" />
          <div className="p-4 grid grid-cols-2 gap-3">
            {certCategoryData.length === 0 ? (
              <p className="text-sm col-span-2 text-center py-6" style={{ color: "rgba(30,37,53,0.4)" }}>No cert data yet</p>
            ) : certCategoryData.map(d => (
              <MiniBar key={d.name} label={d.name} value={d.value} max={certifications.length} color="#C8E63C" />
            ))}
          </div>
        </div>
      </div>

      {/* ── Section: Patients ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Patients & Journeys</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Patients" value={patients.length} icon={HeartPulse} color="#DA6A63" bg="rgba(218,106,99,0.12)" />
          <StatCard label="Premium Patients" value={premiumPatients} icon={TrendingUp} color="#C8E63C" bg="rgba(200,230,60,0.12)" sub={`${patients.length > 0 ? Math.round((premiumPatients / patients.length) * 100) : 0}% conversion`} />
          <StatCard label="Onboarded" value={onboardedPatients} icon={CheckCircle2} color="#a8cc20" bg="rgba(200,230,60,0.1)" />
          <StatCard label="Have Roadmaps" value={patientsWithRoadmap} icon={Activity} color="#7B8EC8" bg="rgba(123,142,200,0.12)" sub={`${patientsWithScans} with scans`} />
        </div>
      </div>

      {/* ── Section: Medical Directors & Supervision ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Medical Directors & Supervision</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Medical Directors" value={mds.length} icon={UserCheck} color="#FA6F30" bg="rgba(250,111,48,0.12)" />
          <StatCard label="Active Supervisions" value={activeMDRels} icon={ShieldCheck} color="#a8cc20" bg="rgba(200,230,60,0.1)" />
          <StatCard label="Pending Relationships" value={pendingMDRels} icon={Clock} color="#FA6F30" bg="rgba(250,111,48,0.1)" />
          <StatCard label="Active MD Subscriptions" value={activeMDSubs} icon={Award} color="#7B8EC8" bg="rgba(123,142,200,0.12)" />
        </div>

        <div className="rounded-2xl overflow-hidden" style={CARD}>
          <SectionHeader icon={ShieldCheck} label="MD Subscription Coverage by Service Type" color="#FA6F30" />
          <div className="p-4 grid grid-cols-2 gap-3">
            {(() => {
              const map = {};
              mdSubs.filter(s => s.status === "active").forEach(s => { map[s.service_type_name || "Unknown"] = (map[s.service_type_name || "Unknown"] || 0) + 1; });
              const data = Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
              return data.length === 0
                ? <p className="col-span-2 text-sm text-center py-6" style={{ color: "rgba(30,37,53,0.4)" }}>No MD subscription data yet</p>
                : data.map(d => <MiniBar key={d.name} label={d.name} value={d.value} max={activeMDSubs} color="#FA6F30" />);
            })()}
          </div>
        </div>
      </div>

      {/* ── Section: Appointments ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Appointments</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Total Appointments" value={appointments.length} icon={Calendar} color="#7B8EC8" bg="rgba(123,142,200,0.12)" />
          <StatCard label="Completed" value={apptCompleted} icon={CheckCircle2} color="#a8cc20" bg="rgba(200,230,60,0.1)" />
          <StatCard label="Requested" value={apptRequested} icon={Clock} color="#FA6F30" bg="rgba(250,111,48,0.1)" />
          <StatCard label="Cancelled" value={apptCancelled} icon={XCircle} color="#DA6A63" bg="rgba(218,106,99,0.1)" />
        </div>

        <div className="rounded-2xl overflow-hidden" style={CARD}>
          <SectionHeader icon={Calendar} label="Recent Appointments" color="#7B8EC8" linkTo="PatientAppointments" />
          <div className="p-4">
            {recentAppts.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "rgba(30,37,53,0.4)" }}>No appointments yet</p>
            ) : (
              <div className="space-y-1.5">
                {recentAppts.map(a => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: "rgba(30,37,53,0.05)" }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#1e2535" }}>{a.patient_name || a.patient_email}</p>
                      <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>{a.service} · {a.provider_name || a.provider_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>{a.appointment_date}</span>
                      <StatusBadge status={a.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section: Treatment Records ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Treatment Records</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Total Treatments" value={treatmentRecords.length} icon={Activity} color="#2D6B7F" bg="rgba(45,107,127,0.15)" />
          <StatCard label="Submitted / Approved" value={submittedRecords} icon={CheckCircle2} color="#a8cc20" bg="rgba(200,230,60,0.1)" />
          <StatCard label="Adverse Reactions" value={adverseReactions} icon={AlertTriangle} color="#DA6A63" bg="rgba(218,106,99,0.1)" sub={treatmentRecords.length > 0 ? `${((adverseReactions / treatmentRecords.length) * 100).toFixed(1)}% rate` : ""} />
          <StatCard label="Unique Services" value={Object.keys(treatmentsByService).length} icon={Stethoscope} color="#7B8EC8" bg="rgba(123,142,200,0.12)" />
        </div>

        <div className="rounded-2xl overflow-hidden" style={CARD}>
          <SectionHeader icon={Stethoscope} label="Top Treatment Services" color="#2D6B7F" />
          <div className="p-4">
            {topServices.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "rgba(30,37,53,0.4)" }}>No treatment records yet</p>
            ) : (
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topServices} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fill: "rgba(30,37,53,0.4)", fontSize: 9 }} />
                    <YAxis tick={{ fill: "rgba(30,37,53,0.4)", fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: "#1e2535", border: "none", borderRadius: 8, fontSize: 11 }} labelStyle={{ color: "white" }} itemStyle={{ color: "#2D6B7F" }} />
                    <Bar dataKey="count" fill="#2D6B7F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section: Reviews ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Reviews & Ratings</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Total Reviews" value={reviews.length} icon={Star} color="#C8E63C" bg="rgba(200,230,60,0.12)" />
          <StatCard label="Average Rating" value={avgRating} icon={Star} color="#C8E63C" bg="rgba(200,230,60,0.12)" />
          <StatCard label="Verified Reviews" value={verifiedReviews} icon={CheckCircle2} color="#a8cc20" bg="rgba(200,230,60,0.1)" />
          <StatCard label="Flagged Reviews" value={flaggedReviews} icon={AlertTriangle} color="#DA6A63" bg="rgba(218,106,99,0.1)" />
        </div>

        <div className="rounded-2xl overflow-hidden" style={CARD}>
          <SectionHeader icon={Star} label="Rating Distribution" color="#C8E63C" linkTo="AdminReviews" />
          <div className="p-4 space-y-2">
            {ratingDist.map(d => (
              <MiniBar key={d.star} label={d.star} value={d.count} max={reviews.length || 1} color="#C8E63C" />
            ))}
          </div>
        </div>
      </div>

      {/* ── Section: Compliance ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Compliance</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Total Logs" value={complianceLogs.length} icon={ClipboardList} color="#7B8EC8" bg="rgba(123,142,200,0.12)" />
          <StatCard label="Action Required" value={complianceActionRequired} icon={AlertTriangle} color="#DA6A63" bg="rgba(218,106,99,0.1)" sub="Unresolved" />
          <StatCard label="Resolved" value={complianceLogs.filter(l => l.resolved_at).length} icon={CheckCircle2} color="#a8cc20" bg="rgba(200,230,60,0.1)" />
          <StatCard label="Incident Reports" value={complianceLogs.filter(l => l.log_type === "incident_report").length} icon={AlertTriangle} color="#FA6F30" bg="rgba(250,111,48,0.1)" />
        </div>

        <div className="rounded-2xl overflow-hidden" style={CARD}>
          <SectionHeader icon={ShieldCheck} label="Compliance by Type" color="#7B8EC8" linkTo="AdminCompliance" />
          <div className="p-4 grid grid-cols-2 gap-3">
            {Object.keys(complianceByType).length === 0 ? (
              <p className="col-span-2 text-sm text-center py-6" style={{ color: "rgba(30,37,53,0.4)" }}>No compliance logs yet</p>
            ) : Object.entries(complianceByType).map(([type, count]) => (
              <MiniBar key={type} label={type.replace(/_/g, " ")} value={count} max={complianceLogs.length} color="#7B8EC8" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}