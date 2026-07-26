/**
 * Administrative routes — protected by a constant-time admin token.
 *
 *   POST   /api/admin/images          upload + process a new image
 *   PATCH  /api/admin/images/:id      update metadata
 *   POST   /api/admin/images/:id/publish   set isPublished = true
 *   DELETE /api/admin/images/:id       remove record + clean up storage objects
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
import { getLogger } from "../utils/logger";
import type { Prisma } from "@prisma/client";

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

  // ---- POST: upload ----
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

      const record = await uploadImage({
        buffer: file.buffer,
        originalFilename: file.originalname || "upload.bin",
        declaredMime: file.mimetype,
        category: strField(body.category),
        title: strField(body.title),
        description: strField(body.description),
        altText: strField(body.altText),
        tags: normalizeTags(body.tags),
        isPublished: parseBool(body.isPublished),
        displayOrder: parseOptionalInt(body.displayOrder),
      });

      res.status(201).json(toImageDTO(record, getStorage()));
    })
  );

  // ---- PATCH: update metadata ----
  router.patch(
    "/images/:id",
    requireAdmin(),
    asyncHandler(async (req, res) => {
      const repo = getRepo();
      const existing = await repo.findById(req.params.id);
      if (!existing) throw new HttpError(404, "Image not found", "not_found");

      const body = req.body ?? {};
      const changes: Partial<Prisma.ImageUpdateInput> & { tags?: string[] } = {};
      if (typeof body.title === "string") changes.title = body.title;
      if (typeof body.description === "string") changes.description = body.description;
      if (typeof body.altText === "string") changes.altText = body.altText;
      if (typeof body.category === "string") changes.category = body.category.trim() || null;
      if (typeof body.isPublished === "boolean") changes.isPublished = body.isPublished;
      if (body.displayOrder !== undefined && body.displayOrder !== null) {
        const n = Number(body.displayOrder);
        if (Number.isFinite(n)) changes.displayOrder = Math.trunc(n);
      }
      if (body.tags !== undefined) changes.tags = normalizeTags(body.tags) ?? [];

      const updated = await repo.update(req.params.id, changes);
      res.json(toImageDTO(updated, getStorage()));
    })
  );

  // ---- POST publish ----
  router.post(
    "/images/:id/publish",
    requireAdmin(),
    asyncHandler(async (req, res) => {
      const repo = getRepo();
      const existing = await repo.findById(req.params.id);
      if (!existing) throw new HttpError(404, "Image not found", "not_found");
      const updated = await repo.update(req.params.id, { isPublished: true });
      res.json(toImageDTO(updated, getStorage()));
    })
  );

  // ---- DELETE: remove record + clean up storage objects ----
  router.delete(
    "/images/:id",
    requireAdmin(),
    asyncHandler(async (req, res) => {
      const repo = getRepo();
      const storage = getStorage();
      const log = getLogger();
      const existing = await repo.findById(req.params.id);
      if (!existing) throw new HttpError(404, "Image not found", "not_found");

      await repo.delete(req.params.id);

      // Best-effort cleanup of the stored objects (master + derivatives).
      const keys = [existing.objectKey, existing.mediumObjectKey, existing.thumbnailObjectKey].filter(
        (k): k is string => Boolean(k)
      );
      await Promise.all(
        keys.map((k) =>
          storage.delete(k).catch((e) => {
            log.warn({ objectKey: k, message: e instanceof Error ? e.message : String(e) }, "failed to delete storage object during image deletion");
          })
        )
      );

      res.status(204).end();
    })
  );

  return router;
}

function strField(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Normalize tags from either a real array (JSON body) or a string (form field). */
function normalizeTags(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    return raw
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return parseTags(raw);
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
