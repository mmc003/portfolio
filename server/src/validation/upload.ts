/**
 * Upload validation — size, declared MIME, and real file-signature (magic byte)
 * checks. We trust the magic bytes over the (spoofable) Content-Type header.
 */
import { HttpError } from "../middleware/error";

export const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type AllowedMime = (typeof ALLOWED_MIME)[number];

/** Map a detected MIME type to a safe file extension. */
export function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    default:
      return "bin";
  }
}

/**
 * Sniff the real format from the leading bytes. Returns the MIME type or null
 * if no known signature matches. Designed to be safe on short/empty buffers.
 */
export function sniffMime(buf: Buffer | Uint8Array): string | null {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b.length < 12) return null;

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return "image/png";

  // WebP/GIF/AVIF all use a 4-byte ASCII tag.
  const tag4 = b.subarray(0, 4).toString("latin1");

  // WebP: "RIFF" .... "WEBP"
  if (tag4 === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") {
    return "image/webp";
  }

  // GIF: "GIF87a" / "GIF89a"
  if (tag4 === "GIF8" && (b[5] === 0x37 || b[5] === 0x39) && b[6] === 0x61) {
    return "image/gif";
  }

  // AVIF/HEIC: ISO BMFF "ftyp" box at offset 4, brand at offset 8.
  if (b.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = b.subarray(8, 12).toString("latin1");
    if (brand === "avif" || brand === "avis") return "image/avif";
  }

  return null;
}

export interface ValidationResult {
  ok: boolean;
  detectedMime: string | null;
}

/**
 * Validate an uploaded buffer. Throws an HttpError (400/413) on failure so the
 * error middleware can format it. Returns the detected MIME on success.
 */
export function validateUpload(input: {
  buffer: Buffer;
  declaredMime?: string;
  sizeBytes: number;
  maxBytes: number;
}): string {
  const { buffer, declaredMime, sizeBytes, maxBytes } = input;

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new HttpError(400, "Empty file", "empty_file");
  }
  if (sizeBytes > maxBytes) {
    throw new HttpError(
      413,
      `File exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB upload limit`,
      "file_too_large"
    );
  }

  const detected = sniffMime(buffer);
  if (!detected || !(ALLOWED_MIME as readonly string[]).includes(detected)) {
    throw new HttpError(415, "Unsupported file type", "unsupported_media_type");
  }

  // If a Content-Type was supplied, flag mismatches (spoofed header).
  if (declaredMime && declaredMime !== detected) {
    throw new HttpError(
      400,
      `File signature does not match declared type (${declaredMime})`,
      "mime_mismatch"
    );
  }

  return detected;
}
