/**
 * Centralized, validated environment configuration.
 *
 * All runtime configuration flows through one Zod schema so the process fails
 * fast with a useful message if required config is missing/malformed, and the
 * rest of the app reads a strongly-typed `env`.
 */
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

/** A clearly-insecure value used only when NODE_ENV is not "production". */
export const DEV_FALLBACK_ADMIN_TOKEN = "dev-admin-token-change-me";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  CORS_ORIGIN: z.string().default("*"),
  // Optional override for the media-URL origin. When empty (default), media
  // URLs are built from the incoming request's host, so they work on any port
  // or behind a proxy without configuration. Ignored by the S3 driver.
  PUBLIC_BASE_URL: z.string().default(""),

  ADMIN_API_TOKEN: z.string().min(1),

  DATABASE_URL: z.string().min(1).default("file:./dev.db"),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./uploads"),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),

  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(50),
  IMAGE_THUMBNAIL_WIDTH: z.coerce.number().int().positive().default(500),
  IMAGE_MEDIUM_WIDTH: z.coerce.number().int().positive().default(1600),
  IMAGE_DERIVATIVE_FORMAT: z.enum(["webp", "jpeg"]).default("webp"),
});

export type Env = z.infer<typeof schema>;

/**
 * Validate the environment. Throws a single aggregated, human-readable error
 * on failure. Accepts an injected map to make it trivially testable without
 * polluting process.env.
 */
export function loadEnv(input: Record<string, unknown> = process.env): Env {
  const nodeEnv = (input.NODE_ENV as string | undefined) ?? "development";

  // ADMIN_API_TOKEN is the only "soft" required var: a dev fallback keeps local
  // development and tests ergonomic, but production MUST supply a real secret.
  if (
    !input.ADMIN_API_TOKEN ||
    typeof input.ADMIN_API_TOKEN !== "string" ||
    input.ADMIN_API_TOKEN.length === 0
  ) {
    if (nodeEnv === "production") {
      throw new Error(
        "ADMIN_API_TOKEN is required in production. Generate one with `openssl rand -hex 32`."
      );
    }
    input = { ...input, ADMIN_API_TOKEN: DEV_FALLBACK_ADMIN_TOKEN };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  // Cross-field validation: the S3 driver requires S3 settings.
  const env = parsed.data;
  if (env.STORAGE_DRIVER === "s3") {
    const missing = [
      "S3_ENDPOINT",
      "S3_REGION",
      "S3_BUCKET",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
    ].filter((k) => !env[k as keyof Env]);
    if (missing.length > 0) {
      throw new Error(`STORAGE_DRIVER=s3 requires: ${missing.join(", ")}`);
    }
  }
  return env;
}

let cached: Env | undefined;

/** Returns the validated env, validating once on first use. */
export function getEnv(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}

/** Reset the cache (tests). */
export function resetEnvCache(): void {
  cached = undefined;
}
