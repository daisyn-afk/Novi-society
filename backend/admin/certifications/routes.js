import { Router } from "express";
import { pool, query } from "../db.js";
import { hasAdminOrStaffModuleAccess, requireAuth } from "../auth/helpers.js";
import { notifyProviderOfCourseCertificateIssuance } from "../certificationNotifications.js";
import { notifyAdminsOfCertificationSubmission } from "../adminNotifications.js";
import {
  getProviderIdAliases,
  isMedicalDirectorRole,
  mdHasActiveSupervisionOf,
} from "../mdSupervisedAccess.js";
import { sendEmailFromTemplate } from "../emails/renderTemplate.js";

export const certificationsRouter = Router();
certificationsRouter.use(requireAuth);

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

async function getProviderOwnershipAliases(me) {
  const authUserId = String(me?.id || "").trim();
  const authEmail = String(me?.email || "").trim().toLowerCase();
  const aliases = new Set();
  if (authUserId) aliases.add(authUserId);
  if (!authUserId && !authEmail) {
    return { authUserId, authEmail, aliases };
  }
  const { rows } = await query(
    `select id::text as app_user_id, auth_user_id::text as auth_user_id
     from public.users
     where ($1 <> '' and auth_user_id::text = $1)
        or ($2 <> '' and lower(email) = $2)
     limit 1`,
    [authUserId, authEmail]
  );
  const appUserId = String(rows?.[0]?.app_user_id || "").trim();
  const resolvedAuthUserId = String(rows?.[0]?.auth_user_id || "").trim();
  if (resolvedAuthUserId) aliases.add(resolvedAuthUserId);
  if (appUserId) aliases.add(appUserId);
  return { authUserId, authEmail, aliases };
}

async function normalizeProviderIdentity(providerId, providerEmail) {
  const id = String(providerId || "").trim();
  const email = String(providerEmail || "").trim().toLowerCase();
  if (!id && !email) {
    return { providerId: null, providerEmail: null };
  }
  const { rows } = await query(
    `select id::text as app_user_id, auth_user_id::text as auth_user_id, lower(email) as email
     from public.users
     where ($1 <> '' and (auth_user_id::text = $1 or id::text = $1))
        or ($2 <> '' and lower(email) = $2)
     order by case
       when $1 <> '' and auth_user_id::text = $1 then 0
       when $1 <> '' and id::text = $1 then 1
       else 2
     end
     limit 1`,
    [id, email]
  );
  const row = rows?.[0];
  if (!row) {
    return {
      providerId: id || null,
      providerEmail: email || providerEmail || null,
    };
  }
  return {
    providerId: row.auth_user_id || id || row.app_user_id || null,
    providerEmail: row.email || email || providerEmail || null,
  };
}

function providerOwnsCertification(row, ownership) {
  const ownerId = String(row?.provider_id || "").trim();
  const ownerEmail = String(row?.provider_email || "").trim().toLowerCase();
  const idMatch = ownerId && ownership.aliases.has(ownerId);
  const emailMatch = Boolean(ownership.authEmail && ownerEmail && ownerEmail === ownership.authEmail);
  return idMatch || emailMatch;
}

function toPermissionObject(rawPermissions) {
  if (rawPermissions && typeof rawPermissions === "object" && !Array.isArray(rawPermissions)) {
    return rawPermissions;
  }
  if (typeof rawPermissions === "string") {
    try {
      const parsed = JSON.parse(rawPermissions);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // ignore malformed legacy payloads
    }
  }
  return {};
}

function hasTruthyPermission(permissions, key) {
  const value = permissions?.[key];
  return value === true || value === "true" || value === 1 || value === "1";
}

