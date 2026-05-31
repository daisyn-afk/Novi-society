import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../db.js";
import { hasAdminOrStaffModuleAccess, requireAuth } from "../auth/helpers.js";
import { notifyAdminsOfLicenseSubmission } from "../adminNotifications.js";
import { getProviderIdAliases } from "../mdSupervisedAccess.js";
import { sendEmailFromTemplate } from "../emails/renderTemplate.js";

export const licensesRouter = Router();
licensesRouter.use(requireAuth);
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

function isMedicalDirectorRole(role) {
  return String(role || "").trim().toLowerCase() === "medical_director";
}

function pickNameFromMetadata(meta = {}) {
  const first = String(meta.first_name || meta.given_name || meta.firstName || "").trim();
  const last = String(meta.last_name || meta.family_name || meta.lastName || "").trim();
  const full = String(meta.full_name || meta.name || "").trim();
  if (full) return full;
  return [first, last].filter(Boolean).join(" ").trim() || null;
}

async function resolveNameFromAuthByUserId(userId) {
  if (!supabaseAdmin || !userId) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(String(userId));
    if (error || !data?.user) return null;
    const user = data.user;
    const sources = [];
    if (user.user_metadata && typeof user.user_metadata === "object") sources.push(user.user_metadata);
    if (user.app_metadata && typeof user.app_metadata === "object") sources.push(user.app_metadata);
    if (Array.isArray(user.identities)) {
      for (const identity of user.identities) {
        if (identity?.identity_data && typeof identity.identity_data === "object") {
          sources.push(identity.identity_data);
        }
      }
    }
    for (const source of sources) {
      const candidate = pickNameFromMetadata(source);
      if (candidate) return candidate;
    }
    return null;
  } catch {
    return null;
  }
}

