import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";
import { hasAdminOrStaffModuleAccess } from "../auth/helpers.js";
import {
  getProviderIdAliases,
  isMedicalDirectorRole,
  mdHasActiveSupervisionOf,
} from "../mdSupervisedAccess.js";
import { mapComplianceLogRow } from "./service.js";
import { resolveActiveMdForProvider } from "./automationHelpers.js";

export const complianceLogsRouter = Router();

const LOG_TYPES = new Set([
  "supervision_check",
  "chart_review",
  "incident_report",
  "license_review",
  "certification_review",
  "note",
]);

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function canManageComplianceLogs(me) {
  return hasAdminOrStaffModuleAccess(me, "AdminCompliance");
}

async function resolveProviderIdentity({ provider_id, provider_email }) {
  const id = String(provider_id || "").trim();
  const email = String(provider_email || "").trim().toLowerCase();

  if (id) {
    const { aliases, email: resolvedEmail } = await getProviderIdAliases(id);
    return {
      provider_id: aliases[0] || id,
      provider_email: resolvedEmail || email || null,
    };
  }

  if (email) {
    const { rows } = await query(
      `select id::text as app_user_id, auth_user_id::text as auth_user_id, lower(email) as email
         from public.users
        where lower(email) = $1
        limit 1`,
      [email]
    );
    const row = rows?.[0];
    if (row) {
      return {
        provider_id: row.auth_user_id || row.app_user_id,
        provider_email: row.email || email,
      };
    }
    return { provider_id: null, provider_email: email };
  }

  return { provider_id: null, provider_email: null };
}

async function mdCanAccessLog(me, logRow) {
  if (canManageComplianceLogs(me)) return true;
  if (!isMedicalDirectorRole(me.role)) return false;
  if (String(logRow.medical_director_id || "") === String(me.id || "")) return true;
  if (logRow.provider_id) {
    return mdHasActiveSupervisionOf(me, logRow.provider_id);
  }
  return false;
}

async function getSupervisedProviderIds(mdId) {
  const { rows } = await query(
    `select distinct provider_id::text as provider_id
       from public.medical_director_relationship
      where medical_director_id = $1
        and lower(coalesce(status, '')) = 'active'`,
    [String(mdId || "")]
  );
  return (rows || []).map((r) => r.provider_id).filter(Boolean);
}

complianceLogsRouter.get("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);

    const where = [];
    const params = [];
    const logType = String(req.query.log_type || "").trim();
    const providerId = String(req.query.provider_id || "").trim();
    const medicalDirectorId = String(req.query.medical_director_id || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);

    if (canManageComplianceLogs(me)) {
      if (providerId) {
        params.push(providerId);
        where.push(`provider_id = $${params.length}`);
      }
      if (medicalDirectorId) {
        params.push(medicalDirectorId);
        where.push(`medical_director_id = $${params.length}`);
      }
    } else if (isMedicalDirectorRole(me.role)) {
      const supervised = await getSupervisedProviderIds(me.id);
      params.push(String(me.id));
      const mdIdx = params.length;
      if (supervised.length) {
        params.push(supervised);
        where.push(
          `(medical_director_id = $${mdIdx} or provider_id = any($${params.length}::text[]))`
        );
      } else {
        where.push(`medical_director_id = $${mdIdx}`);
      }
    } else {
      return res.status(403).json({ error: "Forbidden." });
    }

    if (logType && LOG_TYPES.has(logType)) {
      params.push(logType);
      where.push(`log_type = $${params.length}`);
    }

    params.push(limit);
    const limitIdx = params.length;

    const { rows } = await query(
      `select *
         from public.compliance_logs
         ${where.length ? `where ${where.join(" and ")}` : ""}
         order by created_at desc
         limit $${limitIdx}`,
      params
    );

    return res.json((rows || []).map(mapComplianceLogRow));
  } catch (error) {
    return next(error);
  }
});