async function resolveCanManageCertifications(me) {
  if (hasAdminOrStaffModuleAccess(me, "AdminLicenses")) return true;
  if (String(me?.role || "").trim().toLowerCase() !== "staff") return false;
  const authUserId = String(me?.id || "").trim();
  if (!authUserId) return false;
  try {
    const { rows } = await query(
      `select permissions
       from public.users
       where auth_user_id = $1
       limit 1`,
      [authUserId]
    );
    const permissions = toPermissionObject(rows?.[0]?.permissions);
    return hasTruthyPermission(permissions, "AdminLicenses");
  } catch {
    return false;
  }
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
        `alter table public.certification add column if not exists attachment_url text`,
        `alter table public.certification add column if not exists issuer_signature_url text`,
        `alter table public.certification add column if not exists rejection_reason text`
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

function resolveProviderFirstName({ providerName, providerEmail }) {
  const fromName = String(providerName || "").trim();
  if (fromName) return fromName.split(/\s+/)[0];
  const email = String(providerEmail || "").trim();
  if (email.includes("@")) return email.split("@")[0];
  return "Provider";
}

function resolveCertificationDocumentUrl(cert) {
  const directUrl = String(cert?.certificate_url || "").trim();
  if (directUrl && directUrl !== "/N/A" && directUrl.toUpperCase() !== "N/A") return directUrl;
  const fallbackFields = [
    cert?.certification_url,
    cert?.certification_file_url,
    cert?.document_url,
    cert?.file_url,
    cert?.attachment_url,
  ];
  for (const value of fallbackFields) {
    const url = String(value || "").trim();
    if (url && url !== "/N/A" && url.toUpperCase() !== "N/A") return url;
  }
  return null;
}

async function sendCertificationRejectedEmail({
  providerEmail,
  providerFirstName,
  certificationName,
  serviceTypeName,
  rejectionReason
}) {
  if (!providerEmail) return false;
  const result = await sendEmailFromTemplate("certification_rejected", {
    to: providerEmail,
    first_name: providerFirstName || "Provider",
    certification_name: certificationName || "certification",
    service_name: serviceTypeName || "this service",
    rejection_reason: rejectionReason || "No reason provided.",
    rejection_title: "Reason for rejection",
    details: [
      { label: "Certification", value: certificationName || "—" },
      { label: "Service", value: serviceTypeName || "—" },
    ],
  });
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error("[certifications] rejection email send failed:", result.error);
    return false;
  }
  return true;
}

async function sendCertificationApprovedEmail({
  providerEmail,
  providerFirstName,
  certificationName,
  serviceTypeName,
  certificateNumber
}) {
  if (!providerEmail) return false;
  const result = await sendEmailFromTemplate("certification_approved", {
    to: providerEmail,
    first_name: providerFirstName || "Provider",
    certification_name: certificationName || "certification",
    service_name: serviceTypeName || "this service",
    certificate_number: certificateNumber || "N/A",
    details: [
      { label: "Certification", value: certificationName || "—" },
      { label: "Service", value: serviceTypeName || "—" },
      { label: "Certificate #", value: certificateNumber || "N/A" },
    ],
  });
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error("[certifications] approval email send failed:", result.error);
    return false;
  }
  return true;
}

async function resolveNotificationRecipient({ providerId, providerEmail }) {
  const id = String(providerId || "").trim();
  const email = String(providerEmail || "").trim().toLowerCase();
  if (!id && !email) return { userId: null, userEmail: null };
  try {
    const { rows } = await query(
      `select auth_user_id, email
       from public.users
       where ($1::text <> '' and (auth_user_id::text = $1 or id::text = $1))
          or ($2::text <> '' and lower(email) = $2)
       order by updated_at desc nulls last
       limit 1`,
      [id, email]
    );
    const row = rows?.[0] || null;
    return {
      userId: String(row?.auth_user_id || id || "").trim() || null,
      userEmail: String(row?.email || email || "").trim().toLowerCase() || null
    };
  } catch {
    return {
      userId: id || null,
      userEmail: email || null
    };
  }
}

let notificationTablePromise = null;
let notificationColumnsByTablePromise = null;

async function getNotificationTableName() {
  if (!notificationTablePromise) {
    notificationTablePromise = query(
      `select table_name
       from information_schema.tables
       where table_schema = 'public'
         and table_name in ('notification', 'notifications')
       order by case when table_name = 'notification' then 0 else 1 end
       limit 1`
    ).then((r) => r.rows?.[0]?.table_name || null)
      .catch(() => null);
  }
  return notificationTablePromise;
}

