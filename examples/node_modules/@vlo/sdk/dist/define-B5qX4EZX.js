//#region src/config/define.ts
/**
* Refers to an environment variable by name so a secret never sits in `vlo.config.ts`.
*
* The value is read when the profile is loaded, not when `env` is called. An unset or empty
* variable fails the load with a message naming the variable, unless `optional` is `true`,
* in which case the field is simply absent.
*
* @example
* ```ts
* import { defineConfig, env } from "@vlo/sdk";
*
* export default defineConfig({
*   workflows: ["*.workflow.ts"],
*   profiles: {
*     prod: {
*       journal: env("DATABASE_URL"),
*       auth: { token: env("VLO_TOKEN"), pushSecret: env("VLO_PUSH_SECRET", { optional: true }) },
*     },
*   },
* });
* ```
*/
function env(name, options = {}) {
	return {
		__env: name,
		...options.optional !== void 0 ? { optional: options.optional } : {}
	};
}
/** Whether `value` is an {@link EnvRef} rather than a literal. */
function isEnvRef(value) {
	return typeof value === "object" && value !== null && "__env" in value;
}
/**
* Types and checks a `vlo.config.ts` and returns it unchanged for `export default`.
*
* Throws a `TypeError` when `profiles` is empty. Values wrapped with {@link env} are
* resolved later, when the CLI loads the profile.
*
* @example
* ```ts
* import { defineConfig, env } from "@vlo/sdk";
*
* export default defineConfig({
*   workflows: ["./workflows/*.workflow.ts"],
*   workers: ["./workers/*.worker.ts"],
*   profiles: {
*     local: { journal: "sqlite://.vlo/dev.db", blob: "file://.vlo/blobs" },
*     prod: {
*       journal: env("DATABASE_URL"),
*       auth: { token: env("VLO_TOKEN") },
*       roles: ["orchestrator", "api"],
*       queues: { media: { mode: "pull" } },
*       dispatcher: { mode: "manual" },
*       deploy: { target: "vercel", cron: "* * * * *" },
*     },
*   },
* });
* ```
*/
function defineConfig(config) {
	if (Object.keys(config.profiles).length === 0) throw new TypeError("defineConfig: at least one profile is required");
	return config;
}
/** Used when there is no `vlo.config.ts`: SQLite and a file blob store under `.vlo/`. */
const DEFAULT_CONFIG = {
	workflows: ["**/*.workflow.{ts,js,mjs}"],
	workers: ["**/*.worker.{ts,js,mjs}"],
	profiles: { local: {
		journal: "sqlite://.vlo/dev.db",
		blob: "file://.vlo/blobs"
	} }
};
//#endregion
export { isEnvRef as i, defineConfig as n, env as r, DEFAULT_CONFIG as t };
