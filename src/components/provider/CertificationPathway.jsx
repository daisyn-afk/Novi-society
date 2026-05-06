import { CheckCircle2, Lock, MapPin, Users, Clock, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { formatMinAvailableSeatsLabel } from "@/lib/sessionDateSeats";

export default function CertificationPathway({
  serviceType,
  courses = [],
  userCerts,
  userMDSubs,
  enrolledCourseIds = new Set(),
  serviceEnrollments = [],
  sessionByEnrollment = {},
  initiallyExpandedCourseId = null,
  onEnroll,
  onViewEnrollment,
  onApplyMD
}) {
  const firstEnrolledCourseId = courses.find((course) => enrolledCourseIds.has(course.id))?.id || null;
  const [expandedCourseId, setExpandedCourseId] = useState(
    initiallyExpandedCourseId || firstEnrolledCourseId || null
  );
  if (!serviceType) return null;

  const activeCert = userCerts.find(c => c.service_type_id === serviceType?.id && c.status === "active");
  const mdCoverage = userMDSubs.find(s => s.service_type_id === serviceType?.id && s.status === "active");

  // Journey: Purchase -> Materials -> Attend -> Certified -> MD coverage.
  const anyEnrolled = courses.some((course) => enrolledCourseIds.has(course.id));
  const attendedEnrollment = serviceEnrollments.find((enrollment) => {
    if (["attended", "completed"].includes(enrollment.status)) return true;
    const session = sessionByEnrollment[enrollment.id];
    return !!session?.code_used;
  });
  const hasStudiedProgress = serviceEnrollments.some((enrollment) =>
    ["paid", "confirmed", "attended", "completed"].includes(enrollment.status)
  );
  const steps = [
    { num: 1, label: "Purchase Course", status: anyEnrolled ? "complete" : "available" },
    { num: 2, label: "Review Materials", status: hasStudiedProgress ? "complete" : anyEnrolled ? "available" : "locked" },
    { num: 3, label: "Attend Course", status: attendedEnrollment ? "complete" : anyEnrolled ? "available" : "locked" },
    { num: 4, label: "Get Certified", status: activeCert ? "complete" : anyEnrolled ? "available" : "locked" },
    { num: 5, label: "Join Society (MD Coverage)", status: mdCoverage ? "complete" : activeCert ? "available" : "locked" },
  ];

  const getStepColor = (status) => {
    if (status === "complete") return { bg: "rgba(200,230,60,0.15)", border: "rgba(200,230,60,0.4)", text: "#4a6b10" };
    if (status === "available") return { bg: "rgba(123,142,200,0.12)", border: "rgba(123,142,200,0.25)", text: "#7B8EC8" };
    return { bg: "rgba(30,37,53,0.06)", border: "rgba(30,37,53,0.1)", text: "rgba(30,37,53,0.3)" };
  };

  return (
    <div className="rounded-3xl overflow-hidden" style={{
      background: "rgba(255,255,255,0.9)",
      border: "1px solid rgba(30,37,53,0.1)",
      boxShadow: "0 2px 12px rgba(30,37,53,0.06)",
    }}>
      {/* Header */}
      <div className="px-8 py-6" style={{ borderBottom: "1px solid rgba(30,37,53,0.08)" }}>
        <p className="text-xs uppercase tracking-widest font-bold mb-2" style={{ color: "rgba(30,37,53,0.4)" }}>
          {serviceType.category?.replace(/_/g, " ")}
        </p>
        <h2 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 26,
          fontStyle: "italic",
          color: "#1e2535",
          lineHeight: 1.1,
        }}>
          Become a NOVI Society Member
        </h2>
        <p className="text-sm mt-2" style={{ color: "rgba(30,37,53,0.6)" }}>Master {serviceType.name} & join our community of certified providers</p>
      </div>

      {/* Step Progress */}
      <div className="px-8 py-8">
        {/* Visual step indicators */}
        <div className="flex items-center justify-between gap-3 mb-8">
          {steps.map((step, idx) => {
            const colors = getStepColor(step.status);
            return (
              <div key={step.num} className="flex-1 flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 transition-all"
                  style={{
                    background: colors.bg,
                    border: `1.5px solid ${colors.border}`,
                    color: colors.text,
                  }}
                >
                  {step.status === "complete" ? <CheckCircle2 className="w-5 h-5" /> : step.num}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className="flex-1 h-0.5 mx-1"
                    style={{
                      background: idx < steps.filter((step) => step.status === "complete").length
                        ? "rgba(200,230,60,0.4)"
                        : "rgba(30,37,53,0.08)"
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step labels */}
        <div className="flex items-center justify-between text-xs font-bold mb-8 gap-2">
          {steps.map(step => (
            <div key={step.num} className="flex-1 text-center" style={{ color: "rgba(30,37,53,0.6)" }}>
              {step.label}
            </div>
          ))}
        </div>

        <div className="border-t" style={{ borderColor: "rgba(30,37,53,0.08)" }} />
      </div>

      {/* Courses Section */}
      <div className="px-8 py-6 space-y-5">
        {(() => {
          return courses.length === 0 ? (
          <div className="text-center py-8" style={{ color: "rgba(30,37,53,0.5)" }}>
            <p className="text-sm font-semibold">No courses configured for this service yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => {
              const isEnrolled = enrolledCourseIds.has(course.id);
              const isExpanded = expandedCourseId === course.id;
              const seatsHint = formatMinAvailableSeatsLabel(course);
              return (
                <div key={course.id} className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.1)" }}>
                  {/* Collapsible Header */}
                  <button
                    onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                    className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left hover:brightness-105 transition-all"
                    style={{ background: "rgba(255,255,255,0.5)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>
                        {course.title}
                      </h3>
                      <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>
                        Instructor: {course.instructor_name || "TBD"}
                      </p>
                      <div className="mt-2">
                        <span
                          className="text-[11px] font-bold px-2 py-1 rounded-full"
                          style={isEnrolled
                            ? { background: "rgba(123,142,200,0.12)", color: "#4a5fa0", border: "1px solid rgba(123,142,200,0.28)" }
                            : { background: "rgba(250,111,48,0.12)", color: "#b84f20", border: "1px solid rgba(250,111,48,0.28)" }}
                        >
                          {isEnrolled ? "Enrolled" : "Available"}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 mt-1">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" style={{ color: "rgba(30,37,53,0.4)" }} />
                      ) : (
                        <ChevronDown className="w-5 h-5" style={{ color: "rgba(30,37,53,0.4)" }} />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-5 py-4 space-y-3" style={{ borderTop: "1px solid rgba(30,37,53,0.08)" }}>
                      {/* Course Description */}
                      {course.description && (
                        <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.65)" }}>
                          {course.description}
                        </p>
                      )}

                      {/* Pre-Course Materials */}
                      {course.pre_course_materials?.length > 0 && (
                        <div className="rounded-lg p-3" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.15)" }}>
                          <p className="text-xs font-bold mb-2" style={{ color: "#7B8EC8" }}>📚 Pre-Course Materials to Study</p>
                          <ul className="space-y-1">
                            {course.pre_course_materials.map((mat, i) => (
                              <li key={i} className="text-xs flex items-start gap-2" style={{ color: "rgba(30,37,53,0.6)" }}>
                                {mat.required && <Zap className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "#FA6F30" }} />}
                                <span>{mat.title}{mat.required ? " (Required)" : ""}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Course Info Grid */}
                      <div className="grid grid-cols-3 gap-2 p-3 rounded-lg" style={{ background: "rgba(30,37,53,0.04)" }}>
                        {course.location && (
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{course.location}</span>
                          </div>
                        )}
                        {course.duration_hours && (
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>
                            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{course.duration_hours}h</span>
                          </div>
                        )}
                        {seatsHint != null && (
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>
                            <Users className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{seatsHint}</span>
                          </div>
                        )}
                      </div>

                      {/* CTA Button */}
                      {!activeCert && (
                        <button
                          onClick={() => (isEnrolled ? onViewEnrollment?.(course) : onEnroll(course))}
                          className="w-full py-3 rounded-lg font-bold text-white transition-all hover:opacity-90"
                          style={{ background: isEnrolled ? "#7B8EC8" : "#FA6F30" }}
                        >
                          {isEnrolled ? "View Enrollment" : "Enroll"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
        })()}

        {/* Status messages */}
        {activeCert && !mdCoverage && (
            <div className="rounded-lg p-3.5 flex items-start gap-3" style={{ background: "rgba(250,111,48,0.1)", border: "1px solid rgba(250,111,48,0.2)" }}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#FA6F30" }} />
              <div className="flex-1">
                <p className="text-xs font-bold" style={{ color: "#FA6F30" }}>🎉 Certification Earned!</p>
                <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.6)" }}>
                  Complete your NOVI Society membership by setting up MD Board coverage to start practicing.
                </p>
                <button
                  onClick={onApplyMD}
                  className="text-xs font-bold mt-2 px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: "#FA6F30", color: "#fff" }}
                >
                  Join NOVI Society
                </button>
              </div>
            </div>
          )}

        {mdCoverage && (
          <div className="rounded-lg p-3.5 flex items-start gap-3" style={{ background: "rgba(200,230,60,0.12)", border: "1px solid rgba(200,230,60,0.3)" }}>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#4a6b10" }} />
            <div>
              <p className="text-xs font-bold" style={{ color: "#4a6b10" }}>✨ Welcome to NOVI Society!</p>
              <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.6)" }}>
                You're fully certified and covered. Start offering {serviceType.name} services with full MD Board support.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}