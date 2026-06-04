import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Video, Link as LinkIcon, BookOpen, ExternalLink } from "lucide-react";
import { normalizePreCourseMaterials } from "@/lib/preCourseMaterials";

const TYPE_ICONS = {
  pdf: FileText,
  video: Video,
  link: LinkIcon,
  text: BookOpen,
};

const TYPE_COLORS = {
  pdf: "bg-red-50 text-red-600",
  video: "bg-blue-50 text-blue-600",
  link: "bg-purple-50 text-purple-600",
  text: "bg-green-50 text-green-600",
};

export default function PreCourseMaterials({ course, open, onClose }) {
  const materials = normalizePreCourseMaterials(course?.pre_course_materials);

  if (!materials.length) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pre-Course Materials</DialogTitle>
          <p className="text-sm text-slate-500 mt-1">{course?.title}</p>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {materials.map((m, i) => {
            const Icon = TYPE_ICONS[m.type] || BookOpen;
            const colorClass = TYPE_COLORS[m.type] || "bg-slate-50 text-slate-600";
            const href = m.url?.trim() || null;
            return (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{m.title || "Study material"}</p>
                    {m.content && m.type === "text" && (
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    )}
                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                        style={{ color: "#FA6F30" }}
                      >
                        Open {m.type === "pdf" ? "PDF" : m.type === "video" ? "Video" : "Link"}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            className="w-full mt-2"
            style={{ background: "#FA6F30", color: "#fff" }}
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
