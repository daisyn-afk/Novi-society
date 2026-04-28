import { Router } from "express";
import { pool } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";

export const licensesRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
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

function mapLicenseRow(row) {
  return {
    ...row,
    created_date: row.created_at,
    updated_date: row.updated_at
  };
}

async function fetchLicenseById(client, id) {
  const { rows } = await client.query(
    `select l.*, coalesce(u.full_name, trim(concat_ws(' ', u.first_name, u.last_name)), '') as provider_full_name
     from public.licenses l
     left join public.users u on u.auth_user_id = l.provider_id
     where l.id = $1
     limit 1`,
    [id]
  );
  return rows[0] || null;
}

licensesRouter.get("/", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
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
      params.push(providerId);
      where.push(`l.provider_id = $${params.length}`);
    }
    if (providerEmail) {
      params.push(providerEmail.toLowerCase());
      where.push(`lower(l.provider_email) = $${params.length}`);
    }
    if (me.role !== "admin") {
      params.push(me.id);
      const providerIdParam = `$${params.length}`;
      params.push(String(me.email || "").toLowerCase());
      const providerEmailParam = `$${params.length}`;
      // Non-admin providers can only see their own licenses.
      // Support legacy rows keyed by email even if provider_id is missing/mismatched.
      where.push(`(l.provider_id = ${providerIdParam} or lower(l.provider_email) = ${providerEmailParam})`);
    }

    const sql = `select l.*, coalesce(u.full_name, trim(concat_ws(' ', u.first_name, u.last_name)), '') as provider_full_name
      from public.licenses l
      left join public.users u on u.auth_user_id = l.provider_id
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by l.created_at desc`;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(sql, params);
      return res.json(rows.map(mapLicenseRow));
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
});

licensesRouter.post("/", async (req, res, next) => {
  try {
    const { me } = await requireAuth(req);
    const body = req.body || {};
    const providerId = me.role === "admin" && body.provider_id ? String(body.provider_id) : me.id;
    const providerEmail = me.role === "admin" && body.provider_email
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
    const { me } = await requireAuth(req);
    const id = String(req.params.id || "").trim();
    const client = await pool.connect();
    try {
      const row = await fetchLicenseById(client, id);
      if (!row) {
        const err = new Error("License not found.");
        err.statusCode = 404;
        throw err;
      }
      if (me.role !== "admin" && row.provider_id !== me.id) {
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
    const { me } = await requireAuth(req);
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
      if (me.role !== "admin" && existing.provider_id !== me.id) {
        const err = new Error("Forbidden.");
        err.statusCode = 403;
        throw err;
      }

      const updates = req.body || {};
      const next = {
        provider_email: Object.prototype.hasOwnProperty.call(updates, "provider_email") ? updates.provider_email : existing.provider_email,
        license_type: Object.prototype.hasOwnProperty.call(updates, "license_type") ? updates.license_type : existing.license_type,
        license_number: Object.prototype.hasOwnProperty.call(updates, "license_number") ? updates.license_number : existing.license_number,
        issuing_state: Object.prototype.hasOwnProperty.call(updates, "issuing_state") ? updates.issuing_state : existing.issuing_state,
        expiration_date: Object.prototype.hasOwnProperty.call(updates, "expiration_date") ? updates.expiration_date : existing.expiration_date,
        document_url: Object.prototype.hasOwnProperty.call(updates, "document_url") ? updates.document_url : existing.document_url,
        status: Object.prototype.hasOwnProperty.call(updates, "status") ? updates.status : existing.status,
        rejection_reason: Object.prototype.hasOwnProperty.call(updates, "rejection_reason") ? updates.rejection_reason : existing.rejection_reason,
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
      const updated = await fetchLicenseById(client, rows[0]?.id || id);
      return res.json(mapLicenseRow(updated || rows[0]));
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
});
