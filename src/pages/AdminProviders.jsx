import React, { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  FileCheck,
  GraduationCap,
  Info,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Shield,
  Stethoscope,
  Trash2,
  TrendingUp,
  Users as UsersIcon
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { adminUsersApi } from "@/api/adminUsersApi";
import {
  ADMIN_PROVIDER_LIFECYCLE_FILTERS,
  buildAdminProviderLifecycleIndex,
  classifyAdminProviderLifecycle,
  rowsForProvider,
} from "@/lib/adminProviderLifecycle";
import {
  summarizeProviderMemberships,
} from "@/lib/providerMembershipSummary";
import {
  expandActiveServiceIds,
  serviceDisplayName,
  treatmentMenuServiceTypes,
} from "@/lib/serviceTypeMembershipModel";
import { fetchLaunchRoadmapPhases } from "@/api/launchRoadmapApi";
import {
  computeLaunchRoadmapStats,
  getStaticLaunchRoadmapPhases,
  mergeLaunchRoadmapPhases,
} from "@/lib/launchRoadmapUtils";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  is_active: true
};

const PAGE_SIZE = 10;
const PROVIDER_FETCH_LIMIT = 500;

const LIFECYCLE_FILTER_ICONS = {
  no_license: Compass,
  license_pending_review: Clock,
  license_verified_no_course: BookOpen,
  cert_pending_review: FileCheck,
  applied_md_coverage: Shield,
  enrolled_no_subscription: TrendingUp,
  fully_active: CheckCircle2,
};

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function mergeProviderContext(provider, profile = null) {
  if (!profile) return provider;
  return {
    ...provider,
    ...profile,
    id: profile.id || provider.auth_user_id || provider.id,
    auth_user_id: profile.auth_user_id || provider.auth_user_id,
    users_id: profile.users_id || provider.id,
    email: profile.email || provider.email,
  };
}

function getProviderPerformedTreatments(provider, treatmentRecords = []) {
  const providerRecords = rowsForProvider(provider, treatmentRecords);
  const byService = {};

  for (const record of providerRecords) {
    const svc = record.service || record.service_type_name || "Unknown";
    if (!byService[svc]) byService[svc] = { name: svc, count: 0 };
    byService[svc].count += 1;
  }

  return Object.values(byService).sort((a, b) => b.count - a.count);
}

function getProviderLiveTreatments(provider, serviceTypes = [], mdSubscriptions = []) {
  const providerSubs = rowsForProvider(provider, mdSubscriptions);
  const activeSubs = providerSubs.filter((sub) => String(sub.status || "").toLowerCase() === "active");
  const activeServiceIds = expandActiveServiceIds(activeSubs, serviceTypes);
  const offerings = provider?.service_offerings_v2 || {};

  const liveFromOfferings = Object.entries(offerings)
    .filter(([, value]) => value?.is_live)
    .map(([serviceTypeId]) => {
      const service = serviceTypes.find((st) => String(st.id) === String(serviceTypeId));
      return {
        id: serviceTypeId,
        name: service ? serviceDisplayName(service, serviceTypes) : serviceTypeId,
        source: "live",
      };
    });

  if (liveFromOfferings.length > 0) {
    return liveFromOfferings.sort((a, b) => a.name.localeCompare(b.name));
  }

  return treatmentMenuServiceTypes(serviceTypes, activeServiceIds).map((service) => ({
    id: service.id,
    name: serviceDisplayName(service, serviceTypes),
    source: "covered",
  }));
}

function computeProviderGrowthStudio(provider, {
  licenses = [],
  certs = [],
  enrollments = [],
  mdSubs = [],
  mdRelationships = [],
  roadmapPhases = [],
}) {
  const phases = roadmapPhases?.length
    ? mergeLaunchRoadmapPhases(roadmapPhases, getStaticLaunchRoadmapPhases())
    : getStaticLaunchRoadmapPhases();

  return computeLaunchRoadmapStats({
    me: provider,
    licenses: rowsForProvider(provider, licenses),
    certs: rowsForProvider(provider, certs),
    enrollments: rowsForProvider(provider, enrollments),
    mdSubs: rowsForProvider(provider, mdSubs),
    mdRelationships: rowsForProvider(provider, mdRelationships),
    phases,
  });
}

