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
    // Most spec files open real WebSocket connections against the same
    // single live app instance -- running files in parallel lets one
    // file's live connections count toward another's activeCount/waiting
    // checks. Confirmed as a real, reproducible failure (not just a
    // theoretical risk) once enough WS-opening files existed to overlap in
    // practice, not only a flake risk as it was before. Serializing file
    // execution trades suite wall-clock time for determinism, which is the
    // right trade for a suite this size against one shared instance.
    fileParallelism: false,
  },
});
