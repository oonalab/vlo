/**
 * What `vlo dev` and `vlo serve` share: load the config, open and migrate the journal,
 * bind the port, and print the same four ✓ lines. The two verbs differ only in their
 * defaults — that is the point, so a laptop and Cloud Run run identical code.
 */

import { loadConfig, type LoadedConfig } from "../config/load.ts";
import { DEFAULT_PORT, serve, type ServeResult } from "../host/roles.ts";
import { openJournal } from "../journal/open.ts";

export interface StartOptions {
  cwd: string;
  /** Profile name. Absent is only valid with `implicitProfile`. */
  profile?: string;
  /** Let `loadConfig` pick `local` or the sole profile when `profile` is absent (`vlo dev`). */
  implicitProfile?: boolean;
  configPath?: string;
  /** Overrides the profile's `port`. Absent ⇒ profile, then {@link DEFAULT_PORT}. */
  port?: number;
}

export interface Started {
  running: ServeResult;
  loaded: LoadedConfig;
  close(): Promise<void>;
}

export async function start(options: StartOptions): Promise<Started> {
  const loaded = await loadConfig(options.cwd, options.profile, options.configPath, {
    implicitProfile: options.implicitProfile === true,
  });
  const journal = openJournal(loaded.profile.journal);
  await journal.migrate();
  line("journal", loaded.profile.journal);

  const names = loaded.workflows.map((w) => w.name).sort();
  line(`found ${names.length} workflow${names.length === 1 ? "" : "s"}`, names.join(" · "));
  describeWorkers(loaded.workers.length, Object.keys(loaded.profile.queues));

  const { roles, dispatcher, publicUrl } = loaded.profile;
  const running = await serve({
    journal,
    blob: loaded.profile.blob,
    workflows: loaded.workflows,
    workers: loaded.workers,
    activities: loaded.activities,
    signals: loaded.signals,
    queues: loaded.profile.queues,
    auth: loaded.profile.auth,
    ...(roles !== undefined ? { roles } : {}),
    ...(dispatcher !== undefined ? { dispatcher } : {}),
    ...(publicUrl !== undefined ? { publicUrl } : {}),
    port: options.port ?? loaded.profile.port ?? DEFAULT_PORT,
  });
  line("api", `http://localhost:${running.port}`);

  // The dispatcher never writes to stdout itself; on a terminal its warnings belong there.
  running.host.events.on("warning", (w: { message: string; error?: unknown }) => {
    const detail = w.error instanceof Error ? `: ${w.error.message}` : "";
    process.stderr.write(`  ⚠ ${w.message}${detail}\n`);
  });

  const close = async (): Promise<void> => {
    await running.close();
    await journal.close();
  };
  const shutdown = (): void => void close();
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return { running, loaded, close };
}

function describeWorkers(count: number, remoteQueues: string[]): void {
  if (count > 0) {
    line(`found ${count} worker${count === 1 ? "" : "s"}`, "in-process");
    return;
  }
  if (remoteQueues.length > 0) {
    line("workers", `remote via queues ${remoteQueues.join(" · ")}`);
    return;
  }
  process.stderr.write(
    "  ⚠ no workers found: tasks will stay scheduled until a module exporting defineWorker() " +
      "matches `workers` in vlo.config.ts, or a queue url is configured\n",
  );
}

export function line(label: string, value: string): void {
  const gap = label.length >= 9 ? "   " : "";
  process.stdout.write(`  ✓ ${label.padEnd(9)}${gap}${value}\n`);
}
