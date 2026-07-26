/**
 * Administrative routes — protected by a constant-time admin token.
 *
 *   POST /api/admin/images   upload + process a new image
 *
 * (PATCH/DELETE/publish are added in a later phase but the auth + multer wiring
 * lives here.)
 */
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { requireAdmin } from "../auth/adminToken";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../middleware/error";
import { uploadImage } from "../services/uploadService";
import { toImageDTO } from "../api/dto";
import { getStorage } from "../storage";
import { getRepo } from "../db/client";

export function createAdminRouter(maxBytes: number): Router {
  const router = Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes },
  });

  /** Run multer.single and map its errors to HttpErrors. */
  const singleFile = (field: string) => (req: Request, res: Response, next: NextFunction) => {
    upload.single(field)(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new HttpError(413, "File too large", "file_too_large"));
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(new HttpError(400, "Unexpected form field", "bad_request"));
        }
        return next(new HttpError(400, err.message, "upload_error"));
      }
      return next(err);
    });
  };

  router.post(
    "/images",
    requireAdmin(),
    singleFile("file"),
    asyncHandler(async (req, res) => {
      const file = req.file;
      if (!file) {
        throw new HttpError(400, "No file uploaded (use multipart field 'file')", "no_file");
      }

      const body = req.body ?? {};
      const tags = parseTags(body.tags);
      const displayOrder = parseOptionalInt(body.displayOrder);

      const record = await uploadImage({
        buffer: file.buffer,
        originalFilename: file.originalname || "upload.bin",
        declaredMime: file.mimetype,
        category: typeof body.category === "string" && body.category.trim() ? body.category.trim() : undefined,
        title: typeof body.title === "string" ? body.title : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        altText: typeof body.altText === "string" ? body.altText : undefined,
        tags,
        isPublished: parseBool(body.isPublished),
        displayOrder,
      });

      res.status(201).json(toImageDTO(record, getStorage()));
    })
  );

  // Reuse the admin router for later PATCH/DELETE/publish routes.
  router.use((req, _res, next) => {
    // Attach repo for downstream admin handlers (used by later phases).
    (req as Request & { adminRepo?: ReturnType<typeof getRepo> }).adminRepo = getRepo();
    next();
  });

  return router;
}

function parseTags(raw: unknown): string[] | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const v = raw.trim();
  if (v.startsWith("[")) {
    try {
      const arr = JSON.parse(v);
      return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : undefined;
    } catch {
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseOptionalInt(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function parseBool(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}
