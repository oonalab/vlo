/**
 * `defineWorkflow` — a workflow is a pure reducer `(state, event) → (state, commands)`
 *. Nothing here does I/O, reads a clock or generates randomness: every
 * non-deterministic input arrives on the event.
 */

import type { Command, Json, ReducerEvent } from "../kernel/protocol.ts";
import { contentHash } from "./hash.ts";

/** Workflow-state reduction: the next state plus the commands it asks the engine to run. */
export type Reduction<S> = readonly [S, readonly Command[]];

type EventOf<T extends ReducerEvent["type"]> = Extract<ReducerEvent, { type: T }>;

/**
 * One pure handler per {@link ReducerEvent} type. Each receives the current state and the
 * event and returns a {@link Reduction}. A run receiving an event with no handler fails.
 */
export interface Handlers<S> {
  /** The first event of a run: `state` is what `init` built from the start input. */
  started(state: S, event: EventOf<"started">): Reduction<S>;
  /** A task reached a terminal status; `event.output` is set when it `succeeded`. */
  task_done(state: S, event: EventOf<"task_done">): Reduction<S>;
  /** A signal the run was waiting on was delivered. */
  signal?(state: S, event: EventOf<"signal">): Reduction<S>;
  /** A timer opened by `cmd.timer` fired. */
  timer?(state: S, event: EventOf<"timer">): Reduction<S>;
  /** A child run started by `cmd.spawn` closed. */
  child_done?(state: S, event: EventOf<"child_done">): Reduction<S>;
}

/** What {@link defineWorkflow} takes: how to build the initial state and the handlers. */
export interface WorkflowDef<S, I> {
  /** Builds the initial state from the start input. Called once, just before `on.started`. */
  init(input: I): S;
  /** The event handlers. */
  on: Handlers<S>;
}

/** The wire form of one reduction: state as byte-exact JSON, plus plain `Command` objects. */
export interface ReductionWire {
  /** The next state, as `JSON.stringify` produced it. */
  state: string;
  /** The commands the handler returned, copied. */
  commands: Command[];
}

/**
 * A defined workflow: the value {@link defineWorkflow} returns and the host registers.
 * `S` is the state type, `I` the start-input type.
 */
export interface Workflow<S = unknown, I = unknown> {
  /** Discriminator the config loader uses to find workflows among a module's exports. */
  readonly kind: "workflow";
  /** The name given to {@link defineWorkflow}; what a run is started by. */
  readonly name: string;
  /** Content hash of `name`; runs pin it as their component digest. */
  readonly digest: string;
  /** The definition, as given. */
  readonly def: WorkflowDef<S, I>;
  /**
   * Drive one event. Pass `initInput` for the `started` event (state is built by `init`);
   * otherwise `stateJson` is the checkpoint to fold onto. Throws when no handler is
   * registered for the event type.
   */
  reduce(stateJson: string | null, event: ReducerEvent, initInput?: Json): ReductionWire;
}

/**
 * Fails the run. There is no `cmd.fail`: a run fails when its reducer throws, which keeps
 * failure out of the command vocabulary and off the happy path.
 *
 * Host contract: the host catches a throw from `Workflow.reduce`, appends a `failed` event
 * (`cause: "app_error"`, `error` = this message) and marks the run `failed`. The state
 * checkpoint from before the event is kept, so the run can be rewound and forked.
 */
export class WorkflowFailure extends Error {
  /** Structured context for the failure, as given; `undefined` when none was. */
  readonly details: Json | undefined;

  /** @param details - Anything JSON that helps explain the failure, e.g. the step id and cause. */
  constructor(message: string, details?: Json) {
    super(message);
    this.name = "WorkflowFailure";
    this.details = details;
  }
}

/**
 * Defines a workflow: a named, pure reducer over the run's events.
 *
 * `def` is either a hand-written {@link WorkflowDef} or the output of {@link sequence}.
 * Handlers must not read a clock, generate randomness or do I/O; time and randomness arrive
 * on the event. State must be JSON-serialisable: it is stringified after every reduction.
 * A handler that throws fails the run (see {@link WorkflowFailure}); so does an event
 * whose handler is not registered, or a handler returning anything but `[state, Command[]]`.
 *
 * @example
 * ```ts
 * import { cmd, defineWorkflow } from "@vlo/sdk";
 * import { work } from "./activities.ts";
 *
 * export default defineWorkflow("uppercase", {
 *   init: (input: { item: string }) => ({ item: input.item }),
 *   on: {
 *     started: (s) => [s, [cmd.task(work, { item: s.item })]],
 *     task_done: (s, e) => [s, [cmd.complete(e.output ?? null)]],
 *   },
 * });
 * ```
 */
export function defineWorkflow<S, I>(name: string, def: WorkflowDef<S, I>): Workflow<S, I> {
  // The digest is identity only. A later version replaces it with the hash of the built
  // workflow bundle, so that a run pins the exact code it started under.
  const digest = contentHash({ name, v: 1 });

  return {
    kind: "workflow",
    name,
    digest,
    def,
    reduce(stateJson, event, initInput) {
      const state = initialState(name, def, stateJson, initInput);
      const handler = def.on[event.type];
      if (typeof handler !== "function") {
        throw new Error(`workflow "${name}": no handler for event "${event.type}"`);
      }

      const result = (handler as (s: S, e: ReducerEvent) => Reduction<S>)(state, event);
      return toWire(name, result);
    },
  };
}

function initialState<S, I>(
  name: string,
  def: WorkflowDef<S, I>,
  stateJson: string | null,
  initInput: Json | undefined,
): S {
  if (initInput !== undefined) return def.init(initInput as unknown as I);
  if (stateJson === null) {
    throw new Error(`workflow "${name}": reduce() needs either a state checkpoint or initInput`);
  }
  return JSON.parse(stateJson) as S;
}

function toWire<S>(name: string, result: Reduction<S>): ReductionWire {
  if (!Array.isArray(result) || result.length !== 2 || !Array.isArray(result[1])) {
    throw new TypeError(`workflow "${name}": a handler must return [state, Command[]]`);
  }

  const state = JSON.stringify(result[0]);
  if (state === undefined) {
    throw new TypeError(`workflow "${name}": state must be JSON-serialisable`);
  }

  // Plain JSON.stringify, not canonical: the kernel owns the canonical hash of this string.
  return { state, commands: [...result[1]] };
}
