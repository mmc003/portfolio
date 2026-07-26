import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./test/setupDb.ts"],
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
