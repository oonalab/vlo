import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: "esm",
  platform: "node",
  target: "node22",
  // package.json is "type": "module", so emit .js/.d.ts (matches `exports`).
  fixedExtension: false,
  dts: true,
  clean: true,
  external: ["@vlo/sdk", "@vlo/sdk/host", "zod"],
});
