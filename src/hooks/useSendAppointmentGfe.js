import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

/**
 * Provider: create/resend Qualiphy GFE invite (email + patient in-app notification).
 */
export function useSendAppointmentGfe({ onLocalUpdate } = {}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [gfeSending, setGfeSending] = useState({});
  const [gfeFeedback, setGfeFeedback] = useState({ id: null, type: null, message: "" });

  const sendGFE = async (appt) => {
    if (!appt?.id) return;
    setGfeFeedback({ id: appt.id, type: null, message: "" });
    setGfeSending((s) => ({ ...s, [appt.id]: true }));
    try {
      const res = await base44.functions.invoke("sendQualiphyGFE", { appointment_id: appt.id });
      const data = res?.data || {};
      if (data.success) {
        const meetingUrl = String(data.meeting_url || "").trim();
        onLocalUpdate?.(appt.id, {
          gfe_status: "pending",
          gfe_meeting_url: meetingUrl,
          gfe_exam_url: meetingUrl,
          gfe_sent_at: new Date().toISOString(),
        });
        const emailed = data.email_sent !== false;
        setGfeFeedback({
          id: appt.id,
          type: "success",
          message: emailed
            ? "GFE invite sent. Patient can take the exam from Appointments."
            : "GFE link created. Notification could not be delivered — try Resend GFE.",
        });
        void qc.invalidateQueries({ queryKey: ["my-appointments"] });
        void qc.invalidateQueries({ queryKey: ["treatment-records"] });
        void qc.invalidateQueries({ queryKey: ["my-notifications"] });
        toast({
          title: "GFE invite sent",
          description: emailed
            ? "Patient can take the exam from Appointments."
            : "GFE link saved; check notification settings.",
          duration: 6000,
        });
      } else {
        const errMsg = data.error || "Unexpected response from server.";
        setGfeFeedback({ id: appt.id, type: "error", message: errMsg });
        toast({ title: "GFE not sent", description: errMsg, variant: "destructive", duration: 8000 });
      }
    } catch (err) {
      const rawMsg = (err?.message || "Could not send GFE invite.").replace(/^\[lovable-provider\]\s*\d+\s+/, "");
      const msg = /failed to fetch|fetch failed/i.test(rawMsg)
        ? "Could not reach the GFE service right now. Please try again in a minute."
        : rawMsg;
      setGfeFeedback({ id: appt.id, type: "error", message: msg });
      toast({ title: "GFE failed", description: msg, variant: "destructive", duration: 10000 });
    } finally {
      setGfeSending((s) => ({ ...s, [appt.id]: false }));
    }
  };

  return { sendGFE, gfeSending, gfeFeedback, setGfeFeedback };
}
