/**
 * Server-side image processing with Sharp.
 *
 * Runs once at upload time (never per request): applies EXIF orientation,
 * strips metadata, re-optimizes the master, and generates thumbnail + medium
 * derivatives. Also derives a dominant color and a tiny base64 blur placeholder
 * for low-quality-image-placeholders (prevents layout shift / pop-in).
 */
import sharp from "sharp";

export interface ImageVariant {
  data: Buffer;
  width: number;
  height: number;
  mimeType: string;
  ext: string;
}

export interface ProcessedImage {
  master: ImageVariant;
  medium: ImageVariant;
  thumbnail: ImageVariant;
  aspectRatio: number;
  dominantColor: string | null;
  blurPlaceholder: string | null;
}

export interface ProcessOptions {
  sourceMime: string;
  thumbnailWidth: number;
  mediumWidth: number;
  derivativeFormat: "webp" | "jpeg";
}

interface FormatSpec {
  format: keyof sharp.FormatEnum;
  options: Record<string, unknown>;
  mimeType: string;
  ext: string;
}

function masterFormatFor(mime: string): FormatSpec {
  switch (mime) {
    case "image/png":
      return { format: "png", options: { compressionLevel: 9 }, mimeType: "image/png", ext: "png" };
    case "image/webp":
      return { format: "webp", options: { quality: 82 }, mimeType: "image/webp", ext: "webp" };
    case "image/avif":
      return { format: "avif", options: { quality: 60 }, mimeType: "image/avif", ext: "avif" };
    case "image/jpeg":
    default:
      return { format: "jpeg", options: { quality: 82, mozjpeg: true }, mimeType: "image/jpeg", ext: "jpg" };
  }
}

function derivativeFormatFor(format: "webp" | "jpeg", quality: number): FormatSpec {
  if (format === "jpeg") {
    return { format: "jpeg", options: { quality, mozjpeg: true }, mimeType: "image/jpeg", ext: "jpg" };
  }
  return { format: "webp", options: { quality }, mimeType: "image/webp", ext: "webp" };
}

async function dims(buf: Buffer): Promise<{ width: number; height: number }> {
  const m = await sharp(buf).metadata();
  return { width: m.width ?? 0, height: m.height ?? 0 };
}

export async function processImage(buffer: Buffer, opts: ProcessOptions): Promise<ProcessedImage> {
  // `.rotate()` applies EXIF orientation; outputs below do not call
  // `.withMetadata()`, so EXIF/metadata is stripped from every derivative.
  const source = sharp(buffer).rotate();

  // --- master (preserved/re-encoded format) ---
  const masterSpec = masterFormatFor(opts.sourceMime);
  const masterData = await source
    .clone()
    .toFormat(masterSpec.format, masterSpec.options)
    .toBuffer();
  const masterDims = await dims(masterData);
  const master: ImageVariant = {
    data: masterData,
    width: masterDims.width,
    height: masterDims.height,
    mimeType: masterSpec.mimeType,
    ext: masterSpec.ext,
  };

  // --- derivatives ---
  const mediumSpec = derivativeFormatFor(opts.derivativeFormat, 80);
  const thumbnailSpec = derivativeFormatFor(opts.derivativeFormat, 75);

  const mediumData = await source
    .clone()
    .resize({ width: opts.mediumWidth, withoutEnlargement: true, fit: sharp.fit.inside })
    .toFormat(mediumSpec.format, mediumSpec.options)
    .toBuffer();
  const mediumDims = await dims(mediumData);

  const thumbnailData = await source
    .clone()
    .resize({ width: opts.thumbnailWidth, withoutEnlargement: true, fit: sharp.fit.inside })
    .toFormat(thumbnailSpec.format, thumbnailSpec.options)
    .toBuffer();
  const thumbnailDims = await dims(thumbnailData);

  const aspectRatio = master.width && master.height ? master.width / master.height : 0;

  // --- dominant color (1x1 downsample) ---
  let dominantColor: string | null = null;
  try {
    const px = await sharp(buffer)
      .rotate()
      .resize(1, 1, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer();
    if (px.length >= 3) {
      dominantColor = `#${[px[0], px[1], px[2]]
        .map((c) => c.toString(16).padStart(2, "0"))
        .join("")}`;
    }
  } catch {
    dominantColor = null;
  }

  // --- blur placeholder (tiny WebP data URL) ---
  let blurPlaceholder: string | null = null;
  try {
    const lp = await sharp(masterData)
      .resize(20, 20, { fit: "cover" })
      .toFormat("webp", { quality: 40 })
      .toBuffer();
    blurPlaceholder = `data:image/webp;base64,${lp.toString("base64")}`;
  } catch {
    blurPlaceholder = null;
  }

  return {
    master,
    medium: { data: mediumData, width: mediumDims.width, height: mediumDims.height, mimeType: mediumSpec.mimeType, ext: mediumSpec.ext },
    thumbnail: { data: thumbnailData, width: thumbnailDims.width, height: thumbnailDims.height, mimeType: thumbnailSpec.mimeType, ext: thumbnailSpec.ext },
    aspectRatio,
    dominantColor,
    blurPlaceholder,
  };
}
