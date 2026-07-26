import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { runMigration } from "./migrate-images";
import { LocalFilesystemStorage } from "../storage/local-fs";
import { ImageRepository } from "../db/imageRepository";
import { createPrismaClient } from "../db/client";

const FIXTURES = path.join(__dirname, "../../test/fixtures");

let prisma: PrismaClient;
let repo: ImageRepository;

beforeAll(() => {
  prisma = createPrismaClient();
  repo = new ImageRepository(prisma);
});

beforeEach(async () => {
  await prisma.image.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Build a temp source tree mirroring the repo layout (categories + a junk file). */
async function buildSource(): Promise<string> {
  const src = await fs.mkdtemp(path.join(os.tmpdir(), "migrate-src-"));
  await fs.mkdir(path.join(src, "vancouver"));
  await fs.mkdir(path.join(src, "fog"));
  await fs.copyFile(path.join(FIXTURES, "sample.jpg"), path.join(src, "vancouver", "a.jpg"));
  await fs.copyFile(path.join(FIXTURES, "sample.png"), path.join(src, "vancouver", "b.png"));
  // A third DISTINCT image (different bytes -> different content hash).
  await sharp(await fs.readFile(path.join(FIXTURES, "sample.jpg")))
    .jpeg({ quality: 50 })
    .toFile(path.join(src, "fog", "c.jpg"));
  await fs.writeFile(path.join(src, "notes.txt"), "not an image");
  return src;
}

async function freshStorage(): Promise<{ storage: LocalFilesystemStorage; root: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "migrate-store-"));
  return { storage: new LocalFilesystemStorage({ rootDir: root }), root };
}

async function countFiles(root: string): Promise<number> {
  let n = 0;
  const walk = async (dir: string) => {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (e.isDirectory()) await walk(path.join(dir, e.name));
      else n++;
    }
  };
  await walk(root);
  return n;
}

describe("runMigration", () => {
  it("discovers images, infers categories, and ignores unsupported files (dry-run)", async () => {
    const src = await buildSource();
    const { storage } = await freshStorage();
    const summary = await runMigration({ source: src, dryRun: true, storage, repo });

    expect(summary.dryRun).toBe(true);
    expect(summary.discoveredImages).toBe(3);
    expect(summary.unsupportedFiles).toBe(1);
    expect(summary.migrated).toBe(3); // planned (nothing in DB yet)
    expect(summary.duplicates).toBe(0);
    // Dry-run must not write anything.
    expect(await repo.count()).toBe(0);
    await fs.rm(src, { recursive: true, force: true });
  });

  it("migrates images, sets categories, and writes derivatives", async () => {
    const src = await buildSource();
    const { storage, root } = await freshStorage();
    const summary = await runMigration({ source: src, storage, repo });

    expect(summary.migrated).toBe(3);
    expect(summary.duplicates).toBe(0);
    expect(summary.failed).toBe(0);
    expect(await repo.count()).toBe(3);
    expect(await repo.count({ category: "vancouver" })).toBe(2);
    expect(await repo.count({ category: "fog" })).toBe(1);
    // 3 images x 3 variants each.
    expect(await countFiles(root)).toBe(9);
    await fs.rm(src, { recursive: true, force: true });
    await fs.rm(root, { recursive: true, force: true });
  });

  it("is idempotent: a second run reports duplicates and writes nothing new", async () => {
    const src = await buildSource();
    const { storage, root } = await freshStorage();
    await runMigration({ source: src, storage, repo });
    const second = await runMigration({ source: src, storage, repo });

    expect(second.migrated).toBe(0);
    expect(second.duplicates).toBe(3);
    expect(await repo.count()).toBe(3); // unchanged
    expect(await countFiles(root)).toBe(9); // no new files
    await fs.rm(src, { recursive: true, force: true });
    await fs.rm(root, { recursive: true, force: true });
  });

  it("continues on error by default and records failures", async () => {
    const src = await buildSource();
    // A storage that fails every upload.
    const failing = {
      upload: async () => {
        throw new Error("boom");
      },
      delete: async () => {},
      getPublicUrl: (k: string) => "http://x/" + k,
    };
    const summary = await runMigration({ source: src, storage: failing, repo });
    expect(summary.migrated).toBe(0);
    expect(summary.failed).toBe(3);
    expect(summary.failures.length).toBe(3);
    await fs.rm(src, { recursive: true, force: true });
  });
});
