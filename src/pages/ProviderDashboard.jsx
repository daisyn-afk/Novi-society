import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Award, BookOpen, Calendar, ShieldCheck, AlertTriangle, CheckCircle,
  ArrowRight, Clock, Zap, Users, FileText, Star, ChevronRight,
  TrendingUp, MessageSquare, Heart, Stethoscope, Sparkles, Bell,
  DollarSign, Repeat, Target, Trophy
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProviderSalesLock from "@/components/ProviderSalesLock";
import { useProviderAccess } from "@/components/useProviderAccess";
import { isToday, isTomorrow, format, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";

const GLASS = {
  background: "rgba(255,255,255,0.45)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.75)",
  boxShadow: "0 2px 12px rgba(30,37,53,0.06)",
  borderRadius: 16,
};

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>
      {children}
    </p>
  );
}

function ActionCard({ icon: Icon, color, title, sub, badge, badgeColor, to, urgent }) {
  return (
    <Link to={to}>
      <div
        className="flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer transition-all hover:scale-[1.01]"
        style={{
          ...GLASS,
          border: urgent ? `1.5px solid ${color}55` : "1px solid rgba(255,255,255,0.75)",
          background: urgent ? `${color}0a` : "rgba(255,255,255,0.45)",
        }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
          <Icon className="w-4.5 h-4.5" style={{ color, width: 18, height: 18 }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate" style={{ color: "#1e2535" }}>{title}</p>
          {sub && <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(30,37,53,0.5)" }}>{sub}</p>}
        </div>
        {badge != null && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: `${badgeColor || color}20`, color: badgeColor || color }}>
            {badge}
          </span>
        )}
        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(30,37,53,0.25)" }} />
      </div>
    </Link>
  );
}

