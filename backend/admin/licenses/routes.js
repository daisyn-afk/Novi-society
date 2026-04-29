import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";

export const licensesRouter = Router();
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL || "NOVI Society <support@novisociety.com>";
const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
const noviEmailLogoUrl = process.env.NOVI_EMAIL_LOGO_URL || `${appBaseUrl}/novi-email-logo.png`;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

function hasAdminAccess(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "super_admin" || normalized === "owner";
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

function escapeHtml(rawValue) {
  return String(rawValue ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function buildLicenseDecisionEmailHtml({ providerFirstName, isApproved, rejectionReason }) {
  const safeName = escapeHtml(providerFirstName || "Provider");
  const safeReason = escapeHtml(rejectionReason || "");
  const base = String(appBaseUrl || "").replace(/\/+$/, "");
  const ctaUrl = `${base}/login?next=${encodeURIComponent("/ProviderCredentialsCoverage")}`;
  const ctaMarkup = isApproved
    ? `<p style="margin:0 0 32px">
            <a href="${ctaUrl}" style="display:inline-block;background:#2D6B7F;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;font-size:14px">
              Apply for Coverage
            </a>
          </p>`
    : "";
  const contentBody = isApproved
    ? `
          <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">Your professional license has been verified by the NOVI admin team. ✓</p>
          <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">You're now eligible to apply for MD Board Coverage, which lets you legally offer aesthetic services under NOVI's Board of Medical Directors.</p>
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111827">Your Next Steps:</p>
          <ul style="margin:0 0 24px;padding-left:20px;color:#374151;font-size:15px;line-height:1.9">
            <li>Enroll in a NOVI course or submit an external certification</li>
            <li>Apply for MD Coverage for each service you want to offer</li>
            <li>Get matched with a Board MD - NOVI handles the assignment</li>
          </ul>
          ${ctaMarkup}
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6">You're one step closer,<br/><strong>The NOVI Team</strong></p>
      `
    : `
          <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">Your professional license submission has been reviewed by the NOVI admin team.</p>
          <p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.6"><strong>Status:</strong> Rejected</p>
          <p style="margin:0 0 10px;font-size:15px;font-weight:600;color:#111827">Reason for rejection:</p>
          <div style="background:#fff7f7;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;margin:0 0 24px;color:#7f1d1d;font-size:14px;line-height:1.7">
            ${safeReason}
          </div>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">Please update and resubmit your license details in your provider dashboard.</p>
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6">The NOVI Team</p>
      `;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'DM Sans',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:36px 40px;text-align:center;border-radius:16px 16px 0 0">
          <img src="${noviEmailLogoUrl}" alt="NOVI Society" style="width:160px;height:auto" />
        </td></tr>
        <tr><td style="background:#fff;padding:48px 40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Hi ${safeName},</p>
          ${contentBody}
          <div style="border-top:1px solid #e5e7eb;padding-top:28px;margin-top:8px">
            <p style="margin:0;font-size:15px;color:#374151">Best,<br><strong>The NOVI Society Team</strong></p>
          </div>
        </td></tr>
        <tr><td style="padding:24px 40px;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">© 2026 NOVI Society LLC · 8109 Meadow Valley Dr, McKinney, TX 75071</p>
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af"><a href="mailto:support@novisociety.com" style="color:#9ca3af">support@novisociety.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendLicenseDecisionEmail({ providerEmail, providerFirstName, isApproved, rejectionReason }) {
  if (!providerEmail) return false;
  if (!resendApiKey) {
    // eslint-disable-next-line no-console
    console.warn("[licenses] license decision email skipped: RESEND_API_KEY missing");
    return false;
  }

  const subject = isApproved
    ? "Your license has been verified — unlock MD coverage now"
    : "Your license submission was rejected";
  const html = buildLicenseDecisionEmailHtml({
    providerFirstName,
    isApproved,
    rejectionReason
  });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [providerEmail],
        subject,
        html
      })
    });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.error("[licenses] decision email send failed:", response.status, bodyText);
    }
    return response.ok;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[licenses] decision email request failed:", error);
    return false;
  }
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
    if (!hasAdminAccess(me.role)) {
      params.push(me.id);
      const providerIdParam = `$${params.length}`;
      params.push(String(me.email || "").toLowerCase());
      const providerEmailParam = `$${params.length}`;
      // Non-admin providers can only see their own licenses.
      // Support legacy rows keyed by email even if provider_id is missing/mismatched.
      where.push(`(l.provider_id = ${providerIdParam} or lower(l.provider_email) = ${providerEmailParam})`);
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
    const { me } = await requireAuth(req);
    const body = req.body || {};
    const providerId = hasAdminAccess(me.role) && body.provider_id ? String(body.provider_id) : me.id;
    const providerEmail = hasAdminAccess(me.role) && body.provider_email
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
      return res.status(201).json(mapLicenseRow(rows[0]));
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
      const { rows } = await client.query("select * from public.licenses where id = $1 limit 1", [id]);
      const row = rows[0];
      if (!row) {
        const err = new Error("License not found.");
        err.statusCode = 404;
        throw err;
      }
      if (!hasAdminAccess(me.role) && row.provider_id !== me.id) {
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
      const { rows: existingRows } = await client.query("select * from public.licenses where id = $1 limit 1", [id]);
      const existing = existingRows[0];
      if (!existing) {
        const err = new Error("License not found.");
        err.statusCode = 404;
        throw err;
      }
      if (!hasAdminAccess(me.role) && existing.provider_id !== me.id) {
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
      if (hasAdminAccess(me.role) && requestedStatus === "rejected" && !requestedRejectionReason) {
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
      const statusChangedByAdmin = hasAdminAccess(me.role) && existing.status !== updated.status;
      const isApproved = updated.status === "verified";
      const isRejected = updated.status === "rejected";
      if (statusChangedByAdmin && (isApproved || isRejected)) {
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
        await sendLicenseDecisionEmail({
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
