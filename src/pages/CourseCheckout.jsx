import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, MapPin, Award, CheckCircle, ArrowLeft, CreditCard, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { courseCheckoutApi } from "@/api/courseCheckoutApi";

export default function CourseCheckout() {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get("course_id");

  const { data: course, isLoading: loadingCourse } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => base44.entities.Course.get(courseId),
    enabled: !!courseId,
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: myEnrollments = [] } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.Enrollment.filter({ provider_id: user.id });
    },
  });

  const alreadyEnrolled = myEnrollments.some(e => e.course_id === courseId && e.status !== "cancelled");

  const [selectedDate, setSelectedDate] = useState("");

  const checkout = useMutation({
    mutationFn: async () => {
      const response = await courseCheckoutApi.createCheckout({
        course_id: courseId,
        course_date: selectedDate || null,
        customer_name: me?.full_name || "",
        first_name: me?.first_name || me?.full_name?.split(" ")[0] || "",
        last_name: me?.last_name || me?.full_name?.split(" ").slice(1).join(" ") || "",
        customer_email: me?.email || "",
        terms_confirmed: true,
        refund_policy_confirmed: true,
      });
      if (response?.checkout_url) {
        window.location.href = response.checkout_url;
      } else {
        throw new Error("Stripe checkout URL was not returned.");
      }
    },
  });

  if (loadingCourse) return <div className="text-center py-16" style={{ color: "rgba(30,37,53,0.4)" }}>Loading...</div>;
  if (!course) return <div className="text-center py-16" style={{ color: "rgba(30,37,53,0.4)" }}>Course not found.</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5 px-5 py-8">
      <Link to={createPageUrl("ProviderEnrollments")} className="inline-flex items-center gap-2 text-sm" style={{ color: "#7B8EC8" }}>
        <ArrowLeft className="w-4 h-4" /> Back to Courses
      </Link>

      <div>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: "#1e2535", fontStyle: "italic", fontWeight: 400, lineHeight: 1.1 }}>Checkout</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.6)" }}>Complete your enrollment</p>
      </div>

      {alreadyEnrolled && (
        <div className="p-4 rounded-2xl text-sm" style={{ background: "rgba(218,106,99,0.12)", border: "1px solid rgba(218,106,99,0.3)", color: "#DA6A63" }}>
          You are already enrolled in this course.
        </div>
      )}

      {/* Date Selection */}
      {course?.session_dates?.length > 0 && (
        <div className="rounded-2xl p-6 overflow-hidden" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 4px 16px rgba(31,38,135,0.08)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4" style={{ color: "#7B8EC8" }} />
            <h3 className="font-bold text-base" style={{ color: "#1e2535" }}>Choose a Class Date *</h3>
          </div>
          <div className="space-y-2">
            {course.session_dates
              .filter(s => s.date >= new Date().toISOString().slice(0, 10))
              .sort((a, b) => a.date > b.date ? 1 : -1)
              .map((s, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDate(s.date)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    selectedDate === s.date ? "" : ""
                  }`}
                  style={selectedDate === s.date ? { borderColor: "#FA6F30", background: "rgba(250,111,48,0.1)" } : { borderColor: "rgba(30,37,53,0.1)", background: "transparent" }}
                >
                  <div className="font-medium" style={{ color: "#1e2535" }}>
                    {format(new Date(s.date + "T12:00:00"), "EEEE, MMMM d, yyyy")}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>
                    {s.start_time && s.end_time ? `${s.start_time} – ${s.end_time}` : s.start_time || ""}
                    {s.location && ` · ${s.location}`}
                  </div>
                </button>
              ))}
            {course.session_dates.filter(s => s.date >= new Date().toISOString().slice(0, 10)).length === 0 && (
              <p className="text-sm italic" style={{ color: "rgba(30,37,53,0.4)" }}>No upcoming dates available. Contact us for scheduling.</p>
            )}
          </div>
        </div>
      )}

      {/* Course Summary */}
      <div className="rounded-2xl p-6 overflow-hidden" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 4px 16px rgba(31,38,135,0.08)" }}>
        <h3 className="font-bold text-base mb-4" style={{ color: "#1e2535" }}>Order Summary</h3>
        <div className="space-y-4">
          {course.cover_image_url && (
            <img src={course.cover_image_url} alt={course.title} className="w-full h-40 object-cover rounded-lg" />
          )}
          <div>
            <h3 className="font-bold" style={{ color: "#1e2535" }}>{course.title}</h3>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full capitalize" style={{ background: "rgba(250,111,48,0.15)", color: "#FA6F30", border: "1px solid rgba(250,111,48,0.3)" }}>{course.category?.replace("_"," ")}</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full capitalize" style={{ background: "rgba(123,142,200,0.12)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.25)" }}>{course.level}</span>
            </div>
          </div>
          <div className="flex gap-4 text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
            {course.duration_hours && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{course.duration_hours}h</span>}
            {course.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{course.location}</span>}
           </div>
          {course.certification_name && (
           <div className="flex items-center gap-2 p-3.5 rounded-xl" style={{ background: "rgba(200,230,60,0.12)", border: "1px solid rgba(200,230,60,0.3)" }}>
             <Award className="w-4 h-4" style={{ color: "#C8E63C" }} />
             <span className="text-sm font-bold" style={{ color: "#1e2535" }}>🎓 {course.certification_name}</span>
           </div>
          )}
          <div className="border-t pt-4 flex items-center justify-between" style={{ borderColor: "rgba(30,37,53,0.08)" }}>
           <span className="font-medium" style={{ color: "rgba(30,37,53,0.7)" }}>Total</span>
           <span className="text-3xl font-bold" style={{ color: "#1e2535" }}>${Number(course.price || 0).toLocaleString()}</span>
          </div>
          </div>
          </div>

      {/* Checkout Button */}
      <div className="rounded-2xl p-6 overflow-hidden" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 4px 16px rgba(31,38,135,0.08)" }}>
        <div className="flex items-center gap-2 text-sm mb-4" style={{ color: "rgba(30,37,53,0.6)" }}>
          <CreditCard className="w-4 h-4" />
          <span>Secure payment powered by Stripe</span>
        </div>
        <Button
          className="w-full py-3.5 text-base font-bold rounded-xl"
          style={{ background: "#FA6F30", color: "#fff" }}
          onClick={() => checkout.mutate()}
          disabled={checkout.isPending || alreadyEnrolled || (course?.session_dates?.length > 0 && !selectedDate)}
        >
          {checkout.isPending ? "Redirecting to payment..." : course?.session_dates?.length > 0 && !selectedDate ? "Select a Date to Continue" : `Pay $${Number(course.price || 0).toLocaleString()} & Enroll`}
        </Button>
        <p className="text-xs text-center mt-3" style={{ color: "rgba(30,37,53,0.5)" }}>
          By enrolling you agree to our terms of service. Refunds within 48 hours of purchase.
        </p>
      </div>
    </div>
  );
}