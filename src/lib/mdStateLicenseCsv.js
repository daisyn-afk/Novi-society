import { normalizeUsStateCode } from "@/lib/mdStateLicenses";

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === "\"" && next === "\"") {
        field += "\"";
        i += 1;
      } else if (ch === "\"") {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => String(cell || "").trim())) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }

  row.push(field);
  if (row.some((cell) => String(cell || "").trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeUsState(value) {
  return normalizeUsStateCode(value);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toIsoDate(year, month, day) {
  if (!year || !month || !day) return "";
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return "";
  if (m < 1 || m > 12 || d < 1 || d > 31) return "";
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function excelSerialToIso(value) {
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial < 1) return "";
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400000);
  if (Number.isNaN(date.getTime())) return "";
  return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function normalizeExpirationDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-" || /^n\/?a$/i.test(raw)) return "";

  const isoPrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return isoPrefix[1];

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    let year = Number(slash[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return toIsoDate(year, slash[1], slash[2]);
  }

  const compact = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (compact) {
    let year = Number(compact[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return toIsoDate(year, compact[1], compact[2]);
  }

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const asNumber = Number(raw);
    if (asNumber >= 30000 && asNumber <= 80000) return excelSerialToIso(asNumber);
  }

  return "";
}

export function normalizeLicenseNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-" || /^n\/?a$/i.test(raw)) return "";

  if (/^[0-9.]+e[+-]?\d+$/i.test(raw)) {
    const num = Number(raw);
    if (Number.isFinite(num)) return String(Math.trunc(num));
  }

  if (/^\d+\.0+$/.test(raw)) return raw.replace(/\.0+$/, "");
  return raw;
}

function normalizeNpi(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 10 ? digits : "";
}

function findColumnIndex(headers, matchers) {
  for (let i = 0; i < headers.length; i += 1) {
    const h = headers[i];
    if (matchers.some((re) => re.test(h))) return i;
  }
  return -1;
}

function detectHeaderRow(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    const headers = rows[i].map(normalizeHeader);
    const stateIdx = findColumnIndex(headers, [/^state$/, /^us_state$/, /^st$/]);
    if (stateIdx < 0) continue;
    const licenseIdx = findColumnIndex(headers, [/state_license/, /^license_number$/, /^license$/]);
    const expIdx = findColumnIndex(headers, [/exp_date/, /^expiration_date$/, /^expiration$/, /^exp$/]);
    if (licenseIdx >= 0 || expIdx >= 0) {
      return { index: i, stateIdx, licenseIdx, expIdx };
    }
  }
  return null;
}

function extractNpi(rows) {
  for (const row of rows) {
    const label = String(row[0] || "").trim().toLowerCase();
    if (!label.includes("npi")) continue;
    for (let i = 1; i < row.length; i += 1) {
      const npi = normalizeNpi(row[i]);
      if (npi) return npi;
    }
    const inline = String(row[0] || "").match(/npi\s*[:#]?\s*([0-9.e+-]+)/i);
    if (inline) {
      const npi = normalizeNpi(inline[1]);
      if (npi) return npi;
    }
  }
  return "";
}

function rawCellValue(value) {
  if (value == null) return "";
  return String(value).trim();
}

function rowToEntry(row, columns) {
  const state = normalizeUsState(row[columns.stateIdx]);
  if (!state) return null;

  const licenseIdx = columns.licenseIdx >= 0 ? columns.licenseIdx : 1;
  const expIdx = columns.expIdx >= 0 ? columns.expIdx : 2;

  return {
    us_state: state,
    license_number: rawCellValue(row[licenseIdx]),
    expiration_date: rawCellValue(row[expIdx]),
  };
}

function parsePositionalRows(rows) {
  const entries = [];
  for (const row of rows) {
    if (row.length < 2) continue;
    const entry = rowToEntry(row, { stateIdx: 0, licenseIdx: 1, expIdx: 2 });
    if (entry) entries.push(entry);
  }
  return entries;
}

export function parseMdStateLicenseRows(rows) {
  if (!rows.length) {
    return { entries: [], npi: "", importedCount: 0, warnings: ["No rows found in file."] };
  }

  const npi = extractNpi(rows);
  const header = detectHeaderRow(rows);
  const dataRows = header ? rows.slice(header.index + 1) : rows;
  const entries = header
    ? dataRows.map((row) => rowToEntry(row, header)).filter(Boolean)
    : parsePositionalRows(dataRows);

  const warnings = [];
  if (!entries.length) {
    warnings.push("No state license rows found. Expected columns: State, State license, Exp date.");
  }

  return {
    entries,
    npi,
    importedCount: entries.length,
    warnings,
  };
}

export function parseMdStateLicenseCsv(text) {
  const trimmed = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    return { entries: [], npi: "", importedCount: 0, warnings: ["CSV file is empty."] };
  }
  return parseMdStateLicenseRows(parseCsvRows(trimmed));
}
