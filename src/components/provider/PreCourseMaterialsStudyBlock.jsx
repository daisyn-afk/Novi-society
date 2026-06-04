import { BookOpen, FileText, Zap } from "lucide-react";
import { coursePreCourseMaterials } from "@/lib/preCourseMaterials";

/**
 * Inline pre-course study list (provider My Courses / pathway).
 */
export default function PreCourseMaterialsStudyBlock({ course, title = "Pre-Course Materials" }) {
  const materials = coursePreCourseMaterials(course);
  if (materials.length === 0) return null;

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "rgba(123,142,200,0.1)", border: "1px solid rgba(123,142,200,0.25)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4" style={{ color: "#7B8EC8" }} />
        <p className="text-sm font-bold" style={{ color: "#1e2535" }}>
          📚 {title}
        </p>
      </div>
      <div className="space-y-2.5">
        {materials.map((mat, idx) => {
          const href = mat.url?.trim() || null;
          const inner = (
            <>
              {mat.required !== false ? (
                <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#FA6F30" }} />
              ) : (
                <FileText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#7B8EC8" }} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: "#1e2535" }}>
                  {mat.title || "Study material"}
                </p>
                {mat.required !== false && (
                  <span className="text-xs font-bold" style={{ color: "#FA6F30", fontSize: "9px" }}>
                    Required
                  </span>
                )}
              </div>
            </>
          );
          const rowStyle = {
            background: "rgba(255,255,255,0.5)",
            border: "1px solid rgba(123,142,200,0.15)",
          };
          if (href) {
            return (
              <a
                key={idx}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2.5 p-2.5 rounded-lg transition-opacity hover:opacity-90"
                style={rowStyle}
              >
                {inner}
              </a>
            );
          }
          return (
            <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg" style={rowStyle}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
