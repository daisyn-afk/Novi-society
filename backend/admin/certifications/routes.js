import { Router } from "express";
import { pool, query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";

export const certificationsRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function hasAdminAccess(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "super_admin" || normalized === "owner";
}

function resolveNameFromUser(user) {
  const full = String(user?.full_name || "").trim();
  if (full) return full;
  const joined = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  return String(user?.email || "").trim() || null;
}

function appendSubmitterAuditNote(existingNotes, me) {
  const parts = [];
  const name = resolveNameFromUser(me) || "";
  const email = String(me?.email || "").trim();
  const id = String(me?.id || "").trim();
  parts.push(String(existingNotes || "").trim());
  if (name || email || id) {
    parts.push(
      `[submitter] name=${name || "n/a"}; email=${email || "n/a"}; id=${id || "n/a"}`
    );
  }
  return parts.filter(Boolean).join("\n");
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

let certColumnsPromise = null;
let ensureCertColumnsPromise = null;
async function ensureCertificationWriteColumns() {
  if (!ensureCertColumnsPromise) {
    ensureCertColumnsPromise = (async () => {
      const ddl = [
        `alter table public.certification add column if not exists provider_id text`,
        `alter table public.certification add column if not exists provider_email text`,
        `alter table public.certification add column if not exists provider_name text`,
        `alter table public.certification add column if not exists issued_by text`,
        `alter table public.certification add column if not exists service_type_id text`,
        `alter table public.certification add column if not exists service_type_name text`,
        `alter table public.certification add column if not exists certificate_url text`,
        `alter table public.certification add column if not exists notes text`,
        `alter table public.certification add column if not exists created_by text`,
        `alter table public.certification add column if not exists created_by_email text`,
        `alter table public.certification add column if not exists submitted_by_name text`,
        `alter table public.certification add column if not exists submitted_by_email text`,
        `alter table public.certification add column if not exists user_id text`,
        `alter table public.certification add column if not exists user_email text`,
        `alter table public.certification add column if not exists user_name text`,
        `alter table public.certification add column if not exists certification_url text`,
        `alter table public.certification add column if not exists certification_file_url text`,
        `alter table public.certification add column if not exists document_url text`,
        `alter table public.certification add column if not exists file_url text`,
        `alter table public.certification add column if not exists attachment_url text`
      ];
      for (const statement of ddl) {
        await query(statement);
      }
      certColumnsPromise = null;
    })();
  }
  return ensureCertColumnsPromise;
}
async function getCertificationColumns() {
  await ensureCertificationWriteColumns();
  if (!certColumnsPromise) {
    certColumnsPromise = query(
      `select column_name
       from information_schema.columns
       where table_schema = 'public' and table_name = 'certification'`
    ).then((r) => new Set((r.rows || []).map((row) => String(row.column_name || "").toLowerCase())));
  }
  return certColumnsPromise;
}

async function resolveTemplateCourseIdForServiceType(serviceTypeId) {
  const id = String(serviceTypeId || "").trim();
  if (!id) return null;
  const { rows } = await query(
    `select id
     from public.template_courses
     where linked_service_type_ids @> array[$1]::text[]
     order by is_active desc, updated_at desc nulls last, created_at desc nulls last
     limit 1`,
    [id]
  );
  return rows?.[0]?.id || null;
}

certificationsRouter.get("/", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const columns = await getCertificationColumns();
    const where = [];
    const params = [];
    const certAlias = "c";
    const hasProviderId = columns.has("provider_id");
    const hasProviderEmail = columns.has("provider_email");
    const hasCreatedBy = columns.has("created_by");

    if (!hasAdminAccess(me.role)) {
      const ownershipChecks = [];
      if (hasProviderId) {
        params.push(String(me.id || ""));
        ownershipChecks.push(`${certAlias}.provider_id::text = $${params.length}`);
      }
      if (hasProviderEmail) {
        params.push(String(me.email || "").toLowerCase());
        ownershipChecks.push(`lower(coalesce(${certAlias}.provider_email, '')) = $${params.length}`);
      }
      if (ownershipChecks.length > 0) {
        where.push(`(${ownershipChecks.join(" or ")})`);
      }
    }

    const hasProviderName = columns.has("provider_name");
    const hasSubmittedByName = columns.has("submitted_by_name");
    const hasUserName = columns.has("user_name");
    const hasSubmittedByEmail = columns.has("submitted_by_email");
    const hasUserEmail = columns.has("user_email");
    const providerNameExpr = hasProviderName ? `${certAlias}.provider_name` : "null";
    const providerEmailExpr = hasProviderEmail ? `${certAlias}.provider_email` : "null";
    const submittedByNameExpr = hasSubmittedByName ? `${certAlias}.submitted_by_name` : "null";
    const userNameExpr = hasUserName ? `${certAlias}.user_name` : "null";
    const submittedByEmailExpr = hasSubmittedByEmail ? `${certAlias}.submitted_by_email` : "null";
    const userEmailExpr = hasUserEmail ? `${certAlias}.user_email` : "null";
    const createdByExpr = hasCreatedBy ? `${certAlias}.created_by` : "null";

    const orderBy = columns.has("created_at")
      ? `${certAlias}.created_at desc nulls last`
      : (columns.has("issued_at") ? `${certAlias}.issued_at desc nulls last` : `${certAlias}.id desc`);
    const sql = `select
        ${certAlias}.*,
        coalesce(
          nullif(trim(${providerNameExpr}), ''),
          nullif(trim(${submittedByNameExpr}), ''),
          nullif(trim(${userNameExpr}), ''),
          nullif(trim(u_id.full_name), ''),
          nullif(trim(concat_ws(' ', u_id.first_name, u_id.last_name)), ''),
          nullif(trim(u_email.full_name), ''),
          nullif(trim(concat_ws(' ', u_email.first_name, u_email.last_name)), ''),
          nullif(trim(u_created.full_name), ''),
          nullif(trim(concat_ws(' ', u_created.first_name, u_created.last_name)), '')
        ) as provider_name_resolved,
        coalesce(
          nullif(trim(${providerEmailExpr}), ''),
          nullif(trim(${submittedByEmailExpr}), ''),
          nullif(trim(${userEmailExpr}), ''),
          nullif(trim(u_id.email), ''),
          nullif(trim(u_email.email), ''),
          nullif(trim(u_created.email), '')
        ) as provider_email_resolved
      from public.certification ${certAlias}
      left join public.users u_id
        on ${hasProviderId ? `(${certAlias}.provider_id is not null and (u_id.auth_user_id::text = ${certAlias}.provider_id::text or u_id.id::text = ${certAlias}.provider_id::text))` : "false"}
      left join public.users u_email
        on ${hasProviderEmail ? `(${certAlias}.provider_email is not null and nullif(trim(${certAlias}.provider_email), '') is not null and lower(trim(u_email.email)) = lower(trim(${certAlias}.provider_email)))` : "false"}
      left join public.users u_created
        on ${hasCreatedBy ? `(${createdByExpr} is not null and (u_created.auth_user_id::text = ${createdByExpr}::text or u_created.id::text = ${createdByExpr}::text or lower(u_created.email) = lower(${createdByExpr}::text)))` : "false"}
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by ${orderBy}`;
    const { rows } = await query(sql, params);
    const normalized = (rows || []).map((row) => ({
      ...row,
      provider_name: row?.provider_name_resolved || row?.provider_name || null,
      provider_email: row?.provider_email_resolved || row?.provider_email || null,
      certification_name: row?.certification_name || row?.cert_name || null,
      cert_name: row?.cert_name || row?.certification_name || null,
      status: row?.status || "pending"
    }));
    return res.json(normalized);
  } catch (error) {
    return next(error);
  }
});

