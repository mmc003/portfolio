import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { requireAdmin, safeEqualString, extractBearerToken } from "./adminToken";
import { resetEnvCache } from "../config/env";
import { errorHandler } from "../middleware/error";

const SECRET = "super-secret-token";
const ORIGINAL_TOKEN = process.env.ADMIN_API_TOKEN;

beforeAll(() => {
  process.env.ADMIN_API_TOKEN = SECRET;
  resetEnvCache();
});

afterAll(() => {
  if (ORIGINAL_TOKEN === undefined) delete process.env.ADMIN_API_TOKEN;
  else process.env.ADMIN_API_TOKEN = ORIGINAL_TOKEN;
  resetEnvCache();
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post("/admin", requireAdmin(), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe("admin token auth", () => {
  it("rejects with 401 when no Authorization header", async () => {
    const res = await request(buildApp()).post("/admin");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("rejects with 401 for a wrong token", async () => {
    const res = await request(buildApp())
      .post("/admin")
      .set("Authorization", "Bearer wrong-token");
    expect(res.status).toBe(401);
  });

  it("accepts the correct bearer token", async () => {
    const res = await request(buildApp())
      .post("/admin")
      .set("Authorization", `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("rejects a token that is a prefix of the secret", async () => {
    const res = await request(buildApp())
      .post("/admin")
      .set("Authorization", `Bearer ${SECRET.slice(0, 5)}`);
    expect(res.status).toBe(401);
  });
});

describe("safeEqualString / extractBearerToken", () => {
  it("compares equal and unequal strings", () => {
    expect(safeEqualString("abc", "abc")).toBe(true);
    expect(safeEqualString("abc", "abd")).toBe(false);
    expect(safeEqualString("abc", "abcd")).toBe(false);
  });
  it("extracts bearer token", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
    expect(extractBearerToken(undefined)).toBe("");
    expect(extractBearerToken("Basic abc")).toBe("");
  });
});
