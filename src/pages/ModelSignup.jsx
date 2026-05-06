import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { adminCoursesApi } from "@/api/adminCoursesApi";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sparkles, ArrowRight, Clock, MapPin, Calendar, ChevronRight,
  CheckCircle2, BookOpen, User, Phone, Mail, Check, ExternalLink, RefreshCw, AlertCircle
} from "lucide-react";
import NoviFooter from "@/components/NoviFooter";

const TIME_SLOTS = [
  { label: "2:00 PM", value: "14:00" },
  { label: "3:00 PM", value: "15:00" },
  { label: "4:00 PM", value: "16:00" },
  { label: "5:00 PM", value: "17:00" },
];

const TREATMENT_TYPES = [
  { label: "Botox (TOX)", value: "tox" },
  { label: "Filler", value: "filler" },
  { label: "Both", value: "both" },
];

const BLANK_FORM = {
  customer_name: "",
  customer_email: "",
  phone: "",
  date_of_birth: "",
  age_range: "",
  experience_level: "",
  health_questions: "",
  notes: "",
  treatment_type: "",
  promo_code: "",
};

const validatePhone = (phone) => /^[\d\s\-\+\(\)]+$/.test(phone.replace(/\s/g, '')) && phone.replace(/\D/g, '').length >= 10;
const isAtLeast18 = (dateStr) => {
  if (!dateStr) return false;
  const dob = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return false;
  const today = new Date();
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 18;
};

