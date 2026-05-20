import { CheckCircle2, Clock, Mail } from "lucide-react";
import { PASSWORD_SETUP_STATUS } from "@/lib/passwordSetupStatus";

export function PasswordSetupStatusBadge({ status, showNotSent = false }) {
  if (status === PASSWORD_SETUP_STATUS.COMPLETED) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
        style={{ background: "rgba(200, 230, 60, 0.5)", color: "#2d5016", border: "1px solid rgba(175, 205, 50, 0.55)" }}
      >
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
        Password Created
      </span>
    );
  }
  if (status === PASSWORD_SETUP_STATUS.PENDING) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
        style={{ background: "rgba(123, 142, 200, 0.22)", color: "#5f73b3", border: "1px solid rgba(123, 142, 200, 0.4)" }}
      >
        <Clock className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
        Password Reset Pending
      </span>
    );
  }
  if (showNotSent) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
        style={{ background: "rgba(30,37,53,0.08)", color: "rgba(30,37,53,0.55)", border: "1px solid rgba(30,37,53,0.12)" }}
      >
        <Mail className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
        Reset Not Sent
      </span>
    );
  }
  return null;
}
