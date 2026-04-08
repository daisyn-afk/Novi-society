import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Eye } from "lucide-react";
import CourseEnrollmentCard from "@/components/provider/CourseEnrollmentCard";
import ClassDayOnboardingWizard from "@/components/provider/ClassDayOnboardingWizard";
import { isToday } from "date-fns";

// Build a fake enrollment object for simulator preview
function makeFakeEnrollment(course, step) {
  const today = new Date().toISOString().split("T")[0];
  return {
    id: "sim-enrollment",
    course_id: course?.id || "sim",
    status: "confirmed",
    session_date: today,
    amount_paid: course?.price || null,
  };
}

function makeFakeSession(step) {
  return step === "done" ? { code_used: true } : null;
}

export default function AdminClassDaySimulator() {
  const [view, setView] = useState("card");
  const [cardStep, setCardStep] = useState("code");
  const [wizardStep, setWizardStep] = useState(0);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(true);

  const { data: courses = [] } = useQuery({
    queryKey: ["courses-simulator"],
    queryFn: () => base44.entities.Course.filter({ is_active: true }),
  });
  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["service-types-simulator"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });

  const selectedCourse = courses.find(c => c.id === selectedCourseId) || null;

  // Build fake data for card preview
  const fakeEnrollment = makeFakeEnrollment(selectedCourse, cardStep);
  const fakeSession = makeFakeSession(cardStep);
  const fakeCerts = cardStep === "done" ? [{ enrollment_id: "sim-enrollment", certification_name: "Certified" }] : [];

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#DA6A63" }}>Admin Tools</p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", lineHeight: 1.2 }}>Class Day Simulator</h1>
        <p className="mt-1 text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>Preview exactly what the provider sees on class day.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 12px rgba(30,37,53,0.06)" }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>What to Preview</p>
            <div className="space-y-1.5">
              {[
                { id: "card", label: "Enrollment Card", sub: "The course card on My Courses tab" },
                { id: "wizard", label: "Onboarding Wizard", sub: "The 3-step popup that opens automatically" },
              ].map(v => (
                <button key={v.id} onClick={() => setView(v.id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                  style={{ background: view === v.id ? "rgba(250,111,48,0.1)" : "rgba(30,37,53,0.03)", border: view === v.id ? "1.5px solid rgba(250,111,48,0.35)" : "1px solid rgba(30,37,53,0.07)" }}>
                  <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{v.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{v.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {view === "card" && (
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 12px rgba(30,37,53,0.06)" }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Card State</p>
              <div className="space-y-1.5">
                {[
                  { id: "code", label: "Waiting for code", sub: "Provider hasn't entered code yet" },
                  { id: "done", label: "Code redeemed", sub: "Attendance confirmed, MD CTA shown" },
                ].map(s => (
                  <button key={s.id} onClick={() => setCardStep(s.id)}
                    className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                    style={{ background: cardStep === s.id ? "rgba(123,142,200,0.12)" : "rgba(30,37,53,0.03)", border: cardStep === s.id ? "1.5px solid rgba(123,142,200,0.35)" : "1px solid rgba(30,37,53,0.07)" }}>
                    <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{s.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{s.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === "wizard" && (
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 12px rgba(30,37,53,0.06)" }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Open/Close</p>
              <button
                onClick={() => setWizardOpen(o => !o)}
                className="w-full px-3 py-2 rounded-xl text-sm font-semibold"
                style={{ background: wizardOpen ? "rgba(250,111,48,0.1)" : "rgba(30,37,53,0.04)", border: wizardOpen ? "1.5px solid rgba(250,111,48,0.35)" : "1px solid rgba(30,37,53,0.07)", color: "#1e2535" }}
              >
                {wizardOpen ? "Close Wizard" : "Open Wizard"}
              </button>
            </div>
          )}

          {courses.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 12px rgba(30,37,53,0.06)" }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Use Real Course</p>
              <select className="w-full text-sm rounded-xl px-3 py-2 outline-none" style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.1)", color: "#1e2535" }}
                value={selectedCourseId || ""} onChange={e => setSelectedCourseId(e.target.value || null)}>
                <option value="">— Sample data —</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Preview panel */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 12px rgba(30,37,53,0.06)" }}>
            <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(30,37,53,0.07)", background: "rgba(30,37,53,0.02)" }}>
              <Eye className="w-4 h-4" style={{ color: "#7B8EC8" }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.45)" }}>
                Provider View — {view === "card" ? (cardStep === "code" ? "Class day, waiting for code" : "Code redeemed") : "Onboarding Wizard"}
              </p>
            </div>
            <div className="p-5" style={{ background: "linear-gradient(150deg, #ede9fb 0%, #f5f2ff 40%, #eaf5c8 75%, #C8E63C 100%)", minHeight: 400 }}>
              {view === "card" ? (
                <div className="max-w-sm mx-auto">
                  <CourseEnrollmentCard
                    enrollment={fakeEnrollment}
                    course={selectedCourse || {
                      title: "Botox Fundamentals",
                      category: "botox",
                      level: "beginner",
                      duration_hours: 8,
                      location: "Austin, TX",
                      instructor_name: "Dr. Sarah Chen",
                      certifications_awarded: [{ cert_name: "Botox Certification" }],
                    }}
                    session={fakeSession}
                    certs={fakeCerts}
                    activeSubServiceIds={new Set()}
                    onViewMaterials={() => {}}
                    onCancel={() => {}}
                  />
                </div>
              ) : (
                <div className="max-w-xl mx-auto">
                  <ClassDayOnboardingWizard
                    enrollment={fakeEnrollment}
                    course={selectedCourse || { title: "Botox Fundamentals" }}
                    open={wizardOpen}
                    onClose={() => setWizardOpen(false)}
                  />
                  {!wizardOpen && (
                    <div className="text-center py-10">
                      <p className="text-sm font-medium" style={{ color: "rgba(30,37,53,0.5)" }}>Wizard is closed — click "Open Wizard" to preview it</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}