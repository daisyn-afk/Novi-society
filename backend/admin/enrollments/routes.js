import { Router } from "express";
import { query } from "../db.js";
import { backfillPaidEnrollments } from "./repository.js";
import { hasAdminAccess, hasStaffModuleAccess, requireAuth } from "../auth/helpers.js";

export const enrollmentsRouter = Router();
enrollmentsRouter.use(requireAuth);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLASS_DATE_KEY_RE =
  /^class_date:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):(\d{4}-\d{2}-\d{2})$/i;

function parseSharedClassDateEnrollmentKey(value) {
  const match = CLASS_DATE_KEY_RE.exec(String(value || "").trim());
  if (!match) return null;
  return { courseId: match[1], sessionDate: match[2] };
}

enrollmentsRouter.get("/", async (req, res, next) => {
  try {
    const me = req.me || {};
    const role = String(me.role || "").trim().toLowerCase();
    const isAdmin = hasAdminAccess(role);
    const isStaff = role === "staff";
    if (isStaff && !hasStaffModuleAccess(me, "AdminEnrollments")) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const providerId = String(req.query?.provider_id || "").trim();
    const providerEmail = String(req.query?.provider_email || "").trim().toLowerCase();
    const ownId = String(me.id || "").trim();
    const ownEmail = String(me.email || "").trim().toLowerCase();
    const forceOwnScope = !isAdmin && !isStaff;
    const status = String(req.query?.status || "").trim();
    const courseId = String(req.query?.course_id || "").trim();

    const whereClauses = [];
    const params = [];
    if (forceOwnScope) {
      const ownClauses = [];
      if (ownId) {
        params.push(ownId);
        ownClauses.push(`provider_id::text = $${params.length}`);
      }
      if (ownEmail) {
        params.push(ownEmail);
        ownClauses.push(`lower(provider_email) = $${params.length}`);
      }
      if (ownClauses.length) {
        whereClauses.push(`(${ownClauses.join(" or ")})`);
      }
    } else if (providerId) {
      params.push(providerId);
      whereClauses.push(`provider_id::text = $${params.length}`);
    }
    if (!forceOwnScope && providerEmail) {
      params.push(providerEmail);
      whereClauses.push(`lower(provider_email) = $${params.length}`);
    }
    if (status) {
      params.push(status);
      whereClauses.push(`status = $${params.length}`);
    }
    if (courseId) {
      params.push(courseId);
      whereClauses.push(`course_id::text = $${params.length}`);
    }
    const whereSql = whereClauses.length ? `where ${whereClauses.join(" and ")}` : "";

    const { rows } = await query(
      `select
         id,
         created_at as created_date,
         updated_at as updated_date,
         course_id,
         pre_order_id,
         provider_id,
         provider_name,
         provider_email,
         customer_name,
         status,
         session_date,
         amount_paid,
         paid_at
       from public.enrollments
       ${whereSql}
       order by created_at desc`,
      params
    );
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

enrollmentsRouter.patch("/:id", async (req, res, next) => {
  try {
    if (!hasAdminAccess(req.me?.role) && !hasStaffModuleAccess(req.me, "AdminEnrollments")) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "Enrollment id is required." });

    const updates = req.body || {};
    const allowed = ["status"];
    const keys = Object.keys(updates).filter((key) => allowed.includes(key));

    const sharedClassDate = parseSharedClassDateEnrollmentKey(id);
    if (sharedClassDate) {
      if (keys.length === 0) {
        const { rows } = await query(
          `select *
           from public.enrollments
           where course_id::text = $1
             and session_date::date = $2::date
           order by created_at desc`,
          [sharedClassDate.courseId, sharedClassDate.sessionDate]
        );
        return res.json({ bulk: true, enrollments: rows });
      }

      const nextStatus = String(updates.status || "").trim().toLowerCase();
      if (!nextStatus) {
        return res.status(400).json({ error: "Status is required for shared class attendance confirmation." });
      }

      const { rows } = await query(
        `update public.enrollments
         set status = $1, updated_at = now()
         where course_id::text = $2
           and session_date::date = $3::date
           and lower(coalesce(status, '')) = any($4::text[])
         returning *`,
        [nextStatus, sharedClassDate.courseId, sharedClassDate.sessionDate, ["attended"]]
      );
      return res.json({ bulk: true, updated_count: rows.length, enrollments: rows });
    }

    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: "Enrollment id must be a valid UUID." });
    }

    if (keys.length === 0) {
      const { rows } = await query(`select * from public.enrollments where id = $1 limit 1`, [id]);
      return res.json(rows[0] || null);
    }

    const values = [];
    const setClauses = keys.map((key) => {
      values.push(updates[key]);
      return `${key} = $${values.length}`;
    });
    values.push(id);

    const { rows } = await query(
      `update public.enrollments
       set ${setClauses.join(", ")}, updated_at = now()
       where id = $${values.length}
       returning *`,
      values
    );
    return res.json(rows[0] || null);
  } catch (error) {
    return next(error);
  }
});

enrollmentsRouter.post("/repair", async (_req, res, next) => {
  try {
    if (!hasAdminAccess(_req.me?.role) && !hasStaffModuleAccess(_req.me, "AdminEnrollments")) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const result = await backfillPaidEnrollments();
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});
