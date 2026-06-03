import { Router } from "express";
import multer from "multer";
import {
  uploadCourseCoverImage,
  uploadLicenseDocument,
  uploadManufacturerLogo,
  uploadPatientJourneySelfie,
} from "../supabaseStorage.js";
import { getMeFromAccessToken } from "../auth/service.js";

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

const uploadMdDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MD_DOC_MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!MD_DOC_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const err = new Error("Only PDF, DOC, DOCX, JPG, PNG, and WEBP files are allowed.");
      err.statusCode = 400;
      return cb(err);
    }
    return cb(null, true);
  }
});

export const uploadsRouter = Router();

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

    const extension = MD_DOC_MIME_TO_EXTENSION[req.file.mimetype];
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
