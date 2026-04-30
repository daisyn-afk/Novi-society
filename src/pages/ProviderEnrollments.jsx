import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, Award } from "lucide-react";
import React from "react";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { isToday, isPast } from "date-fns";
import ProviderLockGate from "@/components/ProviderLockGate";
import PreCourseMaterials from "@/components/PreCourseMaterials";
import ProviderSalesLock from "@/components/ProviderSalesLock";
import { useProviderAccess } from "@/components/useProviderAccess";
import ClassDayOnboardingWizard from "@/components/provider/ClassDayOnboardingWizard";
import CourseEnrollmentCard from "@/components/provider/CourseEnrollmentCard";
import CertificationPathway from "@/components/provider/CertificationPathway";
import { isNowWithinSessionRedeemWindow } from "@/lib/classCodeWindow";
import CourseCardDeck from "@/components/provider/CourseCardDeck";
import { adminCoursesApi } from "@/api/adminCoursesApi";

const categoryMeta = {
  injectables:  { label: "Injectables",          color: "#FA6F30" },
  botox:         { label: "Botox & Neurotoxins", color: "#DA6A63" },
  fillers:       { label: "Dermal Fillers",       color: "#C8E63C" },
  laser:         { label: "Laser Treatments",     color: "#7B8EC8" },
  prp:           { label: "PRP Therapy",          color: "#2D6B7F" },
  chemical_peel: { label: "Chemical Peels",       color: "#5a7a20" },
  microneedling: { label: "Microneedling",        color: "#7B8EC8" },
  kybella:       { label: "Kybella",              color: "#FA6F30" },
  skincare:      { label: "Skincare",             color: "#4a6db8" },
  other:         { label: "Other",                color: "#1e2535" },
};

