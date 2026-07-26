/**
 * Public gallery routes (no auth).
 *
 *   GET /api/images        paginated, filterable image list (published only)
 *   GET /api/images/:id    single published image
 *
 * Public users can NEVER see unpublished images: the list/detail handlers force
 * isPublished=true regardless of any client-supplied `published` param.
 */
import { Router, Request } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { getRepo } from "../db/client";
import { getStorage } from "../storage";
import { toImageDTO } from "../api/dto";
import { mediaUrlPrefix } from "../api/mediaUrl";
import { resolveLimit } from "../db/imageRepository";
import { HttpError } from "../middleware/error";

/** Coerce a query value (string | string[]) into a trimmed string or undefined. */
function asString(v: unknown): string | undefined {
  if (Array.isArray(v)) v = v[0];
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s.length ? s : undefined;
}

export function createGalleryRouter(): Router {
  const router = Router();

  router.get(
    "/images",
    asyncHandler(async (req: Request, res) => {
      const repo = getRepo();
      const storage = getStorage();
      const prefix = mediaUrlPrefix(req);

      const limit = resolveLimit(asString(req.query.limit) ?? undefined);
      const sort = asString(req.query.sort) === "oldest" ? "oldest" : "newest";
      const cursor = asString(req.query.cursor) ?? null;
      const category = asString(req.query.category);
      const tag = asString(req.query.tag);

      // Public route: published is ALWAYS true, ignoring client input.
      const { items, nextCursor } = await repo.list({
        limit,
        cursor,
        category,
        tag,
        published: true,
        sort,
      });

      res.set("Cache-Control", "public, max-age=60, s-maxage=300");
      res.set("Vary", "Accept-Encoding");
      res.json({
        items: items.map((i) => toImageDTO(i, storage, prefix)),
        pagination: { nextCursor, hasMore: nextCursor !== null },
      });
    })
  );

  router.get(
    "/images/:id",
    asyncHandler(async (req, res) => {
      const repo = getRepo();
      const storage = getStorage();
      const image = await repo.findById(req.params.id);
      if (!image || !image.isPublished) {
        throw new HttpError(404, "Image not found", "not_found");
      }
      res.set("Cache-Control", "public, max-age=300, s-maxage=600");
      res.json(toImageDTO(image, storage, mediaUrlPrefix(req)));
    })
  );

  return router;
}
