import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./test/setupDb.ts"],
    // DB-writing test files share one SQLite file; serialize them to avoid
    // "database is locked" under parallel access. The suite is small.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    // Keep test artifacts out of the working tree.
    cacheDir: "node_modules/.vitest",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/scripts/**", "src/index.ts"],
    },
  },
});
