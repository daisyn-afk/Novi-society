import { Calendar, MapPin, Users, Clock, FileText, Trash2, BookOpen, Award, CheckCircle2, Zap } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useState } from "react";

export default function CourseEnrollmentCard({
  enrollment,
  course,
  session,
  certs,
  activeSubServiceIds,
  onViewMaterials,
  onCancel,
  onOpenClassWizard,
  showClassWizardCta = false,
}) {
  const [showDetails, setShowDetails] = useState(false);
  if (!course) return null;

  const nextSessionDate =
    enrollment.session_date ||
    course.session_dates?.find((d) => d.date)?.date;
  const earnedCerts = certs.filter(c => c.course_id === course.id && c.status === "active");
  const linkedServiceIds = (course.linked_service_type_ids?.length > 0)
    ? course.linked_service_type_ids
    : (course.certifications_awarded || []).map(c => c.service_type_id).filter(Boolean);
  const allServicesCovered = linkedServiceIds.every(id => activeSubServiceIds.has(id));

  const statusConfig = {
    pending_payment: { bg: "rgba(218,106,99,0.12)", color: "#DA6A63", label: "Awaiting Payment" },
    paid: { bg: "rgba(123,142,200,0.12)", color: "#7B8EC8", label: "Confirmed" },
    confirmed: { bg: "rgba(123,142,200,0.12)", color: "#7B8EC8", label: "Confirmed" },
    attended: { bg: "rgba(200,230,60,0.12)", color: "#4a6b10", label: "Attended" },
    completed: { bg: "rgba(200,230,60,0.12)", color: "#4a6b10", label: "Completed" },
    cancelled: { bg: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.4)", label: "Cancelled" },
    no_show: { bg: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.4)", label: "No Show" },
  };

  const cfg = statusConfig[enrollment.status] || statusConfig.confirmed;
  const daysUntilClass = nextSessionDate ? differenceInDays(new Date(nextSessionDate), new Date()) : null;
  const isStudying = ["paid", "confirmed"].includes(enrollment.status) && nextSessionDate;
  const isCompleted = ["attended", "completed"].includes(enrollment.status);

  return (
    <div
      className="rounded-3xl overflow-hidden transition-all hover:shadow-lg"
      style={{
        background: "rgba(255,255,255,0.75)",
        backdropFilter: "blur(30px)",
        border: "1px solid rgba(255,255,255,0.8)",
        boxShadow: "0 4px 16px rgba(31,38,135,0.08)",
      }}
    >
      {/* Header with color accent */}
      <div
        className="px-6 py-4 flex items-start justify-between gap-3"
        style={{
          background: `linear-gradient(135deg, ${cfg.color}15 0%, ${cfg.color}08 100%)`,
          borderBottom: "1px solid rgba(30,37,53,0.05)",
        }}
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>
            {course.title}
          </h3>
          <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.5)" }}>
            {course.instructor_name && `Instructor: ${course.instructor_name}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
          {isStudying && (
            <span className="text-xs font-bold px-2.5 py-1.5 rounded-full whitespace-nowrap" style={{ background: "rgba(200,230,60,0.2)", color: "#4a6b10" }}>
              📚 Studying
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {course.description && (
        <div className="px-6 py-4" style={{ borderTop: "1px solid rgba(30,37,53,0.08)" }}>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.65)", lineHeight: "1.6" }}>
            {course.description}
          </p>
        </div>
      )}

      {/* Countdown Timer */}
      {isStudying && daysUntilClass != null && !isCompleted && (
        <div className="px-6 pt-4" style={{ borderTop: "1px solid rgba(30,37,53,0.05)" }}>
          <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg, rgba(250,111,48,0.15) 0%, rgba(250,111,48,0.08) 100%)", border: "1px solid rgba(250,111,48,0.25)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest font-bold" style={{ color: "#FA6F30" }}>Time to Class</p>
                <p className="text-3xl font-bold mt-1" style={{ color: "#1e2535" }}>{Math.max(daysUntilClass, 0)}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>days until {nextSessionDate ? format(new Date(nextSessionDate), "MMM d") : "class"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.4)" }}>Class Date</p>
                <p className="font-bold text-sm mt-1" style={{ color: "#1e2535" }}>{nextSessionDate ? format(new Date(nextSessionDate), "MMM d, yyyy") : "TBD"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-6 py-5 space-y-4">
        {/* Pre-Course Materials */}
        {course.pre_course_materials?.length > 0 && (
          <div className="rounded-xl p-4" style={{ background: "rgba(123,142,200,0.1)", border: "1px solid rgba(123,142,200,0.25)" }}>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4" style={{ color: "#7B8EC8" }} />
              <p className="text-sm font-bold" style={{ color: "#1e2535" }}>📚 Pre-Course Materials</p>
            </div>
            <div className="space-y-2.5">
              {course.pre_course_materials.map((mat, idx) => (
                <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(123,142,200,0.15)" }}>
                  {mat.required ? (
                    <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#FA6F30" }} />
                  ) : (
                    <FileText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#7B8EC8" }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: "#1e2535" }}>{mat.title}</p>
                    {mat.required && <span className="text-xs font-bold" style={{ color: "#FA6F30", fontSize: "9px" }}>🔴 Required</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick info grid */}
        <div className="grid grid-cols-2 gap-2">
         {nextSessionDate && (
           <div className="flex items-center gap-2.5 text-xs p-2.5 rounded-lg" style={{ background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.2)", color: "rgba(30,37,53,0.65)" }}>
             <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: "#FA6F30" }} />
             <span className="font-medium">{format(new Date(nextSessionDate), "MMM d, yyyy")}</span>
           </div>
         )}
         {course.location && (
           <div className="flex items-center gap-2.5 text-xs p-2.5 rounded-lg" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)", color: "rgba(30,37,53,0.65)" }}>
             <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: "#7B8EC8" }} />
             <span className="font-medium">{course.location}</span>
           </div>
         )}
         {course.duration_hours && (
           <div className="flex items-center gap-2.5 text-xs p-2.5 rounded-lg" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.2)", color: "rgba(30,37,53,0.65)" }}>
             <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "#C8E63C" }} />
             <span className="font-medium">{course.duration_hours}h class</span>
           </div>
         )}
         {course.max_seats && (
           <div className="flex items-center gap-2.5 text-xs p-2.5 rounded-lg" style={{ background: "rgba(45,107,127,0.08)", border: "1px solid rgba(45,107,127,0.2)", color: "rgba(30,37,53,0.65)" }}>
             <Users className="w-4 h-4 flex-shrink-0" style={{ color: "#2D6B7F" }} />
             <span className="font-medium">{course.available_seats || 0} seats left</span>
           </div>
         )}
        </div>

        {/* Earned certifications */}
        {earnedCerts.length > 0 && (
          <div className="rounded-xl p-3" style={{ background: "rgba(200,230,60,0.1)", border: "1px solid rgba(200,230,60,0.3)" }}>
            <p className="text-xs font-bold mb-2" style={{ color: "#4a6b10" }}>Certifications Earned</p>
            <div className="space-y-1.5">
              {earnedCerts.map(cert => (
                <div key={cert.id} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#4a6b10" }} />
                  <span style={{ color: "#1e2535", fontWeight: 500 }}>{cert.certification_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Service coverage status */}
        {linkedServiceIds.length > 0 && (
          <div
            className="rounded-xl p-3 flex items-start gap-2"
            style={{
              background: allServicesCovered ? "rgba(200,230,60,0.12)" : "rgba(218,106,99,0.12)",
              border: allServicesCovered ? "1px solid rgba(200,230,60,0.3)" : "1px solid rgba(218,106,99,0.25)",
            }}
          >
            {allServicesCovered ? (
              <>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#4a6b10" }} />
                <p className="text-xs" style={{ color: "#1e2535" }}>
                  <strong>All services unlocked:</strong> You have MD Board coverage for all certifications from this course.
                </p>
              </>
            ) : (
              <>
                <Award className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#DA6A63" }} />
                <p className="text-xs" style={{ color: "#1e2535" }}>
                  <strong>MD coverage needed:</strong> Apply for NOVI Board supervision to practice these services.
                </p>
              </>
            )}
          </div>
        )}

        {/* More Details Toggle */}
        {(course.requirements || course.what_to_bring) && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: showDetails ? "rgba(30,37,53,0.1)" : "rgba(255,255,255,0.5)",
              color: "#1e2535",
              border: "1px solid rgba(30,37,53,0.1)"
            }}
          >
            {showDetails ? "Hide Details" : "View Course Details"}
          </button>
        )}

        {/* Expanded Details */}
        {showDetails && (
          <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(30,37,53,0.03)", border: "1px solid rgba(30,37,53,0.08)" }}>
            {course.requirements && (
              <div>
                <p className="text-xs font-bold mb-1" style={{ color: "#1e2535" }}>Requirements</p>
                <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>{course.requirements}</p>
              </div>
            )}
            {course.what_to_bring && (
              <div>
                <p className="text-xs font-bold mb-1" style={{ color: "#1e2535" }}>What to Bring</p>
                <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>{course.what_to_bring}</p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "rgba(30,37,53,0.08)" }}>
          {showClassWizardCta && (
            <button
              onClick={onOpenClassWizard}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: "rgba(250,111,48,0.12)",
                color: "#c8501f",
                border: "1px solid rgba(250,111,48,0.25)",
              }}
            >
              <Zap className="w-3.5 h-3.5" /> Class Day Wizard
            </button>
          )}
          <button
            onClick={onViewMaterials}
            className={`${showClassWizardCta ? "flex-[1.1]" : "flex-1"} flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all`}
            style={{
              background: "rgba(123,142,200,0.1)",
              color: "#4a5fa8",
              border: "1px solid rgba(123,142,200,0.2)",
            }}
          >
            <FileText className="w-3.5 h-3.5" /> View Materials
          </button>
          <button
            onClick={onCancel}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
            style={{
              background: "rgba(218,106,99,0.1)",
              color: "#DA6A63",
              border: "1px solid rgba(218,106,99,0.2)",
            }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Cancel
          </button>
        </div>
      </div>
    </div>
  );
}