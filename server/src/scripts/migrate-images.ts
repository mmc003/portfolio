/**
 * Migrate existing portfolio images from the repository into object storage +
 * the metadata database, using the SAME upload pipeline as live uploads.
 *
 *   npm run migrate:images -- --source ../src/imgs [--dry-run] [--on-error=fail]
 *
 * Behavior:
 *  - Walks <source>; first path segment under <source> is treated as the
 *    category (e.g. src/imgs/vancouver/x.jpg -> category "vancouver").
 *  - Ignores unsupported (non-image) files and reports them.
 *  - Idempotent: skips images whose content hash already exists in the DB.
 *  - NEVER deletes or modifies the source files.
 */
import { promises as fs } from "fs";
import path from "path";
import { uploadImage } from "../services/uploadService";
import { ImageRepository } from "../db/imageRepository";
import { ImageStorage } from "../storage/types";
import { sha256Hex } from "../utils/hash";

const IMAGE_RE = /\.(jpe?g|png|webp|avif)$/i;

export interface MigrationSummary {
  source: string;
  dryRun: boolean;
  discoveredImages: number;
  unsupportedFiles: number;
  migrated: number;
  duplicates: number;
  failed: number;
  failures: string[];
}

export interface RunMigrationOptions {
  source: string;
  dryRun?: boolean;
  onError?: "continue" | "fail";
  storage: ImageStorage;
  repo: ImageRepository;
}

interface DiscoveredItem {
  file: string;
  category: string | null;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    throw new Error(`Source directory not found or not readable: ${dir}`);
  }
  for (const name of entries) {
    const full = path.join(dir, name);
    const stat = await fs.stat(full);
    if (stat.isDirectory()) out.push(...(await walk(full)));
    else if (stat.isFile()) out.push(full);
  }
  return out;
}

function discover(source: string, files: string[]): { items: DiscoveredItem[]; unsupported: number } {
  const items: DiscoveredItem[] = [];
  let unsupported = 0;
  for (const file of files) {
    if (!IMAGE_RE.test(file)) {
      unsupported++;
      continue;
    }
    const rel = path.relative(source, file);
    const segs = rel.split(path.sep);
    const category = segs.length > 1 ? segs[0] : null;
    items.push({ file, category });
  }
  return { items, unsupported };
}

function titleFromFilename(filename: string): string {
  const base = path.basename(filename).replace(/\.[^.]+$/, "");
  return base || path.basename(filename);
}

export async function runMigration(opts: RunMigrationOptions): Promise<MigrationSummary> {
  const dryRun = opts.dryRun ?? false;
  const onError = opts.onError ?? "continue";
  const absSource = path.resolve(opts.source);

  const allFiles = await walk(absSource);
  const { items, unsupported } = discover(absSource, allFiles);

  const summary: MigrationSummary = {
    source: absSource,
    dryRun,
    discoveredImages: items.length,
    unsupportedFiles: unsupported,
    migrated: 0,
    duplicates: 0,
    failed: 0,
    failures: [],
  };

  // Per-category display-order counter, seeded from existing rows.
  const orderBase: Record<string, number> = {};

  for (const item of items) {
    const categoryKey = item.category ?? "__none__";
    try {
      const buffer = await fs.readFile(item.file);
      const hash = sha256Hex(buffer);
      const existing = await opts.repo.findByContentHash(hash);
      if (existing) {
        summary.duplicates++;
        continue;
      }

      if (dryRun) {
        summary.migrated++;
        continue;
      }

      if (!(categoryKey in orderBase)) {
        orderBase[categoryKey] = await opts.repo.maxDisplayOrder(item.category ?? undefined);
      }
      orderBase[categoryKey] += 1;

      await uploadImage(
        {
          buffer,
          originalFilename: path.basename(item.file),
          category: item.category ?? undefined,
          title: titleFromFilename(item.file),
          altText: titleFromFilename(item.file),
          displayOrder: orderBase[categoryKey],
          isPublished: true,
        },
        { storage: opts.storage, repo: opts.repo }
      );
      summary.migrated++;
    } catch (err) {
      summary.failed++;
      summary.failures.push(`${item.file}: ${err instanceof Error ? err.message : String(err)}`);
      if (onError === "fail") throw err;
    }
  }

  return summary;
}

function printSummary(s: MigrationSummary): void {
  // eslint-disable-next-line no-console
  console.log(
    [
      `\nImage migration summary (${s.dryRun ? "DRY-RUN" : "REAL"})`,
      `  source:             ${s.source}`,
      `  discovered images:  ${s.discoveredImages}`,
      `  unsupported files:  ${s.unsupportedFiles} (ignored)`,
      `  migrated:           ${s.migrated}`,
      `  duplicates skipped: ${s.duplicates}`,
      `  failed:             ${s.failed}`,
      s.failures.length ? `  failures:\n${s.failures.map((f) => "    - " + f).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );
}

interface CliArgs {
  source?: string;
  dryRun: boolean;
  onError: "continue" | "fail";
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { dryRun: false, onError: "continue" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--source") out.source = argv[i + 1];
    else if (a.startsWith("--source=")) out.source = a.slice("--source=".length);
    else if (a === "--on-error") out.onError = argv[i + 1] === "fail" ? "fail" : "continue";
    else if (a.startsWith("--on-error=")) out.onError = a.slice("--on-error=".length) === "fail" ? "fail" : "continue";
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const source = args.source ?? "../src/imgs";
  // Lazily import env-backed singletons so this file can also be unit-tested
  // without triggering env validation at import time.
  const { getEnv } = await import("../config/env");
  const { getStorage } = await import("../storage");
  const { getRepo } = await import("../db/client");
  getEnv(); // validate configuration

  const summary = await runMigration({
    source,
    dryRun: args.dryRun,
    onError: args.onError,
    storage: getStorage(),
    repo: getRepo(),
  });
  printSummary(summary);
  if (summary.failed > 0 && args.onError === "fail") process.exitCode = 1;
}

// Run only when executed directly (not when imported by tests).
if (require.main === module) {
  void main();
}
