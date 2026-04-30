import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { MapPin, CheckSquare, Square, ChevronDown, ChevronUp, Users, Clock, Package, AlertCircle } from "lucide-react";
import { trainerPrepApi } from "@/api/trainerPrepApi";

export default function TrainerPrepView({ scheduledCourses = [], enrollments = [] }) {
  const [expanded, setExpanded] = useState(null);
  const queryClient = useQueryClient();

  const now = new Date();
  const upcomingCourses = scheduledCourses
    .filter(c => {
      const dates = (c.session_dates || []).filter(d => {
        try {
          const parsed = parseISO(d.date);
          return parsed >= now;
        } catch {
          return false;
        }
      });
      return dates.length > 0;
    })
    .sort((a, b) => {
      const aDate = (a.session_dates || []).map(d => d.date).sort()[0] || "";
      const bDate = (b.session_dates || []).map(d => d.date).sort()[0] || "";
      return aDate > bDate ? 1 : -1;
    });

  const courseIds = useMemo(() => upcomingCourses.map((c) => c.id), [upcomingCourses]);
  const { data: checklistRows = [] } = useQuery({
    queryKey: ["trainer-prep-checklist", courseIds],
    queryFn: () => trainerPrepApi.getCourseChecklist(courseIds),
    enabled: courseIds.length > 0
  });
  const checklistByCourse = useMemo(
    () => new Map(checklistRows.map((row) => [row.course_id, row])),
    [checklistRows]
  );

  const enrollCountFor = (id) => enrollments.filter(e => e.course_id === id && !["cancelled", "no_show"].includes(e.status)).length;
  const toggleCheckMutation = useMutation({
    mutationFn: ({ courseId, itemId, isChecked }) =>
      trainerPrepApi.setProgress({
        scheduled_course_id: courseId,
        supply_item_id: itemId,
        is_checked: isChecked
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainer-prep-checklist"] });
    }
  });
  const resetMutation = useMutation({
    mutationFn: (courseId) => trainerPrepApi.resetProgress(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainer-prep-checklist"] });
    }
  });

  const nextSessionDate = (course) => {
    const sorted = (course.session_dates || []).filter(d => { try { return parseISO(d.date) >= now; } catch { return false; } }).sort((a, b) => a.date > b.date ? 1 : -1);
    return sorted[0] || null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-1" style={{ background: "rgba(218,106,99,0.07)", border: "1px solid rgba(218,106,99,0.2)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#DA6A63" }} />
          <p className="text-sm" style={{ color: "#DA6A63" }}>
            <strong>Trainer Prep Checklist</strong> — Review location, enrolled count, and confirm all supplies before each training session.
          </p>
        </div>
      </div>

      {upcomingCourses.length === 0 ? (
        <div className="rounded-3xl py-16 text-center" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
          <Package className="w-10 h-10 mx-auto mb-3" style={{ color: "#d0d5e0" }} />
          <p className="font-semibold mb-1" style={{ color: "#1a2540" }}>No upcoming scheduled courses</p>
          <p className="text-sm" style={{ color: "#b0b8cc" }}>Schedule a course first to see trainer prep checklists.</p>
        </div>
      ) : (
        upcomingCourses.map(course => {
          const courseChecklist = checklistByCourse.get(course.id);
          const supplies = courseChecklist?.items || [];
          const isOpen = expanded === course.id;
          const enrollCount = enrollCountFor(course.id);
          const done = supplies.filter((s) => s.is_checked).length;
          const total = supplies.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const isComplete = total > 0 && done === total;
          const next = nextSessionDate(course);

          return (
            <div key={course.id} className="rounded-3xl overflow-hidden" style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 2px 12px rgba(30,37,53,0.07)" }}>
              <button className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-black/5 transition-colors" onClick={() => setExpanded(isOpen ? null : course.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-bold text-sm" style={{ color: "#1a2540" }}>{course.title}</p>
                    {next && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(218,106,99,0.1)", color: "#DA6A63" }}>
                        Next: {format(parseISO(next.date), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs flex-wrap" style={{ color: "#8891a8" }}>
                    {next?.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{next.location}</span>}
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{enrollCount} enrolled</span>
                    {course.instructor_name && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Trainer: {course.instructor_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold" style={{ color: isComplete ? "#22c55e" : "#DA6A63" }}>{done}/{total}</div>
                    <div className="text-xs" style={{ color: "#b0b8cc" }}>items</div>
                  </div>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: isComplete ? "rgba(34,197,94,0.12)" : "rgba(218,106,99,0.1)", color: isComplete ? "#22c55e" : "#DA6A63", border: `2px solid ${isComplete ? "#22c55e" : "#DA6A63"}` }}>
                    {pct}%
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4" style={{ color: "#b0b8cc" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "#b0b8cc" }} />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                  {/* Session Schedule */}
                  <div className="px-5 py-4 space-y-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#8891a8" }}>Session Schedule & Locations</h4>
                    <div className="space-y-2">
                      {(course.session_dates || []).map((sd, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: "rgba(74,95,160,0.05)", border: "1px solid rgba(74,95,160,0.1)" }}>
                          <div className="text-center w-12">
                            <div className="text-xs font-bold" style={{ color: "#DA6A63" }}>{sd.date ? format(parseISO(sd.date), "MMM").toUpperCase() : ""}</div>
                            <div className="text-xl font-black" style={{ color: "#1a2540", lineHeight: 1 }}>{sd.date ? format(parseISO(sd.date), "d") : "—"}</div>
                          </div>
                          <div className="flex-1">
                            {sd.label && <p className="text-xs font-bold mb-0.5" style={{ color: "#4a5fa0" }}>{sd.label}</p>}
                            <div className="flex gap-3 text-xs flex-wrap" style={{ color: "#8891a8" }}>
                              {(sd.start_time || sd.end_time) && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{sd.start_time}{sd.end_time ? `–${sd.end_time}` : ""}</span>}
                              {(sd.location || course.location) && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{sd.location || course.location}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Enrolled Providers */}
                  <div className="px-5 py-4 space-y-2" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#8891a8" }}>Enrolled Providers ({enrollCount})</h4>
                    {enrollCount === 0 && <p className="text-xs" style={{ color: "#b0b8cc" }}>No confirmed enrollments yet.</p>}
                  </div>

                  {/* Supplies Checklist */}
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#8891a8" }}>Supplies Checklist</h4>
                      {done > 0 && (
                        <button className="text-xs" style={{ color: "#b0b8cc" }} onClick={() => resetMutation.mutate(course.id)}>Reset</button>
                      )}
                    </div>
                    <div className="w-full rounded-full h-1.5 mb-4" style={{ background: "rgba(0,0,0,0.07)" }}>
                      <div className="h-1.5 rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: isComplete ? "#22c55e" : "linear-gradient(90deg, #DA6A63, #FA6F30)" }} />
                    </div>

                    {/* Legend */}
                    <div className="flex gap-3 mb-3">
                      <span className="flex items-center gap-1 text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#C8E63C" }} /> Every Course
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#7B8EC8" }} /> One-Time Purchase
                      </span>
                    </div>

                    {supplies.length === 0 ? (
                      <p className="text-xs" style={{ color: "#b0b8cc" }}>
                        No supply list linked to this course template.
                      </p>
                    ) : (
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {supplies.map((item) => {
                        const checked = item.is_checked || false;
                        const isOneTime = item.purchase_type === "one_time";
                        return (
                          <button key={item.id} onClick={() => toggleCheckMutation.mutate({ courseId: course.id, itemId: item.id, isChecked: !checked })}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-black/5"
                            style={{ background: checked ? "rgba(34,197,94,0.06)" : "rgba(0,0,0,0.02)", border: `1px solid ${checked ? "rgba(34,197,94,0.2)" : "rgba(0,0,0,0.05)"}` }}>
                            {checked
                              ? <CheckSquare className="w-4 h-4 flex-shrink-0" style={{ color: "#22c55e" }} />
                              : <Square className="w-4 h-4 flex-shrink-0" style={{ color: "#b0b8cc" }} />
                            }
                            <span className="flex-1 text-xs" style={{ color: checked ? "#22c55e" : "#4a5575", textDecoration: checked ? "line-through" : "none" }}>{item.item_name}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {item.qty != null && (
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.5)" }}>×{item.qty}</span>
                              )}
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isOneTime ? "#7B8EC8" : "#C8E63C" }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}