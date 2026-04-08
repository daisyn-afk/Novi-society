import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Video, Link as LinkIcon, BookOpen, CheckCircle, ExternalLink } from "lucide-react";

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
  const [viewed, setViewed] = useState(new Set());
  const materials = course?.pre_course_materials || [];

  if (!materials.length) return null;

  const requiredCount = materials.filter(m => m.required !== false).length;
  const viewedRequired = materials.filter((m, i) => m.required !== false && viewed.has(i)).length;
  const allRequiredViewed = viewedRequired >= requiredCount;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pre-Course Materials</DialogTitle>
          <p className="text-sm text-slate-500 mt-1">{course?.title}</p>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            <span>Review all required materials before your class</span>
            <span className="font-semibold">{viewedRequired}/{requiredCount} completed</span>
          </div>

          {materials.map((m, i) => {
            const Icon = TYPE_ICONS[m.type] || BookOpen;
            const colorClass = TYPE_COLORS[m.type] || "bg-slate-50 text-slate-600";
            const isViewed = viewed.has(i);
            return (
              <div key={i} className={`rounded-xl border p-4 transition-colors ${isViewed ? "border-green-200 bg-green-50/30" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm">{m.title}</p>
                      {m.required !== false && (
                        <Badge className="text-xs bg-orange-100 text-orange-700">Required</Badge>
                      )}
                      {isViewed && <CheckCircle className="w-4 h-4 text-green-500" />}
                    </div>
                    {m.content && m.type === "text" && (
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed">{m.content}</p>
                    )}
                    {m.url && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                        style={{ color: "#FA6F30" }}
                        onClick={() => setViewed(v => new Set([...v, i]))}
                      >
                        Open {m.type === "pdf" ? "PDF" : m.type === "video" ? "Video" : "Link"}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {m.type === "text" && !isViewed && (
                      <button
                        className="mt-2 text-sm font-medium"
                        style={{ color: "#FA6F30" }}
                        onClick={() => setViewed(v => new Set([...v, i]))}
                      >
                        Mark as Read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <Button
            className="w-full mt-2"
            style={{ background: allRequiredViewed ? "#FA6F30" : "#94a3b8", color: "#fff" }}
            onClick={onClose}
            disabled={!allRequiredViewed}
          >
            {allRequiredViewed ? "Continue to Enrollment" : `Review ${requiredCount - viewedRequired} more required material(s)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}