async function getNotificationTableColumnsByName() {
  if (!notificationColumnsByTablePromise) {
    notificationColumnsByTablePromise = (async () => {
      const tableName = await getNotificationTableName();
      if (!tableName) return { tableName: null, columns: new Set() };
      const result = await query(
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

async function createCertificationRejectedNotification({
  providerId,
  providerEmail,
  certificationName,
  serviceTypeId,
  serviceTypeName
}) {
  const { tableName, columns } = await getNotificationTableColumnsByName();
  if (!tableName || !columns || columns.size === 0) return false;
  const recipient = await resolveNotificationRecipient({ providerId, providerEmail });
  const valuesByColumn = {
    user_id: recipient.userId || null,
    user_email: recipient.userEmail || null,
    type: "cert_rejected",
    message: `Your ${certificationName || "certification"} was not approved. Please review and resubmit to continue with ${serviceTypeName || "MD coverage"}.`,
    link_page: `ProviderCredentialsCoverage${serviceTypeId ? `?prompt_service=${encodeURIComponent(serviceTypeId)}` : ""}`
  };
  const insertColumns = Object.keys(valuesByColumn).filter((col) => columns.has(col));
  if (insertColumns.length === 0) return false;
  const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(", ");
  const params = insertColumns.map((col) => valuesByColumn[col]);
  try {
    await query(
      `insert into public.${tableName} (${insertColumns.join(", ")})
       values (${placeholders})`,
      params
    );
    return true;
  } catch {
    return false;
  }
}

async function createCertificationApprovedNotification({
  providerId,
  providerEmail,
  certificationName,
  serviceTypeId
}) {
  const { tableName, columns } = await getNotificationTableColumnsByName();
  if (!tableName || !columns || columns.size === 0) return false;
  const recipient = await resolveNotificationRecipient({ providerId, providerEmail });
  const name = String(certificationName || "").trim();
  const message = name
    ? `Your ${name} certification has been approved!`
    : "Your certification has been approved!";
  const valuesByColumn = {
    user_id: recipient.userId || null,
    user_email: recipient.userEmail || null,
    type: "cert_awarded",
    message,
    link_page: `ProviderCredentialsCoverage${serviceTypeId ? `?prompt_service=${encodeURIComponent(serviceTypeId)}` : ""}`
  };
  const insertColumns = Object.keys(valuesByColumn).filter((col) => columns.has(col));
  if (insertColumns.length === 0) return false;
  const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(", ");
  const params = insertColumns.map((col) => valuesByColumn[col]);
  try {
    await query(
      `insert into public.${tableName} (${insertColumns.join(", ")})
       values (${placeholders})`,
      params
    );
    return true;
  } catch {
    return false;
  }
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

function isComplianceCertification(body) {
  const category = String(body?.category || "").trim().toLowerCase();
  if (category === "compliance") return true;
  const label = `${body?.certification_name || body?.cert_name || ""} ${body?.issued_by || ""}`;
  return /cpr|bls|basic life support/i.test(label);
}

function isAdminIssuedCourseCertification(body, canSetAnyProvider) {
  if (!canSetAnyProvider) return false;
  return Boolean(String(body?.enrollment_id || "").trim() || String(body?.course_id || "").trim());
}

certificationsRouter.get("/", async (req, res, next) => {
  try {
    const me = req.me || {};
    const canManageCertifications = await resolveCanManageCertifications(me);
    const columns = await getCertificationColumns();
    const where = [];
    const params = [];
    const certAlias = "c";
    const hasProviderId = columns.has("provider_id");
    const hasProviderEmail = columns.has("provider_email");
    const hasCreatedBy = columns.has("created_by");
    const providerIdFilter = String(req.query?.provider_id || "").trim();
    const statusFilter = String(req.query?.status || "").trim().toLowerCase();

    if (!canManageCertifications) {
      if (isMedicalDirectorRole(me.role) && providerIdFilter) {
        const allowed = await mdHasActiveSupervisionOf(me, providerIdFilter);
        if (!allowed) {
          return res.status(403).json({ error: "Forbidden." });
        }
        const { aliases, email } = await getProviderIdAliases(providerIdFilter);
        const supervisedChecks = [];
        if (hasProviderId && aliases.length) {
          params.push(aliases);
          supervisedChecks.push(`${certAlias}.provider_id::text = any($${params.length}::text[])`);
        }
        if (hasProviderEmail && email) {
          params.push(email);
          supervisedChecks.push(`lower(coalesce(${certAlias}.provider_email, '')) = $${params.length}`);
        }
        if (supervisedChecks.length) {
          where.push(`(${supervisedChecks.join(" or ")})`);
        } else {
          where.push("false");
        }
      } else if (isMedicalDirectorRole(me.role) && !providerIdFilter) {
        const { rows: rels } = await query(
          `select provider_id from public.medical_director_relationship
           where medical_director_id = $1 and lower(coalesce(status, '')) = 'active'`,
          [me.id]
        );
        const supervisedIds = [...new Set((rels || []).map((r) => String(r.provider_id || "").trim()).filter(Boolean))];
        if (!supervisedIds.length) {
          return res.json([]);
        }
        if (hasProviderId) {
          params.push(supervisedIds);
          where.push(`${certAlias}.provider_id::text = any($${params.length}::text[])`);
        }
      } else {
        const ownership = await getProviderOwnershipAliases(me);
        const ownershipChecks = [];
        if (hasProviderId && ownership.aliases.size > 0) {
          params.push(Array.from(ownership.aliases));
          ownershipChecks.push(`${certAlias}.provider_id::text = any($${params.length}::text[])`);
        }
        if (hasProviderEmail && ownership.authEmail) {
          params.push(ownership.authEmail);
          ownershipChecks.push(`lower(coalesce(${certAlias}.provider_email, '')) = $${params.length}`);
        }
        if (ownershipChecks.length > 0) {
          where.push(`(${ownershipChecks.join(" or ")})`);
        }
      }
    } else if (providerIdFilter && hasProviderId) {
      const { aliases } = await getProviderIdAliases(providerIdFilter);
      params.push(aliases.length ? aliases : [providerIdFilter]);
      where.push(`${certAlias}.provider_id::text = any($${params.length}::text[])`);
    }

    if (statusFilter) {
      params.push(statusFilter);
      where.push(`lower(coalesce(${certAlias}.status, '')) = $${params.length}`);
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
    const me = req.me || {};
    const body = req.body || {};
    const columns = await getCertificationColumns();
    const canSetAnyProvider = hasAdminOrStaffModuleAccess(me, "AdminLicenses");
    const adminIssuedCourseCertification = isAdminIssuedCourseCertification(body, canSetAnyProvider);
    const complianceCertification = isComplianceCertification(body);
    let resolvedTemplateCourseId = body.template_course_id || null;
    if (columns.has("template_course_id") && !resolvedTemplateCourseId) {
      resolvedTemplateCourseId = await resolveTemplateCourseIdForServiceType(body.service_type_id);
    }
    if (
      columns.has("template_course_id") &&
      !resolvedTemplateCourseId &&
      !adminIssuedCourseCertification &&
      !complianceCertification
    ) {
      const err = new Error("No linked template course found for this service type. Ask admin to link the service type to a template course.");
      err.statusCode = 400;
      throw err;
    }
    const submitterName = resolveNameFromUser(me);
    const submitterEmail = String(me?.email || "").trim() || null;
    const submitterId = String(me?.id || "").trim() || null;
    const notesWithSubmitter = appendSubmitterAuditNote(body.notes, me);
    let resolvedProviderId = canSetAnyProvider ? (body.provider_id || null) : (me.id || null);
    let resolvedProviderEmail = canSetAnyProvider ? (body.provider_email || null) : (me.email || null);
    if (canSetAnyProvider && (resolvedProviderId || resolvedProviderEmail)) {
      const normalized = await normalizeProviderIdentity(resolvedProviderId, resolvedProviderEmail);
      resolvedProviderId = normalized.providerId || resolvedProviderId;
      resolvedProviderEmail = normalized.providerEmail || resolvedProviderEmail;
    }
    const valuesByColumn = {
      template_course_id: resolvedTemplateCourseId,
      provider_id: resolvedProviderId,
      provider_email: resolvedProviderEmail,
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
      issuer_signature_url: body.issuer_signature_url || null,
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
    if (!canSetAnyProvider) {
      void notifyAdminsOfCertificationSubmission({
        providerName: created?.provider_name || valuesByColumn.provider_name,
        providerEmail: created?.provider_email || valuesByColumn.provider_email,
        certificationName: created?.certification_name || created?.cert_name || valuesByColumn.certification_name || valuesByColumn.cert_name,
        serviceTypeName: created?.service_type_name || valuesByColumn.service_type_name,
        certificationId: created?.id
      });
    } else if (String(created?.status || valuesByColumn.status || "").toLowerCase() === "active") {
      const issuedCourseCert = Boolean(created?.enrollment_id || valuesByColumn.enrollment_id);
      const hasCertificateDocument = Boolean(resolveCertificationDocumentUrl(created));
      if (issuedCourseCert && hasCertificateDocument) {
        void notifyProviderOfCourseCertificateIssuance({
          ...valuesByColumn,
          ...created,
          provider_name: created?.provider_name || valuesByColumn.provider_name,
          provider_email: created?.provider_email || valuesByColumn.provider_email,
          certification_name: created?.certification_name || created?.cert_name || valuesByColumn.certification_name || valuesByColumn.cert_name,
          certificate_number: created?.certificate_number || valuesByColumn.certificate_number,
        });
      } else if (!issuedCourseCert) {
        void createCertificationApprovedNotification({
          providerId: created?.provider_id || valuesByColumn.provider_id,
          providerEmail: created?.provider_email || valuesByColumn.provider_email,
          certificationName: created?.certification_name || created?.cert_name || valuesByColumn.certification_name || valuesByColumn.cert_name,
          serviceTypeId: created?.service_type_id || valuesByColumn.service_type_id || ""
        });
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
    const me = req.me || {};
    const canManageCertifications = await resolveCanManageCertifications(me);
    const id = String(req.params.id || "").trim();
    const { rows } = await query(`select * from public.certification where id = $1 limit 1`, [id]);
    const row = rows[0];
    if (!row) {
      const err = new Error("Certification not found.");
      err.statusCode = 404;
      throw err;
    }
    if (!canManageCertifications) {
      const ownership = await getProviderOwnershipAliases(me);
      if (!providerOwnsCertification(row, ownership)) {
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
    const me = req.me || {};
    const canManageCertifications = await resolveCanManageCertifications(me);
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
    if (!canManageCertifications) {
      const ownership = await getProviderOwnershipAliases(me);
      if (!providerOwnsCertification(existing, ownership)) {
        const err = new Error("Forbidden.");
        err.statusCode = 403;
        throw err;
      }
    }

    const updates = { ...(req.body || {}) };
    if (canManageCertifications) {
      const prevStatus = String(existing?.status || "").toLowerCase();
      const nextStatusRaw = updates.status != null ? updates.status : existing?.status;
      const nextStatus = String(nextStatusRaw || "").toLowerCase();
      const turningActive = nextStatus === "active" && prevStatus !== "active";
      const turningRevoked = nextStatus === "revoked" && prevStatus !== "revoked";
      if (turningRevoked) {
        const reason = String(updates.rejection_reason ?? "").trim();
        if (!reason) {
          const err = new Error("rejection_reason is required when rejecting a certification.");
          err.statusCode = 400;
          throw err;
        }
      }
      if (turningActive) {
        const hasEnrollment = Boolean(String(existing?.enrollment_id || updates.enrollment_id || "").trim());
        if (columns.has("issued_at") && !String(updates.issued_at || "").trim()) {
          updates.issued_at = new Date().toISOString();
        }
        if (columns.has("certificate_number")) {
          const fromBody = String(updates.certificate_number ?? "").trim();
          const existingNum = String(existing?.certificate_number ?? "").trim();
          if (fromBody) {
            updates.certificate_number = fromBody;
          } else if (existingNum) {
            updates.certificate_number = existingNum;
          } else {
            updates.certificate_number = hasEnrollment ? `NOVI-${Date.now()}` : `NOVI-EXT-${Date.now()}`;
          }
        }
      }
    }

    const allowed = Object.keys(updates).filter((key) => columns.has(String(key || "").toLowerCase()));
    if (allowed.length === 0) return res.json(existing);
    const setClause = allowed.map((col, idx) => `${col} = $${idx + 2}`).join(", ");
    const values = [id, ...allowed.map((col) => updates[col])];
    const { rows } = await query(`update public.certification set ${setClause} where id = $1 returning *`, values);
    const updated = rows[0] || existing;
    const issuedCourseCert = Boolean(String(existing?.enrollment_id || updated?.enrollment_id || "").trim());
    const hadCertificateDocument = Boolean(resolveCertificationDocumentUrl(existing));
    const hasCertificateDocument = Boolean(resolveCertificationDocumentUrl(updated));
    const courseCertificateDocumentAdded = issuedCourseCert && !hadCertificateDocument && hasCertificateDocument;
    if (canManageCertifications && courseCertificateDocumentAdded) {
      void notifyProviderOfCourseCertificateIssuance(updated);
    }
    const changedStatus = canManageCertifications && String(existing?.status || "") !== String(updated?.status || "");
    const isApproved = String(updated?.status || "").toLowerCase() === "active";
    const isRejected = String(updated?.status || "").toLowerCase() === "revoked";
    const wasPending = String(existing?.status || "").toLowerCase() === "pending";
    const isExternalSubmission = Boolean(
      updated?.certificate_url ||
      updated?.certification_url ||
      updated?.certification_file_url ||
      updated?.document_url ||
      updated?.file_url ||
      updated?.attachment_url ||
      updated?.service_type_id ||
      updated?.issued_by
    );
    const notifyProviderCertDecision = changedStatus && (isExternalSubmission || wasPending) && (isApproved || isRejected);
    if (notifyProviderCertDecision) {
      const providerId = String(
        updated?.provider_id || updated?.user_id || updated?.created_by || ""
      ).trim() || null;
      const providerEmail = String(
        updated?.provider_email || updated?.user_email || updated?.submitted_by_email || updated?.created_by_email || ""
      ).trim().toLowerCase() || null;
      const providerName = String(
        updated?.provider_name || updated?.user_name || updated?.submitted_by_name || ""
      ).trim() || null;
      if ((providerId || providerEmail) && isRejected) {
        await createCertificationRejectedNotification({
          providerId,
          providerEmail,
          certificationName: updated?.certification_name || updated?.cert_name || "certification",
          serviceTypeId: updated?.service_type_id || "",
          serviceTypeName: updated?.service_type_name || ""
        });
      }
      if ((providerId || providerEmail) && isApproved) {
        await createCertificationApprovedNotification({
          providerId,
          providerEmail,
          certificationName: updated?.certification_name || updated?.cert_name || "certification",
          serviceTypeId: updated?.service_type_id || ""
        });
      }
      if (providerEmail && isRejected) {
        void sendCertificationRejectedEmail({
          providerEmail,
          providerFirstName: resolveProviderFirstName({ providerName, providerEmail }),
          certificationName: updated?.certification_name || updated?.cert_name || "certification",
          serviceTypeName: updated?.service_type_name || "",
          rejectionReason: updated?.rejection_reason || ""
        });
      }
      if (providerEmail && isApproved) {
        void sendCertificationApprovedEmail({
          providerEmail,
          providerFirstName: resolveProviderFirstName({ providerName, providerEmail }),
          certificationName: updated?.certification_name || updated?.cert_name || "certification",
          serviceTypeName: updated?.service_type_name || "",
          certificateNumber: updated?.certificate_number || ""
        });
      }
    }
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

