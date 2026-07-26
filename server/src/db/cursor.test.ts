import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor } from "./cursor";

describe("cursor", () => {
  it("round-trips a payload", () => {
    const payload = { createdAt: "2026-07-25T10:00:00.000Z", id: "abc123" };
    const encoded = encodeCursor(payload);
    expect(encoded).not.toContain("{");
    expect(decodeCursor(encoded)).toEqual(payload);
  });

  it("returns null for missing/undefined input", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });

  it("returns null for tampered/invalid cursors", () => {
    expect(decodeCursor("not-base64-json")).toBeNull();
    expect(decodeCursor(Buffer.from(JSON.stringify({ id: "x" })).toString("base64url"))).toBeNull();
  });
});
