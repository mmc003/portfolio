import { describe, it, expect } from "vitest";
import { S3Storage } from "./s3";

/**
 * A minimal fake S3 client that records the commands it receives.
 * This lets us assert the adapter issues the correct operations without a
 * real bucket. Real S3/MinIO integration is covered by CI service containers.
 */
function makeFakeClient() {
  const sent: { name: string; input: Record<string, unknown> }[] = [];
  const client = {
    async send(command: { constructor: { name: string }; input: Record<string, unknown> }) {
      sent.push({ name: command.constructor.name, input: command.input });
      return {};
    },
  };
  return { client, sent };
}

describe("S3Storage", () => {
  it("uploads via PutObjectCommand with immutable cache headers", async () => {
    const { client, sent } = makeFakeClient();
    const s3 = new S3Storage({
      region: "us-east-1",
      bucket: "bkt",
      accessKeyId: "k",
      secretAccessKey: "s",
      endpoint: "http://localhost:9000",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
    });
    const res = await s3.upload({
      data: Buffer.from("bytes"),
      objectKey: "images/x.webp",
      mimeType: "image/webp",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].name).toBe("PutObjectCommand");
    expect(sent[0].input.Bucket).toBe("bkt");
    expect(sent[0].input.Key).toBe("images/x.webp");
    expect(sent[0].input.ContentType).toBe("image/webp");
    expect(String(sent[0].input.CacheControl)).toContain("immutable");
    expect(res.url).toBe("http://localhost:9000/bkt/images/x.webp");
  });

  it("deletes via DeleteObjectCommand", async () => {
    const { client, sent } = makeFakeClient();
    const s3 = new S3Storage({
      region: "us-east-1",
      bucket: "bkt",
      accessKeyId: "k",
      secretAccessKey: "s",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
    });
    await s3.delete("images/x.webp");
    expect(sent[0].name).toBe("DeleteObjectCommand");
    expect(sent[0].input.Key).toBe("images/x.webp");
  });

  it("prefers a publicBaseUrl (CDN) for public URLs", () => {
    const s3 = new S3Storage({
      region: "us-east-1",
      bucket: "bkt",
      accessKeyId: "k",
      secretAccessKey: "s",
      publicBaseUrl: "https://cdn.example.com",
    });
    expect(s3.getPublicUrl("images/x.webp")).toBe("https://cdn.example.com/images/x.webp");
  });

  it("falls back to virtual-hosted AWS URL when no endpoint/base set", () => {
    const s3 = new S3Storage({
      region: "eu-west-1",
      bucket: "bkt",
      accessKeyId: "k",
      secretAccessKey: "s",
    });
    expect(s3.getPublicUrl("images/x.webp")).toBe(
      "https://bkt.s3.eu-west-1.amazonaws.com/images/x.webp"
    );
  });

  it("rejects an unsafe key", async () => {
    const { client } = makeFakeClient();
    const s3 = new S3Storage({
      region: "us-east-1",
      bucket: "bkt",
      accessKeyId: "k",
      secretAccessKey: "s",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
    });
    await expect(
      s3.upload({ data: Buffer.from("x"), objectKey: "../escape", mimeType: "image/webp" })
    ).rejects.toThrow(/Unsafe object key/);
  });
});
