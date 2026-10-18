import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/components/setup.ts"],
    include: ["tests/**/*.test.tsx", "tests/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
  },
});
