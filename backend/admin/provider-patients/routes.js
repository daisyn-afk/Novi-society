import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getMeFromAccessToken } from "../auth/service.js";
import {
  getUserDbIdByAuthUserId,
  listProviderPatients,
  bulkUpsertProviderPatients,
  listRosterOnlyPatients,
  validateEmail
} from "./repository.js";

// ── Invite infrastructure (Resend + Supabase admin) ─────────────────────────
const resendApiKey    = process.env.RESEND_API_KEY || "";
const resendFromEmail = process.env.RESEND_FROM_EMAIL || "NOVI Society <support@novisociety.com>";
const appBaseUrl      = process.env.APP_BASE_URL || "http://localhost:5173";

const _supabaseUrl  = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const _serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const _supabaseAdmin = _supabaseUrl && _serviceKey
  ? createClient(_supabaseUrl, _serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

async function sendPatientInviteEmail({ to, firstName, inviteLink }) {
  if (!to || !inviteLink || !resendApiKey) return false;
  const name = firstName || "there";
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'DM Sans',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:36px 40px;text-align:center;border-radius:16px 16px 0 0">
          <p style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px">NOVI Society</p>
        </td></tr>
        <tr><td style="background:#fff;padding:40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 16px;font-size:16px;color:#374151">Hi ${name},</p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">
            Your provider has added you to their patient roster on NOVI Society. Create your free account to
            view aftercare plans, book future appointments, and track your treatment journey.
          </p>
          <p style="margin:0 0 28px">
            <a href="${inviteLink}" style="display:inline-block;background:#2D6B7F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px">
              Set up your NOVI account
            </a>
          </p>
          <p style="margin:0;font-size:12px;color:#9ca3af">If you did not expect this email, you can safely ignore it.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: resendFromEmail, to: [to], subject: "Your provider has invited you to NOVI Society", html })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const providerPatientsRouter = Router();

const CSV_MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB
const PREVIEW_ROW_LIMIT = 10;
const MAX_IMPORT_ROWS = 500;

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CSV_MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const isCSV =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname?.toLowerCase().endsWith(".csv");
    if (!isCSV) {
      const err = new Error("Only .csv files are allowed.");
      err.statusCode = 400;
      return cb(err);
    }
    return cb(null, true);
  }
});

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

async function requireProviderAuth(req) {
  const token = getBearerToken(req);
  if (!token) {
    const err = new Error("Missing bearer token.");
    err.statusCode = 401;
    throw err;
  }
  const me = await getMeFromAccessToken(token);
  // me.id is auth_user_id; resolve the DB users.id for FK usage
  const providerDbId = await getUserDbIdByAuthUserId(me.id);
  if (!providerDbId) {
    const err = new Error("Provider account not found.");
    err.statusCode = 404;
    throw err;
  }
  return { me, providerDbId };
}

/** Parse a CSV buffer into an array of record objects (keyed by column header). */
function parseCsvBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const records = [];
    const parser = parse({
      columns: true,         // first row = headers
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });

    parser.on("readable", () => {
      let record;
      while ((record = parser.read()) !== null) {
        records.push(record);
      }
    });
    parser.on("error", reject);
    parser.on("end", () => resolve(records));

    parser.write(buffer);
    parser.end();
  });
}

