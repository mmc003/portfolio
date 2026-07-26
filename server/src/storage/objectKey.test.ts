import { describe, it, expect } from "vitest";
import {
  sanitizeFilename,
  sanitizeCategory,
  sanitizeExtension,
  generateKeySet,
  assertSafeObjectKey,
} from "./objectKey";

describe("sanitizeFilename", () => {
  it("lowercases, dashes spaces, strips symbols and accents", () => {
    expect(sanitizeFilename("My Cool Photo! (1).JPG")).toBe("my-cool-photo-1");
    expect(sanitizeFilename("Café naïve — yep")).toBe("cafe-naive-yep");
  });
  it("falls back to 'image' for empty/garbage input", () => {
    expect(sanitizeFilename("!!!")).toBe("image");
    expect(sanitizeFilename("")).toBe("image");
  });
  it("truncates very long names", () => {
    const long = "a".repeat(200);
    expect(sanitizeFilename(long).length).toBe(60);
  });
});

describe("sanitizeCategory", () => {
  it("normalizes and returns undefined for empty", () => {
    expect(sanitizeCategory("Da Nang Boats!")).toBe("danangboats");
    expect(sanitizeCategory("")).toBeUndefined();
    expect(sanitizeCategory(null)).toBeUndefined();
  });
});

describe("sanitizeExtension", () => {
  it("strips non-alpha", () => {
    expect(sanitizeExtension(".W_eBp")).toBe("webp");
    expect(sanitizeExtension("")).toBe("bin");
  });
});

describe("generateKeySet", () => {
  it("produces a unique, safe, grouped key set", () => {
    const ks = generateKeySet({
      originalFilename: "Sunset.JPG",
      category: "vancouver",
      originalExt: "jpg",
      derivativeExt: "webp",
      now: new Date("2026-07-25T00:00:00Z"),
      uuid: "abc-123",
    });
    expect(ks.base).toBe("images/vancouver/2026/07/abc-123-sunset");
    expect(ks.original).toBe("images/vancouver/2026/07/abc-123-sunset/original.jpg");
    expect(ks.thumbnail).toBe("images/vancouver/2026/07/abc-123-sunset/thumbnail.webp");
    expect(ks.medium).toBe("images/vancouver/2026/07/abc-123-sunset/medium.webp");
  });

  it("omits the category segment when absent", () => {
    const ks = generateKeySet({
      originalFilename: "x.jpg",
      originalExt: "jpg",
      derivativeExt: "webp",
      uuid: "u",
      now: new Date("2026-01-02T00:00:00Z"),
    });
    expect(ks.base).toBe("images/2026/01/u-x");
  });

  it("generates a unique id per call when uuid is not injected", () => {
    const a = generateKeySet({ originalFilename: "a.jpg", originalExt: "jpg", derivativeExt: "webp" });
    const b = generateKeySet({ originalFilename: "a.jpg", originalExt: "jpg", derivativeExt: "webp" });
    expect(a.base).not.toBe(b.base);
  });
});

describe("assertSafeObjectKey", () => {
  it("accepts a normal key", () => {
    expect(() => assertSafeObjectKey("images/2026/07/abc/original.webp")).not.toThrow();
  });
  it.each([
    ["path traversal", "images/../etc/passwd"],
    ["leading slash", "/etc/passwd"],
    ["empty", ""],
    ["double slash", "images//x"],
    ["spaces", "images/my file.webp"],
  ])("rejects unsafe key (%s)", (_label, key) => {
    expect(() => assertSafeObjectKey(key)).toThrow(/Unsafe object key/);
  });
});
