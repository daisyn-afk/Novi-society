import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";

export const functionsRouter = Router();
let certificationColumnsPromise = null;

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function parseClassDateTime(dateValue, timeValue, fallbackHour, fallbackMinute) {
  if (!dateValue) return null;
  const date = String(dateValue).slice(0, 10);
  const time = String(timeValue || "").trim();
  const [hhRaw, mmRaw] = time.split(":");
  const hh = Number.isFinite(Number(hhRaw)) ? Number(hhRaw) : fallbackHour;
  const mm = Number.isFinite(Number(mmRaw)) ? Number(mmRaw) : fallbackMinute;
  return zonedDateTimeToUtc(date, hh, mm, "Etc/GMT+5");
}

function getPartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second)
  };
}

function zonedDateTimeToUtc(dateString, hour, minute, timeZone) {
  const [yearRaw, monthRaw, dayRaw] = String(dateString || "").slice(0, 10).split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!year || !month || !day) return null;

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const tzParts = getPartsInTimeZone(utcGuess, timeZone);
  const asIfUtc = Date.UTC(
    tzParts.year,
    tzParts.month - 1,
    tzParts.day,
    tzParts.hour,
    tzParts.minute,
    tzParts.second
  );
  const offsetMs = asIfUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

function toDateOnly(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return raw.slice(0, 10);
}

function isWithinRedeemWindow(sessionDate, sessionDates) {
  const dateOnly = toDateOnly(sessionDate);
  if (!dateOnly) return false;
  const config = Array.isArray(sessionDates)
    ? sessionDates.find((entry) => toDateOnly(entry?.date) === dateOnly)
    : null;
  const startAt = parseClassDateTime(dateOnly, config?.start_time, 0, 0);
  const endAt = parseClassDateTime(dateOnly, config?.end_time, 23, 59);
  if (!startAt || !endAt) return { ok: false, startAt: null, endAt: null, expiresAt: null, now: new Date() };
  const expiresAt = new Date(endAt.getTime() + (24 * 60 * 60 * 1000));
  const now = new Date();
  return { ok: now >= startAt && now <= expiresAt, startAt, endAt, expiresAt, now };
}

async function createCertificationsForEnrollment(enrollment, course, me) {
  const awarded = Array.isArray(course?.certifications_awarded) ? course.certifications_awarded : [];
  if (!awarded.length) return [];
  if (!certificationColumnsPromise) {
    certificationColumnsPromise = query(
      `select column_name
       from information_schema.columns
       where table_schema = 'public' and table_name = 'certification'`
    )
      .then((r) => new Set((r.rows || []).map((row) => String(row.column_name || "").toLowerCase())))
      .catch(() => new Set());
  }
  const certificationColumns = await certificationColumnsPromise;
  const hasColumn = (name) => certificationColumns.has(String(name || "").toLowerCase());
  // If certification table is still template-only schema, skip runtime issuance
  // instead of failing class-code redemption.
  if (!hasColumn("provider_id") && hasColumn("template_course_id")) return [];

  const created = [];
  for (const cert of awarded) {
    const certificationName =
      String(cert?.cert_name || cert?.service_type_name || course?.certification_name || course?.title || "Course Certification").trim();
    if (!certificationName) continue;
    try {
      const valuesByColumn = {
        provider_id: String(me.id || "") || null,
        provider_email: String(me.email || "").toLowerCase() || null,
        provider_name: String(me.full_name || "").trim() || null,
        enrollment_id: enrollment?.id || null,
        course_id: course?.id || null,
        certification_name: certificationName,
        cert_name: certificationName,
        issued_by: course?.title || "NOVI Class",
        category: cert?.category || course?.category || "class_completion",
        status: "active",
        issued_at: new Date().toISOString(),
        service_type_id: cert?.service_type_id || null,
        service_type_name: cert?.service_type_name || null
      };
      const insertColumns = Object.keys(valuesByColumn).filter((col) => hasColumn(col));
      if (insertColumns.length === 0) continue;
      const insertValues = insertColumns.map((col) => valuesByColumn[col]);
      const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(", ");
      const returningNameColumn = hasColumn("certification_name") ? "certification_name" : (hasColumn("cert_name") ? "cert_name" : null);
      const sql = `insert into public.certification (${insertColumns.join(", ")}) values (${placeholders})${returningNameColumn ? ` returning ${returningNameColumn}` : ""}`;
      const { rows } = await query(sql, insertValues);
      if (returningNameColumn && rows?.[0]?.[returningNameColumn]) {
        created.push(rows[0][returningNameColumn]);
      }
    } catch {
      // Do not fail code redemption because optional certification write failed.
    }
  }

  return created;
}

