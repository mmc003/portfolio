import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { LocalFilesystemStorage } from "./local-fs";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "lfstest-"));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("LocalFilesystemStorage", () => {
  it("uploads, reads back, and deletes an object", async () => {
    const storage = new LocalFilesystemStorage({ rootDir: root });
    const key = "images/2026/07/abc/original.jpg";
    const data = Buffer.from("fake-jpeg-bytes");

    const stored = await storage.upload({ data, objectKey: key, mimeType: "image/jpeg" });
    expect(stored.size).toBe(data.byteLength);
    expect(stored.url).toBe(`/media/${key}`);

    const onDisk = await fs.readFile(path.join(root, key));
    expect(onDisk.equals(data)).toBe(true);

    await storage.delete(key);
    await expect(fs.readFile(path.join(root, key))).rejects.toThrow();
  });

  it("delete is idempotent (missing file does not throw)", async () => {
    const storage = new LocalFilesystemStorage({ rootDir: root });
    await expect(storage.delete("images/missing.webp")).resolves.toBeUndefined();
  });

  it("rejects path-traversal keys", async () => {
    const storage = new LocalFilesystemStorage({ rootDir: root });
    await expect(
      storage.upload({ data: Buffer.from("x"), objectKey: "../escape.webp", mimeType: "image/webp" })
    ).rejects.toThrow(/Unsafe object key|escapes storage root/);
    expect(() => storage.getPublicUrl("../etc/passwd")).toThrow(/Unsafe object key/);
  });

  it("creates nested directories as needed", async () => {
    const storage = new LocalFilesystemStorage({ rootDir: root });
    const key = "images/cat/2026/07/uuid/medium.webp";
    await storage.upload({ data: Buffer.from("y"), objectKey: key, mimeType: "image/webp" });
    const stat = await fs.stat(path.join(root, key));
    expect(stat.isFile()).toBe(true);
  });
});
