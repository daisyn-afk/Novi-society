import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen, CheckCircle, AlertCircle, Loader, Shield } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProviderLockGate from "@/components/ProviderLockGate";
import { CLASS_TIME_ZONE, getSessionWindowForDate, isNowWithinSessionRedeemWindow } from "@/lib/classCodeWindow";

function toDateOnly(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}$/.test(raw)) return "";
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return raw.slice(0, 10);
}

function formatSessionDateLabel(value) {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return "Date TBD";
  const [y, m, d] = dateOnly.split("-").map(Number);
  if (!y || !m || !d) return dateOnly;
  return format(new Date(y, m - 1, d), "MMM d, yyyy");
}

export default function ProviderCodeRedemption() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [successDialog, setSuccessDialog] = useState(null);
  const [error, setError] = useState("");
  const [selectedCourseWindowKey, setSelectedCourseWindowKey] = useState("");
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";

  const { data: myEnrollments = [], isLoading: loadingEnrollments, isFetching: fetchingEnrollments } = useQuery({
    queryKey: ["my-enrollments-code-redemption"],
    queryFn: async () => {
      const me = await base44.auth.me();
      const [byProviderIdResult, byEmailResult, preOrdersResult] = await Promise.allSettled([
        me?.id ? base44.entities.Enrollment.filter({ provider_id: me.id }, "-created_date") : Promise.resolve([]),
        me?.email ? base44.entities.Enrollment.filter({ provider_email: me.email }, "-created_date") : Promise.resolve([]),
        base44.entities.PreOrder.list("-created_date", 500),
      ]);
      const byProviderId = byProviderIdResult.status === "fulfilled" ? (byProviderIdResult.value || []) : [];
      const byEmail = byEmailResult.status === "fulfilled" ? (byEmailResult.value || []) : [];
      const preOrders = preOrdersResult.status === "fulfilled" ? (preOrdersResult.value || []) : [];
      const email = String(me?.email || "").toLowerCase();
      const derivedFromPreOrders = preOrders
        .filter((p) => String(p?.order_type || "").toLowerCase() === "course")
        .filter((p) => ["paid", "confirmed", "completed"].includes(String(p?.status || "").toLowerCase()))
        .filter((p) => String(p?.customer_email || "").toLowerCase() === email)
        .map((p) => ({
          id: `preorder-${p.id}`,
          pre_order_id: p.id,
          course_id: p.course_id,
          provider_id: me?.id || null,
          provider_email: p.customer_email || me?.email || null,
          provider_name: p.customer_name || null,
          status: String(p?.status || "").toLowerCase() === "completed" ? "attended" : String(p?.status || "").toLowerCase(),
          session_date: p.course_date || p.session_date || null,
          amount_paid: p.amount_paid,
          created_date: p.created_date || p.created_at || null,
        }));
      const map = new Map();
      [...byProviderId, ...byEmail, ...derivedFromPreOrders].forEach((row) => {
        const dedupeKey = row?.pre_order_id || row?.id || `${row?.course_id || ""}:${row?.session_date || ""}`;
        if (dedupeKey) map.set(String(dedupeKey), row);
      });
      return Array.from(map.values());
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["my-sessions-code-redemption", myEnrollments.map((e) => `${e.id}:${e.course_id}:${e.session_date || ""}`).join("|")],
    queryFn: async () => {
      const me = await base44.auth.me();
      const allSessions = await base44.entities.ClassSession.list("-created_date");
      const enrollmentIds = new Set(myEnrollments.map((e) => String(e.id)));
      const classDateKeys = new Set(
        myEnrollments
          .filter((e) => e.course_id && e.session_date)
          .map((e) => `class_date:${e.course_id}:${String(e.session_date).slice(0, 10)}`)
      );
      const meId = String(me?.id || "");
      const meEmail = String(me?.email || "").toLowerCase();
      return (allSessions || []).filter((session) => {
        const providerId = String(session?.provider_id || "");
        const providerEmail = String(session?.provider_email || "").toLowerCase();
        const enrollmentId = String(session?.enrollment_id || "");
        const sessionCourseId = String(session?.course_id || "");
        if (providerId && providerId === meId) return true;
        if (providerEmail && providerEmail === meEmail) return true;
        if (enrollmentIds.has(enrollmentId)) return true;
        if (classDateKeys.has(enrollmentId)) return true;
        return false;
      });
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses-code-redemption"],
    queryFn: () => base44.entities.Course.list(),
  });

  const redeemMutation = useMutation({
    mutationFn: (payload) =>
      base44.functions.invoke("redeemClassCode", payload),
    onSuccess: (res) => {
      if (res.data.success) {
        setSuccessDialog(res.data);
        setCode("");
        queryClient.invalidateQueries({ queryKey: ["my-sessions-code-redemption"] });
        queryClient.invalidateQueries({ queryKey: ["my-enrollments-code-redemption"] });
        setError("");
      } else {
        setError(res.data.error || "Failed to redeem code");
      }
    },
    onError: (err) => {
      setError(err.message || "An error occurred");
    },
  });

  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));
  const redeemed = sessions.filter(s => s.code_used);
  const codeWindowEnrollments = Array.from(
    [...myEnrollments, ...sessions.map((session) => {
      const rawEnrollmentKey = String(session?.enrollment_id || "");
      const classDateParts = rawEnrollmentKey.startsWith("class_date:") ? rawEnrollmentKey.split(":") : [];
      const classDateCourseId = classDateParts.length >= 3 ? String(classDateParts[1] || "") : "";
      const classDateSessionDate = classDateParts.length >= 3 ? toDateOnly(classDateParts[2]) : "";
      return {
        id: session?.enrollment_id || `class-session:${session?.id || ""}`,
        course_id: session?.course_id || classDateCourseId || null,
        session_date: classDateSessionDate || toDateOnly(session?.session_date) || null,
        status: session?.code_used ? "attended" : "paid",
        course_title: session?.course_title || null,
      };
    })]
      .filter((enrollment) => enrollment?.course_id && enrollment?.session_date && ["paid", "confirmed", "attended"].includes(String(enrollment?.status || "").toLowerCase()))
      .reduce((acc, enrollment) => {
        const dateOnly = toDateOnly(enrollment.session_date);
        const key = `${enrollment.course_id}:${dateOnly}`;
        const normalized = { ...enrollment, session_date: dateOnly };
        const existing = acc.get(key);
        const existingStatus = String(existing?.status || "").toLowerCase();
        const incomingStatus = String(normalized?.status || "").toLowerCase();

        if (!existing) {
          acc.set(key, normalized);
          return acc;
        }

        // Prefer attended rows so UI consistently reflects redeemed sessions.
        if (existingStatus !== "attended" && incomingStatus === "attended") {
          acc.set(key, normalized);
        }
        return acc;
      }, new Map())
      .values()
  );
  const formatWindowDateTime = (dateValue) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dateValue);
  const redeemedSessionKeys = new Set(
    (sessions || [])
      .filter((session) => Boolean(session?.code_used))
      .map((session) => {
        const classDateParts = String(session?.enrollment_id || "").startsWith("class_date:")
          ? String(session.enrollment_id).split(":")
          : [];
        const sessionDate = toDateOnly(session?.session_date) || (classDateParts.length >= 3 ? toDateOnly(classDateParts[2]) : "");
        const sessionCourseId = String(session?.course_id || (classDateParts.length >= 3 ? classDateParts[1] : "") || "");
        if (!sessionCourseId || !sessionDate) return "";
        return `${sessionCourseId}:${sessionDate}`;
      })
      .filter(Boolean)
  );
  const enrollmentWindows = codeWindowEnrollments.map((enrollment) => {
    const course = courseMap[enrollment.course_id];
    const sessionDate = String(enrollment.session_date || "").slice(0, 10);
    const window = getSessionWindowForDate(course, sessionDate);
    const isOpen = window ? isNowWithinSessionRedeemWindow(course, sessionDate) : false;
    const key = `${enrollment.course_id}:${sessionDate}`;
    const isAttended = redeemedSessionKeys.has(key);
    return { key, enrollment, course, window, isOpen, isAttended };
  });
  const selectedWindow = enrollmentWindows.find((entry) => entry.key === selectedCourseWindowKey) || null;
  const canEnterCode = Boolean(selectedWindow && selectedWindow.isOpen && !selectedWindow.isAttended);
  const getLocalValidationError = (enteredCode) => {
    const normalizedCode = String(enteredCode || "").trim().toUpperCase();
    if (normalizedCode.length !== 6) return "Please enter the full 6-character class code.";
    if (!selectedWindow) return "Please select a course/session first.";
    if (selectedWindow.isAttended) return "Attendance is already marked for this session.";
    if (!selectedWindow.isOpen) return "Selected course window is currently closed.";

    const matchingSession = sessions.find((session) => String(session.session_code || "").toUpperCase() === normalizedCode);
    if (!matchingSession) return "That code is not assigned to your class session.";
    if (matchingSession.code_used) return "This class code has already been redeemed.";

    const selectedCourseId = String(selectedWindow.enrollment.course_id || "");
    const selectedDate = String(selectedWindow.enrollment.session_date || "").slice(0, 10);
    const sessionCourseId = String(matchingSession.course_id || "");
    const sessionDate = String(matchingSession.session_date || "").slice(0, 10);
    if (selectedCourseId && sessionCourseId && selectedCourseId !== sessionCourseId) {
      return "This code does not belong to the selected course.";
    }
    if (selectedDate && sessionDate && selectedDate !== sessionDate) {
      return "This code does not belong to the selected course date.";
    }

    const relatedEnrollment = myEnrollments.find((enrollment) => enrollment.id === matchingSession.enrollment_id);
    const matchingSessionDate = matchingSession.session_date || relatedEnrollment?.session_date;
    const course = courseMap[matchingSession.course_id || relatedEnrollment?.course_id];
    if (!matchingSessionDate || !course) return null;
    if (!isNowWithinSessionRedeemWindow(course, matchingSessionDate)) {
      return "This code is only valid from class start time until 24 hours after class end.";
    }
    return null;
  };

  return (
    <ProviderLockGate feature="attendance" bypass>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Class Attendance</h2>
          <p className="text-slate-500 text-sm mt-1">Select your course first, then enter the instructor code when class is on.</p>
        </div>

        <Card className="border border-slate-200 bg-slate-50">
          <CardContent className="pt-4">
            <p className="text-base font-semibold text-slate-900 mb-2">How to redeem your class code</p>
            <ol className="text-sm text-slate-700 space-y-2 list-decimal pl-5">
              <li>Select your enrolled course row in the course windows section.</li>
              <li>
                Check status:
                <br />
                only rows marked <span className="font-semibold text-green-700">Class is on</span> can accept code.
              </li>
              <li>Enter the 6-character code shared by your instructor and click Submit.</li>
            </ol>
          </CardContent>
        </Card>

        {/* Code Entry Card */}
        <Card className="border-2 border-amber-200 bg-amber-50/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600" />
              Redeem Attendance Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">
                Enter the 6-character code from your instructor:
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Step 1: Select your course below. Step 2: Enter code here only when that course shows "Class is on".
              </p>
              {selectedWindow ? (
                <div className={`mb-2 rounded-md px-2.5 py-2 text-xs ${selectedWindow.isAttended ? "bg-green-50 text-green-800 border border-green-200" : selectedWindow.isOpen ? "bg-green-50 text-green-800 border border-green-200" : "bg-slate-100 text-slate-700 border border-slate-200"}`}>
                  Selected: {selectedWindow.course?.title || selectedWindow.enrollment.course_title || "Course"} ({selectedWindow.enrollment.session_date}) - {selectedWindow.isAttended ? "Attended: code entry is disabled for this session." : selectedWindow.isOpen ? "Class is on: you can enter code now." : "Class not started: wait until class start time."}
                </div>
              ) : (
                <div className="mb-2 rounded-md px-2.5 py-2 text-xs bg-amber-50 text-amber-800 border border-amber-200">
                  Select a course row first to enable code entry.
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="E.g., ABC123"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength="6"
                  className="font-mono text-lg tracking-widest text-center uppercase"
                  disabled={!canEnterCode}
                />
                <Button
                  onClick={() => {
                    const localValidationError = getLocalValidationError(code);
                    if (localValidationError) {
                      setError(localValidationError);
                      return;
                    }
                    redeemMutation.mutate({
                      session_code: code,
                      selected_course_id: selectedWindow?.enrollment?.course_id || null,
                      selected_session_date: String(selectedWindow?.enrollment?.session_date || "").slice(0, 10) || null,
                    });
                  }}
                  disabled={!canEnterCode || code.length !== 6 || redeemMutation.isPending}
                  style={{ background: "#FA6F30", color: "#fff" }}
                >
                  {redeemMutation.isPending ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming/Active Enrollments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(loadingEnrollments || fetchingEnrollments) ? (
              <p className="text-sm text-slate-500">Loading latest course windows...</p>
            ) : enrollmentWindows.length === 0 ? (
              <p className="text-sm text-slate-500">No eligible paid/confirmed course sessions found yet.</p>
            ) : enrollmentWindows.map(({ key, enrollment, course, window, isOpen, isAttended }) => (
              <button key={key} type="button" onClick={() => { setSelectedCourseWindowKey(key); setError(""); }}
                className={`w-full rounded-lg border p-3 text-left flex items-start justify-between gap-3 ${selectedCourseWindowKey === key ? "border-orange-400 bg-orange-50/40" : ""}`}>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900">{course?.title || enrollment.course_title || "Course"}</p>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 capitalize">
                      {String(enrollment.status || "unknown").replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Session date: {formatSessionDateLabel(enrollment.session_date)}
                  </p>
                  {window ? (
                    <p className="text-xs text-slate-500 mt-1">
                      Window: {formatWindowDateTime(window.startAt)} - {formatWindowDateTime(window.expiresAt)}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700 mt-1">Session timing not configured by admin yet.</p>
                  )}
                </div>
                <Badge className={isAttended ? "bg-green-100 text-green-700" : isOpen ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}>
                  {isAttended ? "Attended" : isOpen ? "Class is on" : "Class not started"}
                </Badge>
              </button>
            ))}
            <p className="text-xs text-slate-500 pt-1">
              Pick the course row first. You can enter code only for rows marked "Class is on".
            </p>
          </CardContent>
        </Card>

        {/* Success Dialog */}
        <Dialog open={!!successDialog} onOpenChange={() => setSuccessDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Attendance Confirmed!
              </DialogTitle>
            </DialogHeader>
            {successDialog && (
              <div className="space-y-4 pt-4">
                <div className="bg-green-50 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-slate-700">
                    <strong>Course:</strong> {successDialog.course_title}
                  </p>
                  <p className="text-sm text-slate-700">
                    <strong>Session:</strong> {formatSessionDateLabel(successDialog.session_date)}
                  </p>
                  {successDialog.certifications?.length > 0 && (
                    <div className="pt-2 border-t border-green-200">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Certifications Awarded:</p>
                      <div className="space-y-1">
                        {successDialog.certifications.map((cert, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-slate-700">{cert}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Link to={createPageUrl("ProviderCredentialsCoverage")} className="block">
                  <Button className="w-full" style={{ background: "#FA6F30", color: "#fff" }}>
                    <Shield className="w-4 h-4 mr-2" /> Activate MD Coverage
                  </Button>
                </Link>
                <Button variant="outline" className="w-full" onClick={() => setSuccessDialog(null)}>
                  Do this later
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Redeemed Sessions */}
        {redeemed.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900">Your Confirmed Attendance</h3>
            {redeemed.map((session) => (
              <Card key={session.id} className="border-l-4 border-l-green-500">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{session.course_title}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        {formatSessionDateLabel(session.session_date)}
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Attended
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ProviderLockGate>
  );
}