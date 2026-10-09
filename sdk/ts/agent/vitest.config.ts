import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Mirrors the `paths` in tsconfig.json: run against `@vlo/sdk` sources, not its `dist/`. */
const sdk = (entry: string): string => fileURLToPath(new URL(`../sdk/src/${entry}`, import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    testTimeout: 20_000,
  },
  resolve: {
    // Longest specifier first: "@vlo/sdk" is a prefix of "@vlo/sdk/host".
    alias: [
      { find: "@vlo/sdk/host", replacement: sdk("host.ts") },
      { find: "@vlo/sdk", replacement: sdk("index.ts") },
    ],
  },
});