certificationsRouter.post("/", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const body = req.body || {};
    const columns = await getCertificationColumns();
    const canSetAnyProvider = hasAdminAccess(me.role);
    let resolvedTemplateCourseId = body.template_course_id || null;
    if (columns.has("template_course_id") && !resolvedTemplateCourseId) {
      resolvedTemplateCourseId = await resolveTemplateCourseIdForServiceType(body.service_type_id);
    }
    if (columns.has("template_course_id") && !resolvedTemplateCourseId) {
      const err = new Error("No linked template course found for this service type. Ask admin to link the service type to a template course.");
      err.statusCode = 400;
      throw err;
    }
    const submitterName = resolveNameFromUser(me);
    const submitterEmail = String(me?.email || "").trim() || null;
    const submitterId = String(me?.id || "").trim() || null;
    const notesWithSubmitter = appendSubmitterAuditNote(body.notes, me);
    const valuesByColumn = {
      template_course_id: resolvedTemplateCourseId,
      provider_id: canSetAnyProvider ? (body.provider_id || null) : (me.id || null),
      provider_email: canSetAnyProvider ? (body.provider_email || null) : (me.email || null),
      provider_name: canSetAnyProvider ? (body.provider_name || null) : (resolveNameFromUser(me) || null),
      user_id: canSetAnyProvider ? (body.user_id || body.provider_id || null) : submitterId,
      user_email: canSetAnyProvider ? (body.user_email || body.provider_email || null) : submitterEmail,
      user_name: canSetAnyProvider ? (body.user_name || body.provider_name || null) : submitterName,
      submitted_by_name: canSetAnyProvider ? (body.submitted_by_name || null) : submitterName,
      submitted_by_email: canSetAnyProvider ? (body.submitted_by_email || null) : submitterEmail,
      created_by: canSetAnyProvider ? (body.created_by || null) : (submitterId || submitterEmail),
      created_by_email: canSetAnyProvider ? (body.created_by_email || null) : submitterEmail,
      course_id: body.course_id || null,
      enrollment_id: body.enrollment_id || null,
      certification_name: body.certification_name || null,
      cert_name: body.cert_name || body.certification_name || null,
      issued_by: body.issued_by || null,
      issued_by_email: body.issued_by_email || null,
      category: body.category || null,
      issued_at: body.issued_at || null,
      expires_at: body.expires_at || null,
      certificate_number: body.certificate_number || null,
      status: body.status || "pending",
      service_type_id: body.service_type_id || null,
      service_type_name: body.service_type_name || null,
      certificate_url: body.certificate_url || null,
      certification_url: body.certification_url || body.certificate_url || null,
      certification_file_url: body.certification_file_url || body.certificate_url || null,
      document_url: body.document_url || body.certificate_url || null,
      file_url: body.file_url || body.certificate_url || null,
      attachment_url: body.attachment_url || body.certificate_url || null,
      notes: notesWithSubmitter || null
    };

    const insertColumns = Object.keys(valuesByColumn).filter((col) => columns.has(col));
    if (insertColumns.length === 0) {
      const err = new Error("Certification table schema does not support this payload.");
      err.statusCode = 400;
      throw err;
    }
    const insertValues = insertColumns.map((col) => valuesByColumn[col]);
    const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(", ");
    const { rows } = await query(
      `insert into public.certification (${insertColumns.join(", ")}) values (${placeholders}) returning *`,
      insertValues
    );
    const created = rows[0] || {};
    const forcedFieldValues = {
      provider_id: valuesByColumn.provider_id,
      provider_email: valuesByColumn.provider_email,
      provider_name: valuesByColumn.provider_name,
      issued_by: valuesByColumn.issued_by,
      service_type_id: valuesByColumn.service_type_id,
      service_type_name: valuesByColumn.service_type_name,
      certificate_url: valuesByColumn.certificate_url,
      notes: valuesByColumn.notes,
      created_by: valuesByColumn.created_by,
      created_by_email: valuesByColumn.created_by_email,
      submitted_by_name: valuesByColumn.submitted_by_name,
      submitted_by_email: valuesByColumn.submitted_by_email,
      user_id: valuesByColumn.user_id,
      user_email: valuesByColumn.user_email,
      user_name: valuesByColumn.user_name,
      certification_url: valuesByColumn.certification_url,
      certification_file_url: valuesByColumn.certification_file_url,
      document_url: valuesByColumn.document_url,
      file_url: valuesByColumn.file_url,
      attachment_url: valuesByColumn.attachment_url
    };
    const missingCritical =
      !String(created?.provider_id || "").trim() ||
      !String(created?.provider_email || "").trim() ||
      !String(created?.provider_name || "").trim() ||
      !String(created?.service_type_name || "").trim() ||
      !String(created?.certificate_url || "").trim();
    if (created?.id && missingCritical) {
      const updatableColumns = Object.keys(forcedFieldValues).filter((col) => columns.has(col));
      if (updatableColumns.length > 0) {
        const setClause = updatableColumns.map((col, idx) => `${col} = $${idx + 2}`).join(", ");
        const values = [created.id, ...updatableColumns.map((col) => forcedFieldValues[col])];
        await query(`update public.certification set ${setClause} where id = $1`, values);
      }
    }
    return res.status(201).json({
      ...created,
      certification_name: created?.certification_name || created?.cert_name || null,
      cert_name: created?.cert_name || created?.certification_name || null,
      status: created?.status || "pending"
    });
  } catch (error) {
    return next(error);
  }
});

