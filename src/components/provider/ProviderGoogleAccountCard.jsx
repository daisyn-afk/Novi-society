import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle, Link2, Mail, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  disconnectGoogleCalendar,
  fetchGoogleCalendarConnectUrl,
  fetchGoogleCalendarStatus,
} from "@/lib/googleCalendarApi";
import {
  fetchGmailConnectUrl,
  fetchGmailStatus,
} from "@/lib/gmailApi";

/**
 * Single source of truth for the provider's Google connection in the Profile.
 *
 * Q12 — there is exactly one Disconnect button. It revokes the whole Google
 * grant at Google and clears the local row, regardless of which features
 * (Calendar, Gmail, or both) are currently in use.
 */
export default function ProviderGoogleAccountCard({ providerEmail = "" }) {
  const qc = useQueryClient();

  const calendarStatusQuery = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: fetchGoogleCalendarStatus,
    staleTime: 30_000,
  });

  const gmailStatusQuery = useQuery({
    queryKey: ["gmail-status"],
    queryFn: fetchGmailStatus,
    staleTime: 30_000,
  });

  const calendarStatus = calendarStatusQuery.data;
  const gmailStatus = gmailStatusQuery.data;

  const configured =
    calendarStatus?.configured !== false && gmailStatus?.configured !== false;
  const calendarConnected = Boolean(calendarStatus?.connected);
  const gmailConnected = Boolean(gmailStatus?.gmail_connected);
  const googleConnected = calendarConnected || gmailConnected;
  const googleEmail =
    calendarStatus?.google_email || gmailStatus?.google_email || "";

  const connectCalendar = useMutation({
    mutationFn: fetchGoogleCalendarConnectUrl,
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
  });

  const connectGmail = useMutation({
    mutationFn: fetchGmailConnectUrl,
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
  });

  const disconnect = useMutation({
    mutationFn: disconnectGoogleCalendar,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-calendar-status"] });
      qc.invalidateQueries({ queryKey: ["gmail-status"] });
    },
  });

  const isLoading = calendarStatusQuery.isLoading || gmailStatusQuery.isLoading;

  return (
    <Card
      style={{
        background: "rgba(255,255,255,0.88)",
        border: "1px solid rgba(123,142,200,0.2)",
        backdropFilter: "blur(14px)",
        boxShadow: "0 2px 16px rgba(30,37,53,0.07)",
      }}
    >
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(123,142,200,0.12)" }}
          >
            <Calendar className="w-5 h-5" style={{ color: "#7B8EC8" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900">Google account</p>
            <p className="text-sm mt-1 text-slate-600 leading-relaxed">
              Connect Google to schedule Meet calls with reps and message them
              from your own Gmail
              {providerEmail ? ` (${providerEmail})` : ""}.
            </p>
          </div>
        </div>

        {!configured ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Google OAuth is not configured on this environment yet.
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-xs text-slate-500">Checking connection…</p>
        ) : googleConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Connected as {googleEmail || providerEmail}
            </div>

            <div className="flex flex-wrap gap-2">
              <FeaturePill
                icon={Calendar}
                label="Calendar"
                granted={calendarConnected}
              />
              <FeaturePill icon={Mail} label="Gmail" granted={gmailConnected} />
            </div>

            <div className="flex flex-wrap gap-2">
              {!gmailConnected ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!configured || connectGmail.isPending}
                  onClick={() => connectGmail.mutate()}
                >
                  <Mail className="w-3.5 h-3.5" />
                  {connectGmail.isPending ? "Redirecting…" : "Add Gmail messaging"}
                </Button>
              ) : null}
              {!calendarConnected ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!configured || connectCalendar.isPending}
                  onClick={() => connectCalendar.mutate()}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {connectCalendar.isPending ? "Redirecting…" : "Add Calendar"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 ml-auto"
                disabled={disconnect.isPending}
                onClick={() => disconnect.mutate()}
              >
                <Unlink className="w-3.5 h-3.5" />
                {disconnect.isPending ? "Disconnecting…" : "Disconnect Google"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              Your NOVI email must be a Google account. Sign in with that exact
              address when connecting.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="gap-1.5 font-semibold"
                style={{ background: "#7B8EC8", color: "#fff" }}
                disabled={!configured || connectCalendar.isPending}
                onClick={() => connectCalendar.mutate()}
              >
                <Link2 className="w-4 h-4" />
                {connectCalendar.isPending
                  ? "Redirecting…"
                  : "Connect Google (Calendar)"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 font-semibold"
                disabled={!configured || connectGmail.isPending}
                onClick={() => connectGmail.mutate()}
              >
                <Mail className="w-4 h-4" />
                {connectGmail.isPending ? "Redirecting…" : "Connect Gmail"}
              </Button>
            </div>
            {connectCalendar.isError ? (
              <p className="text-xs text-red-600">
                {connectCalendar.error?.message || "Could not start Google connect."}
              </p>
            ) : null}
            {connectGmail.isError ? (
              <p className="text-xs text-red-600">
                {connectGmail.error?.message || "Could not start Gmail connect."}
              </p>
            ) : null}
          </div>
        )}

        {disconnect.isError ? (
          <p className="text-xs text-red-600">
            {disconnect.error?.message || "Could not disconnect."}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FeaturePill({ icon: Icon, label, granted }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={
        granted
          ? {
              background: "rgba(74,107,16,0.12)",
              color: "#4a6b10",
              border: "1px solid rgba(74,107,16,0.22)",
            }
          : {
              background: "rgba(30,37,53,0.05)",
              color: "rgba(30,37,53,0.55)",
              border: "1px solid rgba(30,37,53,0.12)",
            }
      }
    >
      <Icon className="w-3 h-3" />
      {label} {granted ? "✓" : "—"}
    </span>
  );
}
