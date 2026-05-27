import { Router } from "express";
import { pool } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";

export const notificationsRouter = Router();

let notificationTablePromise = null;
let notificationColumnsByTablePromise = null;

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function hasAdminAccess(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "super_admin" || normalized === "owner";
}

async function requireAuth(req) {
  const token = getBearerToken(req);
  if (!token) {
    const err = new Error("Missing bearer token.");
    err.statusCode = 401;
    throw err;
  }
  const me = await getMeFromAccessToken(token);
  return { me };
}

async function getNotificationTableName() {
  if (!notificationTablePromise) {
    notificationTablePromise = pool.query(
      `select table_name
       from information_schema.tables
       where table_schema = 'public'
         and table_name in ('notification', 'notifications')
       order by case when table_name = 'notification' then 0 else 1 end
       limit 1`
    ).then((r) => r.rows?.[0]?.table_name || null)
      .catch(() => null);
  }
  let tableName = await notificationTablePromise;
  if (!tableName) {
    await ensureNotificationTable();
    notificationTablePromise = null;
    notificationColumnsByTablePromise = null;
    notificationTablePromise = pool.query(
      `select table_name
       from information_schema.tables
       where table_schema = 'public'
         and table_name in ('notification', 'notifications')
       order by case when table_name = 'notification' then 0 else 1 end
       limit 1`
    ).then((r) => r.rows?.[0]?.table_name || null)
      .catch(() => null);
    tableName = await notificationTablePromise;
  }
  return tableName;
}

async function getNotificationTableColumnsByName() {
  if (!notificationColumnsByTablePromise) {
    notificationColumnsByTablePromise = (async () => {
      const tableName = await getNotificationTableName();
      if (!tableName) return { tableName: null, columns: new Set() };
      const result = await pool.query(
        `select column_name
         from information_schema.columns
         where table_schema = 'public'
           and table_name = $1`,
        [tableName]
      );
      return {
        tableName,
        columns: new Set((result.rows || []).map((row) => String(row.column_name || "").toLowerCase()))
      };
    })().catch(() => ({ tableName: null, columns: new Set() }));
  }
  return notificationColumnsByTablePromise;
}

async function ensureNotificationTable() {
  await pool.query(
    `create table if not exists public.notifications (
       id text primary key default ('notif_' || md5(random()::text || clock_timestamp()::text)),
       user_id text null,
       user_email text null,
       type text null,
       message text not null,
       link_page text null,
       read_at timestamptz null,
       created_at timestamptz not null default now(),
       updated_at timestamptz not null default now()
     )`
  );
  await pool.query(`create index if not exists idx_notifications_user_id on public.notifications(user_id)`);
  await pool.query(`create index if not exists idx_notifications_user_email on public.notifications(lower(user_email))`);
  await pool.query(`create index if not exists idx_notifications_created_at on public.notifications(created_at desc)`);
}

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const { tableName, columns } = await getNotificationTableColumnsByName();
    if (!tableName || columns.size === 0) return res.json([]);

    const params = [];
    const where = [];
    const requestedUserId = String(req.query?.user_id || "").trim();
    const requestedUserEmail = String(req.query?.user_email || "").trim().toLowerCase();

    if (hasAdminAccess(me.role) && (requestedUserId || requestedUserEmail)) {
      if (requestedUserId && columns.has("user_id")) {
        params.push(requestedUserId);
        where.push(`user_id::text = $${params.length}`);
      }
      if (requestedUserEmail && columns.has("user_email")) {
        params.push(requestedUserEmail);
        where.push(`lower(user_email) = $${params.length}`);
      }
    } else {
      const ownClauses = [];
      if (columns.has("user_id")) {
        params.push(String(me.id || ""));
        ownClauses.push(`user_id::text = $${params.length}`);
      }
      if (columns.has("user_email")) {
        params.push(String(me.email || "").toLowerCase());
        ownClauses.push(`lower(user_email) = $${params.length}`);
      }
      if (ownClauses.length) where.push(`(${ownClauses.join(" or ")})`);
    }

    const limitRaw = Number(req.query?.limit || 30);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 30;
    params.push(limit);
    const limitParam = `$${params.length}`;

    const sortColumn = columns.has("created_date")
      ? "created_date"
      : (columns.has("created_at") ? "created_at" : "id");

    const sql = `select *
                 from public.${tableName}
                 ${where.length ? `where ${where.join(" and ")}` : ""}
                 order by ${sortColumn} desc
                 limit ${limitParam}`;
    const { rows } = await pool.query(sql, params);
    return res.json(rows || []);
  } catch (error) {
    return next(error);
  }
});

