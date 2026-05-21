import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { getSessionWindowForDate, isNowWithinSessionRedeemWindow } from "@/lib/classCodeWindow";

function toDateOnly(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return raw.slice(0, 10);
}

function normalizeStatus(value) {
  return String(value || "").toLowerCase();
}

export function useAttendanceContext() {
  const queryClient = useQueryClient();

  const { data: myEnrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ["attendance-my-enrollments"],
    queryFn: async () => {
      const me = await base44.auth.me();
      const [byProviderIdResult, byEmailResult, preOrdersResult] = await Promise.allSettled([
        me?.id ? base44.entities.Enrollment.filter({ provider_id: me.id }, "-created_date") : Promise.resolve([]),
        me?.email ? base44.entities.Enrollment.filter({ provider_email: me.email }, "-created_date") : Promise.resolve([]),
        me?.email
          ? base44.entities.PreOrder.list("-created_date", 500, { customer_email: me.email })
          : Promise.resolve([]),
      ]);
      const byProviderId = byProviderIdResult.status === "fulfilled" ? (byProviderIdResult.value || []) : [];
      const byEmail = byEmailResult.status === "fulfilled" ? (byEmailResult.value || []) : [];
      const preOrders = preOrdersResult.status === "fulfilled" ? (preOrdersResult.value || []) : [];
      const email = String(me?.email || "").trim().toLowerCase();
      const derivedFromPreOrders = email
        ? preOrders
          .filter((p) => normalizeStatus(p?.order_type) === "course")
          .filter((p) => Boolean(p?.course_id))
          .filter((p) => ["paid", "confirmed", "completed"].includes(normalizeStatus(p?.status)))
          .filter((p) => String(p?.customer_email || "").trim().toLowerCase() === email)
          .map((p) => ({
            id: `preorder-${p.id}`,
            pre_order_id: p.id,
            course_id: p.course_id,
            provider_id: me?.id || null,
            provider_email: p.customer_email || me?.email || null,
            provider_name: p.customer_name || null,
            status: normalizeStatus(p?.status) === "completed" ? "attended" : normalizeStatus(p?.status),
            session_date: p.course_date || p.session_date || null,
            amount_paid: p.amount_paid,
            created_date: p.created_date || p.created_at || null,
          }))
        : [];
      const map = new Map();
      [...byProviderId, ...byEmail, ...derivedFromPreOrders].forEach((row) => {
        const key = row?.pre_order_id || row?.id || `${row?.course_id || ""}:${row?.session_date || ""}`;
        if (key) map.set(String(key), row);
      });
      return Array.from(map.values());
    },
  });

  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["attendance-my-sessions", myEnrollments.map((e) => `${e.id}:${e.course_id}:${e.session_date || ""}`).join("|")],
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
        if (providerId && providerId === meId) return true;
        if (providerEmail && providerEmail === meEmail) return true;
        if (enrollmentIds.has(enrollmentId)) return true;
        if (classDateKeys.has(enrollmentId)) return true;
        return false;
      });
    },
    enabled: myEnrollments.length >= 0,
  });

  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["attendance-courses"],
    queryFn: () => base44.entities.Course.list(),
  });

  const redeemMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke("redeemClassCode", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-my-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-my-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["provider-my-enrollments-with-dates"] });
      queryClient.invalidateQueries({ queryKey: ["my-enrollments-code-redemption"] });
      queryClient.invalidateQueries({ queryKey: ["my-sessions-code-redemption"] });
    },
  });

  const courseMap = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, c])), [courses]);

  const redeemedSessionKeys = useMemo(
    () =>
      new Set(
        sessions
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
      ),
    [sessions]
  );

  const enrollmentWindows = useMemo(() => {
    const merged = [
      ...myEnrollments,
      ...sessions.map((session) => {
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
      }),
    ];

    const unique = Array.from(
      merged
        .filter(
          (enrollment) =>
            enrollment?.course_id &&
            enrollment?.session_date &&
            ["paid", "confirmed", "attended", "completed"].includes(normalizeStatus(enrollment?.status))
        )
        .reduce((acc, enrollment) => {
          const dateOnly = toDateOnly(enrollment.session_date);
          const key = `${enrollment.course_id}:${dateOnly}`;
          const normalized = { ...enrollment, session_date: dateOnly };
          const existing = acc.get(key);
          const existingStatus = normalizeStatus(existing?.status);
          const incomingStatus = normalizeStatus(normalized?.status);
          if (!existing || (existingStatus !== "attended" && incomingStatus === "attended")) {
            acc.set(key, normalized);
          }
          return acc;
        }, new Map())
        .values()
    );

    return unique.map((enrollment) => {
      const course = courseMap[enrollment.course_id];
      const sessionDate = String(enrollment.session_date || "").slice(0, 10);
      const key = `${enrollment.course_id}:${sessionDate}`;
      const window = getSessionWindowForDate(course, sessionDate);
      const isOpen = window ? isNowWithinSessionRedeemWindow(course, sessionDate) : false;
      const isAttended = redeemedSessionKeys.has(key) || ["attended", "completed"].includes(normalizeStatus(enrollment.status));
      return { key, enrollment, course, window, isOpen, isAttended };
    });
  }, [courseMap, myEnrollments, redeemedSessionKeys, sessions]);

  const activeWindows = useMemo(
    () => enrollmentWindows.filter((entry) => entry.isOpen && !entry.isAttended),
    [enrollmentWindows]
  );

  function getWindowByEnrollment(enrollment) {
    const courseId = String(enrollment?.course_id || "");
    const sessionDate = toDateOnly(enrollment?.session_date);
    if (!courseId || !sessionDate) return null;
    return enrollmentWindows.find((entry) => entry.key === `${courseId}:${sessionDate}`) || null;
  }

  function getLocalValidationError(code, windowEntry) {
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (normalizedCode.length !== 6) return "Please enter the full 6-character class code.";
    if (!windowEntry) return "No class session is linked to this enrollment yet.";
    if (windowEntry.isAttended) return "Attendance is already marked for this session.";
    if (!windowEntry.isOpen) return "Attendance opens only during the active class window.";
    return null;
  }

  async function submitAttendance({ code, windowEntry }) {
    const localError = getLocalValidationError(code, windowEntry);
    if (localError) return { ok: false, error: localError };
    try {
      const response = await redeemMutation.mutateAsync({
        session_code: String(code || "").toUpperCase().trim(),
        selected_course_id: windowEntry?.enrollment?.course_id || null,
        selected_session_date: String(windowEntry?.enrollment?.session_date || "").slice(0, 10) || null,
      });
      if (!response?.data?.success) {
        return { ok: false, error: response?.data?.error || "Failed to redeem class code." };
      }
      return { ok: true, data: response.data };
    } catch (error) {
      return { ok: false, error: error?.message || "Attendance submission failed." };
    }
  }

  return {
    isLoading: loadingEnrollments || loadingSessions || loadingCourses,
    isSubmitting: redeemMutation.isPending,
    myEnrollments,
    sessions,
    courses,
    enrollmentWindows,
    activeWindows,
    getWindowByEnrollment,
    getLocalValidationError,
    submitAttendance,
  };
}
