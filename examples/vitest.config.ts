import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const sdk = (path: string) => fileURLToPath(new URL(`../sdk/ts/sdk/src/${path}`, import.meta.url));

// The examples import `@oona/vlo` by name. As in tsconfig.json, point the bare specifiers at
// the SDK sources so the tests run in a fresh checkout with no build step.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@oona\/vlo\/host$/, replacement: sdk("host.ts") },
      { find: /^@oona\/vlo\/agent$/, replacement: sdk("agent/index.ts") },
      { find: /^@oona\/vlo$/, replacement: sdk("index.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["*/**/*.test.ts"],
    testTimeout: 20_000,
  },
});
