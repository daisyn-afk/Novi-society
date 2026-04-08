import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search, Shield, Award, FileText, BookOpen, CreditCard,
  AlertCircle, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Mail, TrendingUp, Zap, User
} from "lucide-react";

const FUNNEL_STAGES = [
  { key: "no_license", label: "No License Uploaded", color: "#DA6A63", bg: "rgba(218,106,99,0.1)", icon: AlertCircle, pitch: "Needs to upload license to unlock courses." },
  { key: "pending_license", label: "License Pending Review", color: "#FA6F30", bg: "rgba(250,111,48,0.1)", icon: Clock, pitch: "License submitted — awaiting verification." },
  { key: "no_enrollment", label: "License Verified, No Course", color: "#7B8EC8", bg: "rgba(123,142,200,0.12)", icon: BookOpen, pitch: "Ready to enroll — great time to upsell a course." },
  { key: "enrolled", label: "Enrolled, No Subscription", color: "#C8E63C", bg: "rgba(200,230,60,0.12)", icon: TrendingUp, pitch: "Taking a course — ready to sell MD subscription." },
  { key: "active", label: "Fully Active", color: "#22c55e", bg: "rgba(34,197,94,0.1)", icon: CheckCircle2, pitch: "Active subscriber on the platform." },
];

function getStage(provider, licenses, enrollments, mdSubs) {
  const provLicenses = licenses.filter(l => l.provider_id === provider.id);
  const hasVerified = provLicenses.some(l => l.status === "verified");
  const hasPending = provLicenses.some(l => l.status === "pending_review");
  const hasEnrollment = enrollments.some(e => e.provider_id === provider.id && !["cancelled"].includes(e.status));
  const hasSub = mdSubs.some(s => s.provider_id === provider.id && s.status === "active");

  if (hasSub) return "active";
  if (hasEnrollment) return "enrolled";
  if (hasVerified) return "no_enrollment";
  if (hasPending) return "pending_license";
  return "no_license";
}

