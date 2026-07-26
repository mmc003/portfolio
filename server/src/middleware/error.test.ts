import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { errorHandler, HttpError, notFound } from "./error";

function build() {
  const app = express();
  app.get("/boom", (_req, _res, next) => next(new HttpError(418, "I am a teapot", "teapot")));
  app.get("/explode", () => {
    throw new Error("kaboom");
  });
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

describe("error middleware", () => {
  it("returns the status and body for an HttpError", async () => {
    const res = await request(build()).get("/boom");
    expect(res.status).toBe(418);
    expect(res.body).toEqual({ error: { code: "teapot", message: "I am a teapot" } });
  });

  it("maps unknown errors to a 500 without leaking a stack", async () => {
    const res = await request(build()).get("/explode");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("internal_error");
    // In the test env (NODE_ENV !== production) the message is surfaced for
    // debugging; the contract is that no stack trace is ever serialized.
    expect(JSON.stringify(res.body)).not.toContain("at ");
    expect(res.body.error.stack).toBeUndefined();
  });

  it("returns a 404 JSON body for unknown routes", async () => {
    const res = await request(build()).get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });
});
