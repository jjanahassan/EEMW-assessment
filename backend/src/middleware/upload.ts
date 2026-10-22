import fs from "fs";
import path from "path";
import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { env } from "../config/env";
import { UnsupportedMediaTypeError } from "../errors/AppError";
import { ALLOWED_EXTENSIONS } from "../modules/documents/fileTypes";

// Temp folder lives inside the upload dir so it's on the same disk/volume
const TMP_DIR = path.join(env.UPLOAD_DIR, ".tmp");
fs.mkdirSync(TMP_DIR, { recursive: true });

export const upload = multer({
  dest: TMP_DIR, // streams to disk instead of holding the whole file in memory
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, // exceeded -> MulterError -> 413
    files: 1,
    fields: 20,
    fieldSize: 10 * 1024,
  },
  // quick rejection before anything is written; the real check (magic bytes) is in the service
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new UnsupportedMediaTypeError(`File type ".${ext}" is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`));
    }
    cb(null, true);
  },
});

// Deletes the temp file once the response is finished, whether it succeeded or failed.
// One place covers every path: validation errors, service errors, success.
export function cleanupUploadedFile(req: Request, res: Response, next: NextFunction) {
  res.on("close", () => {
    if (req.file) fs.promises.unlink(req.file.path).catch(() => {});
  });
  next();
}