import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse";
import { randomUUID } from "node:crypto";
import { getMeFromAccessToken } from "../auth/service.js";
import {
  getUserDbIdByAuthUserId,
  listProviderPatients,
  bulkUpsertProviderPatients,
  validateEmail
} from "./repository.js";

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