export default function ModelSignup() {
  const qc = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [step, setStep] = useState("dates");
  const [form, setForm] = useState(BLANK_FORM);
  const [gfeUrl, setGfeUrl] = useState(null);
  const [sendingGFE, setSendingGFE] = useState(false);
  const [gfeSent, setGfeSent] = useState(false);
  const [gfeChoice, setGfeChoice] = useState(null);
  const [nonRefundableChecked, setNonRefundableChecked] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [age18Checked, setAge18Checked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoState, setPromoState] = useState(null); // { valid, error, discount_cents, final_cents, discount_type, discount_value }
  const [promoApplied, setPromoApplied] = useState(false);
  const [validatingPromo, setValidatingPromo] = useState(false);

  // Detect redirect back from Stripe with ?success=true
  const urlParams = new URLSearchParams(window.location.search);
  const [stripeSuccess, setStripeSuccess] = useState(() => urlParams.get("success") === "true");
  const [stripePreOrderId] = useState(() => urlParams.get("pre_order_id") || null);
  const [stripeGfeUrl, setStripeGfeUrl] = useState(null);
  const [stripeGfeSending, setStripeGfeSending] = useState(false);
  const [stripeGfeChoice, setStripeGfeChoice] = useState(null);
  const [stripeGfeError, setStripeGfeError] = useState("");
  const [stripeCourseId] = useState(() => urlParams.get("course_id") || null);
  const [stripeCustomerEmail] = useState(() => urlParams.get("customer_email") || null);
  const [stripeCustomerName] = useState(() => urlParams.get("customer_name") || null);
  const [stripePhone] = useState(() => urlParams.get("phone") || null);
  const [stripeDateOfBirth] = useState(() => urlParams.get("date_of_birth") || null);
  const [stripeTreatmentType] = useState(() => urlParams.get("treatment_type") || null);

  const sendStripeGFE = async () => {
    if (!stripeCourseId) return;
    setStripeGfeSending(true);
    setStripeGfeError("");
    try {
      const res = await base44.functions.invoke("sendModelGFE", {
        course_id: stripeCourseId,
        customer_name: stripeCustomerName || "",
        customer_email: stripeCustomerEmail || "",
        phone: stripePhone || "",
        pre_order_id: stripePreOrderId || null,
        treatment_type: stripeTreatmentType || form.treatment_type || null,
        date_of_birth: stripeDateOfBirth || form.date_of_birth || null,
      });
      if (res.data?.success && res.data?.meeting_url) {
        setStripeGfeUrl(res.data.meeting_url);
        // Always email the link so they have it regardless of "now" or "later"
        await base44.functions.invoke("sendModelGFEEmail", {
          customer_email: stripeCustomerEmail || "",
          customer_name: stripeCustomerName || "",
          gfe_url: res.data.meeting_url,
        });
      }
    } catch (e) {
      console.error("GFE send error:", e);
      setStripeGfeError(e?.message || "Failed to generate GFE link.");
    }
    setStripeGfeSending(false);
  };

  const { data: courses = [] } = useQuery({
    queryKey: ["landing-courses"],
    queryFn: async () => {
      const scheduledCourses = await adminCoursesApi.list("scheduled");
      return (scheduledCourses || [])
        .filter((course) => course?.is_active !== false)
        .map((course) => ({
          ...course,
          session_dates: Array.isArray(course?.session_dates) ? course.session_dates : []
        }));
    }
  });

  useEffect(() => {
    if (!stripeSuccess) return;
    const bump = () => {
      void qc.invalidateQueries({ queryKey: ["landing-courses"], refetchType: "all" });
    };
    bump();
    const t1 = setTimeout(bump, 900);
    const t2 = setTimeout(bump, 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [stripeSuccess, qc]);

  useEffect(() => {
    const id = selectedCourse?.id;
    if (!id || !Array.isArray(courses) || courses.length === 0) return;
    const fresh = courses.find((c) => c.id === id);
    if (fresh && fresh !== selectedCourse) setSelectedCourse(fresh);
  }, [courses, selectedCourse]);

  const { data: existingBookings = [] } = useQuery({
    queryKey: ["model-bookings", selectedDate, selectedCourse?.id],
    queryFn: async () => {
      if (!selectedDate || !selectedCourse?.id) return [];
      const allModels = await base44.entities.PreOrder.filter({ 
        order_type: "model",
        course_id: selectedCourse.id,
      });
      return allModels.filter(b => b.course_date === selectedDate);
    },
    enabled: !!selectedDate && !!selectedCourse?.id,
  });

  const getSlotCount = (timeSlot) => {
    if (!selectedDate) return 0;
    return existingBookings.filter(b => b.model_time_slot === timeSlot).length;
  };

  const isSlotFull = (timeSlot) => getSlotCount(timeSlot) >= 2;
  const totalCapacityReached = existingBookings.length >= 8;
  const getTreatmentLabel = (val) => TREATMENT_TYPES.find(t => t.value === val)?.label || val;
  const isPhoneValid = validatePhone(form.phone);
  const isDobValidAge = !form.date_of_birth || isAtLeast18(form.date_of_birth);

  const submitMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke("submitPreOrderRequest", payload),
    onSuccess: (res) => {
      setStep("submitted");
      const preOrderId = res?.data?.id || res?.data?.pre_order_id;
      sendGFE(preOrderId);
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      setProcessingPayment(true);
      try {
        const res = await base44.functions.invoke("createModelCheckout", {
          customer_email: form.customer_email,
          customer_name: form.customer_name,
          phone: form.phone,
          date_of_birth: form.date_of_birth || null,
          health_questions: { summary: form.health_questions || "" },
          course_id: selectedCourse?.id,
          course_date: selectedDate,
          time_slot: selectedTimeSlot,
          treatment_type: form.treatment_type,
          is_waitlist: showWaitlist,
          promo_code: form.promo_code || null,
        });
        if (res.data?.free) {
          if (res.data?.waitlist_auto) {
            setShowWaitlist(true);
            setSelectedTimeSlot(null);
          }
          // Fully discounted — skip Stripe, go straight to success
          setStep("submitted");
          sendGFE(res.data?.pre_order_id || null);
        } else if (res.data?.url) {
          if (res.data?.waitlist_auto) {
            setShowWaitlist(true);
            setSelectedTimeSlot(null);
          }
          window.open(res.data.url, "_blank");
        }
      } catch (err) {
        console.error("Payment error:", err);
        alert(`Payment error: ${err?.message || "Please try again."}`);
      } finally {
        setProcessingPayment(false);
      }
    },
  });

  const sendGFE = async (preOrderId) => {
    if (!selectedCourse?.id) return;
    setSendingGFE(true);
    setStripeGfeError("");
    try {
      const res = await base44.functions.invoke("sendModelGFE", {
        course_id: selectedCourse.id,
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        phone: form.phone,
        pre_order_id: preOrderId || null,
        treatment_type: form.treatment_type || null,
        date_of_birth: form.date_of_birth || null,
      });
      if (res.data?.success && res.data?.meeting_url) {
        setGfeUrl(res.data.meeting_url);
        setGfeSent(true);
        // Always email the link so they have it
        await base44.functions.invoke("sendModelGFEEmail", {
          customer_email: form.customer_email,
          customer_name: form.customer_name,
          gfe_url: res.data.meeting_url,
        });
      }
    } catch (e) {
      console.error("GFE send error:", e);
      setStripeGfeError(e?.message || "Failed to generate GFE link.");
    }
    setSendingGFE(false);
  };

  const resetPromo = () => {
    setPromoInput("");
    setPromoState(null);
    setPromoApplied(false);
    setForm(f => ({ ...f, promo_code: "" }));
  };

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setValidatingPromo(true);
    try {
      const res = await base44.functions.invoke("validateModelPromo", { promo_code: promoInput.trim() });
      setPromoState(res.data);
      if (res.data?.valid) {
        setPromoApplied(true);
        setForm(f => ({ ...f, promo_code: promoInput.trim() }));
      }
    } catch (e) {
      setPromoState({ valid: false, error: "Could not validate code. Try again." });
    }
    setValidatingPromo(false);
  };

  const openModal = (course) => {
    setSelectedCourse(course);
    setStep("dates");
    setSelectedDate(null);
    setSelectedTimeSlot(null);
    setForm(BLANK_FORM);
    setGfeUrl(null);
    setGfeSent(false);
    setGfeChoice(null);
    setNonRefundableChecked(false);
    setAge18Checked(false);
    setTermsChecked(false);
    setShowWaitlist(false);
    resetPromo();
  };

  const closeModal = () => {
    setSelectedCourse(null);
    setStep("dates");
    setSelectedDate(null);
    setSelectedTimeSlot(null);
    setForm(BLANK_FORM);
    setGfeUrl(null);
    setGfeSent(false);
    setGfeChoice(null);
    setNonRefundableChecked(false);
    setAge18Checked(false);
    setTermsChecked(false);
    setShowWaitlist(false);
    resetPromo();
  };

  const handlePayment = () => {
    if (!nonRefundableChecked) return;
    paymentMutation.mutate();
  };

  const handleSubmit = () => {
    if (!form.customer_name || !form.customer_email || !form.phone || !form.date_of_birth || !form.treatment_type || !age18Checked || !termsChecked || !isPhoneValid || !isDobValidAge) return;
    if (!showWaitlist && !selectedTimeSlot) return;
    setStep("payment");
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parseLocalDate = (dateStr) => {
    const d = dateStr.split("T")[0];
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day);
  };

  const getUpcomingDates = (course) =>
    (course.session_dates || [])
      .filter(s => s.date && parseLocalDate(s.date) >= today)
      .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));

  const hasUpcomingDates = (course) => getUpcomingDates(course).length > 0;
  const canSubmitInfo = form.customer_name && form.customer_email && form.phone && form.date_of_birth && form.treatment_type && (showWaitlist || selectedTimeSlot) && isPhoneValid && isDobValidAge;

  return (
    <div className="min-h-screen" style={{ background: "#f5f3ef", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>

      {/* Stripe success banner */}
      {stripeSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-6" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="bg-white rounded-3xl p-8 max-w-md mx-4 shadow-2xl w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: "rgba(200,230,60,0.15)" }}>
                <CheckCircle2 className="w-8 h-8" style={{ color: "#5a7a20" }} />
              </div>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.75rem", color: "#1e2535", fontStyle: "italic" }}>
                You're Booked!
              </h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>
                Payment confirmed! Your spot is reserved.
              </p>
            </div>

            {/* GFE section */}
            <div className="p-4 rounded-2xl mb-5" style={{ background: "rgba(45,107,127,0.05)", border: "1px solid rgba(45,107,127,0.15)" }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#2D6B7F" }}>Next: Complete Your Good Faith Exam (GFE)</p>
              <p className="text-sm mb-4" style={{ color: "rgba(30,37,53,0.65)" }}>
                A GFE is required before your treatment session.
              </p>

              {!stripeGfeChoice ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setStripeGfeChoice("now"); sendStripeGFE(); }}
                    className="p-4 rounded-xl text-left transition-all"
                    style={{ background: "rgba(200,230,60,0.1)", border: "2px solid rgba(200,230,60,0.4)" }}
                  >
                    <p className="font-bold text-sm mb-1" style={{ color: "#3d5a0a" }}>Complete Now</p>
                    <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>Open the GFE portal today</p>
                  </button>
                  <button
                    onClick={async () => {
                      setStripeGfeChoice("later");
                      // Generate GFE link and email it
                      await sendStripeGFE();
                    }}
                    className="p-4 rounded-xl text-left transition-all"
                    style={{ background: "rgba(45,107,127,0.07)", border: "2px solid rgba(45,107,127,0.2)" }}
                  >
                    <p className="font-bold text-sm mb-1" style={{ color: "#2D6B7F" }}>Email Me Later</p>
                    <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>We'll email you the link</p>
                  </button>
                </div>
              ) : stripeGfeChoice === "now" ? (
                stripeGfeSending ? (
                  <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Generating your GFE link...
                  </div>
                ) : stripeGfeUrl ? (
                  <div className="space-y-2">
                    <a
                      href={stripeGfeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm"
                      style={{ background: "#C8E63C", color: "#1a2540" }}
                    >
                      <ExternalLink className="w-4 h-4" /> Open GFE Portal →
                    </a>
                    <p className="text-xs text-center" style={{ color: "rgba(30,37,53,0.4)" }}>Link also sent to {stripeCustomerEmail}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
                      Couldn't generate the GFE link automatically. {stripeGfeError ? `Error: ${stripeGfeError}` : `Our team will email it to you at ${stripeCustomerEmail} within 24 hours.`}
                    </p>
                    <button onClick={() => { setStripeGfeChoice(null); setStripeGfeSending(false); }} className="text-xs underline" style={{ color: "#2D6B7F" }}>Try again</button>
                  </div>
                )
              ) : (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#5a7a20" }} />
                  <p className="text-sm" style={{ color: "rgba(30,37,53,0.65)" }}>Our team will email the GFE link to <strong>{stripeCustomerEmail}</strong> before your course date.</p>
                </div>
              )}
            </div>

            <Button
              className="w-full py-3 rounded-full font-bold"
              style={{ background: "#1e2535", color: "#fff" }}
              onClick={() => {
                setStripeSuccess(false);
                window.history.replaceState({}, "", window.location.pathname);
              }}
            >
              Done
            </Button>
          </div>
        </div>
      )}

      {/* HERO */}
      <section style={{
        background: "linear-gradient(135deg, #1e2535 0%, #2D6B7F 55%, #7B8EC8 100%)",
        padding: "80px 24px 72px",
      }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-baseline justify-center gap-2 mb-10">
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: "#fff", fontStyle: "italic", fontWeight: 400 }}>novi</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>Society</span>
          </div>

          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full mb-8" style={{
            background: "rgba(200,230,60,0.15)",
            border: "1px solid rgba(200,230,60,0.35)",
          }}>
            <Sparkles className="w-4 h-4" style={{ color: "#C8E63C" }} />
            <span className="text-sm font-semibold" style={{ color: "#C8E63C" }}>Model Enrollment Portal</span>
          </div>

          <h1 style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
            color: "#fff",
            fontStyle: "italic",
            fontWeight: 400,
            lineHeight: 1.05,
            marginBottom: "20px",
          }}>
            Be Part of<br />the Experience
          </h1>

          <p style={{
            fontSize: "clamp(1rem, 2.5vw, 1.15rem)",
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.8,
            maxWidth: "580px",
            margin: "0 auto 12px",
          }}>
            NOVI Society training courses require live models for hands-on practice sessions. Sign up to participate in a course near you — treatment is performed by licensed professionals under medical supervision, at no cost to you.
          </p>

          <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}>
            Select a course below to reserve your spot.{" "}
            <a href={createPageUrl("ModelBookingLookup")} style={{ color: "#C8E63C", textDecoration: "underline" }}>
              View your existing booking
            </a>
          </p>
        </div>
      </section>

      {/* WHAT TO EXPECT */}
      <section className="py-14 px-6" style={{ background: "#fff" }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-center mb-8" style={{ color: "#C8E63C", letterSpacing: "0.2em" }}>What to Expect</p>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {
                emoji: "✨",
                title: "Free Aesthetic Treatments",
                desc: "Receive professional aesthetic treatments at no charge as part of the training session.",
              },
              {
                emoji: "🏥",
                title: "Medical Supervision",
                desc: "All sessions are supervised by a licensed Medical Director within a compliant framework.",
              },
              {
                emoji: "📋",
                title: "Simple Sign-Up",
                desc: "No license required. Just provide your basic info and select a course date.",
              },
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-2xl text-center" style={{ background: "#f9f8f6", border: "1px solid rgba(0,0,0,0.07)" }}>
                <div className="text-3xl mb-3">{item.emoji}</div>
                <p className="font-bold text-sm mb-2" style={{ color: "#1e2535" }}>{item.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COURSES */}
      <section className="py-16 px-6" style={{ background: "#f5f3ef" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#C8E63C", letterSpacing: "0.2em" }}>Available Courses</p>
            <h2 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(2rem, 5vw, 3rem)",
              color: "#1e2535",
              fontStyle: "italic",
              fontWeight: 400,
              lineHeight: 1.1,
            }}>
              Choose Your Session
            </h2>
            <p className="mt-3 text-sm" style={{ color: "rgba(30,37,53,0.55)" }}>
              All courses listed below are open for model sign-ups.
            </p>
          </div>

          {courses.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)" }}>
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p style={{ color: "rgba(30,37,53,0.4)" }}>No courses available at this time — check back soon!</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {courses.map(course => {
                const upcoming = getUpcomingDates(course);
                return (
                  <div
                    key={course.id}
                    onClick={() => openModal(course)}
                    className="group cursor-pointer rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                    style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)" }}
                  >
                    {course.cover_image_url && (
                      <div className="relative h-44 overflow-hidden">
                        <img
                          src={course.cover_image_url}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="p-5">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ background: "rgba(123,142,200,0.12)", color: "#2D6B7F" }}>
                        {course.category?.replace(/_/g, " ")}
                      </span>
                      <h3 className="font-bold text-base mt-3 mb-1.5 leading-tight" style={{ color: "#1e2535" }}>{course.title}</h3>
                      {course.description && (
                        <p className="text-sm line-clamp-2 mb-3" style={{ color: "rgba(30,37,53,0.6)" }}>{course.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs mb-3" style={{ color: "rgba(30,37,53,0.5)" }}>
                        {course.duration_hours && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{course.duration_hours}h</span>}
                        {course.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{course.location}</span>}
                      </div>

                      {upcoming.length > 0 ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg w-fit" style={{ background: "rgba(200,230,60,0.12)", color: "#4a6b10" }}>
                          <Calendar className="w-3 h-3" />
                          {upcoming.length} date{upcoming.length > 1 ? "s" : ""} available
                        </div>
                      ) : (
                        <div className="text-xs px-2.5 py-1.5 rounded-lg w-fit" style={{ background: "rgba(0,0,0,0.04)", color: "rgba(30,37,53,0.4)" }}>
                          Dates TBA
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-4 pt-4 text-sm font-semibold" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", color: "#2D6B7F" }}>
                        <span>Sign Up as Model</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <NoviFooter />

      {/* SIGNUP DIALOG */}
      <Dialog open={!!selectedCourse} onOpenChange={closeModal}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          {selectedCourse && step !== "submitted" && (
            <DialogHeader className="pb-2">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {["dates", "info", "payment"].map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{
                      background: step === s ? "#C8E63C" : i < ["dates","info"].indexOf(step) ? "rgba(200,230,60,0.3)" : "rgba(0,0,0,0.08)",
                      color: step === s ? "#1a2540" : "rgba(30,37,53,0.4)",
                    }}>
                      {i + 1}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: step === s ? "#1e2535" : "rgba(30,37,53,0.4)" }}>
                      {s === "dates" ? "Date" : s === "info" ? "Details" : "Payment"}
                    </span>
                    {i < 2 && <span style={{ color: "rgba(30,37,53,0.2)", margin: "0 4px" }}>→</span>}
                  </div>
                ))}
              </div>
              <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", color: "#1e2535", fontSize: "1.5rem" }}>
                {selectedCourse.title}
              </DialogTitle>
              <div className="flex flex-wrap gap-3 text-xs mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>
                {selectedCourse.duration_hours && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{selectedCourse.duration_hours}h</span>}
                {selectedCourse.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedCourse.location}</span>}
              </div>
            </DialogHeader>
          )}

          {/* STEP 1: Date Selection */}
          {selectedCourse && step === "dates" && (
            <div className="space-y-4 pt-2">
              {selectedCourse.description && (
                <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>{selectedCourse.description}</p>
              )}

              <div>
                <h4 className="font-bold mb-3 text-xs uppercase tracking-wide" style={{ color: "rgba(30,37,53,0.5)" }}>
                  {getUpcomingDates(selectedCourse).length > 0 ? "Select a Date" : "Available Dates"}
                </h4>

                {getUpcomingDates(selectedCourse).length === 0 ? (
                  <div className="text-center py-8 rounded-xl" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)" }}>
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm" style={{ color: "rgba(30,37,53,0.4)" }}>No upcoming dates yet — check back soon.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getUpcomingDates(selectedCourse).map((s, i) => {
                      const isSelected = selectedDate === s.date;
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedDate(s.date)}
                          className="w-full text-left px-4 py-3 rounded-xl border-2 transition-all"
                          style={isSelected
                            ? { borderColor: "#C8E63C", background: "rgba(200,230,60,0.1)" }
                            : { borderColor: "rgba(0,0,0,0.1)", background: "transparent" }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm" style={{ color: "#1e2535" }}>
                              {parseLocalDate(s.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                          {(s.start_time || s.end_time) && (
                            <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.45)" }}>
                              {s.start_time}{s.end_time ? ` – ${s.end_time}` : ""}
                              {s.location ? ` · ${s.location}` : ""}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <Button
                className="w-full py-5 text-base font-bold rounded-xl"
                style={{ background: selectedDate ? "#C8E63C" : "rgba(0,0,0,0.1)", color: "#1a2540" }}
                onClick={() => setStep("info")}
                disabled={!selectedDate}
              >
                Continue <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          )}

          {/* STEP 2: Personal Info */}
          {selectedCourse && step === "info" && (
            <div className="space-y-5 pt-2">
              {selectedDate && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.25)" }}>
                  <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: "#5a7a20" }} />
                  <p className="text-sm font-semibold" style={{ color: "#3d5a0a" }}>
                    {parseLocalDate(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </p>
                  <button onClick={() => setStep("dates")} className="ml-auto text-xs underline" style={{ color: "rgba(30,37,53,0.45)" }}>Change</button>
                </div>
              )}

              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "#2D6B7F" }}>
                  <User className="w-3.5 h-3.5" /> Your Information
                </p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Full Name *</Label>
                    <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Jane Smith" className="h-11 rounded-xl" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Email Address *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(30,37,53,0.35)" }} />
                      <Input type="email" value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} placeholder="jane@example.com" className="h-11 rounded-xl pl-9" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Phone Number (SMS) *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(30,37,53,0.35)" }} />
                      <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 123-4567" className="h-11 rounded-xl pl-9" style={{ border: isPhoneValid || !form.phone ? "1.5px solid rgba(0,0,0,0.1)" : "1.5px solid rgba(218,106,99,0.4)" }} />
                    </div>
                    {form.phone && !isPhoneValid && <p className="text-xs mt-1" style={{ color: "#DA6A63" }}>Please enter a valid 10+ digit phone number</p>}
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Date of Birth *</Label>
                    <Input
                      type="date"
                      value={form.date_of_birth}
                      onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
                      className="h-11 rounded-xl"
                      style={{ border: isDobValidAge ? "1.5px solid rgba(0,0,0,0.1)" : "1.5px solid rgba(218,106,99,0.4)" }}
                    />
                    {form.date_of_birth && !isDobValidAge && (
                      <p className="text-xs mt-1" style={{ color: "#DA6A63" }}>Age should be 18 or above</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Treatment Type *</Label>
                    <Select value={form.treatment_type} onValueChange={v => setForm(f => ({ ...f, treatment_type: v }))}>
                      <SelectTrigger className="h-11 rounded-xl" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}>
                        <SelectValue placeholder="Select treatment..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TREATMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Time Slot *</Label>
                    {totalCapacityReached && !showWaitlist && (
                      <div className="p-3 rounded-xl mb-3" style={{ background: "rgba(218,106,99,0.1)", border: "1px solid rgba(218,106,99,0.25)" }}>
                        <p className="text-sm font-semibold mb-2" style={{ color: "#DA6A63" }}>This date is at capacity</p>
                        <Button onClick={() => setShowWaitlist(true)} variant="ghost" className="text-xs" style={{ color: "#DA6A63" }}>Join waitlist instead</Button>
                      </div>
                    )}
                    {!showWaitlist ? (
                      <div className="grid grid-cols-2 gap-2">
                        {TIME_SLOTS.map(slot => {
                          const isFull = isSlotFull(slot.value);
                          const count = getSlotCount(slot.value);
                          return (
                            <button
                              key={slot.value}
                              onClick={() => !isFull && setSelectedTimeSlot(slot.value)}
                              disabled={isFull}
                              className="p-3 rounded-xl text-sm font-semibold transition-all text-left"
                              style={{
                                background: selectedTimeSlot === slot.value ? "rgba(200,230,60,0.15)" : isFull ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.02)",
                                border: selectedTimeSlot === slot.value ? "2px solid #C8E63C" : isFull ? "1px solid rgba(200,50,50,0.3)" : "1px solid rgba(0,0,0,0.07)",
                                color: isFull ? "rgba(30,37,53,0.3)" : "#1e2535",
                                cursor: isFull ? "not-allowed" : "pointer",
                                opacity: isFull ? 0.6 : 1,
                              }}
                            >
                              <div>{slot.label}</div>
                              <div className="text-xs mt-0.5" style={{ color: isFull ? "rgba(200,50,50,0.5)" : "rgba(30,37,53,0.5)" }}>
                                {isFull ? "Full" : `${count}/2`}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl text-center" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.25)" }}>
                        <p className="font-semibold text-sm mb-1" style={{ color: "#3d5a0a" }}>Join the Waitlist</p>
                        <p className="text-xs mb-3" style={{ color: "rgba(30,37,53,0.55)" }}>We'll notify you if a spot opens up</p>
                        <Button onClick={() => setShowWaitlist(false)} variant="ghost" className="text-xs" style={{ color: "#2D6B7F" }}>Select time slot instead</Button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Age Range</Label>
                      <Select value={form.age_range} onValueChange={v => setForm(f => ({ ...f, age_range: v }))}>
                        <SelectTrigger className="h-11 rounded-xl" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="18-25">18–25</SelectItem>
                          <SelectItem value="26-35">26–35</SelectItem>
                          <SelectItem value="36-45">36–45</SelectItem>
                          <SelectItem value="46-55">46–55</SelectItem>
                          <SelectItem value="56+">56+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Prior Experience</Label>
                      <Select value={form.experience_level} onValueChange={v => setForm(f => ({ ...f, experience_level: v }))}>
                        <SelectTrigger className="h-11 rounded-xl" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="first_time">First time</SelectItem>
                          <SelectItem value="some">Some experience</SelectItem>
                          <SelectItem value="regular">Regular treatments</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Health Questions / Medical History</Label>
                    <Textarea value={form.health_questions} onChange={e => setForm(f => ({ ...f, health_questions: e.target.value }))} placeholder="Share any medical conditions, allergies, medications, or contraindications..." rows={3} className="rounded-xl resize-none text-sm mb-3" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
                    <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Questions or Comments</Label>
                    <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any questions, allergies, or special notes..." rows={3} className="rounded-xl resize-none text-sm" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.07)" }}>
                  <Checkbox id="age18" checked={age18Checked} onCheckedChange={setAge18Checked} className="mt-0.5" />
                  <Label htmlFor="age18" className="text-xs leading-relaxed cursor-pointer flex-1" style={{ color: "rgba(30,37,53,0.7)" }}>
                    I confirm that I am <strong>18 years of age or older</strong> and able to consent to aesthetic treatments.
                  </Label>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.07)" }}>
                  <Checkbox id="terms" checked={termsChecked} onCheckedChange={setTermsChecked} className="mt-0.5" />
                  <Label htmlFor="terms" className="text-xs leading-relaxed cursor-pointer flex-1" style={{ color: "rgba(30,37,53,0.7)" }}>
                    I agree to the <a href="/TermsAndConditions" className="underline" style={{ color: "#2D6B7F" }} target="_blank" rel="noreferrer">Terms & Conditions</a> and acknowledge treatments are by licensed professionals under medical supervision.
                  </Label>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="ghost" onClick={() => setStep("dates")} className="px-4" style={{ color: "rgba(30,37,53,0.5)" }}>Back</Button>
                {age18Checked && termsChecked ? (
                  <Button
                    className="flex-1 py-5 text-base font-bold rounded-xl"
                    style={{ background: canSubmitInfo ? "#C8E63C" : "rgba(0,0,0,0.1)", color: "#1a2540" }}
                    disabled={!canSubmitInfo}
                    onClick={handleSubmit}
                  >
                    Continue to Payment <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs rounded-xl" style={{ color: "rgba(30,37,53,0.45)", border: "1px dashed rgba(0,0,0,0.14)" }}>
                    Tick both checkboxes to continue
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Payment */}
          {selectedCourse && step === "payment" && (
            <div className="space-y-5 pt-2">
              <div className="p-4 rounded-xl" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.25)" }}>
                <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#5a7a20" }}>Booking Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: "rgba(30,37,53,0.6)" }}>Date:</span>
                    <span className="font-semibold" style={{ color: "#1e2535" }}>{parseLocalDate(selectedDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                  </div>
                  {!showWaitlist && (
                    <div className="flex justify-between">
                      <span style={{ color: "rgba(30,37,53,0.6)" }}>Time:</span>
                      <span className="font-semibold" style={{ color: "#1e2535" }}>{TIME_SLOTS.find(t => t.value === selectedTimeSlot)?.label}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span style={{ color: "rgba(30,37,53,0.6)" }}>Treatment:</span>
                    <span className="font-semibold" style={{ color: "#1e2535" }}>{getTreatmentLabel(form.treatment_type)}</span>
                  </div>
                  {showWaitlist && (
                    <div className="flex justify-between pt-2" style={{ borderTop: "1px solid rgba(0,0,0,0.1)" }}>
                      <span style={{ color: "rgba(30,37,53,0.6)" }}>Status:</span>
                      <span className="font-semibold" style={{ color: "#DA6A63" }}>Waitlist</span>
                    </div>
                  )}
                </div>
              </div>

              {!showWaitlist && (
                <>
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block" style={{ color: "#1e2535" }}>Promo Code (Optional)</Label>
                    {!promoApplied ? (
                      <div className="flex gap-2">
                        <Input
                          value={promoInput}
                          onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoState(null); }}
                          onKeyDown={e => e.key === "Enter" && handleApplyPromo()}
                          placeholder="Enter code"
                          className="h-11 rounded-xl flex-1"
                          style={{ border: promoState && !promoState.valid ? "1.5px solid rgba(218,106,99,0.5)" : "1.5px solid rgba(0,0,0,0.1)" }}
                        />
                        <Button
                          onClick={handleApplyPromo}
                          disabled={!promoInput.trim() || validatingPromo}
                          className="h-11 px-5 rounded-xl font-semibold flex-shrink-0"
                          style={{ background: "#1e2535", color: "#fff" }}
                        >
                          {validatingPromo ? "..." : "Apply"}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "rgba(200,230,60,0.12)", border: "1.5px solid rgba(200,230,60,0.4)" }}>
                        <div>
                          <span className="text-sm font-bold" style={{ color: "#3d5a0a" }}>{promoInput}</span>
                          <span className="text-xs ml-2" style={{ color: "#5a7a20" }}>
                            — {promoState.discount_type === "percentage" ? `${promoState.discount_value}% off` : `$${promoState.discount_value} off`}
                          </span>
                        </div>
                        <button onClick={resetPromo} className="text-xs underline ml-3 flex-shrink-0" style={{ color: "rgba(30,37,53,0.5)" }}>Remove</button>
                      </div>
                    )}
                    {promoState && !promoState.valid && (
                      <p className="text-xs mt-1.5" style={{ color: "#DA6A63" }}>{promoState.error}</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#2D6B7F" }}>What's Included in $50</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.02)" }}>
                        <span style={{ color: "rgba(30,37,53,0.6)" }}>Good Faith Exam</span>
                        <span className="font-semibold" style={{ color: "#1e2535" }}>Included</span>
                      </div>
                      <div className="flex justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.02)" }}>
                        <span style={{ color: "rgba(30,37,53,0.6)" }}>
                          {form.treatment_type === "tox" ? "20 Units of Botox" : form.treatment_type === "filler" ? "1 Syringe of Filler" : "20 Units of Botox or 1 Syringe of Filler"}
                        </span>
                        <span className="font-semibold" style={{ color: "#1e2535" }}>Included</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl text-xs" style={{ background: "rgba(45,107,127,0.06)", border: "1px solid rgba(45,107,127,0.15)", color: "rgba(30,37,53,0.6)" }}>
                    <p className="font-semibold mb-1.5" style={{ color: "#2D6B7F" }}>Additional Pricing (Pay at Training)</p>
                    <div className="space-y-1">
                      <div>• Botox: $5 per unit beyond 20</div>
                      <div>• Filler: $150 per additional syringe</div>
                    </div>
                  </div>
                </>
              )}

              {showWaitlist && (
                <div className="p-4 rounded-xl" style={{ background: "rgba(45,107,127,0.08)", border: "1px solid rgba(45,107,127,0.2)" }}>
                  <p className="font-semibold text-sm mb-2" style={{ color: "#2D6B7F" }}>Waitlist Terms</p>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>
                    Your $50 payment reserves your spot on the waitlist. If a scheduled slot becomes available, we'll notify you via email and SMS within 24 hours. If no spot opens, your payment will be refunded in full.
                  </p>
                </div>
              )}

              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(218,106,99,0.08)", border: "1px solid rgba(218,106,99,0.2)" }}>
                <Checkbox
                  id="non-refundable"
                  checked={nonRefundableChecked}
                  onCheckedChange={setNonRefundableChecked}
                  className="mt-0.5"
                />
                <Label htmlFor="non-refundable" className="text-xs leading-relaxed cursor-pointer flex-1" style={{ color: "rgba(30,37,53,0.7)" }}>
                  I understand that this $50 booking is <strong>non-refundable</strong>{showWaitlist ? " unless no spot opens up" : ""} and reserves my {showWaitlist ? "waitlist position" : "time slot and spot"} in the training.
                </Label>
              </div>

              <div className="p-4 rounded-xl text-center" style={{ background: "#C8E63C", color: "#1a2540" }}>
                <p className="text-xs font-semibold mb-1">Amount Due Today</p>
                {promoApplied && promoState?.valid ? (
                  <div>
                    <p className="text-sm line-through opacity-60">$50.00</p>
                    <p className="text-2xl font-bold">${(promoState.final_cents / 100).toFixed(2)}</p>
                    <p className="text-xs mt-1 opacity-75">Promo applied ✓</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold">$50</p>
                    <p className="text-xs mt-1 opacity-75">{showWaitlist ? "Waitlist Reservation" : "Good Faith Exam Included"}</p>
                  </div>
                )}
              </div>

              <Button
                className="w-full py-5 text-base font-bold rounded-xl"
                style={{ background: nonRefundableChecked ? "#1e2535" : "rgba(0,0,0,0.1)", color: "#fff" }}
                disabled={!nonRefundableChecked || processingPayment}
                onClick={handlePayment}
              >
                {processingPayment ? "Processing..." : `Pay ${promoApplied && promoState?.valid ? `$${(promoState.final_cents / 100).toFixed(2)}` : "$50"} & Reserve Spot`}
              </Button>

              <Button variant="ghost" onClick={() => setStep("info")} className="w-full" style={{ color: "rgba(30,37,53,0.5)" }}>
                Back to Details
              </Button>
            </div>
          )}

          {/* STEP 4: Success */}
          {selectedCourse && step === "submitted" && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(200,230,60,0.15)" }}>
                <CheckCircle2 className="w-8 h-8" style={{ color: "#5a7a20" }} />
              </div>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.75rem", color: "#1e2535", fontStyle: "italic" }}>
                You're Signed Up!
              </h3>
              <p className="text-base leading-relaxed max-w-sm mx-auto" style={{ color: "rgba(30,37,53,0.65)" }}>
                Your $50 payment has been processed and your spot is reserved. We'll send you a confirmation email with next steps.
              </p>
              {selectedDate && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.25)" }}>
                  <Calendar className="w-4 h-4" style={{ color: "#5a7a20" }} />
                  <span className="text-sm font-semibold" style={{ color: "#3d5a0a" }}>
                    {parseLocalDate(selectedDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              )}

              <div className="p-5 rounded-2xl text-left" style={{ background: "rgba(45,107,127,0.05)", border: "1px solid rgba(45,107,127,0.15)" }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#2D6B7F" }}>Next: Complete Your Good Faith Exam (GFE)</p>
                <p className="text-sm mb-4" style={{ color: "rgba(30,37,53,0.65)" }}>
                  A GFE is required before treatment. Would you like to complete it now or have us email the link?
                </p>

                {!gfeChoice ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setGfeChoice("now");
                        if (!gfeSent) sendGFE(null);
                      }}
                      className="p-4 rounded-xl text-left transition-all"
                      style={{ background: "rgba(200,230,60,0.1)", border: "2px solid rgba(200,230,60,0.4)" }}
                    >
                      <p className="font-bold text-sm mb-1" style={{ color: "#3d5a0a" }}>Complete Now</p>
                      <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>Open the GFE portal and finish it today</p>
                    </button>
                    <button
                      onClick={() => setGfeChoice("later")}
                      className="p-4 rounded-xl text-left transition-all"
                      style={{ background: "rgba(45,107,127,0.07)", border: "2px solid rgba(45,107,127,0.2)" }}
                    >
                      <p className="font-bold text-sm mb-1" style={{ color: "#2D6B7F" }}>Email Me Later</p>
                      <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>Admin will send the link to your email</p>
                    </button>
                  </div>
                ) : gfeChoice === "now" ? (
                  sendingGFE ? (
                    <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Generating your GFE link...
                    </div>
                  ) : gfeUrl ? (
                    <div className="space-y-2">
                      <a
                        href={gfeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm"
                        style={{ background: "#C8E63C", color: "#1a2540" }}
                      >
                        <ExternalLink className="w-4 h-4" /> Open GFE Portal
                      </a>
                      <p className="text-xs text-center" style={{ color: "rgba(30,37,53,0.4)" }}>Link also sent to {form.customer_email}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
                        We couldn't generate your GFE link automatically. {stripeGfeError ? `Error: ${stripeGfeError}` : "Our team will email it to you shortly."}
                      </p>
                      <button onClick={() => setGfeChoice(null)} className="text-xs underline" style={{ color: "#2D6B7F" }}>Go back</button>
                    </div>
                  )
                ) : (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#5a7a20" }} />
                    <p className="text-sm" style={{ color: "rgba(30,37,53,0.65)" }}>Got it — our admin team will email the GFE link to <strong>{form.customer_email}</strong> before your course date.</p>
                  </div>
                )}
              </div>

              <p className="text-sm" style={{ color: "rgba(30,37,53,0.45)" }}>
                Check <strong>{form.customer_email}</strong> for confirmation.
              </p>
              <Button onClick={closeModal} className="mt-2 px-8 py-3 rounded-full font-bold" style={{ background: "#C8E63C", color: "#1a2540" }}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}