function ProviderRow({ provider, licenses, certs, enrollments, mdSubs }) {
  const [expanded, setExpanded] = useState(false);

  const provLicenses = licenses.filter(l => l.provider_id === provider.id);
  const provCerts = certs.filter(c => c.provider_id === provider.id);
  const provEnrollments = enrollments.filter(e => e.provider_id === provider.id);
  const provSubs = mdSubs.filter(s => s.provider_id === provider.id);
  const stageKey = getStage(provider, licenses, enrollments, mdSubs);
  const stage = FUNNEL_STAGES.find(s => s.key === stageKey);
  const StageIcon = stage.icon;

  // Progress: 0-4 steps
  const steps = [
    { label: "Registered", done: true },
    { label: "License", done: provLicenses.length > 0 },
    { label: "Verified", done: provLicenses.some(l => l.status === "verified") },
    { label: "Enrolled", done: provEnrollments.length > 0 },
    { label: "Subscribed", done: provSubs.some(s => s.status === "active") },
  ];
  const progressPct = Math.round((steps.filter(s => s.done).length / steps.length) * 100);

  return (
    <div className="rounded-2xl overflow-hidden transition-all" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 2px 10px rgba(30,37,53,0.06)" }}>
      {/* Main row */}
      <button className="w-full text-left px-5 py-4 hover:bg-black/5 transition-colors" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-4">
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarFallback style={{ background: "linear-gradient(135deg, #7B8EC8, #4a6db8)", color: "white", fontSize: 14, fontWeight: 700 }}>
              {provider.full_name?.[0] || provider.email?.[0] || "P"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-sm" style={{ color: "#1e2535" }}>{provider.full_name || "—"}</span>
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: stage.bg, color: stage.color }}>
                <StageIcon className="w-2.5 h-2.5" />{stage.label}
              </span>
            </div>
            <p className="text-xs flex items-center gap-1" style={{ color: "rgba(30,37,53,0.5)" }}>
              <Mail className="w-3 h-3" />{provider.email}
            </p>
          </div>

          {/* Progress bar */}
          <div className="hidden sm:block w-32 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold" style={{ color: "rgba(30,37,53,0.5)" }}>Journey</span>
              <span className="text-xs font-bold" style={{ color: progressPct === 100 ? "#22c55e" : "#7B8EC8" }}>{progressPct}%</span>
            </div>
            <div className="w-full rounded-full h-1.5" style={{ background: "rgba(30,37,53,0.08)" }}>
              <div className="h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%`, background: progressPct === 100 ? "#22c55e" : "linear-gradient(90deg, #7B8EC8, #C8E63C)" }} />
            </div>
          </div>

          {/* Stats */}
          <div className="hidden md:flex gap-4 flex-shrink-0 text-center">
            <div>
              <p className="text-base font-black" style={{ color: "#1e2535" }}>{provLicenses.length}</p>
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>Licenses</p>
            </div>
            <div>
              <p className="text-base font-black" style={{ color: "#1e2535" }}>{provCerts.length}</p>
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>Certs</p>
            </div>
            <div>
              <p className="text-base font-black" style={{ color: "#1e2535" }}>{provEnrollments.length}</p>
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>Courses</p>
            </div>
            <div>
              <p className="text-base font-black" style={{ color: provSubs.some(s => s.status === "active") ? "#22c55e" : "rgba(30,37,53,0.25)" }}>
                {provSubs.filter(s => s.status === "active").length}
              </p>
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>Subs</p>
            </div>
          </div>

          {expanded ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.3)" }} /> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(30,37,53,0.3)" }} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t px-5 py-4 space-y-4" style={{ borderColor: "rgba(30,37,53,0.06)" }}>
          {/* Sales pitch / next action */}
          {stageKey !== "active" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: stage.bg, border: `1px solid ${stage.color}30` }}>
              <Zap className="w-4 h-4 flex-shrink-0" style={{ color: stage.color }} />
              <p className="text-sm font-semibold" style={{ color: stage.color }}>
                <strong>Next Action:</strong> {stage.pitch}
              </p>
            </div>
          )}

          {/* Journey steps */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Journey Progress</p>
            <div className="flex gap-2 flex-wrap">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: step.done ? "rgba(34,197,94,0.1)" : "rgba(30,37,53,0.06)", color: step.done ? "#22c55e" : "rgba(30,37,53,0.4)", border: `1px solid ${step.done ? "rgba(34,197,94,0.25)" : "rgba(30,37,53,0.08)"}` }}>
                  {step.done ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: "rgba(30,37,53,0.2)" }} />}
                  {step.label}
                </div>
              ))}
            </div>
          </div>

          {/* Licenses */}
          {provLicenses.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(30,37,53,0.4)" }}>Licenses</p>
              <div className="flex flex-wrap gap-2">
                {provLicenses.map(l => (
                  <span key={l.id} className="text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={{ background: l.status === "verified" ? "rgba(34,197,94,0.1)" : l.status === "rejected" ? "rgba(218,106,99,0.1)" : "rgba(250,111,48,0.1)", color: l.status === "verified" ? "#22c55e" : l.status === "rejected" ? "#DA6A63" : "#FA6F30" }}>
                    {l.license_type} ({l.issuing_state}) — {l.status.replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {provCerts.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(30,37,53,0.4)" }}>Certifications</p>
              <div className="flex flex-wrap gap-2">
                {provCerts.map(c => (
                  <span key={c.id} className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: "rgba(200,230,60,0.12)", color: "#4a6b10" }}>
                    {c.certification_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Enrollments */}
          {provEnrollments.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(30,37,53,0.4)" }}>Enrollments</p>
              <div className="flex flex-wrap gap-2">
                {provEnrollments.map(e => (
                  <span key={e.id} className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: "rgba(123,142,200,0.12)", color: "#7B8EC8" }}>
                    {e.status.replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Subscriptions */}
          {provSubs.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(30,37,53,0.4)" }}>MD Subscriptions</p>
              <div className="flex flex-wrap gap-2">
                {provSubs.map(s => (
                  <span key={s.id} className="text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={{ background: s.status === "active" ? "rgba(34,197,94,0.1)" : "rgba(218,106,99,0.1)", color: s.status === "active" ? "#22c55e" : "#DA6A63" }}>
                    {s.service_type_name} — {s.status}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs" style={{ color: "rgba(30,37,53,0.3)" }}>
            Joined {provider.created_date ? new Date(provider.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
          </p>
        </div>
      )}
    </div>
  );
}

const STAGE_FILTER_OPTIONS = [{ key: "all", label: "All" }, ...FUNNEL_STAGES.map(s => ({ key: s.key, label: s.label }))];

export default function AdminProviders() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  const { data: users = [], isLoading } = useQuery({ queryKey: ["users"], queryFn: () => base44.entities.User.list() });
  const { data: licenses = [] } = useQuery({ queryKey: ["licenses"], queryFn: () => base44.entities.License.list() });
  const { data: certs = [] } = useQuery({ queryKey: ["certifications"], queryFn: () => base44.entities.Certification.list() });
  const { data: enrollments = [] } = useQuery({ queryKey: ["enrollments"], queryFn: () => base44.entities.Enrollment.list() });
  const { data: mdSubs = [] } = useQuery({ queryKey: ["md-subs"], queryFn: () => base44.entities.MDSubscription.list() });

  const providers = users.filter(u => u.role === "provider" || !u.role);

  const filtered = providers.filter(p => {
    const matchSearch = !search || p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === "all" || getStage(p, licenses, enrollments, mdSubs) === stageFilter;
    return matchSearch && matchStage;
  });

  // Stage counts for pills
  const stageCounts = FUNNEL_STAGES.reduce((acc, s) => {
    acc[s.key] = providers.filter(p => getStage(p, licenses, enrollments, mdSubs) === s.key).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: "#1e2535" }}>Providers</h2>
        <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>{providers.length} users on the provider path</p>
      </div>

      {/* Funnel summary pills */}
      <div className="flex flex-wrap gap-2">
        {FUNNEL_STAGES.map(s => {
          const SIcon = s.icon;
          const count = stageCounts[s.key] || 0;
          return (
            <button key={s.key} onClick={() => setStageFilter(stageFilter === s.key ? "all" : s.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: stageFilter === s.key ? s.bg : "rgba(255,255,255,0.5)", color: stageFilter === s.key ? s.color : "rgba(30,37,53,0.55)", border: `1px solid ${stageFilter === s.key ? s.color + "40" : "rgba(255,255,255,0.6)"}`, boxShadow: "0 1px 4px rgba(30,37,53,0.05)" }}>
              <SIcon className="w-3 h-3" />
              {s.label}
              <span className="font-black ml-0.5">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(30,37,53,0.3)" }} />
        <Input className="pl-9" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.7)" }} />
      </div>

      {/* Provider list */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.4)" }} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-3xl" style={{ background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.6)" }}>
          <User className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.2)" }} />
          <p className="font-semibold" style={{ color: "rgba(30,37,53,0.5)" }}>No providers found</p>
          <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.35)" }}>
            {search || stageFilter !== "all" ? "Try adjusting your filters." : "Users who select the provider path will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <ProviderRow key={p.id} provider={p} licenses={licenses} certs={certs} enrollments={enrollments} mdSubs={mdSubs} />
          ))}
        </div>
      )}
    </div>
  );
}