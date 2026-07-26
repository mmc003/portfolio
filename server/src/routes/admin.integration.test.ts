import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import express, { Express } from "express";
import request from "supertest";
import { createApp } from "../app";
import { createAdminRouter } from "./admin";
import { errorHandler } from "../middleware/error";
import { createPrismaClient } from "../db/client";
import { PrismaClient } from "@prisma/client";
import { resetEnvCache } from "../config/env";

const FIXTURES = path.join(__dirname, "../../test/fixtures");
const sampleJpgPath = path.join(FIXTURES, "sample.jpg");
const notImagePath = path.join(FIXTURES, "not-an-image.txt");
const sampleJpg = () => readFileSync(sampleJpgPath);

let app: Express;
let prisma: PrismaClient;
let token: string;

beforeAll(() => {
  resetEnvCache();
  token = process.env.ADMIN_API_TOKEN!;
  app = createApp();
  prisma = createPrismaClient();
});

afterEach(async () => {
  await prisma.image.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe("POST /api/admin/images — auth & validation", () => {
  it("rejects without a token (401)", async () => {
    const res = await request(app).post("/api/admin/images");
    expect(res.status).toBe(401);
  });

  it("rejects a wrong token (401)", async () => {
    const res = await request(app)
      .post("/api/admin/images")
      .set("Authorization", "Bearer nope");
    expect(res.status).toBe(401);
  });

  it("rejects an authenticated request with no file (400)", async () => {
    const res = await request(app)
      .post("/api/admin/images")
      .set(auth())
      .field("title", "x");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("no_file");
  });

  it("rejects a non-image file (415)", async () => {
    const res = await request(app)
      .post("/api/admin/images")
      .set(auth())
      .attach("file", notImagePath);
    expect(res.status).toBe(415);
  });

  it("rejects a spoofed content type (400)", async () => {
    const res = await request(app)
      .post("/api/admin/images")
      .set(auth())
      .attach("file", sampleJpg(), { filename: "x.jpg", contentType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("mime_mismatch");
  });

  it("rejects an oversized upload (413) via multer limit", async () => {
    const focused = express();
    focused.use(express.json());
    focused.use("/api/admin", createAdminRouter(100)); // 100-byte limit
    focused.use(errorHandler);
    const res = await request(focused)
      .post("/api/admin/images")
      .set(auth())
      .attach("file", sampleJpgPath);
    expect(res.status).toBe(413);
  });
});

describe("POST /api/admin/images — happy path", () => {
  it("uploads, processes, persists, and serves derivatives", async () => {
    const res = await request(app)
      .post("/api/admin/images")
      .set(auth())
      .field("title", "Sample Photo")
      .field("category", "fog")
      .field("altText", "A red sample image")
      .field("isPublished", "true")
      .field("tags", "fog,portra")
      .attach("file", sampleJpgPath);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTypeOf("string");
    expect(res.body.title).toBe("Sample Photo");
    expect(res.body.category).toBe("fog");
    expect(res.body.width).toBe(120);
    expect(res.body.height).toBe(80);
    expect(res.body.aspectRatio).toBeCloseTo(1.5, 1);
    expect(res.body.tags).toEqual(["fog", "portra"]);
    expect(res.body.isPublished).toBe(true);

    // No internal object keys leak to the client; only derived public URLs.
    expect(res.body.objectKey).toBeUndefined();
    expect(res.body.sources.original).toMatch(/\/media\/.*original\.jpg$/);
    expect(res.body.sources.medium).toMatch(/\/media\/.*medium\.webp$/);
    expect(res.body.sources.thumbnail).toMatch(/\/media\/.*thumbnail\.webp$/);

    // The medium derivative is actually served by the local static route.
    const mediumPath = new URL(res.body.sources.medium).pathname;
    const served = await request(app).get(mediumPath);
    expect(served.status).toBe(200);
    expect(served.headers["cache-control"]).toContain("immutable");
    expect(served.headers["content-type"]).toContain("image/webp");
  });
});
