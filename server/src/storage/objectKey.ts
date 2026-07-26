/**
 * Object-key generation + sanitization.
 *
 * Keys are built from a random UUID + a sanitized slug, so they are unique,
 * predictable, safe (no path traversal), and cache-friendly (a changed image
 * always gets a fresh key).
 */
import { randomUUID } from "crypto";

/** Strip a filename to a safe, lowercase slug. Falls back to "image". */
export function sanitizeFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, ""); // drop extension
  const slug = base
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "") // drop accents/symbols
    .trim()
    .replace(/[\s_]+/g, "-") // spaces/underscores → dash
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "image";
}

/** Sanitize a category segment (folder name). Empty → undefined. */
export function sanitizeCategory(category?: string | null): string | undefined {
  if (!category) return undefined;
  const c = category
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return c || undefined;
}

/** Normalize a file extension to a safe lowercase token. */
export function sanitizeExtension(ext: string): string {
  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean || "bin";
}

function datePath(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}/${mm}`;
}

export interface KeySet {
  /** Shared directory prefix for all variants of one image. */
  base: string;
  original: string;
  thumbnail: string;
  medium: string;
}

export interface GenerateKeySetOptions {
  originalFilename: string;
  category?: string | null;
  /** Extension for the master, e.g. "jpg". */
  originalExt: string;
  /** Extension for derivatives, e.g. "webp". */
  derivativeExt: string;
  /** Injected for deterministic tests. */
  now?: Date;
  /** Injected for deterministic tests. */
  uuid?: string;
}

/** Build a content-unique key set for an image and its derivatives. */
export function generateKeySet(opts: GenerateKeySetOptions): KeySet {
  const slug = sanitizeFilename(opts.originalFilename);
  const cat = sanitizeCategory(opts.category);
  const id = opts.uuid ?? randomUUID();
  const when = opts.now ?? new Date();

  const base = ["images", cat, datePath(when), `${id}-${slug}`]
    .filter((s): s is string => Boolean(s))
    .join("/");

  const originalExt = sanitizeExtension(opts.originalExt);
  const derivativeExt = sanitizeExtension(opts.derivativeExt);

  return {
    base,
    original: `${base}/original.${originalExt}`,
    thumbnail: `${base}/thumbnail.${derivativeExt}`,
    medium: `${base}/medium.${derivativeExt}`,
  };
}

/**
 * Reject object keys that could escape the storage root (path traversal) or are
 * otherwise unsafe. Throws on violation.
 */
export function assertSafeObjectKey(objectKey: string): void {
  if (
    typeof objectKey !== "string" ||
    objectKey.length === 0 ||
    objectKey.length > 1024 ||
    objectKey.includes("..") ||
    objectKey.startsWith("/") ||
    objectKey.includes("//") ||
    /[^a-zA-Z0-9\-_./]/.test(objectKey)
  ) {
    throw new Error(`Unsafe object key: ${objectKey}`);
  }
}
