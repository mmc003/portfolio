/**
 * Vitest global setup: provision a fresh SQLite test database by applying the
 * real Prisma migrations to an empty file. This satisfies the Phase 3 gate
 * ("migration works from an empty database") and gives every test file a
 * clean, shared DB. Rows are cleaned per-test in beforeEach.
 *
 * The temp DB lives under the OS temp dir (not the working tree) and is removed
 * on teardown. DATABASE_URL is exported via process.env so the PrismaClient
 * factory points at it.
 */
import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

let tmpDir: string;

export function setup(): () => void {
  tmpDir = mkdtempSync(path.join(tmpdir(), "portfolio-test-"));
  const dbFile = path.join(tmpDir, "test.db");
  const datasourceUrl = `file:${dbFile}`;

  process.env.DATABASE_URL = datasourceUrl;
  process.env.NODE_ENV = "test";
  if (!process.env.ADMIN_API_TOKEN) process.env.ADMIN_API_TOKEN = "test-admin-secret";
  if (!process.env.PUBLIC_BASE_URL) process.env.PUBLIC_BASE_URL = "http://localhost:4000";
  if (!process.env.STORAGE_LOCAL_DIR) process.env.STORAGE_LOCAL_DIR = path.join(tmpDir, "uploads");

  // Apply real migrations to the empty DB (proves migrations are valid).
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: datasourceUrl },
  });

  return () => {
    rmSync(tmpDir, { recursive: true, force: true });
  };
}