function ProviderDetailPanel({
  provider,
  allMdSubscriptions = [],
  allTreatmentRecords = [],
  serviceTypes = [],
  allLicenses = [],
  allCerts = [],
  allEnrollments = [],
  allMdRelationships = [],
  roadmapPhases = [],
}) {
  const { data: providerDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-provider-detail", provider.id],
    queryFn: () => adminUsersApi.getProviderDetail(provider.id),
    enabled: Boolean(provider?.id),
    staleTime: 60_000,
  });

  const profile = mergeProviderContext(provider, providerDetail?.profile);
  const membership = summarizeProviderMemberships(profile, allMdSubscriptions, serviceTypes);
  const liveTreatments = getProviderLiveTreatments(profile, serviceTypes, allMdSubscriptions);
  const performedTreatments = getProviderPerformedTreatments(profile, allTreatmentRecords);
  const growthStats = computeProviderGrowthStudio(profile, {
    licenses: allLicenses,
    certs: allCerts,
    enrollments: allEnrollments,
    mdSubs: allMdSubscriptions,
    mdRelationships: allMdRelationships,
    roadmapPhases,
  });

  const activeCoverages = membership.activeSubs.length
    ? membership.activeSubs.map((sub) => {
        const service = serviceTypes.find((st) => String(st.id) === String(sub.service_type_id));
        return {
          id: sub.id || sub.service_type_id,
          name: service?.name || sub.service_type_name || sub.service_type_id || "Coverage",
        };
      })
    : membership.rows.filter((row) => row.has_active).map((row) => ({
        id: row.service_type_id,
        name: row.service_type_name,
      }));

  const phone = profile?.phone || profile?.phone_number || null;
  const email = profile?.email || null;
  const practiceName = profile?.practice_name || null;

  if (detailLoading) {
    return (
      <div
        className="px-6 py-5 border-t"
        style={{
          background: "rgba(30,37,53,0.02)",
          borderColor: "rgba(30,37,53,0.06)",
        }}
      >
        <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className="px-6 py-5 border-t"
      style={{
        background: "rgba(30,37,53,0.02)",
        borderColor: "rgba(30,37,53,0.06)",
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>
            Basic Information
          </h4>
          <div className="space-y-2">
            {practiceName ? (
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>
                {practiceName}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" style={{ color: "rgba(30,37,53,0.35)" }} />
              <span className="text-sm" style={{ color: "#1e2535" }}>
                {email || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5" style={{ color: "rgba(30,37,53,0.35)" }} />
              <span className="text-sm" style={{ color: "#1e2535" }}>
                {phone || "Not provided"}
              </span>
            </div>
            {profile?.city || profile?.state ? (
              <div className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
                {[profile.city, profile.state].filter(Boolean).join(", ")}
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>
            Active MD Coverages
          </h4>
          {activeCoverages.length === 0 ? (
            <p className="text-sm" style={{ color: "rgba(30,37,53,0.4)" }}>
              No active coverages
            </p>
          ) : (
            <div className="space-y-1.5">
              {activeCoverages.map((cov) => (
                <div
                  key={cov.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                  style={{ background: "rgba(34,197,94,0.08)" }}
                >
                  <Shield className="w-3.5 h-3.5" style={{ color: "#22c55e" }} />
                  <span className="text-xs font-medium" style={{ color: "#1e2535" }}>
                    {cov.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>
            Treatments
          </h4>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                Live on menu
              </p>
              {liveTreatments.length === 0 ? (
                <p className="text-sm" style={{ color: "rgba(30,37,53,0.4)" }}>
                  No live treatments
                </p>
              ) : (
                <div className="space-y-1.5">
                  {liveTreatments.slice(0, 4).map((treatment) => (
                    <div
                      key={treatment.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                      style={{ background: "rgba(45,107,127,0.08)" }}
                    >
                      <Stethoscope className="w-3.5 h-3.5" style={{ color: "#2D6B7F" }} />
                      <span className="text-xs font-medium" style={{ color: "#1e2535" }}>
                        {treatment.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                Performed
              </p>
              {performedTreatments.length === 0 ? (
                <p className="text-sm" style={{ color: "rgba(30,37,53,0.4)" }}>
                  No treatment records yet
                </p>
              ) : (
                <div className="space-y-1.5">
                  {performedTreatments.slice(0, 4).map((treatment) => (
                    <div
                      key={treatment.name}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg"
                      style={{ background: "rgba(30,37,53,0.05)" }}
                    >
                      <span className="text-xs font-medium" style={{ color: "#1e2535" }}>
                        {treatment.name}
                      </span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: "#2D6B7F" }}>
                        {treatment.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>
            Growth Studio Progress
          </h4>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>Overall</span>
                <span className="text-xs font-bold" style={{ color: "#1e2535" }}>
                  {growthStats.overallPct}%
                </span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: "rgba(30,37,53,0.08)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${growthStats.overallPct}%`,
                    background: "linear-gradient(90deg, #C8E63C, #2D6B7F)",
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              {growthStats.phases
                .filter((phase) => !phase.comingSoon)
                .slice(0, 3)
                .map((phase) => (
                  <div key={phase.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="w-3 h-3" style={{ color: "rgba(30,37,53,0.35)" }} />
                      <span className="text-xs" style={{ color: "rgba(30,37,53,0.7)" }}>
                        {phase.label}
                      </span>
                    </div>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: phase.complete ? "#22c55e" : "rgba(30,37,53,0.45)" }}
                    >
                      {phase.pct != null ? `${phase.pct}%` : "—"}
                    </span>
                  </div>
                ))}
            </div>

            {growthStats.nextAction ? (
              <div
                className="mt-2 px-2 py-1.5 rounded-lg text-xs"
                style={{ background: "rgba(200,230,60,0.12)", color: "#6b8f1a" }}
              >
                <span className="font-semibold">Next:</span>{" "}
                {growthStats.nextAction.label || growthStats.nextAction.id}
              </div>
            ) : growthStats.overallPct === 100 ? (
              <div
                className="mt-2 px-2 py-1.5 rounded-lg text-xs"
                style={{ background: "rgba(34,197,94,0.1)", color: "#15803d" }}
              >
                Growth Studio complete
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminProviders() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [sendingPasswordResetId, setSendingPasswordResetId] = useState(null);
  const debouncedSearch = useDebounced(search, 300);

  const { data: allMdSubscriptions = [] } = useQuery({
    queryKey: ["admin-all-md-subscriptions"],
    queryFn: () => base44.entities.MDSubscription.list(),
  });

  const { data: allLicenses = [] } = useQuery({
    queryKey: ["admin-provider-licenses"],
    queryFn: () => base44.entities.License.list("-created_date", PROVIDER_FETCH_LIMIT),
  });

  const { data: allCerts = [] } = useQuery({
    queryKey: ["admin-provider-certs"],
    queryFn: () => base44.entities.Certification.list(),
  });

  const { data: allEnrollments = [] } = useQuery({
    queryKey: ["admin-provider-enrollments"],
    queryFn: () => base44.entities.Enrollment.list("-created_date", PROVIDER_FETCH_LIMIT),
  });

  const { data: coursePreOrders = [] } = useQuery({
    queryKey: ["admin-provider-preorders"],
    queryFn: () => base44.entities.PreOrder.list("-created_date", PROVIDER_FETCH_LIMIT),
  });

  const { data: allTreatmentRecords = [] } = useQuery({
    queryKey: ["admin-all-treatment-records"],
    queryFn: () => base44.entities.TreatmentRecord.list("-created_date", PROVIDER_FETCH_LIMIT),
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["admin-service-types"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });

  const { data: roadmapPhases = [] } = useQuery({
    queryKey: ["launch-roadmap-phases"],
    queryFn: fetchLaunchRoadmapPhases,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allMdRelationships = [] } = useQuery({
    queryKey: ["admin-all-md-relationships"],
    queryFn: () => base44.entities.MedicalDirectorRelationship.list("-created_date", PROVIDER_FETCH_LIMIT),
  });

  const [expandedProviderId, setExpandedProviderId] = useState(null);

  const lifecycleDatasets = useMemo(
    () => ({
      licenses: allLicenses,
      certs: allCerts,
      enrollments: allEnrollments,
      preOrders: coursePreOrders,
      mdSubs: allMdSubscriptions,
    }),
    [allLicenses, allCerts, allEnrollments, coursePreOrders, allMdSubscriptions]
  );

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["admin-providers", { q: debouncedSearch, isActive: activeFilter }],
    queryFn: () =>
      adminUsersApi.list({
        page: 1,
        pageSize: PROVIDER_FETCH_LIMIT,
        q: debouncedSearch,
        role: "provider",
        isActive: activeFilter === "all" ? "" : activeFilter,
      }),
    placeholderData: keepPreviousData,
  });

  const allProviders = data?.data || [];

  const lifecycleIndex = useMemo(
    () => buildAdminProviderLifecycleIndex(allProviders, lifecycleDatasets),
    [allProviders, lifecycleDatasets]
  );

  const filteredProviders = useMemo(() => {
    if (lifecycleFilter === "all") return allProviders;
    return allProviders.filter(
      (provider) => classifyAdminProviderLifecycle(provider, lifecycleDatasets).stage === lifecycleFilter
    );
  }, [allProviders, lifecycleFilter, lifecycleDatasets]);

  const total = filteredProviders.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const providers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredProviders.slice(start, start + PAGE_SIZE);
  }, [filteredProviders, page]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editing?.id) {
        const body = {
          email: payload.email,
          first_name: payload.first_name,
          last_name: payload.last_name,
          role: "provider",
          is_active: payload.is_active
        };
        if (payload.password) body.password = payload.password;
        return adminUsersApi.update(editing.id, body);
      }
      return adminUsersApi.create({
        ...payload,
        role: "provider"
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-providers"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setFormError("");
    },
    onError: (err) => setFormError(err?.message || "Unable to save provider.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminUsersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-providers"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleteTarget(null);
    }
  });

  const passwordResetMutation = useMutation({
    mutationFn: (id) => adminUsersApi.sendPasswordReset(id),
    onSuccess: (data) => {
      toast({
        title: "Password reset email sent",
        description: `A set-password link was sent to ${data?.email || "the provider"}.`
      });
    },
    onError: (err) => {
      toast({
        title: "Could not send email",
        description: err?.message || "Request failed. Try again.",
        variant: "destructive"
      });
    },
    onSettled: () => setSendingPasswordResetId(null)
  });

  const handleSendPasswordReset = (provider) => {
    if (!provider?.id || !provider?.email) return;
    setSendingPasswordResetId(provider.id);
    passwordResetMutation.mutate(provider.id);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (provider) => {
    setEditing(provider);
    setForm({
      first_name: provider.first_name || "",
      last_name: provider.last_name || "",
      email: provider.email || "",
      password: "",
      is_active: provider.is_active !== false
    });
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = () => {
    setFormError("");
    const email = form.email.trim();
    if (!email) {
      setFormError("Email is required.");
      return;
    }
    if (!editing && (!form.password || form.password.length < 8)) {
      setFormError("Password is required and must be at least 8 characters.");
      return;
    }
    if (editing && form.password && form.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    saveMutation.mutate({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email,
      password: form.password,
      is_active: form.is_active
    });
  };

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: "#1e2535" }}>
            Providers
          </h2>
          <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>
            {allProviders.length} provider{allProviders.length === 1 ? "" : "s"} on the platform
          </p>
        </div>
        <Button onClick={openCreate} style={{ background: "#C8E63C", color: "#1a2540" }}>
          <Plus className="w-4 h-4 mr-1" /> New Provider
        </Button>
      </div>

      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap gap-2">
          {ADMIN_PROVIDER_LIFECYCLE_FILTERS.map((filter) => {
            const Icon = LIFECYCLE_FILTER_ICONS[filter.id] || AlertCircle;
            const count = lifecycleIndex.counts[filter.id] || 0;
            const active = lifecycleFilter === filter.id;
            return (
              <div key={filter.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setLifecycleFilter(active ? "all" : filter.id);
                    setPage(1);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: active ? filter.bg : "rgba(255,255,255,0.5)",
                    color: active ? filter.color : "rgba(30,37,53,0.55)",
                    border: `1px solid ${active ? `${filter.color}40` : "rgba(255,255,255,0.6)"}`,
                    boxShadow: "0 1px 4px rgba(30,37,53,0.05)",
                  }}
                >
                  <Icon className="w-3 h-3 flex-shrink-0" />
                  {filter.label}
                  <span className="font-black ml-0.5 tabular-nums">{count}</span>
                </button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
                      style={{ color: "rgba(30,37,53,0.35)" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-xs text-xs leading-relaxed"
                    style={{ background: "#1e2535", color: "#fff" }}
                  >
                    {filter.description}
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </TooltipProvider>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "rgba(30,37,53,0.3)" }}
          />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email..."
            className="pl-9"
            style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.7)" }}
          />
        </div>
        <select
          className="h-10 rounded-xl px-3 py-2 text-sm"
          style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.7)" }}
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.6)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.7)",
          boxShadow: "0 2px 10px rgba(30,37,53,0.06)",
        }}
      >
            <Table>
              <TableHeader>
                <TableRow style={{ background: "rgba(30,37,53,0.04)" }}>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {error ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-red-600">
                      {error?.message || "Failed to load providers."}
                    </TableCell>
                  </TableRow>
                ) : isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={5}>
                        <div className="h-5 bg-slate-100 rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : providers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16">
                      <UsersIcon className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.2)" }} />
                      <p className="font-semibold text-sm" style={{ color: "rgba(30,37,53,0.5)" }}>
                        No providers found
                      </p>
                      <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.35)" }}>
                        {search || lifecycleFilter !== "all" || activeFilter !== "all"
                          ? "Try adjusting your filters."
                          : "Create a provider to get started."}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  providers.map((provider) => {
                    const isExpanded = expandedProviderId === provider.id;
                    const lifecycle = classifyAdminProviderLifecycle(provider, lifecycleDatasets);
                    const filterDef = ADMIN_PROVIDER_LIFECYCLE_FILTERS.find((f) => f.id === lifecycle.stage);
                    
                    return (
                      <React.Fragment key={provider.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                          onClick={() => setExpandedProviderId(isExpanded ? null : provider.id)}
                        >
                          <TableCell className="font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-100"
                                style={{ color: "rgba(30,37,53,0.4)" }}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                              {provider.full_name || `${provider.first_name || ""} ${provider.last_name || ""}`.trim() || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-700">{provider.email}</TableCell>
                          <TableCell>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: filterDef?.bg || "rgba(148,163,184,0.1)",
                                color: filterDef?.color || "#94a3b8",
                              }}
                            >
                              {filterDef?.label || "Unknown"}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs">
                            {formatDate(provider.created_at)}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Send password reset email"
                              disabled={sendingPasswordResetId === provider.id}
                              onClick={() => handleSendPasswordReset(provider)}
                            >
                              <Mail className="w-4 h-4 text-slate-500" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(provider)}>
                              <Pencil className="w-4 h-4 text-slate-500" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(provider)}>
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={5} className="p-0">
                              <ProviderDetailPanel
                                provider={provider}
                                allMdSubscriptions={allMdSubscriptions}
                                allTreatmentRecords={allTreatmentRecords}
                                serviceTypes={serviceTypes}
                                allLicenses={allLicenses}
                                allCerts={allCerts}
                                allEnrollments={allEnrollments}
                                allMdRelationships={allMdRelationships}
                                roadmapPhases={roadmapPhases}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>

        <div
          className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 border-t"
          style={{ borderColor: "rgba(30,37,53,0.06)" }}
        >
          <div className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
            {total === 0
              ? "No results"
              : `Showing ${from}-${to} of ${total}${isFetching ? " (updating...)" : ""}`}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </Button>
            <span className="text-xs px-2" style={{ color: "rgba(30,37,53,0.6)" }}>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setForm(EMPTY_FORM);
            setFormError("");
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.email}` : "Create Provider"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  First name
                </label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  placeholder="Jane"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Last name
                </label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Email *</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="provider@example.com"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">
                {editing ? "New password (leave blank to keep current)" : "Password *"}
              </label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editing ? "••••••••" : "Minimum 8 characters"}
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700 h-10">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, is_active: e.target.checked }))
                  }
                />
                Active
              </label>
            </div>

            {editing ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-600 mb-2">
                  Send a one-time link so this provider can set or reset their password.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sendingPasswordResetId === editing.id}
                  onClick={() => handleSendPasswordReset(editing)}
                >
                  <Mail className="w-4 h-4 mr-1" />
                  {sendingPasswordResetId === editing.id ? "Sending…" : "Send password reset email"}
                </Button>
              </div>
            ) : null}

            {formError ? (
              <p className="text-sm text-red-600">{formError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              style={{ background: "#C8E63C", color: "#1a2540" }}
            >
              {saveMutation.isPending ? "Saving..." : editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete provider?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            This will permanently remove{" "}
            <strong>{deleteTarget?.email}</strong> from Supabase Auth and the users table.
          </p>
          {deleteMutation.error ? (
            <p className="text-sm text-red-600">
              {deleteMutation.error?.message || "Delete failed."}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}