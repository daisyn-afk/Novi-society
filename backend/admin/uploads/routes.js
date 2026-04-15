import { Router } from "express";
import multer from "multer";
import { uploadCourseCoverImage } from "../supabaseStorage.js";

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
