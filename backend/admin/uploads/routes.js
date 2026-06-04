import { Router } from "express";
import multer from "multer";
import {
  uploadCourseCoverImage,
  uploadLicenseDocument,
  uploadManufacturerLogo,
  uploadPatientJourneySelfie,
} from "../supabaseStorage.js";
import { getMeFromAccessToken } from "../auth/service.js";
import { convertUploadToPdf } from "../lib/convertDocumentToPdf.js";

const SUPABASE_PUBLIC_HOST = (() => {
  try {
    const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    return raw ? new URL(raw).host : "";
  } catch {
    return "";
  }
})();
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "course-covers";

const INLINE_VIEW_MIME = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const INLINE_VIEW_EXTENSIONS = new Set(Object.keys(INLINE_VIEW_MIME));

function extensionFromUrl(url) {
  try {
    return new URL(url).pathname.split(".").pop()?.toLowerCase().split("?")[0] || "";
  } catch {
    return "";
  }
}

function isAllowedStorageDocumentUrl(url) {
  try {
    const parsed = new URL(String(url || "").trim());
    if (!SUPABASE_PUBLIC_HOST || parsed.host !== SUPABASE_PUBLIC_HOST) return false;
    if (!parsed.pathname.includes("/storage/v1/object/public/")) return false;
    if (!parsed.pathname.includes(`/${SUPABASE_STORAGE_BUCKET}/`)) return false;
    return true;
  } catch {
    return false;
  }
}

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MIME_TO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

const PATIENT_SELFIE_MAX_BYTES = 10 * 1024 * 1024;
const PATIENT_SELFIE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const PATIENT_SELFIE_MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const uploadPatientSelfie = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PATIENT_SELFIE_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (PATIENT_SELFIE_MIME_TYPES.has(file.mimetype)) {
      return cb(null, true);
    }
    const name = String(file.originalname || "").toLowerCase();
    if (/\.(jpe?g|png|webp|heic|heif)$/.test(name)) {
      return cb(null, true);
    }
    const err = new Error("Only JPG, PNG, WEBP, HEIC, and HEIF images are allowed.");
    err.statusCode = 400;
    return cb(err);
  },
});

const MANUFACTURER_LOGO_MAX_BYTES = 3 * 1024 * 1024;
const MANUFACTURER_LOGO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);
const MANUFACTURER_LOGO_MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const uploadManufacturerLogoMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MANUFACTURER_LOGO_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!MANUFACTURER_LOGO_MIME_TYPES.has(file.mimetype)) {
      const err = new Error("Only JPG, PNG, WEBP, and SVG images are allowed.");
      err.statusCode = 400;
      return cb(err);
    }
    return cb(null, true);
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const err = new Error("Only JPG, PNG, and WEBP images are allowed.");
      err.statusCode = 400;
      return cb(err);
    }
    return cb(null, true);
  }
});

const LICENSE_MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024;
const LICENSE_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf"
]);
const LICENSE_MIME_TO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf"
};

const uploadLicense = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LICENSE_MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!LICENSE_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const err = new Error("Only JPG, PNG, WEBP, HEIC, HEIF, and PDF files are allowed.");
      err.statusCode = 400;
      return cb(err);
    }
    return cb(null, true);
  }
});

const MD_DOC_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MD_DOC_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp"
]);
const MD_DOC_MIME_TO_EXTENSION = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
const MD_DOC_EXTENSION_TO_MIME = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
/** Browsers often mislabel Office files (especially .docx as zip or octet-stream). */
const MD_DOC_AMBIGUOUS_MIME_TYPES = new Set([
  "application/octet-stream",
  "binary/octet-stream",
  "application/zip",
  "application/x-zip-compressed",
]);

function mdDocExtensionFromFilename(originalname) {
  const ext = String(originalname || "").split(".").pop()?.toLowerCase() || "";
  if (!ext || !MD_DOC_EXTENSION_TO_MIME[ext]) return null;
  return ext === "jpeg" ? "jpg" : ext;
}

