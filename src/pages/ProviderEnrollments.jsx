import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, Award } from "lucide-react";
import React from "react";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import ProviderLockGate from "@/components/ProviderLockGate";
import PreCourseMaterials from "@/components/PreCourseMaterials";
import ProviderSalesLock from "@/components/ProviderSalesLock";
import { useProviderAccess } from "@/components/useProviderAccess";
import CourseEnrollmentCard from "@/components/provider/CourseEnrollmentCard";
import CertificationPathway from "@/components/provider/CertificationPathway";
import CourseCardDeck from "@/components/provider/CourseCardDeck";
import { adminCoursesApi } from "@/api/adminCoursesApi";
import { useAttendanceContext } from "@/components/provider/useAttendanceContext";
import { coursePreCourseMaterials } from "@/lib/preCourseMaterials";

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
  const attendance = useAttendanceContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const getCurrentUser = React.useCallback(
    () =>
      qc.ensureQueryData({
        queryKey: ["me"],
        queryFn: () => base44.auth.me(),
        staleTime: 30_000,
      }),
    [qc]
  );
  const [activeTab, setActiveTab] = useState("browse");
  const [search, setSearch] = useState("");
  const [preMaterialsCourse, setPreMaterialsCourse] = useState(null);
  const cancelEnrollment = useMutation({
    mutationFn: ({ id }) => base44.entities.Enrollment.update(id, {
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: "Cancelled by provider",
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
      qc.invalidateQueries({ queryKey: ["provider-my-enrollments-with-dates"] });
    },
  });

  const {
    data: myEnrollments = [],
    isLoading: loadingEnrollments,
    isFetched: hasFetchedEnrollments,
  } = useQuery({
    queryKey: ["provider-my-enrollments-with-dates"],
    queryFn: async () => {
      const me = await getCurrentUser();
      const [byProviderIdResult, byEmailResult, preOrdersResult] = await Promise.allSettled([
        me?.id ? base44.entities.Enrollment.filter({ provider_id: me.id }, "-created_date") : Promise.resolve([]),
        me?.email ? base44.entities.Enrollment.filter({ provider_email: me.email }, "-created_date") : Promise.resolve([]),
        me?.email
          ? base44.entities.PreOrder.list("-created_date", 500, { customer_email: me.email })
          : Promise.resolve([]),
      ]);
      const byProviderId = byProviderIdResult.status === "fulfilled" ? (byProviderIdResult.value || []) : [];
      const byEmail = byEmailResult.status === "fulfilled" ? (byEmailResult.value || []) : [];
      if (preOrdersResult.status !== "fulfilled") {
        throw preOrdersResult.reason || new Error("Unable to load pre-order dates.");
      }
      const preOrders = preOrdersResult.value || [];
      const email = String(me?.email || "").trim().toLowerCase();
      const paidPreOrders = email
        ? preOrders
            .filter((p) => p?.order_type === "course")
            .filter((p) => Boolean(p?.course_id))
            .filter((p) => ["paid", "confirmed", "completed"].includes(String(p?.status || "").toLowerCase()))
            .filter((p) => String(p?.customer_email || "").trim().toLowerCase() === email)
        : [];
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
    refetchOnMount: true,
    placeholderData: (previousData) => previousData,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: async () => {
      const me = await getCurrentUser();
      const [byProviderIdResult, byEmailResult] = await Promise.allSettled([
        me?.id ? base44.entities.ClassSession.filter({ provider_id: me.id }) : Promise.resolve([]),
        me?.email ? base44.entities.ClassSession.filter({ provider_email: me.email }) : Promise.resolve([]),
      ]);
      const byProviderId = byProviderIdResult.status === "fulfilled" ? (byProviderIdResult.value || []) : [];
      const byEmail = byEmailResult.status === "fulfilled" ? (byEmailResult.value || []) : [];
      const deduped = Array.from(new Map([...byProviderId, ...byEmail].map((row) => [row.id, row])).values());
      return deduped.sort(
        (a, b) => new Date(b.created_date || b.created_at || 0).getTime() - new Date(a.created_date || a.created_at || 0).getTime()
      );
    },
  });

  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => (await adminCoursesApi.list()).filter((course) => course?.is_active !== false),
    staleTime: 0,
  });

  React.useEffect(() => {
    if (!hasFetchedEnrollments) return;
    void qc.invalidateQueries({ queryKey: ["courses"], refetchType: "active" });
  }, [hasFetchedEnrollments, myEnrollments.length, qc]);

  const { data: certs = [] } = useQuery({
    queryKey: ["my-certs"],
    queryFn: async () => {
      const me = await getCurrentUser();
      return base44.entities.Certification.filter({ provider_id: me.id });
    },
  });

  const { data: myMDSubs = [] } = useQuery({
    queryKey: ["my-md-subscriptions"],
    queryFn: async () => {
      const me = await getCurrentUser();
      return base44.entities.MDSubscription.filter({ provider_id: me.id });
    },
  });

  const { data: serviceTypes = [], isLoading: loadingServiceTypes } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });

  const enrichedCourses = courses.map((c) => ({
    ...c,
    pre_course_materials: coursePreCourseMaterials(c),
  }));
  const courseMap = Object.fromEntries(enrichedCourses.map((c) => [c.id, c]));
  const getCourseServiceTypeIds = (course) => {
    if (!course) return [];
    const direct = course.service_type_id ? [course.service_type_id] : [];
    const linked = Array.isArray(course.linked_service_type_ids) ? course.linked_service_type_ids : [];
    const fromCerts = Array.isArray(course.certifications_awarded)
      ? course.certifications_awarded.map((entry) => entry?.service_type_id).filter(Boolean)
      : [];
    return Array.from(new Set([...direct, ...linked, ...fromCerts].map((id) => String(id))));
  };
  /** One pathway per track — avoid duplicating when a course links many service types. */
  const getPrimaryServiceTypeId = (course) => {
    if (!course) return null;
    if (course.service_type_id) return String(course.service_type_id);
    const linked = Array.isArray(course.linked_service_type_ids) ? course.linked_service_type_ids : [];
    if (linked.length > 0) return String(linked[0]);
    const fromCerts = Array.isArray(course.certifications_awarded)
      ? course.certifications_awarded.map((entry) => entry?.service_type_id).filter(Boolean)
      : [];
    if (fromCerts.length > 0) return String(fromCerts[0]);
    return null;
  };
  const resolveEnrollmentCourse = (enrollment) =>
    courseMap[enrollment.course_id] ||
    enrichedCourses.find((c) => String(c.id) === String(enrollment.course_id)) ||
    null;
  const courseMatchesService = (course, serviceTypeId) => {
    if (!course || !serviceTypeId) return false;
    return getCourseServiceTypeIds(course).includes(String(serviceTypeId));
  };
  const sessionByEnrollment = Object.fromEntries(sessions.map(s => [s.enrollment_id, s]));
  const activeSubServiceIds = new Set(myMDSubs.filter(s => s.status === "active").map(s => s.service_type_id));
  const activeEnrollments = myEnrollments.filter(e => e.status !== "cancelled");
  const enrolledCourseIds = new Set(activeEnrollments.map(e => e.course_id));
  const shouldShowEnrollmentStatusLoading = !hasFetchedEnrollments;

  const filteredCourses = enrichedCourses.filter((course) => {
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
                        enrollmentStatusLoading={shouldShowEnrollmentStatusLoading}
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
                  activeEnrollments
                    .map((e) => getPrimaryServiceTypeId(resolveEnrollmentCourse(e)))
                    .filter(Boolean)
                )).map(serviceTypeId => {
                  const svcFromCatalog = serviceTypes.find((s) => s.id === serviceTypeId);
                  const fallbackCourse = enrichedCourses.find((course) =>
                    getPrimaryServiceTypeId(course) === String(serviceTypeId)
                  ) || resolveEnrollmentCourse(
                    activeEnrollments.find((e) => getPrimaryServiceTypeId(resolveEnrollmentCourse(e)) === String(serviceTypeId))
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
                      courses={enrichedCourses.filter((course) => courseMatchesService(course, svc.id))}
                      userCerts={certs}
                      userMDSubs={myMDSubs}
                      enrolledCourseIds={enrolledCourseIds}
                      serviceEnrollments={activeEnrollments.filter((enrollment) => {
                        const enrollmentCourse = resolveEnrollmentCourse(enrollment);
                        return getPrimaryServiceTypeId(enrollmentCourse) === String(serviceTypeId);
                      })}
                      sessionByEnrollment={sessionByEnrollment}
                      initiallyExpandedCourseId={activeEnrollments.find((e) => {
                        const course = resolveEnrollmentCourse(e);
                        return getPrimaryServiceTypeId(course) === String(serviceTypeId);
                      })?.course_id || null}
                      onEnroll={() => setActiveTab("browse")}
                      onApplyMD={() => navigate(createPageUrl("ProviderCredentialsCoverage") + `?prompt_service=${serviceTypeId}`)}
                    />
                  );
                })}
              </div>
            )}

            {loadingEnrollments ? (
              <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-64 animate-pulse rounded-3xl" style={{ background: "rgba(255,255,255,0.15)" }} />)}</div>
            ) : activeEnrollments.length === 0 ? (
              <div className="text-center py-20 rounded-3xl" style={{ background: "rgba(30,37,53,0.08)", border: "1px solid rgba(30,37,53,0.1)" }}>
                <BookOpen className="w-12 h-12 mx-auto mb-3" style={{ color: "rgba(30,37,53,0.3)" }} />
                <p className="font-semibold mb-1" style={{ color: "rgba(30,37,53,0.75)" }}>You have not enrolled in any courses yet</p>
                <p className="text-sm mb-6" style={{ color: "rgba(30,37,53,0.45)" }}>Enroll in a NOVI course to unlock MD coverage and grow your skills.</p>
                <button onClick={() => setActiveTab("browse")} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#FA6F30" }}>
                  Browse Courses →
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-5 max-w-4xl">
                {activeEnrollments.map(e => (
                  (() => {
                    const course =
                      courseMap[e.course_id] ||
                      enrichedCourses.find((c) => String(c.id) === String(e.course_id)) || {
                        id: e.course_id || `enrollment-${e.id}`,
                        title: e.course_title || "Course",
                        description: "",
                        session_dates: e.session_date ? [{ date: e.session_date }] : [],
                        linked_service_type_ids: [],
                        certifications_awarded: [],
                        pre_course_materials: [],
                      };
                    return (
                  <CourseEnrollmentCard
                    key={e.id}
                    enrollment={e}
                    course={course}
                    session={sessionByEnrollment[e.id]}
                    certs={certs}
                    activeSubServiceIds={activeSubServiceIds}
                    onViewMaterials={() => setPreMaterialsCourse(course)}
                    onCancel={() => { if (window.confirm("Cancel this enrollment?")) cancelEnrollment.mutate({ id: e.id }); }}
                    attendanceWindow={attendance.getWindowByEnrollment(e)}
                    isSubmittingAttendance={attendance.isSubmitting}
                    onSubmitAttendance={({ code, windowEntry }) =>
                      attendance.submitAttendance({ code, windowEntry })
                    }
                  />
                    );
                  })()
                ))}
              </div>
            )}
          </div>
        )}

        {preMaterialsCourse && coursePreCourseMaterials(preMaterialsCourse).length > 0 && (
          <PreCourseMaterials
            open={!!preMaterialsCourse}
            course={preMaterialsCourse}
            onClose={() => setPreMaterialsCourse(null)}
          />
        )}

      </div>
    </ProviderLockGate>
    </ProviderSalesLock>
  );
}