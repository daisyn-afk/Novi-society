import { Button } from "@/components/ui/button";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { appointmentGfeDisplayStatus, appointmentGfeLink } from "@/lib/appointmentGfe";
import { openQualiphyGfeExam } from "@/lib/openQualiphyGfe";

/** Compact inline GFE actions for provider appointment views. */
export default function AppointmentGfeProviderControls({
  appointment,
  gfeSending = false,
  onSendGFE,
  showSend = true,
  className = "",
}) {
  if (!appointment || appointment.requires_gfe !== true) return null;

  const gfeStatus = appointmentGfeDisplayStatus(appointment);
  const gfeLink = appointmentGfeLink(appointment);
  const skipSend = appointment.gfe_skip_send === true || appointment.gfe_prerequisite_satisfied === true;
  const canSend =
    showSend &&
    !skipSend &&
    ["requested", "awaiting_payment", "confirmed", "awaiting_consent"].includes(
      String(appointment.status || "")
    );
  const canOpenLink = Boolean(gfeLink) && gfeStatus !== "approved" && !skipSend;

  if (!canSend && !canOpenLink) return null;

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 ${className}`.trim()}>
      {canSend && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs gap-1"
          style={{ color: "#7B8EC8", borderColor: "rgba(123,142,200,0.35)" }}
          onClick={() => onSendGFE?.(appointment)}
          disabled={gfeSending || gfeStatus === "approved"}
        >
          <ShieldCheck className="w-3 h-3" />
          {gfeSending ? "Sending…" : gfeStatus === "pending" ? "Resend GFE" : "Send GFE"}
        </Button>
      )}
      {canOpenLink && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => openQualiphyGfeExam(gfeLink)}
        >
          <ExternalLink className="w-3 h-3" />
          Open link
        </Button>
      )}
    </div>
  );
}