function resolveMdDocUpload(file) {
  const fromMime = MD_DOC_MIME_TO_EXTENSION[file?.mimetype];
  if (fromMime) {
    return { extension: fromMime, mimeType: file.mimetype };
  }
  const fromName = mdDocExtensionFromFilename(file?.originalname);
  if (!fromName) return null;
  if (MD_DOC_AMBIGUOUS_MIME_TYPES.has(file?.mimetype)) {
    return { extension: fromName, mimeType: MD_DOC_EXTENSION_TO_MIME[fromName] };
  }
  if (file?.mimetype === "application/zip" && fromName === "docx") {
    return { extension: "docx", mimeType: MD_DOC_EXTENSION_TO_MIME.docx };
  }
  return null;
}

function isAllowedMdDoc(file) {
  if (MD_DOC_ALLOWED_MIME_TYPES.has(file?.mimetype)) return true;
  return Boolean(resolveMdDocUpload(file));
}

const uploadMdDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MD_DOC_MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedMdDoc(file)) {
      const err = new Error("Only PDF, DOC, DOCX, JPG, PNG, and WEBP files are allowed.");
      err.statusCode = 400;
      return cb(err);
    }
    return cb(null, true);
  }
});

export const uploadsRouter = Router();

function requestApiBase(req) {
  const proto = String(req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0].trim();
  const host = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
  return `${proto}://${host}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function buildInlineViewUrl(req, storageUrl) {
  return `${requestApiBase(req)}/api/admin/uploads/view?url=${encodeURIComponent(storageUrl)}`;
}

/** HTML preview page in a new tab (PDF inline; Word via embedded viewer — avoids Save dialog). */
uploadsRouter.get("/preview", async (req, res, next) => {
  try {
    const rawUrl = String(req.query.url || "").trim();
    if (!isAllowedStorageDocumentUrl(rawUrl)) {
      return res.status(400).send("Invalid document URL.");
    }

    const ext = extensionFromUrl(rawUrl);
    if (!INLINE_VIEW_EXTENSIONS.has(ext)) {
      return res.status(400).send("Unsupported document type for preview.");
    }

    const title = decodeURIComponent(rawUrl.split("/").pop()?.split("?")[0] || "Document");
    const frameSrc =
      ext === "doc" || ext === "docx"
        ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(rawUrl)}`
        : buildInlineViewUrl(req, rawUrl);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    html, body { margin: 0; height: 100%; background: #f1f5f9; }
    iframe { display: block; width: 100%; height: 100%; border: 0; background: #fff; }
  </style>
</head>
<body>
  <iframe src="${escapeHtml(frameSrc)}" title="${escapeHtml(title)}"></iframe>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (error) {
    return next(error);
  }
});

/** Stream a stored document inline so the browser opens PDFs natively (not download). */
uploadsRouter.get("/view", async (req, res, next) => {
  try {
    const rawUrl = String(req.query.url || "").trim();
    if (!isAllowedStorageDocumentUrl(rawUrl)) {
      return res.status(400).send("Invalid document URL.");
    }

    const upstream = await fetch(rawUrl, { redirect: "follow" });
    if (!upstream.ok) {
      return res.status(502).send("Could not load document.");
    }

    const ext = extensionFromUrl(rawUrl);
    if (!INLINE_VIEW_EXTENSIONS.has(ext)) {
      return res.status(400).send("Unsupported document type for preview.");
    }
    const mime =
      INLINE_VIEW_MIME[ext] ||
      upstream.headers.get("content-type")?.split(";")[0]?.trim() ||
      "application/octet-stream";
    const filename = decodeURIComponent(
      rawUrl.split("/").pop()?.split("?")[0] || "document"
    );
    const buf = Buffer.from(await upstream.arrayBuffer());

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `inline; filename="${filename.replace(/"/g, "")}"`);
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.send(buf);
  } catch (error) {
    return next(error);
  }
});

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function inferPatientSelfieMime(file) {
  if (file?.mimetype && PATIENT_SELFIE_MIME_TYPES.has(file.mimetype)) {
    return file.mimetype;
  }
  const name = String(file?.originalname || "").toLowerCase();
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (/\.(jpe?g)$/.test(name)) return "image/jpeg";
  return file?.mimetype || "";
}