// ---------------------------------------------------------------------------
// POST /admin/provider-patients/csv-parse
// Accepts a multipart CSV upload, parses it, returns headers + preview rows.
// No DB writes — safe to call multiple times.
// ---------------------------------------------------------------------------
providerPatientsRouter.post("/csv-parse", csvUpload.single("file"), async (req, res, next) => {
  try {
    await requireProviderAuth(req);

    if (!req.file?.buffer) {
      const err = new Error("CSV file is required.");
      err.statusCode = 400;
      throw err;
    }

    let records;
    try {
      records = await parseCsvBuffer(req.file.buffer);
    } catch {
      const err = new Error("Could not parse the CSV file. Ensure it is a valid, comma-separated file.");
      err.statusCode = 422;
      throw err;
    }

    if (records.length === 0) {
      const err = new Error("The CSV file is empty or contains only a header row.");
      err.statusCode = 422;
      throw err;
    }

    const headers = Object.keys(records[0]);
    const totalRows = records.length;

    if (totalRows > MAX_IMPORT_ROWS) {
      const err = new Error(`CSV contains ${totalRows} rows, which exceeds the ${MAX_IMPORT_ROWS}-row limit. Please split the file and re-upload.`);
      err.statusCode = 422;
      throw err;
    }

    // Return all rows for the import step; preview is a capped subset for the UI table.
    return res.json({
      headers,
      rows: records,
      preview: records.slice(0, PREVIEW_ROW_LIMIT),
      totalRows
    });
  } catch (error) {
    return next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /admin/provider-patients/csv-import
// Accepts: { rows: [...], mapping: { email, first_name, last_name, phone, date_of_birth, gender } }
// Validates, upserts, returns import summary.
// ---------------------------------------------------------------------------
providerPatientsRouter.post("/csv-import", async (req, res, next) => {
  try {
    const { providerDbId } = await requireProviderAuth(req);

    const { rows, mapping } = req.body || {};

    if (!Array.isArray(rows) || rows.length === 0) {
      const err = new Error("No rows provided for import.");
      err.statusCode = 400;
      throw err;
    }

    if (!mapping || typeof mapping !== "object" || !mapping.email) {
      const err = new Error("Column mapping must include at minimum an 'email' field.");
      err.statusCode = 400;
      throw err;
    }

    // Map raw CSV rows to system fields using the provider-supplied column mapping
    const validRows = [];
    const rowErrors = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const email = String(raw[mapping.email] || "").toLowerCase().trim();

      if (!email) {
        rowErrors.push({ row: i + 1, reason: "Missing email." });
        continue;
      }
      if (!validateEmail(email)) {
        rowErrors.push({ row: i + 1, email, reason: "Invalid email format." });
        continue;
      }

      validRows.push({
        email,
        first_name: mapping.first_name ? raw[mapping.first_name] : null,
        last_name:  mapping.last_name  ? raw[mapping.last_name]  : null,
        full_name:  mapping.full_name  ? raw[mapping.full_name]  : null,
        phone:      mapping.phone      ? raw[mapping.phone]      : null,
        date_of_birth: mapping.date_of_birth ? raw[mapping.date_of_birth] : null,
        gender:     mapping.gender     ? raw[mapping.gender]     : null
      });
    }

    const batchId = randomUUID();
    const result = await bulkUpsertProviderPatients(providerDbId, validRows, batchId);

    const allErrors = [
      ...rowErrors,
      ...result.errors
    ];

    return res.status(200).json({
      batchId,
      totalRows: rows.length,
      imported: result.imported,
      skipped:  result.skipped,
      failed:   rowErrors.length + result.failed,
      errors:   allErrors
    });
  } catch (error) {
    return next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /admin/provider-patients
// Returns all imported patients for the authenticated provider.
// ---------------------------------------------------------------------------
providerPatientsRouter.get("/", async (req, res, next) => {
  try {
    const { providerDbId } = await requireProviderAuth(req);
    const patients = await listProviderPatients(providerDbId);
    return res.json(patients);
  } catch (error) {
    return next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /admin/provider-patients/invite
// Sends NOVI platform invites to roster-only patients (no account yet).
// Body (optional): { batch_id: uuid }
//   - Providing batch_id limits invites to patients from a single import.
//   - Omitting batch_id invites ALL roster-only patients for this provider.
// Returns: { invited, skipped, failed, errors }
// ---------------------------------------------------------------------------
providerPatientsRouter.post("/invite", async (req, res, next) => {
  try {
    const { providerDbId } = await requireProviderAuth(req);

    const batchId = req.body?.batch_id || null;
    const rosterOnly = await listRosterOnlyPatients(providerDbId, batchId);

    if (rosterOnly.length === 0) {
      return res.json({ invited: 0, skipped: 0, failed: 0, errors: [] });
    }

    let invited = 0;
    let skipped = 0;
    let failed  = 0;
    const errors = [];

    for (const patient of rosterOnly) {
      const email = String(patient.email || "").toLowerCase().trim();
      if (!email) { failed++; continue; }

      try {
        // Generate a Supabase invite link (creates the auth user if needed)
        let inviteLink = `${appBaseUrl}/signup?email=${encodeURIComponent(email)}`;

        if (_supabaseAdmin?.auth?.admin?.generateLink) {
          const { data: linkData, error: linkErr } = await _supabaseAdmin.auth.admin.generateLink({
            type: "invite",
            email,
            options: { redirectTo: `${appBaseUrl}/set-password` }
          });
          if (!linkErr) {
            const generated = linkData?.properties?.action_link || linkData?.action_link || "";
            if (generated) inviteLink = generated;
          }
        }

        const sent = await sendPatientInviteEmail({
          to: email,
          firstName: patient.first_name || null,
          inviteLink
        });

        if (sent) {
          invited++;
        } else {
          // Link was generated but email sending failed — still counts as skipped
          // rather than a hard failure so the caller can retry
          failed++;
          errors.push({ email, reason: "Email delivery failed." });
        }
      } catch (err) {
        failed++;
        errors.push({ email, reason: err.message || "Unexpected error." });
      }
    }

    return res.json({ invited, skipped, failed, errors });
  } catch (error) {
    return next(error);
  }
});
