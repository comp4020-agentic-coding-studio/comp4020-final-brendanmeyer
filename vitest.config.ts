import { defineConfig } from "vitest/config";

// spec/ checks the running app over HTTP/WS (spec/global-setup.ts finds it).
// src/client/ tests are plain unit tests for DOM logic that doesn't belong
// in that HTTP contract -- each file opts into jsdom itself via a
// `// @vitest-environment jsdom` comment, since the default environment
// stays "node" for everything else.
export default defineConfig({
  test: {
    include: ["spec/**/*.test.ts", "src/client/**/*.test.ts"],
    globalSetup: ["./spec/global-setup.ts"],
  },
});