export default function ProviderDashboard() {
  const { status: accessStatus } = useProviderAccess();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const { data: myEnrollments = [] } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => { const u = await base44.auth.me(); return base44.entities.Enrollment.filter({ provider_id: u.id }); },
  });
  const { data: myCerts = [] } = useQuery({
    queryKey: ["my-certs"],
    queryFn: async () => { const u = await base44.auth.me(); return base44.entities.Certification.filter({ provider_id: u.id }); },
  });
  const { data: myLicenses = [] } = useQuery({
    queryKey: ["my-licenses"],
    queryFn: async () => { const u = await base44.auth.me(); return base44.entities.License.filter({ provider_id: u.id }); },
  });
  const { data: myAppointments = [] } = useQuery({
    queryKey: ["my-appointments"],
    queryFn: async () => { const u = await base44.auth.me(); return base44.entities.Appointment.filter({ provider_id: u.id }, "-appointment_date"); },
  });
  const { data: myMDSubs = [] } = useQuery({
    queryKey: ["my-md-subscriptions"],
    queryFn: async () => { const u = await base44.auth.me(); return base44.entities.MDSubscription.filter({ provider_id: u.id }); },
  });
  const { data: myReviews = [] } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: async () => { const u = await base44.auth.me(); return base44.entities.Review.filter({ provider_id: u.id }, "-created_date"); },
  });
  const { data: treatmentRecords = [] } = useQuery({
    queryKey: ["treatment-records"],
    queryFn: async () => { const u = await base44.auth.me(); return base44.entities.TreatmentRecord.filter({ provider_id: u.id }, "-created_date"); },
  });

  const today = new Date();

  // ── Credentials
  const pendingLicenses = myLicenses.filter(l => l.status === "pending_review");
  const verifiedLicenses = myLicenses.filter(l => l.status === "verified");
  const activeCerts = myCerts.filter(c => c.status === "active");
  const expiringLicenses = myLicenses.filter(l => {
    if (!l.expiration_date || l.status === "expired") return false;
    const days = (new Date(l.expiration_date) - today) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 60;
  });

  // ── Appointments
  const todayAppts = myAppointments.filter(a =>
    a.appointment_date && isToday(new Date(a.appointment_date)) && ["confirmed", "requested"].includes(a.status)
  );
  const tomorrowAppts = myAppointments.filter(a =>
    a.appointment_date && isTomorrow(new Date(a.appointment_date)) && ["confirmed", "requested"].includes(a.status)
  );
  const pendingRequests = myAppointments.filter(a => a.status === "requested");
  const upcomingConfirmed = myAppointments.filter(a => a.status === "confirmed");

  // ── Practice / Patients
  const patientMap = {};
  myAppointments.forEach(a => {
    const key = a.patient_id || a.patient_email;
    if (!key) return;
    if (!patientMap[key]) patientMap[key] = { name: a.patient_name, visits: 0 };
    patientMap[key].visits++;
  });
  const totalPatients = Object.keys(patientMap).length;
  const returningPatients = Object.values(patientMap).filter(p => p.visits > 1).length;
  const retentionRate = totalPatients > 0 ? Math.round((returningPatients / totalPatients) * 100) : 0;
  const completedAppts = myAppointments.filter(a => a.status === "completed");

  // ── Revenue this month
  const thisMonthRevenue = myAppointments
    .filter(a => a.status === "completed" && a.appointment_date && isWithinInterval(new Date(a.appointment_date), { start: startOfMonth(today), end: endOfMonth(today) }))
    .reduce((s, a) => s + (a.total_amount || 0), 0);
  const totalRevenue = completedAppts.reduce((s, a) => s + (a.total_amount || 0), 0);

  // ── Reviews
  const avgRating = myReviews.length ? (myReviews.reduce((s, r) => s + r.rating, 0) / myReviews.length).toFixed(1) : null;
  const unansweredReviews = myReviews.filter(r => !r.response && !r.is_flagged);
  const recentReviews = myReviews.slice(0, 2);

  // ── Treatment records needing attention
  const flaggedRecords = treatmentRecords.filter(r => ["flagged", "changes_requested"].includes(r.status));
  const draftRecords = treatmentRecords.filter(r => r.status === "draft");

  // ── Coverage
  const activeSubscriptions = myMDSubs.filter(s => s.status === "active");
  const hasMDCoverage = activeSubscriptions.length > 0;
  const hasCert = activeCerts.length > 0;
  const hasVerifiedLicense = verifiedLicenses.length > 0;
  const hasEnrollment = myEnrollments.length > 0;
  const hasCompletedCourse = myEnrollments.some(e => ["completed", "attended"].includes(e.status));
  const pendingCerts = myCerts.filter(c => c.status === "pending");

  // ── Provider path steps
  const noviSteps = [
    { label: "Upload License", done: myLicenses.length > 0, page: "ProviderCredentialsCoverage", urgent: myLicenses.length === 0 },
    { label: "License Verified", done: hasVerifiedLicense, page: "ProviderCredentialsCoverage", pending: pendingLicenses.length > 0 },
    { label: "Enroll in Course", done: hasEnrollment, page: "ProviderEnrollments", urgent: hasVerifiedLicense && !hasEnrollment },
    { label: "Complete Course", done: hasCompletedCourse, page: "ProviderEnrollments" },
    { label: "Get Certified", done: hasCert, page: "ProviderCredentialsCoverage" },
    { label: "Activate MD Coverage", done: hasMDCoverage, page: "ProviderCredentialsCoverage", urgent: hasCert && !hasMDCoverage },
  ];
  const noviCompleted = noviSteps.filter(s => s.done).length;
  const nextNoviAction = noviSteps.find(s => !s.done);

  const extSteps = [
    { label: "Upload License", done: myLicenses.length > 0, page: "ProviderCredentialsCoverage" },
    { label: "Submit External Cert", done: pendingCerts.length > 0 || hasCert, page: "ProviderCredentialsCoverage" },
    { label: "Cert Approved", done: hasCert, page: "ProviderCredentialsCoverage", pending: pendingCerts.length > 0 && !hasCert },
    { label: "Activate MD Coverage", done: hasMDCoverage, page: "ProviderCredentialsCoverage" },
  ];
  const extCompleted = extSteps.filter(s => s.done).length;

  // ── Build today's focus list
  const todayTasks = [];
  if (pendingRequests.length > 0) todayTasks.push({ icon: Bell, color: "#FA6F30", title: `${pendingRequests.length} appointment request${pendingRequests.length > 1 ? "s" : ""} need your reply`, sub: "Confirm or decline to keep patients happy", to: createPageUrl("ProviderPractice"), urgent: true });
  if (todayAppts.length > 0) todayTasks.push({ icon: Calendar, color: "#7B8EC8", title: `${todayAppts.length} appointment${todayAppts.length > 1 ? "s" : ""} today`, sub: todayAppts.map(a => a.patient_name || a.patient_email).join(", "), to: createPageUrl("ProviderPractice"), urgent: true });
  if (flaggedRecords.length > 0) todayTasks.push({ icon: AlertTriangle, color: "#DA6A63", title: `${flaggedRecords.length} treatment record${flaggedRecords.length > 1 ? "s" : ""} flagged by MD`, sub: "Review and resubmit changes", to: createPageUrl("ProviderPractice"), urgent: true });
  if (unansweredReviews.length > 0) todayTasks.push({ icon: MessageSquare, color: "#7B8EC8", title: `${unansweredReviews.length} review${unansweredReviews.length > 1 ? "s" : ""} awaiting your response`, sub: "Responding boosts your profile ranking", to: createPageUrl("ProviderPractice") });
  if (draftRecords.length > 0) todayTasks.push({ icon: FileText, color: "#FA6F30", title: `${draftRecords.length} draft treatment record${draftRecords.length > 1 ? "s" : ""}`, sub: "Submit for MD review", to: createPageUrl("ProviderPractice") });
  if (hasCert && !hasMDCoverage) todayTasks.push({ icon: Zap, color: "#C8E63C", title: "Activate MD Coverage — you're certified!", sub: "One step away from seeing patients", to: createPageUrl("ProviderCredentialsCoverage"), urgent: true });
  if (!hasVerifiedLicense) todayTasks.push({ icon: ShieldCheck, color: "#DA6A63", title: "Upload your license to unlock the platform", sub: "Required to enroll in courses & see patients", to: createPageUrl("ProviderCredentialsCoverage"), urgent: true });
  else if (hasVerifiedLicense && !hasEnrollment) todayTasks.push({ icon: BookOpen, color: "#C8E63C", title: "Enroll in a NOVI course", sub: "Get certified and activate MD coverage", to: createPageUrl("ProviderEnrollments") });
  if (expiringLicenses.length > 0) todayTasks.push({ icon: Clock, color: "#FA6F30", title: `${expiringLicenses.length} license expiring soon`, sub: "Renew to stay compliant", to: createPageUrl("ProviderCredentialsCoverage") });
  if (tomorrowAppts.length > 0) todayTasks.push({ icon: Calendar, color: "#7B8EC8", title: `${tomorrowAppts.length} appointment${tomorrowAppts.length > 1 ? "s" : ""} tomorrow`, sub: tomorrowAppts.map(a => a.patient_name || "Patient").join(", "), to: createPageUrl("ProviderPractice") });
  if (!me?.practice_name) todayTasks.push({ icon: Stethoscope, color: "#7B8EC8", title: "Complete your practice profile", sub: "Add your bio, city, and services to attract patients", to: createPageUrl("ProviderPractice") });

  // greeting
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const dashboardContent = (
    <div className="max-w-5xl space-y-7 w-full overflow-x-hidden">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#DA6A63", marginBottom: 6 }}>{greeting}</p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(28px, 5vw, 46px)", color: "#1e2535", lineHeight: 1.05, fontStyle: "italic", fontWeight: 400 }}>
            {me?.full_name?.split(" ")[0] || "Provider"}
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "rgba(30,37,53,0.5)" }}>
            {hasMDCoverage
              ? `✓ MD Coverage Active · ${activeSubscriptions.length} service${activeSubscriptions.length > 1 ? "s" : ""} covered`
              : "Complete your setup to start seeing patients"}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link to={createPageUrl("ProviderPractice")}>
            <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(30,37,53,0.12)", color: "#1e2535" }}>
              <Stethoscope className="w-3.5 h-3.5" /> My Practice
            </button>
          </Link>
          <Link to={createPageUrl("ProviderEnrollments")}>
            <button className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl" style={{ background: "#1e2535", color: "#fff" }}>
              Browse Courses <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Calendar, label: "Upcoming", value: upcomingConfirmed.length, sub: `${pendingRequests.length} pending`, color: "#7B8EC8", page: "ProviderPractice" },
          { icon: Users, label: "Patients", value: totalPatients, sub: `${retentionRate}% returning`, color: "#2D6B7F", page: "ProviderPractice" },
          { icon: Star, label: "Avg Rating", value: avgRating || "—", sub: `${myReviews.length} reviews`, color: "#FA6F30", page: "ProviderPractice" },
          { icon: DollarSign, label: "This Month", value: thisMonthRevenue > 0 ? `$${thisMonthRevenue.toLocaleString()}` : "—", sub: `$${totalRevenue.toLocaleString()} total`, color: "#C8E63C", page: "ProviderPractice" },
        ].map(({ icon: Icon, label, value, sub, color, page }) => (
          <Link key={label} to={createPageUrl(page)}>
            <div className="py-4 px-3 rounded-2xl text-center transition-all hover:scale-[1.02]" style={GLASS}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: `${color}18` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <p className="text-2xl font-bold leading-tight" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>{value}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: "rgba(30,37,53,0.55)" }}>{label}</p>
              <p style={{ fontSize: 10, color: "rgba(30,37,53,0.4)", marginTop: 2 }}>{sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Today's Focus ── */}
      {todayTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4" style={{ color: "#FA6F30" }} />
            <SectionLabel>Today's Focus</SectionLabel>
          </div>
          <div className="space-y-2">
            {todayTasks.slice(0, 6).map((task, i) => (
              <ActionCard key={i} {...task} />
            ))}
          </div>
        </div>
      )}

      {/* ── Appointments snapshot ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Upcoming appointments */}
        <div className="rounded-2xl overflow-hidden" style={GLASS}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: "#7B8EC8" }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>Upcoming Appointments</p>
            </div>
            <Link to={createPageUrl("ProviderPractice")} className="text-xs font-semibold hover:opacity-70" style={{ color: "#7B8EC8" }}>View all</Link>
          </div>
          <div className="px-4 py-3 space-y-2">
            {upcomingConfirmed.length === 0 && pendingRequests.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: "rgba(30,37,53,0.4)" }}>No upcoming appointments</p>
            ) : (
              [...pendingRequests.slice(0, 2), ...upcomingConfirmed.slice(0, 3)].slice(0, 4).map(a => (
                <Link key={a.id} to={createPageUrl("ProviderPractice")}>
                  <div className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/30 transition-colors">
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 flex flex-col items-center justify-center" style={{ background: a.status === "requested" ? "rgba(250,111,48,0.15)" : "rgba(123,142,200,0.15)" }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: a.status === "requested" ? "#FA6F30" : "#7B8EC8", textTransform: "uppercase" }}>
                        {a.appointment_date ? format(new Date(a.appointment_date), "MMM") : "--"}
                      </p>
                      <p className="font-bold text-sm leading-none" style={{ color: a.status === "requested" ? "#FA6F30" : "#7B8EC8" }}>
                        {a.appointment_date ? format(new Date(a.appointment_date), "d") : "--"}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: "#1e2535" }}>{a.service}</p>
                      <p className="text-xs truncate" style={{ color: "rgba(30,37,53,0.5)" }}>{a.patient_name || a.patient_email}</p>
                    </div>
                    {a.status === "requested" && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(250,111,48,0.15)", color: "#FA6F30" }}>New</span>
                    )}
                    {isToday(new Date(a.appointment_date || "")) && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10" }}>Today</span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent reviews */}
        <div className="rounded-2xl overflow-hidden" style={GLASS}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4" style={{ color: "#FA6F30" }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>Recent Reviews</p>
            </div>
            <Link to={createPageUrl("ProviderPractice")} className="text-xs font-semibold hover:opacity-70" style={{ color: "#FA6F30" }}>View all</Link>
          </div>
          <div className="px-4 py-3 space-y-3">
            {myReviews.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: "rgba(30,37,53,0.4)" }}>No reviews yet — complete appointments to get feedback</p>
            ) : (
              recentReviews.map(r => (
                <Link key={r.id} to={createPageUrl("ProviderPractice")}>
                  <div className="py-2 px-3 rounded-xl hover:bg-white/30 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold" style={{ color: "#1e2535" }}>{r.patient_name || "Patient"}</p>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} className="w-2.5 h-2.5" style={{ color: i <= r.rating ? "#FA6F30" : "rgba(30,37,53,0.15)", fill: i <= r.rating ? "#FA6F30" : "transparent" }} />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "rgba(30,37,53,0.55)" }}>{r.comment}</p>}
                    {!r.response && <p className="text-xs mt-1 font-semibold" style={{ color: "#7B8EC8" }}>Tap to respond ↗</p>}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Credentials & Coverage snapshot ── */}
      <div>
        <SectionLabel>Credentials & Coverage</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link to={createPageUrl("ProviderCredentialsCoverage")}>
            <div className="py-4 px-4 rounded-2xl transition-all hover:scale-[1.02]" style={GLASS}>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4" style={{ color: verifiedLicenses.length > 0 ? "#4a6b10" : "#FA6F30" }} />
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>Licenses</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>{myLicenses.length}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>
                {verifiedLicenses.length} verified{pendingLicenses.length > 0 ? ` · ${pendingLicenses.length} pending` : ""}
                {expiringLicenses.length > 0 ? ` · ${expiringLicenses.length} expiring soon` : ""}
              </p>
            </div>
          </Link>
          <Link to={createPageUrl("ProviderCredentialsCoverage")}>
            <div className="py-4 px-4 rounded-2xl transition-all hover:scale-[1.02]" style={GLASS}>
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4" style={{ color: activeCerts.length > 0 ? "#4a6b10" : "rgba(30,37,53,0.4)" }} />
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>Certifications</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>{activeCerts.length}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>
                {activeCerts.length > 0 ? activeCerts.slice(0, 2).map(c => c.service_type_name || c.certification_name).join(", ") : "None yet — complete a course"}
              </p>
            </div>
          </Link>
          <Link to={createPageUrl("ProviderCredentialsCoverage")}>
            <div className="py-4 px-4 rounded-2xl transition-all hover:scale-[1.02]" style={{ ...GLASS, background: hasMDCoverage ? "rgba(200,230,60,0.1)" : "rgba(255,255,255,0.45)", border: hasMDCoverage ? "1px solid rgba(200,230,60,0.4)" : "1px solid rgba(255,255,255,0.75)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4" style={{ color: hasMDCoverage ? "#4a6b10" : "rgba(30,37,53,0.35)" }} />
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>MD Coverage</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>{activeSubscriptions.length}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>
                {hasMDCoverage ? activeSubscriptions.map(s => s.service_type_name).join(", ") : hasCert ? "Certified — activate now!" : "Complete training to unlock"}
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Setup Paths (shown until MD coverage is active) ── */}
      {!hasMDCoverage ? (
        <div>
          <SectionLabel>Your Provider Paths</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* PATH 1: NOVI Course Path */}
            <div style={{ ...GLASS, overflow: "hidden" }}>
              <div className="px-4 py-4 flex items-center gap-3" style={{ background: "rgba(200,230,60,0.1)", borderBottom: "1px solid rgba(200,230,60,0.18)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,230,60,0.2)" }}>
                  <BookOpen className="w-5 h-5" style={{ color: "#C8E63C" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm" style={{ color: "#1e2535" }}>NOVI Course Path</p>
                  <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>Train with us & earn NOVI certification</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(200,230,60,0.2)", color: "#a8c020", border: "1px solid rgba(200,230,60,0.35)" }}>
                  {noviCompleted}/{noviSteps.length}
                </span>
              </div>
              <div className="px-5 pt-3 pb-1">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(30,37,53,0.08)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${(noviCompleted / noviSteps.length) * 100}%`, background: "linear-gradient(90deg, #C8E63C, #a8c020)" }} />
                </div>
              </div>
              <div className="px-5 pb-4 pt-3 space-y-1.5">
                {noviSteps.map((step, i) => (
                  <Link key={i} to={createPageUrl(step.page)}>
                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all hover:bg-white/20"
                      style={step.urgent ? { background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.18)" } : {}}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: step.done ? "#C8E63C" : step.pending ? "#FA6F30" : step.urgent ? "rgba(250,111,48,0.12)" : "rgba(30,37,53,0.07)", border: step.done ? "none" : step.urgent ? "1px solid rgba(250,111,48,0.35)" : "1px solid rgba(30,37,53,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {step.done ? <CheckCircle className="w-3.5 h-3.5" style={{ color: "#1a2540" }} /> : <span style={{ fontSize: 9, fontWeight: 700, color: step.urgent ? "#FA6F30" : "rgba(30,37,53,0.3)" }}>{i + 1}</span>}
                      </div>
                      <span style={{ fontSize: 13, color: step.done ? "#1e2535" : step.urgent ? "#1e2535" : "rgba(30,37,53,0.38)", fontWeight: step.done || step.urgent ? 600 : 400 }}>{step.label}</span>
                      {step.pending && !step.done && <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(250,111,48,0.12)", color: "#FA6F30" }}>Pending</span>}
                      {step.urgent && <ChevronRight className="ml-auto w-3.5 h-3.5 flex-shrink-0" style={{ color: "#FA6F30" }} />}
                    </div>
                  </Link>
                ))}
              </div>
              <div className="px-5 pb-5">
                <Link to={createPageUrl(nextNoviAction?.page || "ProviderEnrollments")}>
                  <button className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #C8E63C, #a8c020)", color: "#1a2540" }}>
                    {nextNoviAction?.label || "Continue Journey"} <ArrowRight className="inline w-3.5 h-3.5 ml-1" />
                  </button>
                </Link>
              </div>
            </div>

            {/* PATH 2: External Certification Path */}
            <div style={{ ...GLASS, overflow: "hidden" }}>
              <div className="px-4 py-4 flex items-center gap-3" style={{ background: "rgba(218,106,99,0.1)", borderBottom: "1px solid rgba(218,106,99,0.18)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(218,106,99,0.2)" }}>
                  <Award className="w-5 h-5" style={{ color: "#DA6A63" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm" style={{ color: "#1e2535" }}>External Certification Path</p>
                  <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>Already trained? Submit your existing cert</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(218,106,99,0.2)", color: "#DA6A63", border: "1px solid rgba(218,106,99,0.3)" }}>
                  {extCompleted}/{extSteps.length}
                </span>
              </div>
              <div className="px-5 pt-3 pb-1">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(30,37,53,0.08)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${(extCompleted / extSteps.length) * 100}%`, background: "linear-gradient(90deg, #DA6A63, #FA6F30)" }} />
                </div>
              </div>
              <div className="px-5 pb-4 pt-3 space-y-1.5">
                {extSteps.map((step, i) => (
                  <Link key={i} to={createPageUrl(step.page)}>
                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all hover:bg-white/20">
                      <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: step.done ? "#DA6A63" : step.pending ? "#FA6F30" : "rgba(30,37,53,0.07)", border: step.done || step.pending ? "none" : "1px solid rgba(30,37,53,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {step.done ? <CheckCircle className="w-3.5 h-3.5 text-white" /> : step.pending ? <Clock className="w-3 h-3 text-white" /> : <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(30,37,53,0.3)" }}>{i + 1}</span>}
                      </div>
                      <span style={{ fontSize: 13, color: step.done ? "#1e2535" : "rgba(30,37,53,0.38)", fontWeight: step.done ? 600 : 400 }}>{step.label}</span>
                      {step.pending && !step.done && <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(250,111,48,0.12)", color: "#FA6F30" }}>Under Review</span>}
                    </div>
                  </Link>
                ))}
              </div>
              <div className="px-5 pb-5">
                <Link to={createPageUrl("ProviderCredentialsCoverage")}>
                  <button className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90" style={{ background: "rgba(218,106,99,0.12)", color: "#DA6A63", border: "1px solid rgba(218,106,99,0.28)" }}>
                    Submit External Cert <ArrowRight className="inline w-3.5 h-3.5 ml-1" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Data-driven practice snapshot (shown once MD coverage is active) ── */
        <div>
          <SectionLabel>Your Practice at a Glance</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Treatments & Records */}
            <div className="rounded-2xl overflow-hidden" style={GLASS}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" style={{ color: "#2D6B7F" }} />
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>Treatments</p>
                </div>
                <Link to={createPageUrl("ProviderPractice")} className="text-xs font-semibold hover:opacity-70" style={{ color: "#2D6B7F" }}>View all</Link>
              </div>
              <div className="px-4 py-4 grid grid-cols-3 gap-3">
                {[
                  { label: "Completed", value: completedAppts.length, color: "#C8E63C" },
                  { label: "Documented", value: treatmentRecords.filter(r => r.status !== "draft").length, color: "#7B8EC8" },
                  { label: "Pending MD", value: treatmentRecords.filter(r => r.status === "submitted").length, color: "#FA6F30" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center py-2 rounded-xl" style={{ background: `${color}0d` }}>
                    <p className="text-xl font-bold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>{value}</p>
                    <p style={{ fontSize: 10, color: "rgba(30,37,53,0.45)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{label}</p>
                  </div>
                ))}
              </div>
              {flaggedRecords.length > 0 && (
                <div className="mx-4 mb-4 px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: "rgba(218,106,99,0.1)", border: "1px solid rgba(218,106,99,0.25)" }}>
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#DA6A63" }} />
                  <p className="text-xs font-semibold" style={{ color: "#DA6A63" }}>{flaggedRecords.length} record{flaggedRecords.length > 1 ? "s" : ""} flagged — needs your attention</p>
                </div>
              )}
            </div>

            {/* Coverage & Credentials */}
            <div className="rounded-2xl overflow-hidden" style={GLASS}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(30,37,53,0.06)" }}>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" style={{ color: "#4a6b10" }} />
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>Coverage & Credentials</p>
                </div>
                <Link to={createPageUrl("ProviderCredentialsCoverage")} className="text-xs font-semibold hover:opacity-70" style={{ color: "#4a6b10" }}>Manage</Link>
              </div>
              <div className="px-4 py-4 space-y-2.5">
                {activeSubscriptions.map(sub => (
                  <div key={sub.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.3)" }}>
                    <Zap className="w-4 h-4 flex-shrink-0" style={{ color: "#4a6b10" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: "#1e2535" }}>{sub.service_type_name || "MD Coverage"}</p>
                      <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>Tier {sub.coverage_tier} · Active</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10" }}>✓ Active</span>
                  </div>
                ))}
                {activeCerts.slice(0, 2).map(cert => (
                  <div key={cert.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.18)" }}>
                    <Award className="w-4 h-4 flex-shrink-0" style={{ color: "#7B8EC8" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: "#1e2535" }}>{cert.certification_name}</p>
                      {cert.service_type_name && <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>{cert.service_type_name}</p>}
                    </div>
                  </div>
                ))}
                {expiringLicenses.length > 0 && (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.25)" }}>
                    <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "#FA6F30" }} />
                    <p className="text-xs font-semibold" style={{ color: "#FA6F30" }}>{expiringLicenses.length} license expiring soon — renew now</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Practice performance ── */}
      {completedAppts.length > 0 && (
        <div>
          <SectionLabel>Practice Performance</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Users, label: "Total Patients", value: totalPatients, color: "#2D6B7F" },
              { icon: Repeat, label: "Retention", value: `${retentionRate}%`, color: "#FA6F30" },
              { icon: TrendingUp, label: "Completed", value: completedAppts.length, color: "#C8E63C" },
              { icon: Trophy, label: "Rating", value: avgRating || "—", color: "#DA6A63" },
            ].map(({ icon: Icon, label, value, color }) => (
              <Link key={label} to={createPageUrl("ProviderPractice")}>
                <div className="py-3 px-3 rounded-2xl text-center transition-all hover:scale-[1.02]" style={GLASS}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-1.5" style={{ background: `${color}18` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <p className="text-xl font-bold leading-tight" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>{value}</p>
                  <p style={{ fontSize: 10, color: "rgba(30,37,53,0.45)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{label}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );

  return (
    <ProviderSalesLock feature="dashboard" applicationStatus={accessStatus} requiredTier="courses_only">
      {dashboardContent}
    </ProviderSalesLock>
  );
}