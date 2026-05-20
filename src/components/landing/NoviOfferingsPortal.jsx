import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminCoursesApi } from "@/api/adminCoursesApi";
import { courseCheckoutApi } from "@/api/courseCheckoutApi";
import { providerOnboardingApi } from "@/api/providerOnboardingApi";
import { redirectToStripeCheckout } from "@/lib/redirectToStripeCheckout";
import { CHECKOUT_RETURN_LANDING, stashCheckoutReturnTo } from "@/lib/checkoutReturnPath";
import {
  effectiveAvailableSeats,
  isCourseFullySoldOut,
  isSessionDateEntrySoldOut,
} from "@/lib/sessionDateSeats";
import {
  Sparkles, ArrowRight, Check,
  Clock, MapPin, ChevronRight, Calendar, CheckCircle2, User, Upload, ImageIcon,
} from "lucide-react";

const BLANK_FORM = {
  first_name: "",
  last_name: "",
  customer_email: "",
  phone: "",
  promo_code: "",
  rn_confirmation: false,
  refund_policy_confirmation: false,
};

const normalizeCourseRecord = (course) => ({
  ...course,
  session_dates: Array.isArray(course?.session_dates) ? course.session_dates : [],
});

const resolveSelectedSessionEntry = (course, selectedSession, selectedDate) => {
  const sessions = Array.isArray(course?.session_dates) ? course.session_dates : [];
  if (sessions.length === 0) return null;

  const date = selectedSession?.date || selectedDate || null;
  if (!date) return null;

  const sameDate = sessions.filter((s) => s?.date === date);
  if (sameDate.length === 0) return null;

  if (selectedSession?.session_id) {
    const byId = sameDate.find((s) => String(s?.session_id || "") === String(selectedSession.session_id));
    if (byId) return byId;
  }

  if (selectedSession?.start_time || selectedSession?.end_time) {
    const byTime = sameDate.find(
      (s) =>
        String(s?.start_time || "") === String(selectedSession?.start_time || "") &&
        String(s?.end_time || "") === String(selectedSession?.end_time || "")
    );
    if (byTime) return byTime;
  }

  const firstBookable = sameDate.find((s) => !isSessionDateEntrySoldOut(s));
  return firstBookable || sameDate[0];
};

/**
 * Shared course checkout + MD service pre-order flows (same behavior as NoviLanding).
 * Use render prop `children` to build any layout; dialogs are mounted here.
 */
