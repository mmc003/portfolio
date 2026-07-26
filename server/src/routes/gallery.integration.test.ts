import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { createPrismaClient } from "../db/client";
import { ImageRepository, CreateImageInput } from "../db/imageRepository";
import { PrismaClient } from "@prisma/client";
import { resetEnvCache } from "../config/env";

let app: ReturnType<typeof createApp>;
let prisma: PrismaClient;
let repo: ImageRepository;

const BASE = new Date("2026-02-01T00:00:00Z").getTime();

function mk(i: number, over: Partial<CreateImageInput> = {}): CreateImageInput {
  return {
    title: `Photo ${i}`,
    altText: `alt ${i}`,
    originalFilename: `p${i}.jpg`,
    category: i % 2 === 0 ? "vancouver" : "fog",
    objectKey: `imgs/p${i}/original.jpg`,
    thumbnailObjectKey: `imgs/p${i}/thumbnail.webp`,
    mediumObjectKey: `imgs/p${i}/medium.webp`,
    width: 2400,
    height: 1600,
    aspectRatio: 1.5,
    mimeType: "image/jpeg",
    fileSize: 1000,
    displayOrder: i,
    isPublished: true,
    createdAt: new Date(BASE + i * 1000),
    ...over,
  };
}

beforeAll(async () => {
  resetEnvCache();
  app = createApp();
  prisma = createPrismaClient();
  repo = new ImageRepository(prisma);
  await prisma.image.deleteMany();
  // 4 published (2 fog, 2 vancouver) + 1 unpublished
  for (let i = 1; i <= 4; i++) await repo.create(mk(i));
  await repo.create({ ...mk(5), isPublished: false, title: "Hidden" });
});

afterAll(async () => {
  await prisma.image.deleteMany();
  await prisma.$disconnect();
});

describe("GET /api/images (public gallery)", () => {
  it("returns only published images with the spec response shape", async () => {
    const res = await request(app).get("/api/images?limit=100");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(4); // unpublished excluded
    expect(res.body.items.every((i: { isPublished: boolean }) => i.isPublished)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.hasMore).toBe(false);
    // Shape: sources present
    expect(res.body.items[0].sources).toBeDefined();
    expect(res.body.items[0].sources.original).toMatch(/^http/);
    // No internal fields leak
    expect(res.body.items[0].objectKey).toBeUndefined();
    expect(res.body.items[0].contentHash).toBeUndefined();
  });

  it("sets cache headers", async () => {
    const res = await request(app).get("/api/images?limit=5");
    expect(res.headers["cache-control"]).toContain("max-age=60");
  });

  it("returns an empty list for a category with no images", async () => {
    const res = await request(app).get("/api/images?category=nonexistent");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.pagination.hasMore).toBe(false);
  });

  it("filters by category", async () => {
    const res = await request(app).get("/api/images?category=fog&limit=100");
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.every((i: { category: string }) => i.category === "fog")).toBe(true);
  });

  it("paginates without skipping or duplicating", async () => {
    const seen = new Set<string>();
    let cursor: string | null = null;
    for (;;) {
      const url: string = `/api/images?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const res = await request(app).get(url);
      for (const it of res.body.items as Array<{ id: string }>) {
        expect(seen.has(it.id)).toBe(false);
        seen.add(it.id);
      }
      cursor = (res.body.pagination.nextCursor as string | null) ?? null;
      if (!cursor) break;
    }
    expect(seen.size).toBe(4);
  });

  it("respects sort=oldest", async () => {
    const res = await request(app).get("/api/images?sort=oldest&limit=100");
    const titles = res.body.items.map((i: { title: string }) => i.title);
    expect(titles).toEqual(["Photo 1", "Photo 2", "Photo 3", "Photo 4"]);
  });

  it("ignores a client-supplied published=false (public cannot see unpublished)", async () => {
    const res = await request(app).get("/api/images?published=false&limit=100");
    expect(res.body.items.every((i: { isPublished: boolean }) => i.isPublished)).toBe(true);
    expect(res.body.items.some((i: { title: string }) => i.title === "Hidden")).toBe(false);
  });

  it("supports conditional GET via ETag (304)", async () => {
    const first = await request(app).get("/api/images?limit=100");
    const etag = first.headers["etag"];
    expect(etag).toBeTruthy();
    const second = await request(app)
      .get("/api/images?limit=100")
      .set("If-None-Match", etag as string);
    expect(second.status).toBe(304);
  });
});

describe("GET /api/images/:id (public detail)", () => {
  it("returns a published image", async () => {
    const list = await request(app).get("/api/images?limit=1");
    const id = list.body.items[0].id;
    const res = await request(app).get(`/api/images/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.sources.original).toMatch(/^http/);
  });

  it("returns 404 for an unpublished image (existence hidden)", async () => {
    const hidden = await repo.create({ ...mk(99), isPublished: false });
    const res = await request(app).get(`/api/images/${hidden.id}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a missing id", async () => {
    const res = await request(app).get("/api/images/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });
});