uploadsRouter.post("/patient-selfie", uploadPatientSelfie.single("file"), async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      const err = new Error("Missing bearer token.");
      err.statusCode = 401;
      throw err;
    }
    const me = await getMeFromAccessToken(token);
    if (!req.file?.buffer) {
      const err = new Error("Image file is required.");
      err.statusCode = 400;
      throw err;
    }

    const resolvedMime = inferPatientSelfieMime(req.file);
    if (!PATIENT_SELFIE_MIME_TYPES.has(resolvedMime)) {
      const err = new Error("Only JPG, PNG, WEBP, HEIC, and HEIF images are allowed.");
      err.statusCode = 400;
      throw err;
    }

    const extension = PATIENT_SELFIE_MIME_TO_EXT[resolvedMime];
    if (!extension) {
      const err = new Error("Unsupported image format.");
      err.statusCode = 400;
      throw err;
    }

    const uploaded = await uploadPatientJourneySelfie({
      buffer: req.file.buffer,
      mimeType: resolvedMime,
      extension,
      patientId: me.id
    });

    res.status(201).json({
      ...uploaded,
      file_url: uploaded.file_url || uploaded.url,
      url: uploaded.url || uploaded.file_url
    });
  } catch (error) {
    next(error);
  }
});

uploadsRouter.post("/course-cover", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      const err = new Error("Image file is required.");
      err.statusCode = 400;
      throw err;
    }

    const extension = MIME_TO_EXTENSION[req.file.mimetype];
    if (!extension) {
      const err = new Error("Unsupported image format.");
      err.statusCode = 400;
      throw err;
    }

    const uploaded = await uploadCourseCoverImage({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      extension
    });

    res.status(201).json(uploaded);
  } catch (error) {
    next(error);
  }
});

uploadsRouter.post("/license-photo", uploadLicense.single("file"), async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      const err = new Error("License file is required.");
      err.statusCode = 400;
      throw err;
    }

    const extension = LICENSE_MIME_TO_EXTENSION[req.file.mimetype];
    if (!extension) {
      const err = new Error("Unsupported file format.");
      err.statusCode = 400;
      throw err;
    }

    const uploaded = await uploadLicenseDocument({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      extension
    });

    res.status(201).json(uploaded);
  } catch (error) {
    next(error);
  }
});

uploadsRouter.post("/manufacturer-logo", uploadManufacturerLogoMulter.single("file"), async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      const err = new Error("Missing bearer token.");
      err.statusCode = 401;
      throw err;
    }
    await getMeFromAccessToken(token);

    if (!req.file?.buffer) {
      const err = new Error("Image file is required.");
      err.statusCode = 400;
      throw err;
    }

    const extension = MANUFACTURER_LOGO_MIME_TO_EXT[req.file.mimetype];
    if (!extension) {
      const err = new Error("Unsupported image format.");
      err.statusCode = 400;
      throw err;
    }

    const uploaded = await uploadManufacturerLogo({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      extension,
    });

    res.status(201).json({
      ...uploaded,
      file_url: uploaded.file_url || uploaded.url,
      url: uploaded.url || uploaded.file_url,
    });
  } catch (error) {
    next(error);
  }
});

uploadsRouter.post("/md-document", uploadMdDoc.single("file"), async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      const err = new Error("Document file is required.");
      err.statusCode = 400;
      throw err;
    }

    const resolved = resolveMdDocUpload(req.file);
    if (!resolved) {
      const err = new Error("Unsupported file format.");
      err.statusCode = 400;
      throw err;
    }

    const pdfReady = await convertUploadToPdf({
      buffer: req.file.buffer,
      extension: resolved.extension,
      originalFileName: req.file.originalname,
    });

    const uploaded = await uploadLicenseDocument({
      buffer: pdfReady.buffer,
      mimeType: pdfReady.mimeType,
      extension: pdfReady.extension,
      folder: "md-contracts",
      originalFileName: pdfReady.outputFileName,
    });

    res.status(201).json({
      ...uploaded,
      converted_to_pdf: pdfReady.converted,
      original_filename: req.file.originalname || null,
    });
  } catch (error) {
    next(error);
  }
});