export default function NoviOfferingsPortal({ children }) {
  const { toast } = useToast();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [courseStep, setCourseStep] = useState("dates");
  const [selectedCourseDate, setSelectedCourseDate] = useState(null);
  const [selectedCourseSession, setSelectedCourseSession] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [promoPreview, setPromoPreview] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    first_name: "",
    last_name: "",
    customer_email: "",
    phone: "",
    license_type: "RN",
    license_number: "",
    license_image_url: "",
    certification_provider_name: "",
    certification_document_url: "",
  });
  const [serviceSubmitted, setServiceSubmitted] = useState(false);
  const [serviceLicenseUploading, setServiceLicenseUploading] = useState(false);
  const [serviceCertUploading, setServiceCertUploading] = useState(false);
  const [serviceUploadError, setServiceUploadError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const selectedSessionEntry = resolveSelectedSessionEntry(selectedCourse, selectedCourseSession, selectedCourseDate);
  const selectedSessionIsSoldOut = Boolean(selectedSessionEntry && isSessionDateEntrySoldOut(selectedSessionEntry));

  const { data: portalMe } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: providerBasicOnboarding } = useQuery({
    queryKey: ["provider-basic-onboarding"],
    queryFn: async () => {
      try {
        return await providerOnboardingApi.getMe();
      } catch {
        return null;
      }
    },
    enabled: portalMe?.role === "provider",
    retry: false,
  });

  const { data: courses = [], isLoading: isLoadingCourses } = useQuery({
    queryKey: ["landing-courses"],
    queryFn: async () => {
      const scheduledCourses = await adminCoursesApi.list("scheduled");
      return (scheduledCourses || [])
        .filter((course) => course?.is_active !== false)
        .map(normalizeCourseRecord);
    },
  });

  useEffect(() => {
    const id = selectedCourse?.id;
    if (!id || !Array.isArray(courses) || courses.length === 0) return;
    const fresh = courses.find((c) => c.id === id);
    if (fresh && fresh !== selectedCourse) setSelectedCourse(fresh);
  }, [courses, selectedCourse]);

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["landing-services"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });

  const handleCheckoutError = (error) => {
    if (Number(error?.status) === 403) {
      toast({
        title: "Finish provider onboarding",
        description:
          error?.message ||
          "Complete your profile and license in the app before purchasing a course with your provider login. You can log out to pay as a guest with another email.",
        variant: "destructive",
      });
      return;
    }
    if (Number(error?.status) === 409) {
      const msg = String(error?.message || "");
      const soldOut = /sold out/i.test(msg);
      toast({
        title: soldOut ? "Sold out" : "Course already purchased",
        description: soldOut ? msg : msg || "You already purchased this course for the selected date.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Checkout unavailable",
      description: error?.message || "Unable to start payment. Please try again.",
      variant: "destructive",
    });
  };

  const openCourseModal = (course) => {
    if (isCourseFullySoldOut(course)) return;
    setSelectedCourse(course);
    setCourseStep("dates");
    setSelectedCourseDate(null);
    setSelectedCourseSession(null);
    setForm(BLANK_FORM);
    setPromoPreview(null);
    setCheckoutError(null);
  };

  const closeCourseModal = () => {
    setSelectedCourse(null);
    setCourseStep("dates");
    setSelectedCourseDate(null);
    setSelectedCourseSession(null);
    setForm(BLANK_FORM);
    setPromoPreview(null);
    setIsCheckingOut(false);
    setCheckoutError(null);
  };

  const promoMutation = useMutation({
    mutationFn: () =>
      courseCheckoutApi.validatePromoCode({
        course_id: selectedCourse?.id,
        promo_code: form.promo_code,
      }),
    onSuccess: (result) => setPromoPreview(result),
  });

  const clearPromoCode = () => {
    setForm((f) => ({ ...f, promo_code: "" }));
    setPromoPreview(null);
    promoMutation.reset();
  };
  const isValidPromoApplied = Boolean(promoPreview && promoPreview.code);

  const handleSubmitApplication = async () => {
    if (!form.first_name || !form.last_name || !form.customer_email || !form.phone || !form.rn_confirmation || !form.refund_policy_confirmation) return;
    if (selectedSessionIsSoldOut) return;
    if (isCourseFullySoldOut(selectedCourse)) return;
    if (isCheckingOut) return;

    const emailMatch =
      portalMe?.role === "provider" &&
      providerBasicOnboarding?.has_completed_basic === false &&
      String(form.customer_email || "")
        .trim()
        .toLowerCase() === String(portalMe.email || "").trim().toLowerCase();
    if (emailMatch) {
      toast({
        title: "Onboarding pending",
        description:
          "Complete your provider profile and license upload in the dashboard before purchasing a course with this email. You can log out to continue as a guest with a different email.",
        variant: "destructive",
      });
      return;
    }

    const fullName = `${form.first_name} ${form.last_name}`.trim();
    setCheckoutError(null);
    setIsCheckingOut(true);
    stashCheckoutReturnTo(CHECKOUT_RETURN_LANDING);
    try {
      const response = await courseCheckoutApi.createCheckout({
        checkout_return_to: CHECKOUT_RETURN_LANDING,
        course_id: selectedCourse.id,
        course_date: selectedSessionEntry?.date || selectedCourseDate || null,
        course_session_id: selectedSessionEntry?.session_id || null,
        course_start_time: selectedSessionEntry?.start_time || null,
        course_end_time: selectedSessionEntry?.end_time || null,
        customer_name: fullName,
        first_name: form.first_name,
        last_name: form.last_name,
        customer_email: form.customer_email,
        phone: form.phone || null,
        promo_code: form.promo_code || null,
        terms_confirmed: form.rn_confirmation,
        refund_policy_confirmed: form.refund_policy_confirmation,
      });
      redirectToStripeCheckout(response?.checkout_url);
    } catch (error) {
      setIsCheckingOut(false);
      setCheckoutError(error);
      handleCheckoutError(error);
    }
  };

  const serviceSpotMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke("createPreOrderCheckout", payload),
    onSuccess: () => setServiceSubmitted(true),
  });

  const handleServicePreOrder = () => {
    if (!selectedService) return;
    if (
      !serviceForm.first_name ||
      !serviceForm.last_name ||
      !serviceForm.customer_email ||
      !serviceForm.phone ||
      !serviceForm.license_number ||
      !serviceForm.license_image_url ||
      !serviceForm.certification_provider_name ||
      !serviceForm.certification_document_url
    )
      return;
    const fullName = `${serviceForm.first_name} ${serviceForm.last_name}`.trim();
    serviceSpotMutation.mutate({
      customer_name: fullName,
      customer_email: serviceForm.customer_email,
      phone: serviceForm.phone || null,
      order_type: "service",
      notes: `Certification provider: ${serviceForm.certification_provider_name}`,
      service_type_id: selectedService.id,
      license_type: serviceForm.license_type,
      license_number: serviceForm.license_number,
      license_image_url: serviceForm.license_image_url || null,
      certification_document_url: serviceForm.certification_document_url || null,
    });
  };

  const handleServiceLicenseUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setServiceLicenseUploading(true);
      setServiceUploadError("");
      const uploaded = await courseCheckoutApi.uploadLicensePhoto(file);
      setServiceForm((f) => ({ ...f, license_image_url: uploaded.url }));
    } catch (error) {
      setServiceUploadError(error?.message || "License upload failed. Please try again.");
    } finally {
      setServiceLicenseUploading(false);
      e.target.value = "";
    }
  };

  const handleServiceCertificationUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setServiceCertUploading(true);
      setServiceUploadError("");
      const uploaded = await courseCheckoutApi.uploadLicensePhoto(file);
      setServiceForm((f) => ({ ...f, certification_document_url: uploaded.url }));
    } catch (error) {
      setServiceUploadError(error?.message || "Certification upload failed. Please try again.");
    } finally {
      setServiceCertUploading(false);
      e.target.value = "";
    }
  };

  const openServiceModal = (service) => {
    setSelectedService(service);
    setServiceSubmitted(false);
    setServiceUploadError("");
    serviceSpotMutation.reset();
    setServiceForm({
      first_name: "",
      last_name: "",
      customer_email: "",
      phone: "",
      license_type: "RN",
      license_number: "",
      license_image_url: "",
      certification_provider_name: "",
      certification_document_url: "",
    });
  };

  const closeServiceModal = () => {
    setSelectedService(null);
    setServiceSubmitted(false);
    serviceSpotMutation.reset();
  };

  const slot = children({
    courses,
    serviceTypes,
    isLoadingCourses,
    openCourseModal,
    openServiceModal,
    isCourseFullySoldOut,
  });

  return (
    <>
      {slot}

      <Dialog open={!!selectedCourse} onOpenChange={(open) => { if (!open) closeCourseModal(); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col overflow-hidden bg-white">
          {selectedCourse && courseStep !== "submitted" && (
            <DialogHeader className="shrink-0 pb-2 pr-14 pt-1">
              <div className="flex items-center gap-3 mb-1">
                {["dates", "info"].map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background:
                          courseStep === step
                            ? "#C8E63C"
                            : i < ["dates", "info"].indexOf(courseStep)
                              ? "rgba(200,230,60,0.3)"
                              : "rgba(0,0,0,0.08)",
                        color: courseStep === step ? "#1a2540" : "rgba(30,37,53,0.4)",
                      }}
                    >
                      {i + 1}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: courseStep === step ? "#1e2535" : "rgba(30,37,53,0.4)" }}>
                      {step === "dates" ? "Select Date" : "Your Details"}
                    </span>
                    {i < 1 && <span style={{ color: "rgba(30,37,53,0.2)", marginLeft: 4, marginRight: 4 }}>→</span>}
                  </div>
                ))}
              </div>
              <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", color: "#1e2535", fontSize: "1.6rem", marginTop: 8 }}>
                {selectedCourse.title}
              </DialogTitle>
              <div className="flex flex-wrap gap-3 text-xs mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>
                {selectedCourse.price && (
                  <span className="font-bold" style={{ color: "#2D6B7F" }}>
                    ${Number(selectedCourse.price).toLocaleString()}
                  </span>
                )}
                {selectedCourse.duration_hours && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedCourse.duration_hours}h
                  </span>
                )}
                {selectedCourse.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {selectedCourse.location}
                  </span>
                )}
              </div>
            </DialogHeader>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto">
          {selectedCourse && courseStep === "dates" && (
            <div className="space-y-4 pt-2">
              {isCourseFullySoldOut(selectedCourse) && (
                <div className="px-4 py-3 rounded-xl text-sm font-semibold" style={{ background: "rgba(218,106,99,0.1)", border: "1px solid rgba(218,106,99,0.25)", color: "#DA6A63" }}>
                  This course is sold out. Registration is closed.
                </div>
              )}
              {selectedCourse.description && (
                <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>
                  {selectedCourse.description}
                </p>
              )}

              {selectedCourse.instructor_name && (
                <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
                  <span className="font-semibold">Instructor:</span> {selectedCourse.instructor_name}
                </p>
              )}

              <div>
                <h4 className="font-bold mb-3 text-sm uppercase tracking-wide" style={{ color: "rgba(30,37,53,0.5)" }}>
                  {(() => {
                    const t = new Date();
                    t.setHours(0, 0, 0, 0);
                    return (selectedCourse.session_dates?.filter((s) => s.date && new Date(s.date.split("T")[0] + "T12:00:00") >= t).length > 0
                      ? "Select an Available Date"
                      : "Available Dates");
                  })()}
                </h4>

                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const upcomingDates = (selectedCourse.session_dates || [])
                    .filter((s) => s.date && new Date(s.date.split("T")[0] + "T12:00:00") >= today)
                    .sort((a, b) => new Date(a.date) - new Date(b.date));

                  if (upcomingDates.length === 0) {
                    return (
                      <div className="text-center py-8 rounded-xl" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)" }}>
                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm" style={{ color: "rgba(30,37,53,0.4)" }}>
                          No upcoming dates scheduled yet.
                        </p>
                        <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.3)" }}>
                          Check back soon or continue to submit your interest.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {upcomingDates.map((session, idx) => {
                        const dateSoldOut = isSessionDateEntrySoldOut(session);
                        const muted = "rgba(30,37,53,0.38)";
                        const strong = "#1e2535";
                        return (
                          <div
                            key={idx}
                            role={dateSoldOut ? "presentation" : "button"}
                            tabIndex={dateSoldOut ? -1 : 0}
                            aria-disabled={dateSoldOut}
                            onClick={() => {
                              if (!dateSoldOut) {
                                setSelectedCourseDate(session.date);
                                setSelectedCourseSession(session);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (!dateSoldOut && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                setSelectedCourseDate(session.date);
                                setSelectedCourseSession(session);
                              }
                            }}
                            className="p-4 rounded-xl transition-all"
                            style={{
                              background: selectedCourseSession === session && !dateSoldOut ? "rgba(200,230,60,0.1)" : "rgba(0,0,0,0.02)",
                              border:
                                selectedCourseSession === session && !dateSoldOut ? "2px solid #C8E63C" : "1px solid rgba(0,0,0,0.07)",
                              cursor: dateSoldOut ? "not-allowed" : "pointer",
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                {session.label && (
                                  <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: dateSoldOut ? muted : "#2D6B7F" }}>
                                    {session.label}
                                  </p>
                                )}
                                <p className="font-semibold text-sm" style={{ color: dateSoldOut ? muted : strong }}>
                                  {new Date(session.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                                </p>
                                {(session.start_time || session.end_time) && (
                                  <p className="text-xs mt-0.5" style={{ color: dateSoldOut ? muted : "rgba(30,37,53,0.5)" }}>
                                    {session.start_time}
                                    {session.end_time ? ` – ${session.end_time}` : ""}
                                    {session.location ? ` · ${session.location}` : ""}
                                  </p>
                                )}
                                {!dateSoldOut && (
                                  <p className="text-xs mt-1 font-semibold" style={{ color: "rgba(45,107,127,0.9)" }}>
                                    {effectiveAvailableSeats(session)} spots left
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end justify-center gap-1 flex-shrink-0 min-h-[2.5rem]">
                                {dateSoldOut ? (
                                  <span
                                    className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md"
                                    style={{ background: "rgba(218,106,99,0.18)", color: "#DA6A63", border: "1px solid rgba(218,106,99,0.35)" }}
                                  >
                                    Sold out
                                  </span>
                                ) : selectedCourseSession === session ? (
                                  <Check className="w-5 h-5" style={{ color: "#5a7a20" }} />
                                ) : (
                                  <div className="w-5 h-5 rounded-full border-2 shrink-0" style={{ borderColor: "rgba(0,0,0,0.2)" }} aria-hidden />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <Button
                className="w-full py-5 text-base font-bold rounded-xl"
                style={{ background: "#C8E63C", color: "#1a2540" }}
                onClick={() => setCourseStep("info")}
                disabled={(() => {
                  const t = new Date();
                  t.setHours(0, 0, 0, 0);
                  const upcoming = selectedCourse.session_dates?.filter((s) => s.date && new Date(s.date.split("T")[0] + "T12:00:00") >= t) || [];
                  const needDate = upcoming.length > 0;
                  return (
                    isCourseFullySoldOut(selectedCourse) ||
                    (needDate && !selectedCourseSession) ||
                    Boolean(selectedSessionIsSoldOut)
                  );
                })()}
              >
                Continue <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              {(() => {
                const t = new Date();
                t.setHours(0, 0, 0, 0);
                return (
                  selectedCourse.session_dates?.filter((s) => s.date && new Date(s.date.split("T")[0] + "T12:00:00") >= t).length > 0 &&
                  !selectedCourseSession
                );
              })() && (
                <p className="text-center text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>
                  Please select a date to continue
                </p>
              )}
            </div>
          )}

          {selectedCourse && courseStep === "info" && (
            <div className="space-y-5 pt-2">
              {selectedSessionIsSoldOut && (
                <div className="px-4 py-3 rounded-xl text-sm font-semibold" style={{ background: "rgba(218,106,99,0.1)", border: "1px solid rgba(218,106,99,0.25)", color: "#DA6A63" }}>
                  This session date is sold out. Choose another date or check back later.
                </div>
              )}
              {selectedCourseDate && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.25)" }}>
                  <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: "#5a7a20" }} />
                  <p className="text-sm font-semibold" style={{ color: "#3d5a0a" }}>
                    {new Date(selectedCourseDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </p>
                  <button type="button" onClick={() => setCourseStep("dates")} className="ml-auto text-xs underline" style={{ color: "rgba(30,37,53,0.45)" }}>
                    Change
                  </button>
                </div>
              )}

              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "#2D6B7F" }}>
                  <User className="w-3.5 h-3.5" /> Personal Information
                </p>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
                        First Name *
                      </Label>
                      <Input
                        value={form.first_name}
                        onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                        placeholder="John"
                        className="h-11 rounded-xl"
                        style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
                        Last Name *
                      </Label>
                      <Input
                        value={form.last_name}
                        onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                        placeholder="Doe"
                        className="h-11 rounded-xl"
                        style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
                        Email *
                      </Label>
                      <Input
                        type="email"
                        value={form.customer_email}
                        onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
                        placeholder="jane@example.com"
                        className="h-11 rounded-xl"
                        style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
                        Phone *
                      </Label>
                      <Input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="(555) 123-4567"
                        className="h-11 rounded-xl"
                        style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl space-y-3 mt-4" style={{ background: "rgba(200, 230, 60, 0.08)", border: "1px solid rgba(200,230,60,0.2)" }}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="rn-confirmation-portal"
                    checked={form.rn_confirmation}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, rn_confirmation: Boolean(checked) }))}
                    className="mt-0.5"
                  />
                  <Label htmlFor="rn-confirmation-portal" className="text-sm font-normal cursor-pointer leading-relaxed" style={{ color: "rgb(61, 90, 10)" }}>
                    I confirm that I am licensed at the RN level or above and agree to the terms of service.
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="refund-policy-confirmation-portal"
                    checked={form.refund_policy_confirmation}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, refund_policy_confirmation: Boolean(checked) }))}
                    className="mt-0.5"
                  />
                  <Label htmlFor="refund-policy-confirmation-portal" className="text-sm leading-relaxed font-normal cursor-pointer" style={{ color: "rgb(61, 90, 10)" }}>
                    I have read and agree to the NOVI Society Refund Policy.
                  </Label>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "rgb(45, 107, 127)" }}>
                  Promo Code (Optional)
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={form.promo_code}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm((f) => ({ ...f, promo_code: value }));
                      setPromoPreview(null);
                      promoMutation.reset();
                    }}
                    placeholder="Enter promo code"
                    className="h-11 rounded-xl"
                    style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
                  />
                  {!isValidPromoApplied && (
                    <Button
                      type="button"
                      className="h-11 rounded-xl px-5 font-bold sm:w-auto w-full"
                      style={{
                        background: "rgb(45, 107, 127)",
                        color: "#fff",
                        opacity: form.promo_code.trim() ? 1 : 0.45,
                      }}
                      onClick={() => promoMutation.mutate()}
                      disabled={!form.promo_code.trim() || promoMutation.isPending}
                    >
                      {promoMutation.isPending ? "Applying..." : "Apply"}
                    </Button>
                  )}
                  {isValidPromoApplied && (
                    <Button type="button" variant="outline" className="h-11 rounded-xl px-5 font-bold sm:w-auto w-full" onClick={clearPromoCode} disabled={promoMutation.isPending}>
                      Remove
                    </Button>
                  )}
                </div>
                {promoMutation.error && <p className="text-xs mt-2" style={{ color: "#DA6A63" }}>{promoMutation.error.message}</p>}
                {promoPreview && (
                  <div className="mt-2 text-xs rounded-lg p-2.5" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.3)", color: "#3d5a0a" }}>
                    Promo <strong>{promoPreview.code}</strong> applied: -${Number(promoPreview.discount_amount || 0).toLocaleString()} · New total{" "}
                    <strong>${Number(promoPreview.total || 0).toLocaleString()}</strong>
                  </div>
                )}
              </div>

              {checkoutError && (
                <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(218,106,99,0.1)", border: "1px solid rgba(218,106,99,0.25)" }}>
                  <p className="text-sm font-semibold" style={{ color: "#DA6A63" }}>{checkoutError.message}</p>
                </div>
              )}

              {(!form.first_name || !form.last_name || !form.customer_email || !form.phone || !form.rn_confirmation || !form.refund_policy_confirmation) && (
                <div className="px-4 py-3 rounded-xl flex flex-col gap-1" style={{ background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.2)" }}>
                  <p className="text-xs font-bold" style={{ color: "#FA6F30" }}>
                    Please complete the following:
                  </p>
                  {!form.first_name && <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>• First Name</p>}
                  {!form.last_name && <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>• Last Name</p>}
                  {!form.customer_email && <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>• Email</p>}
                  {!form.phone && <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>• Phone</p>}
                  {!form.rn_confirmation && <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>• Confirm your license level and terms</p>}
                  {!form.refund_policy_confirmation && <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>• Acknowledge the Refund Policy</p>}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => setCourseStep("dates")} className="px-4" style={{ color: "rgba(30,37,53,0.5)" }}>
                  Back
                </Button>
                <Button
                  className="flex-1 py-5 text-base font-bold rounded-xl"
                  style={{ background: "#C8E63C", color: "#1a2540" }}
                  disabled={
                    isCourseFullySoldOut(selectedCourse) ||
                    selectedSessionIsSoldOut ||
                    !form.first_name ||
                    !form.last_name ||
                    !form.customer_email ||
                    !form.phone ||
                    !form.rn_confirmation ||
                    !form.refund_policy_confirmation ||
                    isCheckingOut
                  }
                  onClick={handleSubmitApplication}
                >
                  {isCheckingOut ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Pay ${Number(promoPreview?.total ?? selectedCourse?.price ?? 0).toLocaleString()}
                    </>
                  )}
                </Button>
              </div>
              <p className="text-center text-xs" style={{ color: "rgba(30,37,53,0.35)" }}>
                Secure payment with Stripe · Admin reviews your application
              </p>
            </div>
          )}

          {selectedCourse && courseStep === "submitted" && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(200,230,60,0.15)" }}>
                <CheckCircle2 className="w-8 h-8" style={{ color: "#5a7a20" }} />
              </div>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.75rem", color: "#1e2535", fontStyle: "italic" }}>Application Submitted!</h3>
              <p className="text-base leading-relaxed max-w-sm mx-auto" style={{ color: "rgba(30,37,53,0.65)" }}>
                Your application for <strong>{selectedCourse.title}</strong> is now under review. We&apos;ll verify your license and send your payment link within 1–2 business days.
              </p>
              {selectedCourseDate && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.25)" }}>
                  <Calendar className="w-4 h-4" style={{ color: "#5a7a20" }} />
                  <span className="text-sm font-semibold" style={{ color: "#3d5a0a" }}>
                    {new Date(selectedCourseDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              )}
              <p className="text-sm" style={{ color: "rgba(30,37,53,0.45)" }}>
                Check <strong>{form.customer_email}</strong> for a confirmation email.
              </p>
              <Button onClick={closeCourseModal} className="mt-2 px-8 py-3 rounded-full font-bold" style={{ background: "#C8E63C", color: "#1a2540" }}>
                Done
              </Button>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedService}
        onOpenChange={(next) => {
          if (!next) closeServiceModal();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden bg-white">
          <DialogHeader className="shrink-0 pr-14 pt-1">
            <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", color: "#1e2535", fontSize: "1.5rem" }}>
              {selectedService?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
          {selectedService && !serviceSubmitted && (
            <div className="space-y-5 pt-2">
              <div className="pt-2 border-t" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#2D6B7F" }}>
                    Personal Information *
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
                        First Name *
                      </Label>
                      <Input
                        value={serviceForm.first_name}
                        onChange={(e) => setServiceForm((f) => ({ ...f, first_name: e.target.value }))}
                        placeholder="John"
                        className="h-11 rounded-xl"
                        style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
                        Last Name *
                      </Label>
                      <Input
                        value={serviceForm.last_name}
                        onChange={(e) => setServiceForm((f) => ({ ...f, last_name: e.target.value }))}
                        placeholder="Doe"
                        className="h-11 rounded-xl"
                        style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
                        Email *
                      </Label>
                      <Input
                        type="email"
                        value={serviceForm.customer_email}
                        onChange={(e) => setServiceForm((f) => ({ ...f, customer_email: e.target.value }))}
                        placeholder="jane@example.com"
                        className="h-11 rounded-xl"
                        style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
                        Phone *
                      </Label>
                      <Input
                        value={serviceForm.phone}
                        onChange={(e) => setServiceForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="(555) 123-4567"
                        className="h-11 rounded-xl"
                        style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
                      />
                    </div>
                  </div>
                  <hr style={{ borderColor: "rgba(0,0,0,0.08)" }} />
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#2D6B7F" }}>
                    Medical License *
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
                        License Type *
                      </Label>
                      <Select value={serviceForm.license_type} onValueChange={(v) => setServiceForm((f) => ({ ...f, license_type: v }))}>
                        <SelectTrigger className="h-11 rounded-xl" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RN">RN - Registered Nurse</SelectItem>
                          <SelectItem value="NP">NP - Nurse Practitioner</SelectItem>
                          <SelectItem value="PA">PA - Physician Assistant</SelectItem>
                          <SelectItem value="MD">MD - Medical Doctor</SelectItem>
                          <SelectItem value="DO">DO - Doctor of Osteopathy</SelectItem>
                          <SelectItem value="other">Other Healthcare Professional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
                        License Number *
                      </Label>
                      <Input
                        value={serviceForm.license_number}
                        onChange={(e) => setServiceForm((f) => ({ ...f, license_number: e.target.value }))}
                        placeholder="RN-123456"
                        className="h-11 rounded-xl"
                        style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
                      License Photo *
                    </Label>
                    {serviceForm.license_image_url ? (
                      <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.3)" }}>
                        <ImageIcon className="w-5 h-5 flex-shrink-0" style={{ color: "#5a7a20" }} />
                        <span className="text-sm font-medium flex-1" style={{ color: "#3d5a0a" }}>
                          License uploaded ✓
                        </span>
                        <button type="button" onClick={() => setServiceForm((f) => ({ ...f, license_image_url: "" }))} className="text-xs underline" style={{ color: "rgba(30,37,53,0.4)" }}>
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-2 p-5 rounded-xl cursor-pointer transition-all" style={{ background: "rgba(0,0,0,0.02)", border: "1.5px dashed rgba(0,0,0,0.15)" }}>
                        {serviceLicenseUploading ? (
                          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: "#2D6B7F" }} />
                        ) : (
                          <Upload className="w-5 h-5" style={{ color: "#2D6B7F" }} />
                        )}
                        <span className="text-sm font-medium" style={{ color: "#2D6B7F" }}>
                          {serviceLicenseUploading ? "Uploading..." : "Click to upload license"}
                        </span>
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleServiceLicenseUpload} disabled={serviceLicenseUploading} />
                      </label>
                    )}
                  </div>
                  <hr style={{ borderColor: "rgba(0,0,0,0.08)" }} />
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#2D6B7F" }}>
                    External Certification *
                  </p>
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
                      School / Provider Name *
                    </Label>
                    <Input
                      value={serviceForm.certification_provider_name}
                      onChange={(e) => setServiceForm((f) => ({ ...f, certification_provider_name: e.target.value }))}
                      placeholder="e.g. Johns Training Academy"
                      className="h-11 rounded-xl"
                      style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>
                      Certification Document *
                    </Label>
                    {serviceForm.certification_document_url ? (
                      <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.3)" }}>
                        <ImageIcon className="w-5 h-5 flex-shrink-0" style={{ color: "#5a7a20" }} />
                        <span className="text-sm font-medium flex-1" style={{ color: "#3d5a0a" }}>
                          Certification uploaded ✓
                        </span>
                        <button type="button" onClick={() => setServiceForm((f) => ({ ...f, certification_document_url: "" }))} className="text-xs underline" style={{ color: "rgba(30,37,53,0.4)" }}>
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-2 p-5 rounded-xl cursor-pointer transition-all" style={{ background: "rgba(0,0,0,0.02)", border: "1.5px dashed rgba(0,0,0,0.15)" }}>
                        {serviceCertUploading ? (
                          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: "#2D6B7F" }} />
                        ) : (
                          <Upload className="w-5 h-5" style={{ color: "#2D6B7F" }} />
                        )}
                        <span className="text-sm font-medium" style={{ color: "#2D6B7F" }}>
                          {serviceCertUploading ? "Uploading..." : "Click to upload certification"}
                        </span>
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleServiceCertificationUpload} disabled={serviceCertUploading} />
                      </label>
                    )}
                  </div>
                  {serviceUploadError && <p className="text-xs" style={{ color: "#DA6A63" }}>{serviceUploadError}</p>}
                </div>
              </div>

              {serviceSpotMutation.error && (
                <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(218,106,99,0.1)", border: "1px solid rgba(218,106,99,0.25)" }}>
                  <p className="text-sm font-semibold" style={{ color: "#DA6A63" }}>{serviceSpotMutation.error.message}</p>
                </div>
              )}

              <Button
                className="w-full py-6 text-base font-bold rounded-xl"
                style={{ background: "rgb(200, 230, 60)", color: "#1a2540" }}
                onClick={handleServicePreOrder}
                disabled={
                  !serviceForm.first_name ||
                  !serviceForm.last_name ||
                  !serviceForm.customer_email ||
                  !serviceForm.phone ||
                  !serviceForm.license_number ||
                  !serviceForm.license_image_url ||
                  !serviceForm.certification_provider_name ||
                  !serviceForm.certification_document_url ||
                  serviceSpotMutation.isPending ||
                  serviceLicenseUploading ||
                  serviceCertUploading
                }
              >
                <Sparkles className="w-5 h-5 mr-2" />
                {serviceSpotMutation.isPending ? "Saving your spot..." : "Save Your Spot"}
              </Button>
              <p className="text-center text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>
                No payment required now · We&apos;ll contact you before launch
              </p>
            </div>
          )}

          {selectedService && serviceSubmitted && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(200,230,60,0.15)" }}>
                <CheckCircle2 className="w-8 h-8" style={{ color: "#5a7a20" }} />
              </div>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.75rem", color: "#1e2535", fontStyle: "italic" }}>
                Spot Saved!
              </h3>
              <p className="text-base leading-relaxed max-w-sm mx-auto" style={{ color: "rgba(30,37,53,0.65)" }}>
                Your request for <strong>{selectedService.name}</strong> has been submitted. We&apos;ll contact you before launch.
              </p>
              <Button onClick={closeServiceModal} className="mt-6 px-8 py-3 rounded-full font-bold" style={{ background: "#C8E63C", color: "#1a2540" }}>
                Done
              </Button>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
