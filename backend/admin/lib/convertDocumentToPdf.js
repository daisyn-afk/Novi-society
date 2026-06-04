import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SOFFICE_CANDIDATES = [
  process.env.LIBREOFFICE_PATH,
  "soffice",
  "libreoffice",
  "/usr/bin/soffice",
  "/usr/bin/libreoffice",
].filter(Boolean);

function pdfFileNameFromOriginal(originalFileName, fallback = "document.pdf") {
  const raw = String(originalFileName || "").trim();
  if (!raw) return fallback;
  if (/\.pdf$/i.test(raw)) return raw;
  return raw.replace(/\.(docx?|DOCX?)$/i, ".pdf");
}

async function resolveSofficeBinary() {
  for (const candidate of SOFFICE_CANDIDATES) {
    try {
      await execFileAsync(candidate, ["--version"], { timeout: 15000 });
      return candidate;
    } catch {
      /* try next */
    }
  }
  const err = new Error(
    "Word to PDF conversion is not available on this server. Install LibreOffice or upload a PDF."
  );
  err.statusCode = 503;
  throw err;
}

/**
 * Convert DOC/DOCX buffer to PDF via LibreOffice. PDF input is returned unchanged.
 */
export async function convertUploadToPdf({ buffer, extension, originalFileName }) {
  const ext = String(extension || "")
    .replace(/^\./, "")
    .toLowerCase();

  if (ext === "pdf") {
    return {
      buffer,
      extension: "pdf",
      mimeType: "application/pdf",
      converted: false,
      outputFileName: pdfFileNameFromOriginal(originalFileName),
    };
  }

  if (ext !== "doc" && ext !== "docx") {
    const err = new Error("Only PDF, DOC, and DOCX files are supported.");
    err.statusCode = 400;
    throw err;
  }

  if (!buffer?.length) {
    const err = new Error("Document file is empty.");
    err.statusCode = 400;
    throw err;
  }

  const soffice = await resolveSofficeBinary();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "novi-doc-pdf-"));
  const inputPath = path.join(tmpDir, `upload.${ext}`);

  try {
    await writeFile(inputPath, buffer);

    await execFileAsync(
      soffice,
      ["--headless", "--norestore", "--convert-to", "pdf", "--outdir", tmpDir, inputPath],
      { timeout: 120000 }
    );

    const outputPath = path.join(tmpDir, "upload.pdf");
    const pdfBuffer = await readFile(outputPath);

    if (!pdfBuffer?.length) {
      const err = new Error("Conversion to PDF produced an empty file.");
      err.statusCode = 502;
      throw err;
    }

    return {
      buffer: pdfBuffer,
      extension: "pdf",
      mimeType: "application/pdf",
      converted: true,
      outputFileName: pdfFileNameFromOriginal(originalFileName),
    };
  } catch (error) {
    if (error?.statusCode) throw error;
    const err = new Error(
      `Could not convert document to PDF: ${error?.message || "LibreOffice conversion failed."}`
    );
    err.statusCode = 502;
    throw err;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
