import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { gfeSimulateApi } from "@/api/gfeSimulateApi";
import { createPageUrl } from "@/utils";
import { broadcastAppointmentsRefresh } from "@/lib/appointmentSync";
import { CheckCircle2, FlaskConical, XCircle } from "lucide-react";

export default function GfeSimulate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = String(searchParams.get("appointment_id") || "").trim();
  const token = String(searchParams.get("token") || "").trim();
  const [notice, setNotice] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["gfe-simulate-context", appointmentId, token],
    enabled: Boolean(appointmentId && token),
    queryFn: () => gfeSimulateApi.getContext({ appointmentId, token }),
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: (outcome) => gfeSimulateApi.submitOutcome({ appointmentId, token, outcome }),
    onSuccess: (result) => {
      broadcastAppointmentsRefresh();
      const redirectPath = String(result?.redirect_path || "").trim();
      if (redirectPath) {
        navigate(redirectPath, { replace: true });
        return;
      }
      navigate(createPageUrl("PatientAppointments"), { replace: true });
    },
    onError: (err) => {
      setNotice({ type: "error", message: err?.message || "Simulation failed." });
    },
  });

  if (!appointmentId || !token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invalid GFE simulation link</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            This link is missing required parameters. Ask your provider to resend the Good Faith Exam.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <p className="text-sm text-slate-600">Loading exam simulation…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Unable to open simulation</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            {error?.message || "This simulation link is invalid or expired."}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data?.already_completed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Exam already completed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <p>
              This Good Faith Exam is already marked as <strong>{data.gfe_status}</strong>.
            </p>
            <Button
              type="button"
              onClick={() => navigate(createPageUrl("PatientAppointments"))}
            >
              Back to appointments
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-lg border-slate-200">
        <CardHeader className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 w-fit">
            <FlaskConical className="w-3.5 h-3.5" />
            GFE test simulation
          </div>
          <CardTitle className="text-xl">Good Faith Exam (simulated)</CardTitle>
          <p className="text-sm text-slate-600">
            This is a development test flow. Choose an outcome to simulate what Qualiphy would send to
            NOVI after the exam.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm space-y-1">
            <p>
              <span className="text-slate-500">Patient:</span> {data.patient_name}
            </p>
            <p>
              <span className="text-slate-500">Provider:</span> {data.provider_name}
            </p>
            <p>
              <span className="text-slate-500">Service:</span> {data.service_label}
            </p>
          </div>

          {notice?.type === "error" && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {notice.message}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              className="h-auto py-4 flex flex-col gap-2 bg-emerald-700 hover:bg-emerald-800"
              disabled={submitMutation.isPending}
              onClick={() => submitMutation.mutate("approved")}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Approve GFE</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2 border-red-200 text-red-700 hover:bg-red-50"
              disabled={submitMutation.isPending}
              onClick={() => submitMutation.mutate("deferred")}
            >
              <XCircle className="w-5 h-5" />
              <span>Reject / Defer</span>
            </Button>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Approving will trigger the same webhook handler used in production: appointment status,
            validity tracking, notifications, and treatment blocking will update immediately.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
