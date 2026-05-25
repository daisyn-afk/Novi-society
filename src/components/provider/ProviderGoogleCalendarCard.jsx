import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  disconnectGoogleCalendar,
  fetchGoogleCalendarConnectUrl,
  fetchGoogleCalendarStatus,
} from "@/lib/googleCalendarApi";

export default function ProviderGoogleCalendarCard({ providerEmail = "" }) {
  const qc = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: fetchGoogleCalendarStatus,
  });

  const connectMutation = useMutation({
    mutationFn: fetchGoogleCalendarConnectUrl,
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectGoogleCalendar,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-calendar-status"] });
    },
  });

  const connected = Boolean(status?.connected);
  const configured = status?.configured !== false;

  return (
    <Card style={{ background: "rgba(255,255,255,0.88)", border: "1px solid rgba(123,142,200,0.2)", backdropFilter: "blur(14px)", boxShadow: "0 2px 16px rgba(30,37,53,0.07)" }}>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(123,142,200,0.12)" }}
          >
            <Calendar className="w-5 h-5" style={{ color: "#7B8EC8" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900">Google Calendar</p>
            <p className="text-sm mt-1 text-slate-600 leading-relaxed">
              Connect to schedule Google Meet calls with supplier reps. Invites are sent from your NOVI email
              {providerEmail ? ` (${providerEmail})` : ""}.
            </p>
          </div>
        </div>

        {!configured ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Google Calendar OAuth is not configured on this environment yet.
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-xs text-slate-500">Checking connection…</p>
        ) : connected ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Connected as {status?.google_email || providerEmail}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 sm:ml-auto"
              disabled={disconnectMutation.isPending}
              onClick={() => disconnectMutation.mutate()}
            >
              <Unlink className="w-3.5 h-3.5" />
              {disconnectMutation.isPending ? "Disconnecting…" : "Disconnect"}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              Your NOVI email must be a Google account. Sign in with that exact address when connecting.
            </p>
            <Button
              type="button"
              className="gap-1.5 font-semibold"
              style={{ background: "#7B8EC8", color: "#fff" }}
              disabled={!configured || connectMutation.isPending}
              onClick={() => connectMutation.mutate()}
            >
              <Link2 className="w-4 h-4" />
              {connectMutation.isPending ? "Redirecting…" : "Connect Google Calendar"}
            </Button>
            {connectMutation.isError ? (
              <p className="text-xs text-red-600">{connectMutation.error?.message || "Could not start Google connect."}</p>
            ) : null}
          </div>
        )}

        {disconnectMutation.isError ? (
          <p className="text-xs text-red-600">{disconnectMutation.error?.message || "Could not disconnect."}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
