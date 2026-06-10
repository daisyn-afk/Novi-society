import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import {
  appointmentGfeDisplayStatus,
  appointmentGfeLink,
  appointmentGfeValidityLabel,
  patientAwaitingGfeInvite,
  patientCanTakeGfeExam,
} from "@/lib/appointmentGfe";
import { openQualiphyGfeExam } from "@/lib/openQualiphyGfe";

const GFE_DARK = "#14532d";

export default function AppointmentGfePatientBlock({ appointment }) {
  if (!appointment || appointment.requires_gfe !== true) return null;

  const gfeStatus = appointmentGfeDisplayStatus(appointment);
  const gfeLink = appointmentGfeLink(appointment);
  const canTake = patientCanTakeGfeExam(appointment);
  const awaitingInvite = patientAwaitingGfeInvite(appointment);
  const validUntil = appointmentGfeValidityLabel(appointment);

  return (
    <div className="mt-1 space-y-0.5">
      <p className="text-xs font-semibold" style={{ color: GFE_DARK }}>
        GFE exam
      </p>

      {awaitingInvite && (
        <p className="text-[11px] leading-snug" style={{ color: GFE_DARK }}>
          Link will be sent by provider
        </p>
      )}

      {canTake && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs gap-1 w-fit mt-0.5"
          style={{
            color: "#fff",
            background: GFE_DARK,
            borderColor: GFE_DARK,
          }}
          onClick={() => openQualiphyGfeExam(gfeLink)}
        >
          GFE link
          <ExternalLink className="w-3 h-3 opacity-80" />
        </Button>
      )}

      {gfeStatus === "approved" && !awaitingInvite && !canTake && (
        <p className="text-[11px] font-medium" style={{ color: GFE_DARK }}>
          {validUntil ? `Approved — valid until ${validUntil}` : "Approved — cleared for this visit"}
        </p>
      )}

      {appointment.gfe_expired && (
        <p className="text-[11px] font-medium" style={{ color: "#991b1b" }}>
          Your GFE has expired. Your provider will send a new exam link.
        </p>
      )}

      {gfeStatus === "deferred" && (
        <p className="text-[11px] font-medium" style={{ color: "#991b1b" }}>
          Needs follow-up — contact your provider
        </p>
      )}
    </div>
  );
}
