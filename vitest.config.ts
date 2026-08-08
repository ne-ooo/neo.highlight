import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/*.config.ts",
        "**/types.ts",
      ],
      thresholds: {
        statements: 95,
        branches: 80,
        functions: 90,
        lines: 95,
      },
    },
  },
});
