/**
 * `defineDomain` — one registration object per area of an application, so a host is built
 * from a list of domains instead of four parallel arrays. A domain is only a grouping:
 * `createHost` flattens every domain onto `workflows`, `workers`, `activities` and
 * `signals`, and roles are still derived from the workers' queues.
 */

import type { Workflow } from "../core/workflow.ts";
import type { ActivityRegistration, SignalRegistration } from "./context.ts";
import type { Worker } from "./worker/registry.ts";

/** What {@link defineDomain} takes. Every registry is optional. */
export interface DomainDef {
  /** Name for diagnostics; two domains with the same name are refused. */
  name: string;
  /** Workflows this domain owns. */
  workflows?: readonly Workflow[];
  /** Workers run in-process for this domain. Each adds a `worker:<queue>` role when `roles` is absent. */
  workers?: readonly Worker[];
  /** Activities whose output the host validates. */
  activities?: readonly ActivityRegistration[];
  /** Signals whose payload the host validates. */
  signals?: readonly SignalRegistration[];
}

/** A defined domain: the value {@link defineDomain} returns and `createHost({ domains })` flattens. */
export interface Domain {
  /** Discriminator, like `Worker.kind`. */
  readonly kind: "domain";
  /** The domain's name. */
  readonly name: string;
  /** Workflows this domain owns. */
  readonly workflows: readonly Workflow[];
  /** Workers run in-process for this domain. */
  readonly workers: readonly Worker[];
  /** Activities whose output the host validates. */
  readonly activities: readonly ActivityRegistration[];
  /** Signals whose payload the host validates. */
  readonly signals: readonly SignalRegistration[];
}

/** The four registries a host is built from, flattened. */
export interface Registries {
  /** Every workflow, across domains and the flat option. */
  workflows: readonly Workflow[];
  /** Every worker. */
  workers: readonly Worker[];
  /** Every activity registration. */
  activities: readonly ActivityRegistration[];
  /** Every signal registration. */
  signals: readonly SignalRegistration[];
}

/**
 * Groups one area's workflows, workers, activities and signals under a name, for
 * `createHost({ domains: [...] })`.
 *
 * @example
 * ```ts
 * import { defineDomain } from "@oona/vlo";
 * import { brandActivities } from "./activities.ts";
 * import { brandResearch, brandWeekly } from "./workflows.ts";
 * import { brandWorker } from "./worker.ts";
 *
 * export const brandDomain = defineDomain({
 *   name: "brand",
 *   workflows: [brandResearch, brandWeekly],
 *   workers: [brandWorker],
 *   activities: brandActivities,
 * });
 * ```
 */
export function defineDomain(def: DomainDef): Domain {
  return {
    kind: "domain",
    name: def.name,
    workflows: def.workflows ?? [],
    workers: def.workers ?? [],
    activities: def.activities ?? [],
    signals: def.signals ?? [],
  };
}

/**
 * Flattens `domains` onto the flat registries. Throws a `TypeError` when two domains share
 * a name, or when two different workflow or activity values are registered under one name;
 * the same value registered twice is fine.
 */
export function mergeDomains(
  options: Partial<Registries> & { domains?: readonly Domain[] },
): Registries {
  const seen = new Set<string>();
  for (const domain of options.domains ?? []) {
    if (seen.has(domain.name)) throw new TypeError(`defineDomain: two domains are named "${domain.name}"`);
    seen.add(domain.name);
  }
  const domains = options.domains ?? [];
  return {
    workflows: unique("workflow", [...(options.workflows ?? []), ...domains.flatMap((d) => d.workflows)]),
    workers: [...new Set([...(options.workers ?? []), ...domains.flatMap((d) => d.workers)])],
    activities: unique("activity", [...(options.activities ?? []), ...domains.flatMap((d) => d.activities)]),
    signals: unique("signal", [...(options.signals ?? []), ...domains.flatMap((d) => d.signals)]),
  };
}

function unique<T extends { readonly name: string }>(what: string, items: readonly T[]): T[] {
  const byName = new Map<string, T>();
  for (const item of items) {
    const prior = byName.get(item.name);
    if (prior !== undefined && prior !== item) {
      throw new TypeError(`createHost: two different ${what} definitions are named "${item.name}"`);
    }
    byName.set(item.name, item);
  }
  return [...byName.values()];
}
