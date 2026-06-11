import * as XLSX from "xlsx";
import { parseMdStateLicenseCsv, parseMdStateLicenseRows } from "@/lib/mdStateLicenseCsv";

function cellToString(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function normalizeSheetRows(rawRows) {
  return (rawRows || [])
    .map((row) => (Array.isArray(row) ? row.map(cellToString) : []))
    .filter((row) => row.some((cell) => String(cell || "").trim()));
}

export function parseMdStateLicenseXlsx(arrayBuffer) {
  if (!arrayBuffer?.byteLength) {
    return { entries: [], npi: "", importedCount: 0, warnings: ["Excel file is empty."] };
  }

  // Use formatted cell text (e.g. "12/31/2026") — not JS Date objects, which shift by timezone.
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) {
    return { entries: [], npi: "", importedCount: 0, warnings: ["Excel workbook has no sheets."] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  return parseMdStateLicenseRows(normalizeSheetRows(rawRows));
}

export function isXlsxFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();
  return (
    name.endsWith(".xlsx")
    || name.endsWith(".xls")
    || type.includes("spreadsheetml")
    || type === "application/vnd.ms-excel"
  );
}

export async function parseMdStateLicenseFile(file) {
  if (!file) {
    return { entries: [], npi: "", importedCount: 0, warnings: ["No file selected."] };
  }

  if (isXlsxFile(file)) {
    return parseMdStateLicenseXlsx(await file.arrayBuffer());
  }

  return parseMdStateLicenseCsv(await file.text());
}
