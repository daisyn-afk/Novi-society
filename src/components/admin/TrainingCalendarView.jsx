import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, MapPin, Users, Clock } from "lucide-react";

export default function TrainingCalendarView({ scheduledCourses = [], enrollments = [] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  // Collect all training events from session_dates across all scheduled courses
  const allEvents = [];
  scheduledCourses.forEach(course => {
    (course.session_dates || []).forEach(sd => {
      if (sd.date) {
        allEvents.push({ ...sd, courseId: course.id, courseTitle: course.title, location: sd.location || course.location, instructor: course.instructor_name });
      }
    });
  });

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDow = startOfMonth(currentMonth).getDay(); // 0=Sun

  const eventsOnDay = (day) => allEvents.filter(e => {
    try { return isSameDay(parseISO(e.date), day); } catch { return false; }
  });

  const selectedEvents = selectedDay ? eventsOnDay(selectedDay) : [];
  const enrollCountFor = (id) => enrollments.filter(e => e.course_id === id).length;

  return (
    <div className="space-y-5">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg" style={{ color: "#1a2540", fontFamily: "'DM Serif Display', serif" }}>
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="flex gap-1">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
            <ChevronLeft className="w-4 h-4" style={{ color: "#8891a8" }} />
          </button>
          <button onClick={() => setCurrentMonth(new Date())} className="px-3 py-1.5 text-xs font-semibold rounded-xl hover:bg-black/5 transition-colors" style={{ color: "#8891a8" }}>Today</button>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
            <ChevronRight className="w-4 h-4" style={{ color: "#8891a8" }} />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-3xl overflow-hidden" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 4px 24px rgba(30,37,53,0.08)" }}>
        {/* DOW headers */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} className="py-2.5 text-center text-xs font-bold uppercase tracking-wider" style={{ color: "#b0b8cc" }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {/* Leading empty cells */}
          {Array.from({ length: startDow }).map((_, i) => (
            <div key={`empty-${i}`} className="h-20 border-b border-r" style={{ borderColor: "rgba(0,0,0,0.04)", background: "rgba(0,0,0,0.01)" }} />
          ))}
          {days.map((day, idx) => {
            const events = eventsOnDay(day);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            return (
              <div key={day.toISOString()} onClick={() => setSelectedDay(isSelected ? null : day)}
                className="h-20 p-1.5 border-b border-r cursor-pointer transition-all hover:bg-black/5"
                style={{ borderColor: "rgba(0,0,0,0.04)", background: isSelected ? "rgba(218,106,99,0.06)" : "transparent" }}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${isToday ? "text-white" : ""}`}
                  style={{ background: isToday ? "#DA6A63" : "transparent", color: isToday ? "#fff" : "#1a2540" }}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {events.slice(0, 2).map((e, i) => (
                    <div key={i} className="text-xs px-1.5 py-0.5 rounded font-medium truncate" style={{ background: "rgba(74,95,160,0.12)", color: "#4a5fa0", fontSize: 10 }}>
                      {e.courseTitle}
                    </div>
                  ))}
                  {events.length > 2 && <div className="text-xs" style={{ color: "#DA6A63", fontSize: 10 }}>+{events.length - 2} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="rounded-3xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.7)" }}>
          <h3 className="font-bold text-sm" style={{ color: "#1a2540" }}>{format(selectedDay, "EEEE, MMMM d, yyyy")}</h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm" style={{ color: "#b0b8cc" }}>No training sessions on this day.</p>
          ) : selectedEvents.map((e, i) => (
            <div key={i} className="rounded-2xl p-4" style={{ background: "rgba(74,95,160,0.06)", border: "1px solid rgba(74,95,160,0.12)" }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-semibold text-sm" style={{ color: "#1a2540" }}>{e.courseTitle}</p>
                {e.label && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(200,230,60,0.18)", color: "#5a7a20" }}>{e.label}</span>}
              </div>
              <div className="flex flex-wrap gap-3 text-xs" style={{ color: "#8891a8" }}>
                {(e.start_time || e.end_time) && (
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{e.start_time}{e.end_time ? `–${e.end_time}` : ""}</span>
                )}
                {e.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{e.location}</span>}
                {e.instructor && <span className="flex items-center gap-1"><Users className="w-3 h-3" />Trainer: {e.instructor}</span>}
              </div>
              <div className="mt-2 text-xs font-semibold" style={{ color: "#4a5fa0" }}>
                {enrollCountFor(e.courseId)} enrolled
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming list */}
      <div>
        <h3 className="font-bold text-sm mb-3" style={{ color: "#8891a8", textTransform: "uppercase", letterSpacing: "0.08em" }}>All Upcoming Sessions</h3>
        <div className="space-y-2">
          {allEvents
            .filter(e => { try { return parseISO(e.date) >= new Date(); } catch { return false; } })
            .sort((a, b) => a.date > b.date ? 1 : -1)
            .slice(0, 10)
            .map((e, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.7)" }}>
                <div className="text-center w-10 flex-shrink-0">
                  <div className="text-xs font-bold" style={{ color: "#DA6A63" }}>{format(parseISO(e.date), "MMM").toUpperCase()}</div>
                  <div className="text-xl font-black" style={{ color: "#1a2540", lineHeight: 1 }}>{format(parseISO(e.date), "d")}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: "#1a2540" }}>{e.courseTitle}</p>
                  <div className="flex gap-3 text-xs mt-0.5" style={{ color: "#8891a8" }}>
                    {e.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{e.location}</span>}
                    {(e.start_time || e.end_time) && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{e.start_time}{e.end_time ? `–${e.end_time}` : ""}</span>}
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0" style={{ background: "rgba(74,95,160,0.1)", color: "#4a5fa0" }}>
                  {enrollCountFor(e.courseId)} enrolled
                </span>
              </div>
            ))}
          {allEvents.filter(e => { try { return parseISO(e.date) >= new Date(); } catch { return false; } }).length === 0 && (
            <p className="text-sm text-center py-6" style={{ color: "#b0b8cc" }}>No upcoming sessions scheduled.</p>
          )}
        </div>
      </div>
    </div>
  );
}