#!/usr/bin/env node
/**
 * Switch the Prisma datasource provider in prisma/schema.prisma to match the
 * target database. The schema is portable, but Prisma requires the provider to
 * be set at generation time, so production (PostgreSQL) swaps it before
 * `prisma generate`.
 *
 * Usage:
 *   node scripts/set-provider.js               # auto-detect from DATABASE_URL
 *   node scripts/set-provider.js postgresql    # force PostgreSQL
 *   node scripts/set-provider.js sqlite        # force SQLite (local)
 */
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");

let provider = process.argv[2];
if (!provider || provider === "auto") {
  const url = process.env.DATABASE_URL || "";
  provider = url.startsWith("postgres") ? "postgresql" : "sqlite";
}
if (provider !== "sqlite" && provider !== "postgresql") {
  console.error(`Unknown provider: ${provider}`);
  process.exit(1);
}

const schema = fs.readFileSync(schemaPath, "utf8");
const next = schema.replace(
  /(datasource\s+db\s*{[^}]*?provider\s*=\s*")(?:sqlite|postgresql)(")/s,
  `$1${provider}$2`
);
if (next === schema) {
  console.error("Could not locate the provider line in schema.prisma");
  process.exit(1);
}
fs.writeFileSync(schemaPath, next);
console.log(`prisma provider set to: ${provider}`);