functionsRouter.post("/redeemClassCode", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    const sessionCode = String(req.body?.session_code || "").trim().toUpperCase();
    const selectedCourseId = String(req.body?.selected_course_id || "").trim();
    const selectedSessionDate = String(req.body?.selected_session_date || "").trim().slice(0, 10);
    if (sessionCode.length !== 6) {
      return res.status(400).json({ success: false, error: "Class code must be 6 characters." });
    }

    const sessionQueryParts = [
      `select *`,
      `from public.class_session`,
      `where upper(session_code) = $1`
    ];
    const params = [sessionCode];
    if (selectedCourseId) {
      params.push(selectedCourseId);
      sessionQueryParts.push(`and course_id::text = $${params.length}`);
    }
    if (selectedSessionDate) {
      params.push(selectedSessionDate);
      sessionQueryParts.push(`and session_date::date = $${params.length}::date`);
    }
    sessionQueryParts.push(`order by created_date desc limit 1`);
    const { rows: sessionRows } = await query(sessionQueryParts.join("\n"), params);
    const session = sessionRows[0];
    if (!session) return res.status(404).json({ success: false, error: "Invalid class code." });
    if (session.code_used) return res.status(400).json({ success: false, error: "This class code was already redeemed." });

    const normalizedSessionDate = selectedSessionDate || toDateOnly(session.session_date);
    const { rows: userRows } = await query(
      `select id, email
       from public.users
       where auth_user_id = $1
       limit 1`,
      [me.id]
    );
    const appUserId = String(userRows?.[0]?.id || "");
    const appUserEmail = String(userRows?.[0]?.email || "").toLowerCase();
    let enrollment = null;
    let preorder = null;
    if (session.enrollment_id && !String(session.enrollment_id).startsWith("class_date:")) {
      const { rows } = await query(
        `select *
         from public.enrollments
         where id = $1
         limit 1`,
        [session.enrollment_id]
      );
      enrollment = rows[0] || null;
    } else {
      const { rows } = await query(
        `select *
         from public.enrollments
         where course_id = $1
           and (
             ($2::date is not null and (session_date::date = $2::date or session_date is null))
             or ($2::date is null)
           )
           and (
             provider_id::text = $3
             or provider_id::text = $4
             or lower(coalesce(provider_email, '')) = lower($5)
             or lower(coalesce(provider_email, '')) = lower($6)
           )
         order by created_at desc nulls last
         limit 1`,
        [
          session.course_id,
          normalizedSessionDate,
          String(me.id || ""),
          appUserId || "__no_app_user__",
          me.email || "",
          appUserEmail || "__no_app_email__",
        ]
      );
      enrollment = rows[0] || null;
    }

    if (!enrollment) {
      const { rows: preorderRows } = await query(
        `select *
         from public.pre_orders
         where (
             lower(coalesce(order_type, '')) = 'course'
             or lower(coalesce(type, '')) = 'course'
           )
           and course_id = $1
           and (
             lower(coalesce(customer_email, '')) = lower($2)
             or lower(coalesce(customer_email, '')) = lower($3)
           )
           and status in ('paid', 'confirmed', 'completed')
           and (
             ($4::date is not null and (course_date::date = $4::date or course_date is null))
             or ($4::date is null)
           )
         order by created_at desc nulls last
         limit 1`,
        [session.course_id, me.email || "", appUserEmail || "", normalizedSessionDate || null]
      );
      preorder = preorderRows[0] || null;
    }

    // Fallback: some historical records have mismatched/missing session_date linkage.
    // In that case, accept course-level ownership for this provider.
    if (!enrollment) {
      const { rows: looseEnrollmentRows } = await query(
        `select *
         from public.enrollments
         where course_id = $1
           and (
             provider_id::text = $2
             or provider_id::text = $3
             or lower(coalesce(provider_email, '')) = lower($4)
             or lower(coalesce(provider_email, '')) = lower($5)
           )
           and lower(coalesce(status, '')) in ('paid', 'confirmed', 'completed', 'attended')
         order by created_at desc nulls last
         limit 1`,
        [
          session.course_id,
          String(me.id || ""),
          appUserId || "__no_app_user__",
          me.email || "",
          appUserEmail || "__no_app_email__",
        ]
      );
      enrollment = looseEnrollmentRows[0] || null;
    }
    if (!preorder) {
      const { rows: loosePreorderRows } = await query(
        `select *
         from public.pre_orders
         where (
             lower(coalesce(order_type, '')) = 'course'
             or lower(coalesce(type, '')) = 'course'
           )
           and course_id = $1
           and (
             lower(coalesce(customer_email, '')) = lower($2)
             or lower(coalesce(customer_email, '')) = lower($3)
           )
           and status in ('paid', 'confirmed', 'completed')
         order by created_at desc nulls last
         limit 1`,
        [session.course_id, me.email || "", appUserEmail || ""]
      );
      preorder = loosePreorderRows[0] || null;
    }
    const meId = String(me.id || "");
    const meAppId = String(appUserId || "");
    const meEmail = String(me.email || "").toLowerCase();
    const meEmails = new Set([meEmail, appUserEmail].filter(Boolean));
    const sessionProviderId = String(session.provider_id || "");
    const sessionProviderEmail = String(session.provider_email || "").toLowerCase();
    const sessionOwnershipMatch =
      (sessionProviderId && (sessionProviderId === meId || sessionProviderId === meAppId)) ||
      (sessionProviderEmail && meEmails.has(sessionProviderEmail));

    if (!enrollment && !preorder && !sessionOwnershipMatch) {
      return res.status(403).json({ success: false, error: "This code is not assigned to your enrollment." });
    }
    if (!enrollment && preorder) {
      enrollment = {
        id: `preorder:${preorder.id}`,
        provider_id: me.id || null,
        provider_email: me.email || preorder.customer_email || null,
        provider_name: me.full_name || preorder.customer_name || null,
        course_id: preorder.course_id,
        session_date: preorder.course_date || normalizedSessionDate || null,
        status: preorder.status
      };
    }

    const enrollmentProviderId = String(enrollment?.provider_id || "");
    const enrollmentProviderEmail = String(enrollment?.provider_email || "").toLowerCase();
    const enrollmentOwnershipMatch =
      (enrollmentProviderId && (enrollmentProviderId === meId || enrollmentProviderId === meAppId)) ||
      (enrollmentProviderEmail && meEmails.has(enrollmentProviderEmail));
    const preorderOwnershipMatch = Boolean(preorder);
    if (!sessionOwnershipMatch && !enrollmentOwnershipMatch && !preorderOwnershipMatch) {
      return res.status(403).json({ success: false, error: "This code is not assigned to your enrollment." });
    }

    const { rows: courseRows } = await query(
      `select id, title, category, certifications_awarded, session_dates
       from public.scheduled_courses
       where id = $1
       limit 1`,
      [session.course_id]
    );
    const course = courseRows[0] || null;
    if (!course) return res.status(404).json({ success: false, error: "Course not found for this class code." });
    const effectiveSessionDate = normalizedSessionDate || toDateOnly(enrollment?.session_date);
    const windowCheck = isWithinRedeemWindow(effectiveSessionDate, course.session_dates);
    if (!windowCheck.ok) {
      return res.status(400).json({
        success: false,
        error: "This code is only valid from class start time until 24 hours after class end.",
        debug_window: {
          now: windowCheck.now?.toISOString?.() || null,
          start_at: windowCheck.startAt?.toISOString?.() || null,
          end_at: windowCheck.endAt?.toISOString?.() || null,
          expires_at: windowCheck.expiresAt?.toISOString?.() || null,
          selected_course_id: selectedCourseId || null,
          selected_session_date: selectedSessionDate || null,
          matched_course_id: session?.course_id || null,
          matched_session_date: toDateOnly(session?.session_date) || null,
          effective_session_date: effectiveSessionDate || null
        }
      });
    }

    await query(
      `update public.class_session
       set code_used = true, code_used_at = now()
       where id = $1`,
      [session.id]
    );

    if (!String(enrollment.id || "").startsWith("preorder:")) {
      await query(
        `update public.enrollments
         set status = 'attended'
         where id = $1`,
        [enrollment.id]
      );
    }

    const certifications = await createCertificationsForEnrollment(enrollment, course, me);

    return res.json({
      success: true,
      session_id: session.id,
      enrollment_id: String(enrollment.id || ""),
      course_title: session.course_title || course.title,
      session_date: effectiveSessionDate || String(session.session_date || "").slice(0, 10),
      certifications
    });
  } catch (error) {
    return next(error);
  }
});
