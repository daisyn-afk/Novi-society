import { createClient } from "@supabase/supabase-js";
import { query, pool } from "../db.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminClient = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

const ALLOWED_ROLES = ["provider", "patient", "medical_director", "admin"];

const SELECT_COLUMNS = `
  id,
  created_at,
  updated_at,
  auth_user_id,
  email,
  first_name,
  last_name,
  full_name,
  role,
  is_active
`;

function ensureAdminClient() {
  if (!adminClient) {
    const err = new Error("Supabase admin client is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    err.statusCode = 500;
    throw err;
  }
}

function normalizeRole(role) {
  const value = String(role || "provider").trim().toLowerCase();
  return ALLOWED_ROLES.includes(value) ? value : "provider";
}

function buildFullName(firstName, lastName) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || null;
}

function normalizeListParams({ page, pageSize, q, role, isActive }) {
  const pageNum = Math.max(1, Number(page) || 1);
  const sizeNum = Math.min(100, Math.max(1, Number(pageSize) || 20));
  const search = String(q || "").trim();
  const roleFilter = role ? normalizeRole(role) : null;
  const activeFilter =
    isActive === true || isActive === "true"
      ? true
      : isActive === false || isActive === "false"
      ? false
      : null;
  return { page: pageNum, pageSize: sizeNum, search, roleFilter, activeFilter };
}

export async function listUsers(rawParams = {}) {
  const { page, pageSize, search, roleFilter, activeFilter } = normalizeListParams(rawParams);
  const offset = (page - 1) * pageSize;

  const whereClauses = [];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    whereClauses.push(
      `(email ilike $${idx} or first_name ilike $${idx} or last_name ilike $${idx} or full_name ilike $${idx})`
    );
  }
  if (roleFilter) {
    params.push(roleFilter);
    whereClauses.push(`role = $${params.length}`);
  }
  if (activeFilter !== null) {
    params.push(activeFilter);
    whereClauses.push(`is_active = $${params.length}`);
  }

  const whereSql = whereClauses.length ? `where ${whereClauses.join(" and ")}` : "";

  const countResult = await query(
    `select count(*)::int as total from public.users ${whereSql}`,
    params
  );
  const total = countResult.rows[0]?.total || 0;

  const listParams = [...params, pageSize, offset];
  const limitIdx = listParams.length - 1;
  const offsetIdx = listParams.length;

  const { rows } = await query(
    `select ${SELECT_COLUMNS}
       from public.users
       ${whereSql}
       order by created_at desc
       limit $${limitIdx} offset $${offsetIdx}`,
    listParams
  );

  return {
    data: rows,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

export async function getUserById(id) {
  const { rows } = await query(
    `select ${SELECT_COLUMNS} from public.users where id = $1 limit 1`,
    [id]
  );
  return rows[0] || null;
}

async function getUserByEmail(email) {
  const { rows } = await query(
    `select ${SELECT_COLUMNS} from public.users where email = $1 limit 1`,
    [email]
  );
  return rows[0] || null;
}

export async function createUser(payload) {
  ensureAdminClient();
  const email = String(payload?.email || "").trim().toLowerCase();
  const password = String(payload?.password || "");
  const firstName = String(payload?.first_name || "").trim();
  const lastName = String(payload?.last_name || "").trim();
  const role = normalizeRole(payload?.role);
  const isActive = payload?.is_active !== false;

  if (!email) {
    const err = new Error("email is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!password || password.length < 8) {
    const err = new Error("password is required and must be at least 8 characters.");
    err.statusCode = 400;
    throw err;
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    const err = new Error("A user with that email already exists.");
    err.statusCode = 409;
    throw err;
  }

  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName || null,
      last_name: lastName || null,
      full_name: buildFullName(firstName, lastName),
      role
    }
  });

  if (createError || !createData?.user?.id) {
    const err = new Error(createError?.message || "Unable to create Supabase auth user.");
    err.statusCode = 400;
    throw err;
  }

  const authUserId = createData.user.id;

  try {
    const { rows } = await query(
      `insert into public.users (
         auth_user_id, email, first_name, last_name, full_name, role, is_active
       ) values ($1, $2, $3, $4, $5, $6, $7)
       returning ${SELECT_COLUMNS}`,
      [
        authUserId,
        email,
        firstName || null,
        lastName || null,
        buildFullName(firstName, lastName),
        role,
        isActive
      ]
    );
    return rows[0];
  } catch (dbError) {
    await adminClient.auth.admin.deleteUser(authUserId).catch(() => {});
    throw dbError;
  }
}

export async function updateUser(id, payload) {
  ensureAdminClient();
  const current = await getUserById(id);
  if (!current) return null;

  const nextEmail = Object.prototype.hasOwnProperty.call(payload || {}, "email")
    ? String(payload.email || "").trim().toLowerCase()
    : current.email;
  if (!nextEmail) {
    const err = new Error("email cannot be empty.");
    err.statusCode = 400;
    throw err;
  }

  const nextFirstName = Object.prototype.hasOwnProperty.call(payload || {}, "first_name")
    ? (String(payload.first_name || "").trim() || null)
    : current.first_name;
  const nextLastName = Object.prototype.hasOwnProperty.call(payload || {}, "last_name")
    ? (String(payload.last_name || "").trim() || null)
    : current.last_name;
  const nextRole = Object.prototype.hasOwnProperty.call(payload || {}, "role")
    ? normalizeRole(payload.role)
    : current.role;
  const nextIsActive = Object.prototype.hasOwnProperty.call(payload || {}, "is_active")
    ? payload.is_active !== false
    : current.is_active;
  const nextFullName = buildFullName(nextFirstName, nextLastName);

  if (current.auth_user_id) {
    const updates = {};
    if (nextEmail !== current.email) updates.email = nextEmail;
    const metaChanged =
      nextFirstName !== current.first_name ||
      nextLastName !== current.last_name ||
      nextRole !== current.role ||
      nextFullName !== current.full_name;
    if (metaChanged) {
      updates.user_metadata = {
        first_name: nextFirstName,
        last_name: nextLastName,
        full_name: nextFullName,
        role: nextRole
      };
    }
    if (payload?.password) {
      if (String(payload.password).length < 8) {
        const err = new Error("password must be at least 8 characters.");
        err.statusCode = 400;
        throw err;
      }
      updates.password = String(payload.password);
    }
    if (Object.keys(updates).length > 0) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(
        current.auth_user_id,
        updates
      );
      if (authError) {
        const err = new Error(authError.message || "Unable to update Supabase auth user.");
        err.statusCode = 400;
        throw err;
      }
    }
  }

  const { rows } = await query(
    `update public.users
       set email = $2,
           first_name = $3,
           last_name = $4,
           full_name = $5,
           role = $6,
           is_active = $7,
           updated_at = now()
     where id = $1
     returning ${SELECT_COLUMNS}`,
    [id, nextEmail, nextFirstName, nextLastName, nextFullName, nextRole, nextIsActive]
  );
  return rows[0] || null;
}

export async function deleteUser(id) {
  ensureAdminClient();
  const current = await getUserById(id);
  if (!current) return false;

  if (current.auth_user_id) {
    const { error: authError } = await adminClient.auth.admin.deleteUser(current.auth_user_id);
    if (authError && !/not.*found|user.*not.*found/i.test(authError.message || "")) {
      const err = new Error(authError.message || "Unable to delete Supabase auth user.");
      err.statusCode = 400;
      throw err;
    }
  }

  const { rowCount } = await query(`delete from public.users where id = $1`, [id]);
  return rowCount > 0;
}

export { pool, ALLOWED_ROLES };
