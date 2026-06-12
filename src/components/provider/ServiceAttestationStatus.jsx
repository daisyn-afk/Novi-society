import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, AlertTriangle, BookOpen, Upload } from "lucide-react";

function statusMeta(evaluation) {
  if (evaluation.complete) {
    return { icon: CheckCircle, color: "#4a6b10", bg: "rgba(200,230,60,0.12)", label: "Ready to practice" };
  }
  if (evaluation.pending) {
    return { icon: Clock, color: "#7B8EC8", bg: "rgba(123,142,200,0.12)", label: "Pending review" };
  }
  return { icon: AlertTriangle, color: "#FA6F30", bg: "rgba(250,111,48,0.1)", label: "Action required" };
}

export default function ServiceAttestationStatus({ evaluation, compact = false, onSubmitCert = null }) {
  if (!evaluation) return null;
  const meta = statusMeta(evaluation);
  const Icon = meta.icon;

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: meta.bg, color: meta.color }}
      >
        <Icon className="w-3 h-3" />
        {meta.label}
      </span>
    );
  }

  return (
    <div className="rounded-xl px-3 py-2.5 space-y-2" style={{ background: meta.bg, border: `1px solid ${meta.color}22` }}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: meta.color }} />
        <p className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</p>
      </div>
      {!evaluation.complete && evaluation.nextSteps?.length > 0 && (
        <div className="space-y-1.5">
          {evaluation.nextSteps.map((step, idx) => (
            <p key={idx} className="text-xs" style={{ color: "rgba(30,37,53,0.65)" }}>
              {step.description || step.label}
            </p>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            {evaluation.nextSteps.some((s) => s.action === "complete_novi_course") && (
              <Link to={createPageUrl("ProviderEnrollments")}>
                <Button size="sm" className="h-7 text-xs gap-1" style={{ background: "#2d3d66", color: "#fff" }}>
                  <BookOpen className="w-3 h-3" /> Browse Courses
                </Button>
              </Link>
            )}
            {evaluation.nextSteps.some((s) =>
              s.action === "submit_external_cert" || s.action === "upload_additional_cert"
            ) && (
              onSubmitCert ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => onSubmitCert(evaluation)}
                >
                  <Upload className="w-3 h-3" /> Submit Certificate
                </Button>
              ) : (
                <Link to={createPageUrl("ProviderCredentialsCoverage")}>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Upload className="w-3 h-3" /> Go to Credentials
                  </Button>
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
