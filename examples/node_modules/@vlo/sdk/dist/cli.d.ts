//#region src/cli.d.ts
/**
 * The `vlo` command: one verb per file under `cli/`.
 *
 * `dev` and `serve` are the same host with different defaults — that is deliberate, and it
 * is why `doctor` and `deploy` read the same profile: whatever runs on a laptop, what a
 * check reports and what a template deploys all come from one place in `vlo.config.ts`.
 */
export declare function main(argv?: readonly string[], cwd?: string): Promise<void>;
//#endregion