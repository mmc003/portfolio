import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../app";

describe("GET /api/health", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "test";
  });

  it("responds 200 with status ok and a timestamp", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.uptime).toBeTypeOf("number");
    expect(res.body.timestamp).toBeTypeOf("string");
    expect(() => new Date(res.body.timestamp)).not.toThrow();
  });

  it("echoes a request id header", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("x-request-id", "abc-123");
    expect(res.headers["x-request-id"]).toBe("abc-123");
  });

  it("returns 404 JSON for an unknown /api route", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });
});