function mapLicenseRow(row) {
  const resolvedProviderEmail =
    String(row.provider_email_resolved || row.provider_email || "").trim() || null;
  const resolvedProviderName =
    String(row.provider_name || "").trim() || null;
  return {
    ...row,
    provider_email: resolvedProviderEmail,
    provider_name: resolvedProviderName,
    created_date: row.created_at,
    updated_date: row.updated_at
  };
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

async function resolveCanManageLicenses(me) {
  if (hasAdminOrStaffModuleAccess(me, "AdminLicenses")) return true;
  if (String(me?.role || "").trim().toLowerCase() !== "staff") return false;
  const authUserId = String(me?.id || "").trim();
  if (!authUserId) return false;
  try {
    const { rows } = await pool.query(
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

async function fetchLicenseById(client, id) {
  const { rows } = await client.query(
    `select l.*,
      coalesce(
        nullif(trim(l.provider_email), ''),
        nullif(trim(u_id.email), ''),
        nullif(trim(u_email.email), '')
      ) as provider_email_resolved,
      coalesce(
        nullif(trim(u_id.full_name), ''),
        nullif(trim(concat_ws(' ', u_id.first_name, u_id.last_name)), ''),
        nullif(trim(u_email.full_name), ''),
        nullif(trim(concat_ws(' ', u_email.first_name, u_email.last_name)), '')
      ) as provider_name
     from public.licenses l
     left join public.users u_id on u_id.auth_user_id = l.provider_id
     left join public.users u_email
       on l.provider_email is not null
      and nullif(trim(l.provider_email), '') is not null
      and lower(trim(u_email.email)) = lower(trim(l.provider_email))
     where l.id = $1
     limit 1`,
    [id]
  );
  return rows[0] || null;
}

function resolveProviderFirstName(licenseRow) {
  const fromName = String(
    licenseRow?.provider_first_name ||
    licenseRow?.first_name ||
    licenseRow?.provider_name ||
    ""
  ).trim();
  if (fromName) return fromName.split(/\s+/)[0];
  const email = String(licenseRow?.provider_email || "").trim();
  if (email.includes("@")) return email.split("@")[0];
  return "Provider";
}

async function sendLicenseDecisionEmail({ providerEmail, providerFirstName, isApproved, rejectionReason }) {
  if (!providerEmail) return false;
  const templateKey = isApproved ? "license_approved" : "license_rejected";
  const vars = isApproved
    ? {
        to: providerEmail,
        first_name: providerFirstName || "Provider",
        summary_lines: [
          "Enroll in a NOVI course or submit an external certification",
          "Apply for MD Coverage for each service you want to offer",
          "Get matched with a Board MD — NOVI handles the assignment",
        ],
      }
    : {
        to: providerEmail,
        first_name: providerFirstName || "Provider",
        rejection_reason: rejectionReason || "",
        rejection_title: "Reason for rejection",
      };
  const result = await sendEmailFromTemplate(templateKey, vars);
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error("[licenses] decision email send failed:", result.error);
    return false;
  }
  return true;
}

licensesRouter.get("/", async (req, res, next) => {
  try {
    const me = req.me || {};
    const canManageLicenses = await resolveCanManageLicenses(me);
    const status = String(req.query?.status || "").trim();
    const providerId = String(req.query?.provider_id || "").trim();
    const providerEmail = String(req.query?.provider_email || "").trim();

    const where = [];
    const params = [];
    if (status) {
      params.push(status);
      where.push(`l.status = $${params.length}`);
    }
    if (providerId) {
      const { aliases } = await getProviderIdAliases(providerId);
      params.push(aliases.length ? aliases : [providerId]);
      where.push(`l.provider_id::text = any($${params.length}::text[])`);
    }
    if (providerEmail) {
      params.push(providerEmail.toLowerCase());
      where.push(`lower(l.provider_email) = $${params.length}`);
    }
    if (!canManageLicenses) {
      if (isMedicalDirectorRole(me.role) && providerId) {
        params.push(me.id);
        where.push(`exists (
          select 1 from public.medical_director_relationship r
           where r.medical_director_id = $${params.length}
             and r.provider_id::text = l.provider_id::text
             and lower(coalesce(r.status, '')) = 'active'
        )`);
      } else {
        params.push(me.id);
        const providerIdParam = `$${params.length}`;
        params.push(String(me.email || "").toLowerCase());
        const providerEmailParam = `$${params.length}`;
        where.push(`(l.provider_id = ${providerIdParam} or lower(l.provider_email) = ${providerEmailParam})`);
      }
    }

    const sql = `select
        l.*,
        coalesce(
          nullif(trim(l.provider_email), ''),
          nullif(trim(u_id.email), ''),
          nullif(trim(u_email.email), '')
        ) as provider_email_resolved,
        coalesce(
          nullif(trim(u_id.full_name), ''),
          nullif(trim(concat_ws(' ', u_id.first_name, u_id.last_name)), ''),
          nullif(trim(u_email.full_name), ''),
          nullif(trim(concat_ws(' ', u_email.first_name, u_email.last_name)), '')
        ) as provider_name
      from public.licenses l
      left join public.users u_id
        on u_id.auth_user_id = l.provider_id
      left join public.users u_email
        on l.provider_email is not null
       and nullif(trim(l.provider_email), '') is not null
       and lower(trim(u_email.email)) = lower(trim(l.provider_email))
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by l.created_at desc`;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(sql, params);
      const mapped = rows.map(mapLicenseRow);
      const unresolved = mapped.filter((row) => !row.provider_name && row.provider_id);
      if (unresolved.length > 0) {
        const byProviderId = new Map();
        for (const row of unresolved) {
          if (!byProviderId.has(row.provider_id)) {
            byProviderId.set(row.provider_id, resolveNameFromAuthByUserId(row.provider_id));
          }
        }
        for (const row of mapped) {
          if (!row.provider_name && row.provider_id && byProviderId.has(row.provider_id)) {
            row.provider_name = await byProviderId.get(row.provider_id);
          }
        }
      }
      return res.json(mapped);
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
});

licensesRouter.post("/", async (req, res, next) => {
  try {
    const me = req.me || {};
    const canManageLicenses = await resolveCanManageLicenses(me);
    const body = req.body || {};
    const providerId = canManageLicenses && body.provider_id ? String(body.provider_id) : me.id;
    const providerEmail = canManageLicenses && body.provider_email
      ? String(body.provider_email)
      : me.email || String(body.provider_email || "");
    const licenseType = String(body.license_type || "").trim();
    const licenseNumber = String(body.license_number || "").trim();

    if (!licenseType || !licenseNumber) {
      const err = new Error("license_type and license_number are required.");
      err.statusCode = 400;
      throw err;
    }

    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `insert into public.licenses (
          provider_id,
          provider_email,
          license_type,
          license_number,
          issuing_state,
          expiration_date,
          document_url,
          status,
          notes
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        returning *`,
        [
          providerId,
          providerEmail || null,
          licenseType,
          licenseNumber,
          body.issuing_state || null,
          body.expiration_date || null,
          body.document_url || null,
          body.status || "pending_review",
          body.notes || null
        ]
      );
      const inserted = await fetchLicenseById(client, rows[0]?.id);
      if (!canManageLicenses) {
        const insertedMapped = mapLicenseRow(inserted || rows[0]);
        void notifyAdminsOfLicenseSubmission({
          providerName: insertedMapped.provider_name,
          providerEmail: insertedMapped.provider_email,
          licenseType: insertedMapped.license_type,
          licenseNumber: insertedMapped.license_number,
          licenseId: insertedMapped.id
        });
      }
      return res.status(201).json(mapLicenseRow(inserted || rows[0]));
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
});

licensesRouter.get("/:id", async (req, res, next) => {
  try {
    const me = req.me || {};
    const canManageLicenses = await resolveCanManageLicenses(me);
    const id = String(req.params.id || "").trim();
    const client = await pool.connect();
    try {
      const row = await fetchLicenseById(client, id);
      if (!row) {
        const err = new Error("License not found.");
        err.statusCode = 404;
        throw err;
      }
      if (!canManageLicenses && row.provider_id !== me.id) {
        const err = new Error("Forbidden.");
        err.statusCode = 403;
        throw err;
      }
      return res.json(mapLicenseRow(row));
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
});

licensesRouter.patch("/:id", async (req, res, next) => {
  try {
    const me = req.me || {};
    const canManageLicenses = await resolveCanManageLicenses(me);
    const id = String(req.params.id || "").trim();
    if (!id) {
      const err = new Error("License id is required.");
      err.statusCode = 400;
      throw err;
    }

    const client = await pool.connect();
    try {
      const existing = await fetchLicenseById(client, id);
      if (!existing) {
        const err = new Error("License not found.");
        err.statusCode = 404;
        throw err;
      }
      if (!canManageLicenses && existing.provider_id !== me.id) {
        const err = new Error("Forbidden.");
        err.statusCode = 403;
        throw err;
      }

      const updates = req.body || {};
      const requestedStatus = Object.prototype.hasOwnProperty.call(updates, "status")
        ? String(updates.status || "").trim()
        : "";
      const requestedRejectionReason = Object.prototype.hasOwnProperty.call(updates, "rejection_reason")
        ? String(updates.rejection_reason || "").trim()
        : "";
      if (canManageLicenses && requestedStatus === "rejected" && !requestedRejectionReason) {
        const err = new Error("rejection_reason is required when rejecting a license.");
        err.statusCode = 400;
        throw err;
      }
      const next = {
        provider_email: Object.prototype.hasOwnProperty.call(updates, "provider_email") ? updates.provider_email : existing.provider_email,
        license_type: Object.prototype.hasOwnProperty.call(updates, "license_type") ? updates.license_type : existing.license_type,
        license_number: Object.prototype.hasOwnProperty.call(updates, "license_number") ? updates.license_number : existing.license_number,
        issuing_state: Object.prototype.hasOwnProperty.call(updates, "issuing_state") ? updates.issuing_state : existing.issuing_state,
        expiration_date: Object.prototype.hasOwnProperty.call(updates, "expiration_date") ? updates.expiration_date : existing.expiration_date,
        document_url: Object.prototype.hasOwnProperty.call(updates, "document_url") ? updates.document_url : existing.document_url,
        status: Object.prototype.hasOwnProperty.call(updates, "status") ? updates.status : existing.status,
        rejection_reason: Object.prototype.hasOwnProperty.call(updates, "rejection_reason")
          ? requestedRejectionReason || null
          : existing.rejection_reason,
        verified_at: Object.prototype.hasOwnProperty.call(updates, "verified_at") ? updates.verified_at : existing.verified_at,
        verified_by: Object.prototype.hasOwnProperty.call(updates, "verified_by") ? updates.verified_by : existing.verified_by,
        notes: Object.prototype.hasOwnProperty.call(updates, "notes") ? updates.notes : existing.notes
      };

      const { rows } = await client.query(
        `update public.licenses
         set provider_email = $2,
             license_type = $3,
             license_number = $4,
             issuing_state = $5,
             expiration_date = $6,
             document_url = $7,
             status = $8,
             rejection_reason = $9,
             verified_at = $10,
             verified_by = $11,
             notes = $12,
             updated_at = now()
         where id = $1
         returning *`,
        [
          id,
          next.provider_email,
          next.license_type,
          next.license_number,
          next.issuing_state,
          next.expiration_date,
          next.document_url,
          next.status,
          next.rejection_reason,
          next.verified_at,
          next.verified_by,
          next.notes
        ]
      );
      const updated = rows[0];
      const statusChangedByReviewer = canManageLicenses && existing.status !== updated.status;
      const isApproved = updated.status === "verified";
      const isRejected = updated.status === "rejected";
      if (statusChangedByReviewer && (isApproved || isRejected)) {
        const providerResult = await client.query(
          `select first_name, full_name, email
           from public.users
           where auth_user_id = $1
              or lower(email) = lower($2)
           order by updated_at desc
           limit 1`,
          [updated.provider_id || null, updated.provider_email || null]
        );
        const providerRow = providerResult.rows[0] || {};
        const providerEmail = updated.provider_email || providerRow.email || null;
        void sendLicenseDecisionEmail({
          providerEmail,
          providerFirstName: resolveProviderFirstName({
            provider_email: providerEmail,
            provider_first_name: providerRow.first_name,
            provider_name: providerRow.full_name
          }),
          isApproved,
          rejectionReason: isRejected ? (updated.rejection_reason || requestedRejectionReason) : ""
        });
      }
      return res.json(mapLicenseRow(updated));
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
});