notificationsRouter.post("/", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const body = req.body || {};
    const isPatientAppointmentRequest =
      String(me.role || "").trim().toLowerCase() === "patient" &&
      String(body.type || "").trim().toLowerCase() === "appointment_request";
    if (!hasAdminAccess(me.role) && !isPatientAppointmentRequest) {
      const err = new Error("Forbidden.");
      err.statusCode = 403;
      throw err;
    }
    const { tableName, columns } = await getNotificationTableColumnsByName();
    if (!tableName || columns.size === 0) {
      const err = new Error("Notification storage is not available.");
      err.statusCode = 500;
      throw err;
    }
    const valuesByColumn = {
      user_id: body.user_id || null,
      user_email: body.user_email || null,
      type: body.type || "generic",
      message: body.message || "",
      link_page: body.link_page || null,
      read_at: body.read_at || null
    };
    const insertColumns = Object.keys(valuesByColumn).filter((col) => columns.has(col));
    if (!insertColumns.length) {
      const err = new Error("Notification table schema does not support this payload.");
      err.statusCode = 400;
      throw err;
    }
    const params = insertColumns.map((col) => valuesByColumn[col]);
    const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(", ");
    const { rows } = await pool.query(
      `insert into public.${tableName} (${insertColumns.join(", ")})
       values (${placeholders})
       returning *`,
      params
    );
    return res.status(201).json(rows[0] || null);
  } catch (error) {
    return next(error);
  }
});

notificationsRouter.get("/:id", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const id = String(req.params.id || "").trim();
    if (!id) {
      const err = new Error("Notification id is required.");
      err.statusCode = 400;
      throw err;
    }
    const { tableName, columns } = await getNotificationTableColumnsByName();
    if (!tableName || columns.size === 0) return res.status(404).json({ error: "Notification storage not available." });
    const { rows } = await pool.query(`select * from public.${tableName} where id = $1 limit 1`, [id]);
    const row = rows[0];
    if (!row) {
      const err = new Error("Notification not found.");
      err.statusCode = 404;
      throw err;
    }
    const meId = String(me.id || "");
    const meEmail = String(me.email || "").toLowerCase();
    const ownerId = String(row.user_id || "");
    const ownerEmail = String(row.user_email || "").toLowerCase();
    const canRead = hasAdminAccess(me.role) || (ownerId && ownerId === meId) || (ownerEmail && ownerEmail === meEmail);
    if (!canRead) {
      const err = new Error("Forbidden.");
      err.statusCode = 403;
      throw err;
    }
    return res.json(row);
  } catch (error) {
    return next(error);
  }
});

notificationsRouter.patch("/:id", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const id = String(req.params.id || "").trim();
    if (!id) {
      const err = new Error("Notification id is required.");
      err.statusCode = 400;
      throw err;
    }
    const { tableName, columns } = await getNotificationTableColumnsByName();
    if (!tableName || columns.size === 0) {
      const err = new Error("Notification storage is not available.");
      err.statusCode = 500;
      throw err;
    }
    const { rows: existingRows } = await pool.query(`select * from public.${tableName} where id = $1 limit 1`, [id]);
    const existing = existingRows[0];
    if (!existing) {
      const err = new Error("Notification not found.");
      err.statusCode = 404;
      throw err;
    }
    const meId = String(me.id || "");
    const meEmail = String(me.email || "").toLowerCase();
    const ownerId = String(existing.user_id || "");
    const ownerEmail = String(existing.user_email || "").toLowerCase();
    const canEdit = hasAdminAccess(me.role) || (ownerId && ownerId === meId) || (ownerEmail && ownerEmail === meEmail);
    if (!canEdit) {
      const err = new Error("Forbidden.");
      err.statusCode = 403;
      throw err;
    }
    const updates = req.body || {};
    const allowedColumns = Object.keys(updates).filter((key) => columns.has(String(key || "").toLowerCase()));
    if (!allowedColumns.length) return res.json(existing);
    const setClause = allowedColumns.map((col, idx) => `${col} = $${idx + 2}`).join(", ");
    const values = [id, ...allowedColumns.map((col) => updates[col])];
    const { rows } = await pool.query(
      `update public.${tableName}
       set ${setClause}
       where id = $1
       returning *`,
      values
    );
    return res.json(rows[0] || existing);
  } catch (error) {
    return next(error);
  }
});

