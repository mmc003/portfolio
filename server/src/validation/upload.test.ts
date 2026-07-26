import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { sniffMime, validateUpload, ALLOWED_MIME } from "./upload";

const FIXTURES = path.join(__dirname, "../../test/fixtures");
const sampleJpg = () => readFileSync(path.join(FIXTURES, "sample.jpg"));
const samplePng = () => readFileSync(path.join(FIXTURES, "sample.png"));
const notImage = () => readFileSync(path.join(FIXTURES, "not-an-image.txt"));

describe("sniffMime", () => {
  it("detects a real JPEG", () => {
    expect(sniffMime(sampleJpg())).toBe("image/jpeg");
  });
  it("detects a real PNG", () => {
    expect(sniffMime(samplePng())).toBe("image/png");
  });
  it("returns null for a text file", () => {
    expect(sniffMime(notImage())).toBeNull();
  });
  it("returns null for a tiny/empty buffer", () => {
    expect(sniffMime(Buffer.alloc(4))).toBeNull();
    expect(sniffMime(Buffer.alloc(0))).toBeNull();
  });
  it("detects WEBP from a crafted RIFF header", () => {
    const buf = Buffer.concat([
      Buffer.from("RIFF", "latin1"),
      Buffer.alloc(4),
      Buffer.from("WEBP", "latin1"),
      Buffer.alloc(8),
    ]);
    expect(sniffMime(buf)).toBe("image/webp");
  });
});

describe("validateUpload", () => {
  const maxBytes = 5 * 1024 * 1024;

  it("accepts a valid JPEG within size limits and returns detected mime", () => {
    const buf = sampleJpg();
    const mime = validateUpload({ buffer: buf, declaredMime: "image/jpeg", sizeBytes: buf.length, maxBytes });
    expect(mime).toBe("image/jpeg");
  });

  it("rejects oversized uploads with 413", () => {
    const buf = sampleJpg();
    expect(() =>
      validateUpload({ buffer: buf, sizeBytes: buf.length, maxBytes: 10 })
    ).toThrow(/upload limit/);
  });

  it("rejects an unsupported file type with 415", () => {
    const buf = notImage();
    // Pretend the (small) text buffer is large enough to pass size; sniff fails.
    expect(() =>
      validateUpload({ buffer: buf, sizeBytes: buf.length, maxBytes })
    ).toThrow(/Unsupported file type/);
  });

  it("flags a spoofed Content-Type (declared mime != signature) with 400", () => {
    const buf = sampleJpg();
    expect(() =>
      validateUpload({ buffer: buf, declaredMime: "image/png", sizeBytes: buf.length, maxBytes })
    ).toThrow(/does not match declared type/);
  });

  it("allows all configured MIME types", () => {
    expect(ALLOWED_MIME).toContain("image/jpeg");
    expect(ALLOWED_MIME).toContain("image/png");
    expect(ALLOWED_MIME).toContain("image/webp");
  });
});