export default function ProviderEnrollments() {
  const { status: accessStatus } = useProviderAccess();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("browse");
  const [search, setSearch] = useState("");
  const [preMaterialsCourse, setPreMaterialsCourse] = useState(null);
  const [onboardingEnrollment, setOnboardingEnrollment] = useState(null);
  const cancelEnrollment = useMutation({
    mutationFn: ({ id }) => base44.entities.Enrollment.update(id, {
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: "Cancelled by provider",
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-enrollments"] }),
  });

  const { data: myEnrollments = [], isLoading } = useQuery({
    queryKey: ["provider-my-enrollments-with-dates"],
    queryFn: async () => {
      const me = await base44.auth.me();
      const [byProviderIdResult, byEmailResult, preOrdersResult] = await Promise.allSettled([
        me?.id ? base44.entities.Enrollment.filter({ provider_id: me.id }, "-created_date") : Promise.resolve([]),
        me?.email ? base44.entities.Enrollment.filter({ provider_email: me.email }, "-created_date") : Promise.resolve([]),
        base44.entities.PreOrder.list("-created_date", 500),
      ]);
      const byProviderId = byProviderIdResult.status === "fulfilled" ? (byProviderIdResult.value || []) : [];
      const byEmail = byEmailResult.status === "fulfilled" ? (byEmailResult.value || []) : [];
      if (preOrdersResult.status !== "fulfilled") {
        throw preOrdersResult.reason || new Error("Unable to load pre-order dates.");
      }
      const preOrders = preOrdersResult.value || [];
      const email = String(me?.email || "").toLowerCase();
      const paidPreOrders = preOrders
        .filter((p) => p?.order_type === "course")
        .filter((p) => ["paid", "confirmed", "completed"].includes(String(p?.status || "").toLowerCase()))
        .filter((p) => String(p?.customer_email || "").toLowerCase() === email);
      const byPreOrderId = new Map(
        [...byProviderId, ...byEmail]
          .filter((row) => row?.pre_order_id)
          .map((row) => [String(row.pre_order_id), row])
      );

      const canonical = paidPreOrders.map((p) => {
          const linked = byPreOrderId.get(String(p.id));
          return {
            id: linked?.id || `preorder-${p.id}`,
            pre_order_id: p.id,
            course_id: p.course_id,
            provider_id: me?.id || null,
            provider_name: p.customer_name,
            provider_email: p.customer_email,
            customer_name: p.customer_name,
            status: linked?.status || (p.status === "completed" ? "confirmed" : p.status),
            session_date: p.course_date,
            amount_paid: linked?.amount_paid ?? p.amount_paid,
            paid_at: linked?.paid_at || p.paid_at || null,
            created_date: p.created_date,
          };
        });

      if (canonical.length > 0) {
        return canonical.sort(
          (a, b) => new Date(b.created_date || b.created_at || 0).getTime() - new Date(a.created_date || a.created_at || 0).getTime()
        );
      }
      return [...byProviderId, ...byEmail].sort(
        (a, b) => new Date(b.created_date || b.created_at || 0).getTime() - new Date(a.created_date || a.created_at || 0).getTime()
      );
    },
    retry: 3,
    refetchOnMount: "always",
    placeholderData: (previousData) => previousData,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: async () => {
      const me = await base44.auth.me();
      const all = await base44.entities.ClassSession.list("-created_date");
      const email = String(me?.email || "").toLowerCase();
      const filtered = (all || []).filter((session) =>
        session?.provider_id === me?.id ||
        String(session?.provider_email || "").toLowerCase() === email
      );
      const deduped = Array.from(new Map(filtered.map((row) => [row.id, row])).values());
      return deduped.sort(
        (a, b) => new Date(b.created_date || b.created_at || 0).getTime() - new Date(a.created_date || a.created_at || 0).getTime()
      );
    },
  });

  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => (await adminCoursesApi.list()).filter((course) => course?.is_active !== false),
  });

  const { data: certs = [] } = useQuery({
    queryKey: ["my-certs"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Certification.filter({ provider_id: me.id });
    },
  });

  const { data: myMDSubs = [] } = useQuery({
    queryKey: ["my-md-subscriptions"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.MDSubscription.filter({ provider_id: me.id });
    },
  });

  const { data: serviceTypes = [], isLoading: loadingServiceTypes } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });

  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));
  const getCourseServiceTypeIds = (course) => {
    if (!course) return [];
    const direct = course.service_type_id ? [course.service_type_id] : [];
    const linked = Array.isArray(course.linked_service_type_ids) ? course.linked_service_type_ids : [];
    const fromCerts = Array.isArray(course.certifications_awarded)
      ? course.certifications_awarded.map((entry) => entry?.service_type_id).filter(Boolean)
      : [];
    return Array.from(new Set([...direct, ...linked, ...fromCerts].map((id) => String(id))));
  };
  const courseMatchesService = (course, serviceTypeId) => {
    if (!course || !serviceTypeId) return false;
    return getCourseServiceTypeIds(course).includes(String(serviceTypeId));
  };
  const sessionByEnrollment = Object.fromEntries(sessions.map(s => [s.enrollment_id, s]));
  const activeSubServiceIds = new Set(myMDSubs.filter(s => s.status === "active").map(s => s.service_type_id));
  const activeEnrollments = myEnrollments.filter(e => e.status !== "cancelled");
  const enrolledCourseIds = new Set(myEnrollments.map(e => e.course_id));

  const todayEnrollment = activeEnrollments.find(e => {
    const course = courseMap[e.course_id];
    const sessionDates = (course?.session_dates || []).sort((a, b) => a.date > b.date ? 1 : -1);
    const nextDate = sessionDates.find(d => d.date && !isPast(new Date(d.date + "T23:59:59")));
    const classDate = e.session_date || nextDate?.date;
    const classIsToday = classDate && isToday(new Date(classDate));
    const isWithinRedeemWindow = classDate && isNowWithinSessionRedeemWindow(course, classDate);
    const session = sessionByEnrollment[e.id];
    const isAttended = session?.code_used || ["attended", "completed"].includes(e.status);
    const linkedServiceIds = getCourseServiceTypeIds(course);
    const needsMDSub = linkedServiceIds.some(id => !activeSubServiceIds.has(id));
    return (classIsToday || isWithinRedeemWindow) && !isAttended && needsMDSub && ["confirmed", "paid"].includes(e.status);
  });

  React.useEffect(() => {
    if (todayEnrollment && !onboardingEnrollment && activeTab === "my") {
      setOnboardingEnrollment(todayEnrollment);
    }
  }, [todayEnrollment, activeTab]);

  const filteredCourses = courses.filter((course) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      course?.title?.toLowerCase().includes(q) ||
      course?.description?.toLowerCase().includes(q)
    );
  });
  const normalizeBrowseCategory = (rawCategory) => {
    const value = String(rawCategory || "").toLowerCase();
    if (!value) return "other";
    if (value === "botox") return "injectables";
    return value;
  };
  const browseCoursesByCategory = filteredCourses.reduce((acc, course) => {
    const key = normalizeBrowseCategory(course.category);
    if (!acc[key]) acc[key] = [];
    acc[key].push(course);
    return acc;
  }, {});
  const browseCategoryOrder = Object.keys(browseCoursesByCategory).sort((a, b) => {
    const aLabel = categoryMeta[a]?.label || a;
    const bLabel = categoryMeta[b]?.label || b;
    return aLabel.localeCompare(bLabel);
  });

  return (
    <ProviderSalesLock feature="enrollments" applicationStatus={accessStatus} requiredTier="courses_only">
    <ProviderLockGate feature="enrollments" bypass>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>Courses</h2>
            <p className="text-sm mt-0.5" style={{ color: "rgba(30,37,53,0.55)" }}>Grow your skills & unlock new services</p>
          </div>
          {activeEnrollments.length > 0 && (
            <button onClick={() => setActiveTab("my")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #7B8EC8, #2D6B7F)" }}>
              <BookOpen className="w-4 h-4" /> My Courses ({activeEnrollments.length})
            </button>
          )}
        </div>

        <div className="flex gap-1 p-1 rounded-2xl w-fit" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.8)" }}>
          {[
            { id: "browse", label: "Browse Courses", icon: Search },
            { id: "my", label: "My Courses", icon: BookOpen, count: activeEnrollments.length },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all"
              style={activeTab === t.id
                ? { background: "white", color: "#1a2540", boxShadow: "0 1px 6px rgba(0,0,0,0.1)" }
                : { color: "rgba(30,37,53,0.55)" }
              }>
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: activeTab === t.id ? "#FA6F30" : "rgba(255,255,255,0.2)", color: "white" }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "browse" && (
          <div className="space-y-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-9 bg-white/95 rounded-xl" placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {(loadingCourses || loadingServiceTypes) ? (
              <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-96 animate-pulse rounded-3xl" style={{ background: "rgba(255,255,255,0.08)" }} />)}</div>
            ) : (() => {
              return browseCategoryOrder.length === 0 ? (
                <div className="text-center py-16" style={{ color: "rgba(30,37,53,0.4)" }}>
                  <Award className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="font-semibold">No courses found</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {browseCategoryOrder.map((categoryKey) => {
                    const categoryCourses = browseCoursesByCategory[categoryKey] || [];
                    return (
                      <CourseCardDeck
                        key={categoryKey}
                        title={categoryMeta[categoryKey]?.label || categoryKey}
                        courses={categoryCourses}
                        isEnrolled={(courseId) => enrolledCourseIds.has(courseId)}
                        onEnroll={(course) => navigate(createPageUrl(`CourseCheckout?course_id=${course.id}`))}
                        onSelect={(course) => navigate(createPageUrl(`CourseCheckout?course_id=${course.id}`))}
                        showControls
                      />
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === "my" && (
          <div className="space-y-6">
            {/* Certification Pathways */}
            {activeEnrollments.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>Your Certification Pathways</p>
                {Array.from(new Set(
                  activeEnrollments.flatMap(e =>
                    getCourseServiceTypeIds(courseMap[e.course_id])
                  )
                )).map(serviceTypeId => {
                  const svcFromCatalog = serviceTypes.find((s) => s.id === serviceTypeId);
                  const fallbackCourse = courses.find((course) =>
                    courseMatchesService(course, serviceTypeId)
                  );
                  const svc = svcFromCatalog || {
                    id: serviceTypeId,
                    name: fallbackCourse?.certification_name || fallbackCourse?.title || "Service Track",
                    category: fallbackCourse?.category || "other",
                  };
                  return (
                    <CertificationPathway
                      key={serviceTypeId}
                      serviceType={svc}
                      courses={courses.filter((course) => courseMatchesService(course, svc.id))}
                      userCerts={certs}
                      userMDSubs={myMDSubs}
                      enrolledCourseIds={enrolledCourseIds}
                      serviceEnrollments={activeEnrollments.filter((enrollment) => {
                        const enrollmentCourse = courseMap[enrollment.course_id];
                        if (!enrollmentCourse) return false;
                        const linkedServiceIds = getCourseServiceTypeIds(enrollmentCourse);
                        return linkedServiceIds.includes(serviceTypeId);
                      })}
                      sessionByEnrollment={sessionByEnrollment}
                      initiallyExpandedCourseId={activeEnrollments.find((e) => {
                        const course = courseMap[e.course_id];
                        if (!course) return false;
                        const linkedServiceIds = getCourseServiceTypeIds(course);
                        return linkedServiceIds.includes(serviceTypeId);
                      })?.course_id || null}
                      onEnroll={() => setActiveTab("browse")}
                      onViewEnrollment={() => {}}
                      onApplyMD={() => navigate(createPageUrl("ProviderCredentialsCoverage") + `?prompt_service=${serviceTypeId}`)}
                    />
                  );
                })}
              </div>
            )}

            {isLoading ? (
              <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-64 animate-pulse rounded-3xl" style={{ background: "rgba(255,255,255,0.15)" }} />)}</div>
            ) : activeEnrollments.length === 0 ? (
              <div className="text-center py-20 rounded-3xl" style={{ background: "rgba(255,255,255,0.1)" }}>
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30 text-white" />
                <p className="font-semibold text-white/70 mb-1">No active enrollments yet</p>
                <p className="text-sm text-white/40 mb-5">Find a course and enroll to get started.</p>
                <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Debug: enrollments={myEnrollments.length}, active={activeEnrollments.length}, courses={courses.length}
                </p>
                <button onClick={() => setActiveTab("browse")} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#FA6F30" }}>
                  Browse Courses →
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-5 max-w-4xl">
                {activeEnrollments.map(e => (
                  (() => {
                    const course = courseMap[e.course_id] || {
                      id: e.course_id || `enrollment-${e.id}`,
                      title: e.course_title || "Course",
                      description: "",
                      session_dates: e.session_date ? [{ date: e.session_date }] : [],
                      linked_service_type_ids: [],
                      certifications_awarded: [],
                    };
                    const classDate = e.session_date || course?.session_dates?.find((d) => d?.date)?.date;
                    const showWizard = Boolean(
                      classDate &&
                      isNowWithinSessionRedeemWindow(course, classDate) &&
                      !sessionByEnrollment[e.id]?.code_used &&
                      ["confirmed", "paid"].includes(e.status)
                    );
                    return (
                  <CourseEnrollmentCard
                    key={e.id}
                    enrollment={e}
                    course={course}
                    session={sessionByEnrollment[e.id]}
                    certs={certs}
                    activeSubServiceIds={activeSubServiceIds}
                    onViewMaterials={() => setPreMaterialsCourse(courseMap[e.course_id])}
                    onCancel={() => { if (window.confirm("Cancel this enrollment?")) cancelEnrollment.mutate({ id: e.id }); }}
                    showClassWizardCta={showWizard}
                    onOpenClassWizard={() => setOnboardingEnrollment(e)}
                  />
                    );
                  })()
                ))}
              </div>
            )}
          </div>
        )}

        {preMaterialsCourse && (
          <PreCourseMaterials
            course={preMaterialsCourse}
            onClose={() => setPreMaterialsCourse(null)}
            onProceed={() => {
              navigate(createPageUrl(`CourseCheckout?course_id=${preMaterialsCourse.id}`));
              setPreMaterialsCourse(null);
            }}
          />
        )}

        {onboardingEnrollment && (
          <ClassDayOnboardingWizard
            enrollment={onboardingEnrollment}
            course={courseMap[onboardingEnrollment.course_id]}
            open={!!onboardingEnrollment}
            onClose={() => setOnboardingEnrollment(null)}
          />
        )}
      </div>
    </ProviderLockGate>
    </ProviderSalesLock>
  );
}