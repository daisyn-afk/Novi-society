import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { fetchGoogleCalendarStatus } from "@/lib/googleCalendarApi";
import { createPageUrl } from "@/utils";
import { AlertCircle, Calendar, CheckCircle, Copy, ExternalLink, Settings } from "lucide-react";
import {
  CALL_DURATIONS,
  US_TIMEZONES,
  isValidEmailFormat,
  resolveTimezoneValue,
  todayDateInputValue,
} from "@/lib/repCallScheduling";

export default function ScheduleCallDialog({
  open,
  onClose,
  manufacturer,
  me,
  savedRep,
  onAddRepInfo,
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayDateInputValue());
  const [time, setTime] = useState("10:00");
  const [timezone, setTimezone] = useState(resolveTimezoneValue());
  const [duration, setDuration] = useState(30);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState(null);

  const mfrName = manufacturer?.name || "Supplier";
  const repEmail = savedRep?.rep_email?.trim() || "";
  const repName = savedRep?.rep_name?.trim() || "Your Rep";
  const repEmailValid = isValidEmailFormat(repEmail);
  const hasRepEmail = Boolean(repEmail);
  const providerEmail = me?.email || "";

  const { data: calendarStatus, isLoading: calendarLoading } = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: fetchGoogleCalendarStatus,
    enabled: open,
  });
  const calendarConnected = Boolean(calendarStatus?.connected);

  const resetForm = () => {
    setDate(todayDateInputValue());
    setTime("10:00");
    setTimezone(resolveTimezoneValue());
    setDuration(30);
    setTopic("");
    setNotes("");
    setError("");
    setBooked(null);
  };

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      resetForm();
      onClose(false);
      return;
    }
    setTimezone(resolveTimezoneValue());
  };

  const handleBook = async () => {
    setError("");
    if (!hasRepEmail) {
      setError("Your rep email is not set.");
      return;
    }
    if (!repEmailValid) {
      setError("Rep email appears invalid. Please update your rep contact info.");
      return;
    }
    if (!date || !time) {
      setError("Please choose a date and time.");
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke("scheduleRepCall", {
        manufacturer_id: manufacturer?.id,
        scheduled_date: date,
        scheduled_time: time,
        timezone,
        duration_minutes: duration,
        topic: topic.trim(),
        notes: notes.trim(),
      });
      const call = res?.data?.call;
      const meetLink = res?.data?.meet_link || call?.meet_link || "";
      setBooked({ call, meetLink });
      qc.invalidateQueries({ queryKey: ["provider-rep-calls", manufacturer?.id] });
    } catch (err) {
      setError(err?.message || "Could not schedule the call. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyMeetLink = async () => {
    if (!booked?.meetLink) return;
    try {
      await navigator.clipboard.writeText(booked.meetLink);
    } catch {
      window.prompt("Copy Meet link:", booked.meetLink);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}>
            Schedule Call — {mfrName}
          </DialogTitle>
        </DialogHeader>

        {booked ? (
          <div className="space-y-4 py-2">
            <div className="text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(200,230,60,0.2)" }}
              >
                <CheckCircle className="w-6 h-6" style={{ color: "#4a6b10" }} />
              </div>
              <p className="font-semibold" style={{ color: "#1e2535" }}>Call scheduled</p>
              <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.55)" }}>
                A calendar invite was sent from your email to {repName}.
              </p>
            </div>

            {booked.meetLink ? (
              <div
                className="rounded-xl px-3 py-3 space-y-2"
                style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.15)" }}
              >
                <p className="text-xs font-semibold" style={{ color: "#1e2535" }}>Google Meet link</p>
                <p className="text-xs break-all" style={{ color: "rgba(30,37,53,0.65)" }}>{booked.meetLink}</p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copyMeetLink}>
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </Button>
                  <a href={booked.meetLink} target="_blank" rel="noreferrer">
                    <Button type="button" size="sm" className="gap-1.5" style={{ background: "#7B8EC8", color: "#fff" }}>
                      <ExternalLink className="w-3.5 h-3.5" /> Open Meet
                    </Button>
                  </a>
                </div>
              </div>
            ) : null}

            <Button className="w-full" onClick={() => { resetForm(); onClose(false); }} style={{ background: "#1e2535", color: "#fff" }}>
              Done
            </Button>
          </div>
        ) : !hasRepEmail ? (
          <div className="space-y-4 py-2">
            <div
              className="flex items-start gap-3 px-3 py-3 rounded-xl"
              style={{ background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.2)" }}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#FA6F30" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Rep email is not set</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>
                  Add your assigned rep&apos;s email before scheduling a Google Meet call.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onClose(false)}>Cancel</Button>
              <Button className="flex-1 font-semibold" style={{ background: "#FA6F30", color: "#fff" }} onClick={() => { onClose(false); onAddRepInfo?.(); }}>
                Add Rep Info
              </Button>
            </div>
          </div>
        ) : !repEmailValid ? (
          <div className="space-y-4 py-2">
            <div
              className="flex items-start gap-3 px-3 py-3 rounded-xl"
              style={{ background: "rgba(218,106,99,0.08)", border: "1px solid rgba(218,106,99,0.2)" }}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#DA6A63" }} />
              <p className="text-sm" style={{ color: "rgba(30,37,53,0.75)" }}>
                Rep email <strong>{repEmail}</strong> looks invalid. Please update your rep contact info.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onClose(false)}>Cancel</Button>
              <Button className="flex-1" style={{ background: "#1e2535", color: "#fff" }} onClick={() => { onClose(false); onAddRepInfo?.(); }}>
                Update Rep Info
              </Button>
            </div>
          </div>
        ) : calendarLoading ? (
          <div className="py-8 text-center text-sm" style={{ color: "rgba(30,37,53,0.55)" }}>
            Checking Google Calendar connection…
          </div>
        ) : !calendarConnected ? (
          <div className="space-y-4 py-2">
            <div
              className="flex items-start gap-3 px-3 py-3 rounded-xl"
              style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.15)" }}
            >
              <Settings className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#7B8EC8" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Connect Google Calendar first</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>
                  Connect Google Calendar in your Profile before scheduling a call.
                  {providerEmail ? (
                    <> Use the Google account that matches your NOVI email (<strong>{providerEmail}</strong>).</>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onClose(false)}>Cancel</Button>
              <Button className="flex-1 font-semibold gap-1.5" style={{ background: "#7B8EC8", color: "#fff" }} asChild>
                <Link to={createPageUrl("ProviderProfile")} onClick={() => onClose(false)}>
                  <Settings className="w-3.5 h-3.5" /> Go to Profile
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.08)" }}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: "#7B8EC8" }} />
              <span style={{ color: "rgba(30,37,53,0.65)" }}>
                With <strong style={{ color: "#1e2535" }}>{repName}</strong> · {repEmail}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Date</label>
                <Input type="date" value={date} min={todayDateInputValue()} onChange={(e) => setDate(e.target.value)} className="h-10" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Time</label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full h-10 px-3 rounded-md text-sm border"
                  style={{ borderColor: "rgba(30,37,53,0.12)" }}
                >
                  {US_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-md text-sm border"
                  style={{ borderColor: "rgba(30,37,53,0.12)" }}
                >
                  {CALL_DURATIONS.map((mins) => (
                    <option key={mins} value={mins}>{mins} min</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Topic</label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Q2 pricing & promos" className="h-10" />
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything else your rep should know"
                className="w-full px-3 py-2 rounded-md text-sm border resize-none"
                style={{ borderColor: "rgba(30,37,53,0.12)" }}
              />
            </div>

            {error ? <p className="text-xs text-red-600">{error}</p> : null}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => onClose(false)} disabled={loading}>Cancel</Button>
              <Button
                className="flex-1 font-bold gap-1.5"
                style={{ background: "#7B8EC8", color: "#fff" }}
                disabled={loading}
                onClick={handleBook}
              >
                {loading ? "Booking..." : "Book Google Meet"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
