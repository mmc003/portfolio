import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ImageRepository, readTags, resolveLimit, paginationDefaults, CreateImageInput } from "./imageRepository";
import { createPrismaClient } from "./client";

let prisma: PrismaClient;
let repo: ImageRepository;

const BASE_TIME = new Date("2026-01-01T00:00:00Z").getTime();

function mkImage(i: number, over: Partial<CreateImageInput> = {}): CreateImageInput {
  return {
    title: `Image ${i}`,
    originalFilename: `img${i}.jpg`,
    objectKey: `images/${i}/original.jpg`,
    thumbnailObjectKey: `images/${i}/thumbnail.webp`,
    mediumObjectKey: `images/${i}/medium.webp`,
    width: 2400,
    height: 1600,
    aspectRatio: 1.5,
    mimeType: "image/jpeg",
    fileSize: 1000 * i,
    displayOrder: i,
    isPublished: true,
    // Distinct timestamps so createdAt-based ordering is deterministic.
    createdAt: new Date(BASE_TIME + i * 1000),
    ...over,
  };
}

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

describe("ImageRepository basics", () => {
  it("creates and retrieves by id and by content hash", async () => {
    const created = await repo.create({ ...mkImage(1), contentHash: "hash-1" });
    expect(created.id).toBeTypeOf("string");
    expect(readTags(created)).toEqual([]);

    const found = await repo.findById(created.id);
    expect(found?.title).toBe("Image 1");

    const byHash = await repo.findByContentHash("hash-1");
    expect(byHash?.id).toBe(created.id);
  });

  it("serializes and reads tags", async () => {
    const created = await repo.create({ ...mkImage(1), tags: ["fog", "portra"] });
    expect(readTags(created)).toEqual(["fog", "portra"]);
  });

  it("updates fields including tags", async () => {
    const created = await repo.create(mkImage(1));
    const updated = await repo.update(created.id, { title: "New", tags: ["a"] });
    expect(updated.title).toBe("New");
    expect(readTags(updated)).toEqual(["a"]);
  });

  it("deletes a record", async () => {
    const created = await repo.create(mkImage(1));
    await repo.delete(created.id);
    expect(await repo.findById(created.id)).toBeNull();
  });

  it("compute maxDisplayOrder", async () => {
    await repo.create({ ...mkImage(1), displayOrder: 3 });
    await repo.create({ ...mkImage(2), displayOrder: 7 });
    expect(await repo.maxDisplayOrder()).toBe(7);
  });
});

describe("ImageRepository list / pagination", () => {
  beforeEach(async () => {
    // 5 published + 2 unpublished, mixed categories.
    for (let i = 1; i <= 5; i++) {
      await repo.create({
        ...mkImage(i, { category: i <= 2 ? "fog" : "vancouver" }),
        isPublished: true,
      });
    }
    await repo.create({ ...mkImage(6, { category: "fog" }), isPublished: false });
    await repo.create({ ...mkImage(7, { category: "vancouver" }), isPublished: false });
  });

  it("returns only published images by default for the public view", async () => {
    const { items } = await repo.list({ limit: 100, published: true });
    expect(items).toHaveLength(5);
    expect(items.every((i) => i.isPublished)).toBe(true);
  });

  it("paginates without skipping or duplicating across pages", async () => {
    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    // page size 2 across 5 published items
    for (;;) {
      const page = await repo.list({ limit: 2, cursor, published: true });
      pages++;
      for (const it of page.items) {
        expect(seen.has(it.id)).toBe(false);
        seen.add(it.id);
      }
      cursor = page.nextCursor;
      if (!cursor) break;
      if (pages > 20) throw new Error("pagination looped");
    }
    expect(seen.size).toBe(5);
  });

  it("filters by category", async () => {
    const { items } = await repo.list({ limit: 100, published: true, category: "fog" });
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.category === "fog")).toBe(true);
  });

  it("filters by tag (JSON contains)", async () => {
    await prisma.image.deleteMany();
    await repo.create({ ...mkImage(1), tags: ["portra", "fog"] });
    await repo.create({ ...mkImage(2), tags: ["portra"] });
    await repo.create({ ...mkImage(3), tags: ["landscape"] });
    const { items } = await repo.list({ limit: 100, tag: "portra" });
    expect(items).toHaveLength(2);
  });

  it("respects sort order (oldest first)", async () => {
    const { items } = await repo.list({ limit: 100, published: true, sort: "oldest" });
    const titles = items.map((i) => i.title);
    // Created in order 1..5 with incrementing createdAt; oldest = earliest created.
    expect(titles[0]).toBe("Image 1");
  });

  it("admin view (no published filter) sees unpublished too", async () => {
    const { items } = await repo.list({ limit: 100 });
    expect(items).toHaveLength(7);
  });

  it("honors limit + nextCursor + hasMore shape", async () => {
    const page = await repo.list({ limit: 2, published: true });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeTypeOf("string");
    const page2 = await repo.list({ limit: 2, published: true, cursor: page.nextCursor });
    expect(page2.items).toHaveLength(2);
  });
});

describe("pagination input resolution", () => {
  it("clamps limits to the configured bounds", () => {
    expect(resolveLimit(0)).toBe(paginationDefaults.defaultLimit);
    expect(resolveLimit(-5)).toBe(paginationDefaults.defaultLimit);
    expect(resolveLimit(99999)).toBe(paginationDefaults.maxLimit);
    expect(resolveLimit(5)).toBe(5);
    expect(resolveLimit("nope" as unknown)).toBe(paginationDefaults.defaultLimit);
  });
});
