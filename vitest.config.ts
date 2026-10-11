import { defineConfig } from "vitest/config";

// Every test in spec/ runs against the running app, which spec/global-setup.ts
// finds. Only spec/ runs: a test anywhere else needs adding to `include`.
// Most of spec/ checks it over HTTP/WS; a DOM-only file like
// spec/fullscreen.test.ts opts into jsdom itself via a
// `// @vitest-environment jsdom` comment instead, since the default
// environment stays "node".
export default defineConfig({
  test: {
    include: ["spec/**/*.test.ts"],
    globalSetup: ["./spec/global-setup.ts"],
  },
});
