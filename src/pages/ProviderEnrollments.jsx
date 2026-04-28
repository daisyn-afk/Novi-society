import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { adminCoursesApi } from "@/api/adminCoursesApi";
import { courseCheckoutApi } from "@/api/courseCheckoutApi";
import { useToast } from "@/components/ui/use-toast";

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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("browse");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const [preMaterialsCourse, setPreMaterialsCourse] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedCourseDate, setSelectedCourseDate] = useState("");
  const [termsConfirmed, setTermsConfirmed] = useState(false);
  const [refundPolicyConfirmed, setRefundPolicyConfirmed] = useState(false);
  const [onboardingEnrollment, setOnboardingEnrollment] = useState(null);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
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

      const enrollmentRows = [...byProviderId, ...byEmail];
      const byPreOrderId = new Map(
        enrollmentRows
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

      return canonical.sort(
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
      const [byProviderIdResult, byEmailResult] = await Promise.allSettled([
        me?.id ? base44.entities.ClassSession.filter({ provider_id: me.id }, "-created_date") : Promise.resolve([]),
        me?.email ? base44.entities.ClassSession.filter({ provider_email: me.email }, "-created_date") : Promise.resolve([]),
      ]);
      const byProviderId = byProviderIdResult.status === "fulfilled" ? (byProviderIdResult.value || []) : [];
      const byEmail = byEmailResult.status === "fulfilled" ? (byEmailResult.value || []) : [];
      const merged = [...byProviderId, ...byEmail];
      const deduped = Array.from(new Map(merged.map((row) => [row.id, row])).values());
      return deduped.sort(
        (a, b) => new Date(b.created_date || b.created_at || 0).getTime() - new Date(a.created_date || a.created_at || 0).getTime()
      );
    },
  });

  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["courses"],
    queryFn: () => adminCoursesApi.list(),
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

  const createCheckout = useMutation({
    mutationFn: (payload) => courseCheckoutApi.createCheckout(payload),
    onSuccess: (response) => {
      if (response?.checkout_url) {
        window.location.href = response.checkout_url;
        return;
      }
      throw new Error("Stripe checkout URL was not returned.");
    },
    onError: (error) => {
      if (Number(error?.status) === 409) {
        toast({
          title: "Course already purchased",
          description: error?.message || "You already purchased this course for the selected date.",
          variant: "destructive"
        });
        return;
      }
      toast({
        title: "Checkout failed",
        description: error?.message || "Unable to start checkout. Please try again.",
        variant: "destructive"
      });
    }
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
                        onSelect={(course) => setSelectedCourse(course)}
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

        <Dialog
          open={!!selectedCourse}
          onOpenChange={(next) => {
            if (!next) {
              setSelectedCourse(null);
              setSelectedCourseDate("");
              setTermsConfirmed(false);
              setRefundPolicyConfirmed(false);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            {selectedCourse && (
              <>
                <DialogHeader>
                  <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", color: "#1e2535", fontSize: "1.5rem" }}>
                    {selectedCourse.title}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
                    Select your class date and continue to secure Stripe checkout.
                  </p>
                  <div className="space-y-2">
                    {(selectedCourse.session_dates || [])
                      .filter((s) => s.date >= new Date().toISOString().slice(0, 10))
                      .sort((a, b) => a.date > b.date ? 1 : -1)
                      .map((s, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedCourseDate(s.date)}
                          className="w-full text-left px-4 py-3 rounded-lg border-2 transition-all"
                          style={selectedCourseDate === s.date
                            ? { borderColor: "#FA6F30", background: "rgba(250,111,48,0.1)" }
                            : { borderColor: "rgba(30,37,53,0.1)", background: "transparent" }}
                        >
                          <div className="font-medium" style={{ color: "#1e2535" }}>
                            {format(new Date(s.date + "T12:00:00"), "EEEE, MMMM d, yyyy")}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>
                            {s.start_time && s.end_time ? `${s.start_time} - ${s.end_time}` : s.start_time || ""}
                            {s.location ? ` · ${s.location}` : ""}
                          </div>
                        </button>
                      ))}
                  </div>
                  <div className="p-4 rounded-xl space-y-3" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.2)" }}>
                    <div className="flex items-start gap-3">
                      <Checkbox id="provider-terms-confirmation" checked={termsConfirmed} onCheckedChange={(checked) => setTermsConfirmed(Boolean(checked))} className="mt-0.5" />
                      <Label htmlFor="provider-terms-confirmation" className="text-sm font-normal cursor-pointer leading-relaxed" style={{ color: "rgb(61, 90, 10)" }}>
                        I confirm I agree to the NOVI terms of service.
                      </Label>
                    </div>
                    <div className="flex items-start gap-3">
                      <Checkbox id="provider-refund-confirmation" checked={refundPolicyConfirmed} onCheckedChange={(checked) => setRefundPolicyConfirmed(Boolean(checked))} className="mt-0.5" />
                      <Label htmlFor="provider-refund-confirmation" className="text-sm font-normal cursor-pointer leading-relaxed" style={{ color: "rgb(61, 90, 10)" }}>
                        I have read and agree to the NOVI Society refund policy.
                      </Label>
                    </div>
                  </div>
                  <Button
                    className="w-full py-3.5 text-base font-bold rounded-xl"
                    style={{ background: "#FA6F30", color: "#fff" }}
                    disabled={!selectedCourseDate || !termsConfirmed || !refundPolicyConfirmed || createCheckout.isPending || !me?.email}
                    onClick={() => {
                      const [firstName = "", ...rest] = String(me?.full_name || "").trim().split(/\s+/);
                      const lastName = rest.join(" ");
                      createCheckout.mutate({
                        course_id: selectedCourse.id,
                        course_date: selectedCourseDate || null,
                        customer_name: String(me?.full_name || "").trim(),
                        first_name: firstName,
                        last_name: lastName,
                        customer_email: me?.email || "",
                        phone: me?.phone || null,
                        terms_confirmed: termsConfirmed,
                        refund_policy_confirmed: refundPolicyConfirmed,
                      });
                    }}
                  >
                    {createCheckout.isPending ? "Redirecting to payment..." : `Pay $${Number(selectedCourse.price || 0).toLocaleString()} & Enroll`}
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

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