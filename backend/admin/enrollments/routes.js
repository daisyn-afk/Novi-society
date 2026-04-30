import { Router } from "express";
import { query } from "../db.js";
import { backfillPaidEnrollments } from "./repository.js";

export const enrollmentsRouter = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

enrollmentsRouter.get("/", async (_req, res, next) => {
  try {
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
       order by created_at desc`
    );
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

enrollmentsRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "Enrollment id is required." });
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: "Enrollment id must be a valid UUID." });
    }

    const updates = req.body || {};
    const allowed = ["status"];
    const keys = Object.keys(updates).filter((key) => allowed.includes(key));
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
    const result = await backfillPaidEnrollments();
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});
