import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { readFileSync } from "fs";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { PrismaClient } from "@prisma/client";
import { uploadImage } from "./uploadService";
import { LocalFilesystemStorage } from "../storage/local-fs";
import { ImageRepository } from "../db/imageRepository";
import { createPrismaClient } from "../db/client";
import { ImageStorage } from "../storage/types";

const FIXTURES = path.join(__dirname, "../../test/fixtures");
const sampleJpg = () => readFileSync(path.join(FIXTURES, "sample.jpg"));

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

/** A real local storage pointed at a fresh temp dir, so we can inspect files. */
async function freshStorage(): Promise<{ storage: LocalFilesystemStorage; root: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "upload-svc-"));
  return { storage: new LocalFilesystemStorage({ rootDir: root, publicBaseUrl: "http://localhost:4000" }), root };
}

async function countFiles(root: string): Promise<number> {
  let n = 0;
  const walk = async (dir: string) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else n++;
    }
  };
  await walk(root);
  return n;
}

/** Minimal fake repo whose create() throws — to test rollback on DB failure. */
function failingRepo() {
  return {
    findByContentHash: async () => null,
    create: async () => {
      throw new Error("DB is down");
    },
  } as unknown as ImageRepository;
}

/** Fake storage whose upload() throws on/after a given call number. */
class FailingStorage implements ImageStorage {
  calls = 0;
  constructor(private failOnOrAfter: number) {}
  async upload() {
    this.calls++;
    if (this.calls >= this.failOnOrAfter) throw new Error("storage boom");
    return { objectKey: "k", size: 1, mimeType: "image/webp", url: "http://x/k" };
  }
  async delete() {}
  getPublicUrl(k: string) {
    return "http://x/" + k;
  }
}

describe("uploadImage", () => {
  it("uploads master + 2 derivatives, persists metadata, writes files", async () => {
    const { storage, root } = await freshStorage();
    const record = await uploadImage(
      { buffer: sampleJpg(), originalFilename: "sample.jpg", declaredMime: "image/jpeg", category: "fog", title: "A sample" },
      { storage, repo }
    );

    expect(record.title).toBe("A sample");
    expect(record.mimeType).toBe("image/jpeg");
    expect(record.width).toBe(120);
    expect(record.height).toBe(80);
    expect(record.aspectRatio).toBeCloseTo(1.5, 1);
    expect(record.category).toBe("fog");
    expect(record.contentHash).toBeTypeOf("string");
    expect(record.objectKey).toMatch(/original\.jpg$/);
    expect(record.mediumObjectKey).toMatch(/medium\.webp$/);
    expect(record.thumbnailObjectKey).toMatch(/thumbnail\.webp$/);

    // Three variant files exist on disk.
    expect(await countFiles(root)).toBe(3);
    await fs.rm(root, { recursive: true, force: true });
  });

  it("is idempotent: a duplicate (same content) returns the existing record", async () => {
    const { storage, root } = await freshStorage();
    const first = await uploadImage(
      { buffer: sampleJpg(), originalFilename: "sample.jpg", declaredMime: "image/jpeg" },
      { storage, repo }
    );
    const second = await uploadImage(
      { buffer: sampleJpg(), originalFilename: "sample.jpg", declaredMime: "image/jpeg" },
      { storage, repo }
    );
    expect(second.id).toBe(first.id);
    const count = await repo.count();
    expect(count).toBe(1);
    await fs.rm(root, { recursive: true, force: true });
  });

  it("rolls back storage when the DB insert fails (uploaded files deleted)", async () => {
    const { storage, root } = await freshStorage();
    await expect(
      uploadImage(
        { buffer: sampleJpg(), originalFilename: "sample.jpg", declaredMime: "image/jpeg" },
        { storage, repo: failingRepo() }
      )
    ).rejects.toThrow();

    // No files should remain after rollback.
    expect(await countFiles(root)).toBe(0);
    await fs.rm(root, { recursive: true, force: true });
  });

  it("aborts and leaves no record when storage upload fails", async () => {
    const failing = new FailingStorage(2); // succeeds master, fails on medium
    await expect(
      uploadImage(
        { buffer: sampleJpg(), originalFilename: "sample.jpg", declaredMime: "image/jpeg" },
        { storage: failing, repo }
      )
    ).rejects.toThrow();
    expect(await repo.count()).toBe(0);
  });

  it("rejects an unsupported file type before touching storage/db", async () => {
    const { storage, root } = await freshStorage();
    await expect(
      uploadImage(
        { buffer: Buffer.from("not an image at all"), originalFilename: "x.txt" },
        { storage, repo }
      )
    ).rejects.toThrow();
    expect(await repo.count()).toBe(0);
    expect(await countFiles(root)).toBe(0);
    await fs.rm(root, { recursive: true, force: true });
  });
});