certificationsRouter.get("/:id", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const id = String(req.params.id || "").trim();
    const { rows } = await query(`select * from public.certification where id = $1 limit 1`, [id]);
    const row = rows[0];
    if (!row) {
      const err = new Error("Certification not found.");
      err.statusCode = 404;
      throw err;
    }
    if (!hasAdminAccess(me.role)) {
      const meId = String(me.id || "");
      const meEmail = String(me.email || "").toLowerCase();
      const ownerId = String(row.provider_id || "");
      const ownerEmail = String(row.provider_email || "").toLowerCase();
      if (!(ownerId && ownerId === meId) && !(ownerEmail && ownerEmail === meEmail)) {
        const err = new Error("Forbidden.");
        err.statusCode = 403;
        throw err;
      }
    }
    return res.json(row);
  } catch (error) {
    return next(error);
  }
});

certificationsRouter.patch("/:id", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const id = String(req.params.id || "").trim();
    if (!id) {
      const err = new Error("Certification id is required.");
      err.statusCode = 400;
      throw err;
    }
    const columns = await getCertificationColumns();
    const { rows: existingRows } = await query(`select * from public.certification where id = $1 limit 1`, [id]);
    const existing = existingRows[0];
    if (!existing) {
      const err = new Error("Certification not found.");
      err.statusCode = 404;
      throw err;
    }
    if (!hasAdminAccess(me.role)) {
      const meId = String(me.id || "");
      const meEmail = String(me.email || "").toLowerCase();
      const ownerId = String(existing.provider_id || "");
      const ownerEmail = String(existing.provider_email || "").toLowerCase();
      if (!(ownerId && ownerId === meId) && !(ownerEmail && ownerEmail === meEmail)) {
        const err = new Error("Forbidden.");
        err.statusCode = 403;
        throw err;
      }
    }

    const updates = req.body || {};
    const allowed = Object.keys(updates).filter((key) => columns.has(String(key || "").toLowerCase()));
    if (allowed.length === 0) return res.json(existing);
    const setClause = allowed.map((col, idx) => `${col} = $${idx + 2}`).join(", ");
    const values = [id, ...allowed.map((col) => updates[col])];
    const { rows } = await query(`update public.certification set ${setClause} where id = $1 returning *`, values);
    return res.json(rows[0] || existing);
  } catch (error) {
    return next(error);
  }
});

