import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { readFileSync } from "fs";
import { promises as fs } from "fs";
import path from "path";
import request from "supertest";
import { createApp } from "../app";
import { createPrismaClient } from "../db/client";
import { ImageRepository, CreateImageInput } from "../db/imageRepository";
import { PrismaClient } from "@prisma/client";
import { resetEnvCache } from "../config/env";

const FIXTURES = path.join(__dirname, "../../test/fixtures");
const samplePng = () => readFileSync(path.join(FIXTURES, "sample.png"));

let app: ReturnType<typeof createApp>;
let prisma: PrismaClient;
let repo: ImageRepository;
let token: string;
let storageRoot: string;

const BASE = new Date("2026-03-01T00:00:00Z").getTime();
function mk(i: number, over: Partial<CreateImageInput> = {}): CreateImageInput {
  return {
    title: `Seed ${i}`,
    altText: `alt ${i}`,
    originalFilename: `s${i}.png`,
    category: "fog",
    objectKey: `imgs/s${i}/original.png`,
    thumbnailObjectKey: `imgs/s${i}/thumbnail.webp`,
    mediumObjectKey: `imgs/s${i}/medium.webp`,
    width: 64,
    height: 64,
    aspectRatio: 1,
    mimeType: "image/png",
    fileSize: 100,
    displayOrder: i,
    isPublished: false,
    createdAt: new Date(BASE + i * 1000),
    ...over,
  };
}

beforeAll(() => {
  resetEnvCache();
  token = process.env.ADMIN_API_TOKEN!;
  app = createApp();
  prisma = createPrismaClient();
  repo = new ImageRepository(prisma);
  storageRoot = process.env.STORAGE_LOCAL_DIR!;
});

afterEach(async () => {
  await prisma.image.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

async function countFiles(root: string): Promise<number> {
  let n = 0;
  const walk = async (dir: string) => {
    try {
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        if (e.isDirectory()) await walk(path.join(dir, e.name));
        else n++;
      }
    } catch {
      /* dir may not exist */
    }
  };
  await walk(root);
  return n;
}

describe("PATCH /api/admin/images/:id", () => {
  it("requires auth (401)", async () => {
    const img = await repo.create(mk(1));
    const res = await request(app).patch(`/api/admin/images/${img.id}`).send({ title: "x" });
    expect(res.status).toBe(401);
  });

  it("updates metadata fields", async () => {
    const img = await repo.create(mk(1));
    const res = await request(app)
      .patch(`/api/admin/images/${img.id}`)
      .set(auth())
      .send({ title: "New Title", category: "vancouver", isPublished: true, tags: ["a", "b"] });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("New Title");
    expect(res.body.category).toBe("vancouver");
    expect(res.body.isPublished).toBe(true);
    expect(res.body.tags).toEqual(["a", "b"]);
  });

  it("returns 404 for a missing id", async () => {
    const res = await request(app).patch("/api/admin/images/nope").set(auth()).send({ title: "x" });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/images/:id/publish", () => {
  it("publishes an unpublished image", async () => {
    const img = await repo.create(mk(1));
    const res = await request(app).post(`/api/admin/images/${img.id}/publish`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.isPublished).toBe(true);
    // Now visible publicly
    const pub = await request(app).get(`/api/images/${img.id}`);
    expect(pub.status).toBe(200);
  });
});

describe("DELETE /api/admin/images/:id", () => {
  it("removes the record and cleans up stored objects", async () => {
    // Upload a real file through the route so objects land in the singleton storage.
    const before = await countFiles(storageRoot);
    const upload = await request(app)
      .post("/api/admin/images")
      .set(auth())
      .attach("file", samplePng(), { filename: "s.png", contentType: "image/png" })
      .field("title", "To Delete");
    expect(upload.status).toBe(201);
    const id = upload.body.id;
    const after = await countFiles(storageRoot);
    expect(after - before).toBe(3); // master + medium + thumbnail

    const del = await request(app).delete(`/api/admin/images/${id}`).set(auth());
    expect(del.status).toBe(204);

    // Record gone
    const get = await request(app).get(`/api/images/${id}`);
    expect(get.status).toBe(404);
    // Storage cleaned up (back to the pre-upload count)
    const final = await countFiles(storageRoot);
    expect(final).toBe(before);
  });

  it("requires auth (401)", async () => {
    const res = await request(app).delete("/api/admin/images/anything");
    expect(res.status).toBe(401);
  });

  it("returns 404 for a missing id", async () => {
    const res = await request(app).delete("/api/admin/images/nope").set(auth());
    expect(res.status).toBe(404);
  });
});
