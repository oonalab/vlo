import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    host: "src/host.ts",
    cli: "src/cli.ts",
    testing: "src/testing.ts",
  },
  format: "esm",
  platform: "node",
  target: "node22",
  // package.json is "type": "module", so emit .js/.d.ts (matches `exports` and `bin`).
  fixedExtension: false,
  dts: true,
  clean: true,
  // `testing` registers vitest suites; vitest must stay a peer of the consumer, never bundled.
  external: ["pg", "zod", "node:sqlite", "vitest"],
});
