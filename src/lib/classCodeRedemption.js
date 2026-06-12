export function isSharedClassDateSession(session) {
  return String(session?.enrollment_id || "").startsWith("class_date:");
}

export function toDateOnly(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return raw.slice(0, 10);
}

export function enrollmentWindowKey(enrollment) {
  const courseId = String(enrollment?.course_id || "");
  const sessionDate = toDateOnly(enrollment?.session_date);
  if (!courseId || !sessionDate) return "";
  return `${courseId}:${sessionDate}`;
}

export function isEnrollmentAttended(enrollment) {
  return ["attended", "completed"].includes(String(enrollment?.status || "").toLowerCase());
}

export function hasProviderAttendedCourseWindow({
  enrollment,
  myEnrollments = [],
  attendedWindowKeys = new Set(),
}) {
  const key = enrollmentWindowKey(enrollment);
  if (!key) return false;
  if (attendedWindowKeys.has(key)) return true;
  return (myEnrollments || []).some((row) => {
    if (!isEnrollmentAttended(row)) return false;
    return enrollmentWindowKey(row) === key;
  });
}

export function hasProviderRedeemedSharedSession({
  enrollment,
  mySessions = [],
  myEnrollments = [],
  attendedWindowKeys = new Set(),
}) {
  if (hasProviderAttendedCourseWindow({ enrollment, myEnrollments, attendedWindowKeys })) {
    return true;
  }

  const courseId = String(enrollment?.course_id || "");
  const sessionDate = toDateOnly(enrollment?.session_date);
  const classDateKey = courseId && sessionDate ? `class_date:${courseId}:${sessionDate}` : "";
  if (!classDateKey) return false;

  return (mySessions || []).some((session) => {
    if (!isSharedClassDateSession(session)) return false;
    if (String(session?.enrollment_id || "") !== classDateKey) return false;
    // Shared session code_used means at least one redemption globally — not this provider.
    return false;
  });
}

export function isSharedSessionFullyRedeemed(session) {
  if (!isSharedClassDateSession(session)) return Boolean(session?.code_used);
  const cap = Number(session?.redemption_cap ?? 0);
  const count = Number(session?.redemption_count ?? 0);
  if (session?.fully_redeemed != null) return Boolean(session.fully_redeemed);
  return cap > 0 && count >= cap;
}

export function canRegenerateClassCode(session) {
  if (!session) return false;
  if (isSharedClassDateSession(session)) {
    return Number(session?.redemption_count ?? 0) === 0;
  }
  return !session?.code_used;
}

export function resolveSeatCapForDisplay(session, seatCapOverride) {
  const override = Number(seatCapOverride ?? NaN);
  if (Number.isFinite(override) && override >= 0) return override;
  return Number(session?.redemption_cap ?? 0);
}

export function formatRedemptionStatus(session, { seatCap } = {}) {
  if (!isSharedClassDateSession(session)) {
    if (session?.attendance_confirmed) return { label: "Attended", tone: "confirmed" };
    if (session?.code_used) return { label: "Code Used", tone: "used" };
    return { label: "Code active", tone: "active" };
  }

  const count = Number(session?.redemption_count ?? 0);
  const cap = resolveSeatCapForDisplay(session, seatCap);
  if (session?.attendance_confirmed) return { label: "Attended", tone: "confirmed" };
  if (cap > 0 && count >= cap) return { label: "Fully redeemed", tone: "full" };
  if (count > 0) return { label: `${count} / ${cap} redeemed`, tone: "progress" };
  if (cap > 0) {
    return {
      label: `Code active · 0 / ${cap} seats`,
      tone: "active",
      hint: "Providers can redeem until all enrolled seats use this code.",
    };
  }
  return {
    label: "Code active",
    tone: "active",
    hint: "Providers can redeem when they enroll and class is live.",
  };
}
