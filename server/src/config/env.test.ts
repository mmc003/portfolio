import { describe, it, expect, beforeEach } from "vitest";
import { loadEnv, DEV_FALLBACK_ADMIN_TOKEN } from "./env";

const base = {
  NODE_ENV: "test",
  ADMIN_API_TOKEN: "real-secret",
};

describe("env validation", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
  });

  it("applies sensible defaults for a dev environment", () => {
    const env = loadEnv({ ...base });
    expect(env.PORT).toBe(4000);
    expect(env.STORAGE_DRIVER).toBe("local");
    expect(env.DATABASE_URL).toBe("file:./dev.db");
    expect(env.MAX_UPLOAD_SIZE_MB).toBe(50);
    expect(env.IMAGE_THUMBNAIL_WIDTH).toBe(500);
    expect(env.IMAGE_MEDIUM_WIDTH).toBe(1600);
  });

  it("uses the dev fallback token when ADMIN_API_TOKEN is missing in non-production", () => {
    const env = loadEnv({ NODE_ENV: "development" });
    expect(env.ADMIN_API_TOKEN).toBe(DEV_FALLBACK_ADMIN_TOKEN);
  });

  it("requires ADMIN_API_TOKEN in production", () => {
    expect(() => loadEnv({ NODE_ENV: "production" })).toThrow(
      /ADMIN_API_TOKEN is required in production/
    );
  });

  it("coerces numeric env strings to numbers", () => {
    const env = loadEnv({
      ...base,
      PORT: "8080",
      MAX_UPLOAD_SIZE_MB: "12",
      IMAGE_THUMBNAIL_WIDTH: "300",
      IMAGE_MEDIUM_WIDTH: "900",
    });
    expect(env.PORT).toBe(8080);
    expect(env.MAX_UPLOAD_SIZE_MB).toBe(12);
    expect(env.IMAGE_THUMBNAIL_WIDTH).toBe(300);
    expect(env.IMAGE_MEDIUM_WIDTH).toBe(900);
  });

  it("rejects an invalid PORT", () => {
    expect(() => loadEnv({ ...base, PORT: "not-a-number" })).toThrow(
      /Invalid environment configuration/
    );
  });

  it("rejects an invalid STORAGE_DRIVER", () => {
    expect(() => loadEnv({ ...base, STORAGE_DRIVER: "ftp" })).toThrow(
      /Invalid environment configuration/
    );
  });

  it("requires S3 settings when STORAGE_DRIVER=s3", () => {
    expect(() => loadEnv({ ...base, STORAGE_DRIVER: "s3" })).toThrow(
      /STORAGE_DRIVER=s3 requires:/
    );
  });

  it("accepts STORAGE_DRIVER=s3 when all S3 settings are present", () => {
    const env = loadEnv({
      ...base,
      STORAGE_DRIVER: "s3",
      S3_ENDPOINT: "http://localhost:9000",
      S3_REGION: "us-east-1",
      S3_BUCKET: "b",
      S3_ACCESS_KEY_ID: "k",
      S3_SECRET_ACCESS_KEY: "s",
    });
    expect(env.STORAGE_DRIVER).toBe("s3");
    expect(env.S3_BUCKET).toBe("b");
  });
});
