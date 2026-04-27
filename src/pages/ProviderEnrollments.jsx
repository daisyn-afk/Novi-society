import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BookOpen, Clock, Award, CheckCircle,
  Search, Calendar, MapPin, Users,
} from "lucide-react";
import React from "react";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { format, isToday, isPast } from "date-fns";
import ProviderLockGate from "@/components/ProviderLockGate";
import PreCourseMaterials from "@/components/PreCourseMaterials";
import ProviderSalesLock from "@/components/ProviderSalesLock";
import { useProviderAccess } from "@/components/useProviderAccess";
import ClassDayOnboardingWizard from "@/components/provider/ClassDayOnboardingWizard";
import CourseEnrollmentCard from "@/components/provider/CourseEnrollmentCard";
import CourseBrowseCard from "@/components/provider/CourseBrowseCard";
import CourseCardDeck from "@/components/provider/CourseCardDeck";
import CertificationPathway from "@/components/provider/CertificationPathway";

const categoryMeta = {
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
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const [preMaterialsCourse, setPreMaterialsCourse] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
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
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Enrollment.filter({ provider_id: me.id }, "-created_date");
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.ClassSession.filter({ provider_id: me.id }, "-created_date");
    },
  });

  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["courses"],
    queryFn: () => base44.entities.Course.filter({ is_active: true }),
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
    const session = sessionByEnrollment[e.id];
    const isAttended = session?.code_used || ["attended", "completed"].includes(e.status);
    const linkedServiceIds = (course?.linked_service_type_ids?.length > 0)
      ? course.linked_service_type_ids
      : (course?.certifications_awarded || []).map(c => c.service_type_id).filter(Boolean);
    const needsMDSub = linkedServiceIds.some(id => !activeSubServiceIds.has(id));
    return classIsToday && !isAttended && needsMDSub && ["confirmed", "paid"].includes(e.status);
  });

  React.useEffect(() => {
    if (todayEnrollment && !onboardingEnrollment && activeTab === "my") {
      setOnboardingEnrollment(todayEnrollment);
    }
  }, [todayEnrollment, activeTab]);

  const filteredCourses = courses.filter(c => {
    const matchSearch = !search || c.title?.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || c.category === category;
    const matchLvl = level === "all" || c.level === level;
    return matchSearch && matchCat && matchLvl;
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
              <Input className="pl-9 bg-white/95 rounded-xl" placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {(loadingCourses || loadingServiceTypes) ? (
              <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-96 animate-pulse rounded-3xl" style={{ background: "rgba(255,255,255,0.08)" }} />)}</div>
            ) : (() => {
              const filteredServices = serviceTypes.filter(s => {
                const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.category?.toLowerCase().includes(search.toLowerCase());
                return matchSearch;
              });
              return filteredServices.length === 0 ? (
                <div className="text-center py-16" style={{ color: "rgba(30,37,53,0.4)" }}>
                  <Award className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="font-semibold">No services found</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredServices.map(svc => {
                    const serviceCourses = courses.filter(c => (c.linked_service_type_ids?.includes(svc.id)) || (c.certifications_awarded?.some(ca => ca.service_type_id === svc.id)));
                    const meta = categoryMeta[svc.category] || categoryMeta.other;
                    return (
                      <CertificationPathway
                        key={svc.id}
                        serviceType={svc}
                        courses={serviceCourses}
                        userCerts={certs}
                        userMDSubs={myMDSubs}
                        enrolledCourseIds={enrolledCourseIds}
                        onEnroll={(course) => setSelectedCourse(course)}
                        onApplyMD={() => navigate(createPageUrl("ProviderCredentialsCoverage") + `?prompt_service=${svc.id}`)}
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
                    (courseMap[e.course_id]?.linked_service_type_ids || []).filter(Boolean)
                  )
                )).map(serviceTypeId => {
                  const svc = serviceTypes.find(s => s.id === serviceTypeId);
                  if (!svc) return null;
                  return (
                    <CertificationPathway
                      key={serviceTypeId}
                      serviceType={svc}
                      courses={courses.filter(c => (c.linked_service_type_ids?.includes(svc.id)) || (c.certifications_awarded?.some(ca => ca.service_type_id === svc.id)))}
                      userCerts={certs}
                      userMDSubs={myMDSubs}
                      enrolledCourseIds={enrolledCourseIds}
                      onEnroll={() => setActiveTab("browse")}
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
                <button onClick={() => setActiveTab("browse")} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#FA6F30" }}>
                  Browse Courses →
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-5 max-w-4xl">
                {activeEnrollments.map(e => (
                  <CourseEnrollmentCard
                    key={e.id}
                    enrollment={e}
                    course={courseMap[e.course_id]}
                    session={sessionByEnrollment[e.id]}
                    certs={certs}
                    activeSubServiceIds={activeSubServiceIds}
                    onViewMaterials={() => setPreMaterialsCourse(courseMap[e.course_id])}
                    onCancel={() => { if (window.confirm("Cancel this enrollment?")) cancelEnrollment.mutate({ id: e.id }); }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {preMaterialsCourse && (
          <PreCourseMaterials
            course={preMaterialsCourse}
            onClose={() => setPreMaterialsCourse(null)}
            onProceed={() => { setSelectedCourse(preMaterialsCourse); setPreMaterialsCourse(null); }}
          />
        )}

        {selectedCourse && (() => {
          window.location.href = createPageUrl(`CourseCheckout?course_id=${selectedCourse.id}`);
          return null;
        })()}

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