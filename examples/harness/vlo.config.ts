import { defineConfig } from "@oona/vlo";

export default defineConfig({
  workflows: ["*.workflow.ts"],
  workers: ["*.worker.ts"],
  activities: ["activities.ts"],
  profiles: {
    dev: {
      journal: "sqlite://.vlo/harness.db",
      blob: "file://.vlo/blobs",
      roles: ["orchestrator", "api", "worker:default"],
      dispatcher: { mode: "loop" },
    },
  },
});
