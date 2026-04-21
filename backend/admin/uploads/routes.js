import { Router } from "express";
import multer from "multer";
import { uploadCourseCoverImage, uploadLicenseDocument } from "../supabaseStorage.js";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MIME_TO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

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