complianceLogsRouter.post("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const body = req.body || {};

    const logType = String(body.log_type || "note").trim();
    const summary = String(body.summary || "").trim();
    if (!summary) {
      return res.status(400).json({ error: "summary is required." });
    }
    if (!LOG_TYPES.has(logType)) {
      return res.status(400).json({ error: "Invalid log_type." });
    }

    const provider = await resolveProviderIdentity(body);
    if (!provider.provider_id && !provider.provider_email) {
      return res.status(400).json({ error: "provider_id or provider_email is required." });
    }

    if (isMedicalDirectorRole(me.role)) {
      if (!provider.provider_id || !(await mdHasActiveSupervisionOf(me, provider.provider_id))) {
        return res.status(403).json({ error: "You can only create logs for providers you supervise." });
      }
    } else if (!canManageComplianceLogs(me)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    let medicalDirectorId = String(body.medical_director_id || "").trim() || null;
    if (isMedicalDirectorRole(me.role)) {
      medicalDirectorId = String(me.id);
    } else if (!medicalDirectorId && provider.provider_id) {
      medicalDirectorId = await resolveActiveMdForProvider(provider.provider_id);
    }

    const attachments = Array.isArray(body.attachments)
      ? body.attachments.filter((a) => a && (a.url || a.name))
      : [];

    const { rows } = await query(
      `insert into public.compliance_logs (
         provider_id,
         provider_email,
         medical_director_id,
         created_by_id,
         created_by_role,
         log_type,
         summary,
         details,
         action_required,
         action_taken,
         attachments,
         source
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,'manual')
       returning *`,
      [
        provider.provider_id,
        provider.provider_email,
        medicalDirectorId,
        String(me.id),
        String(me.role || ""),
        logType,
        summary,
        body.details ? String(body.details) : null,
        body.action_required === true,
        body.action_taken ? String(body.action_taken) : null,
        JSON.stringify(attachments),
      ]
    );

    return res.status(201).json(mapComplianceLogRow(rows[0]));
  } catch (error) {
    return next(error);
  }
});

complianceLogsRouter.patch("/:id", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const body = req.body || {};

    const { rows: existingRows } = await query(
      `select * from public.compliance_logs where id = $1 limit 1`,
      [req.params.id]
    );
    const existing = existingRows?.[0];
    if (!existing) return res.status(404).json({ error: "Compliance log not found." });

    if (!(await mdCanAccessLog(me, existing))) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const isExplicitEdit =
      body.summary !== undefined ||
      body.log_type !== undefined ||
      body.details !== undefined ||
      body.provider_id !== undefined ||
      body.provider_email !== undefined ||
      body.attachments !== undefined;

    const isResolve =
      !isExplicitEdit &&
      (body.resolved_at !== undefined || body.action_required === false || body.action_taken !== undefined);

    if (isResolve) {
      const actionTaken =
        body.action_taken !== undefined
          ? String(body.action_taken || "").trim() || null
          : existing.action_taken;
      const resolvedAt =
        body.resolved_at !== undefined
          ? body.resolved_at
          : new Date().toISOString();
      const actionRequired =
        body.action_required !== undefined ? body.action_required === true : false;

      const { rows } = await query(
        `update public.compliance_logs
            set action_required = $2,
                action_taken = $3,
                resolved_at = $4,
                updated_at = now()
          where id = $1
          returning *`,
        [req.params.id, actionRequired, actionTaken, resolvedAt || null]
      );
      return res.json(mapComplianceLogRow(rows[0]));
    }

    if (!canManageComplianceLogs(me)) {
      return res.status(403).json({ error: "Only admins can edit compliance logs." });
    }

    const logType = body.log_type !== undefined ? String(body.log_type).trim() : existing.log_type;
    if (!LOG_TYPES.has(logType)) {
      return res.status(400).json({ error: "Invalid log_type." });
    }

    const summary = body.summary !== undefined ? String(body.summary).trim() : existing.summary;
    if (!summary) {
      return res.status(400).json({ error: "summary is required." });
    }

    const provider =
      body.provider_id !== undefined || body.provider_email !== undefined
        ? await resolveProviderIdentity(body)
        : { provider_id: existing.provider_id, provider_email: existing.provider_email };

    const attachments =
      body.attachments !== undefined
        ? (Array.isArray(body.attachments) ? body.attachments.filter((a) => a && (a.url || a.name)) : [])
        : existing.attachments;

    const { rows } = await query(
      `update public.compliance_logs
          set provider_id = $2,
              provider_email = $3,
              log_type = $4,
              summary = $5,
              details = $6,
              action_required = $7,
              attachments = $8::jsonb,
              updated_at = now()
        where id = $1
        returning *`,
      [
        req.params.id,
        provider.provider_id,
        provider.provider_email,
        logType,
        summary,
        body.details !== undefined ? String(body.details || "") : existing.details,
        body.action_required !== undefined ? body.action_required === true : existing.action_required,
        JSON.stringify(Array.isArray(attachments) ? attachments : []),
      ]
    );
    return res.json(mapComplianceLogRow(rows[0]));
  } catch (error) {
    return next(error);
  }
});

complianceLogsRouter.delete("/:id", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    if (!canManageComplianceLogs(me)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const { rowCount } = await query(`delete from public.compliance_logs where id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Compliance log not found." });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});
