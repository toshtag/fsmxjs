# fsmxjs

Minimal, framework-agnostic finite state machine library for TypeScript.

**[Live examples →](https://toshtag.github.io/fsmxjs/)**
Toggle · Form wizard · Queue mode · Snapshot serialization · Async task manager

Originally inspired by [@xstate/fsm](https://github.com/statelyai/xstate/tree/main/packages/xstate-fsm), but evolved into a distinct design: synchronous-only core, async handled entirely outside via companion packages, and explicit rejection of actor/invoke semantics.

## Contents

- [Features](#features)
- [Design Philosophy](#design-philosophy)
- [Installation](#installation)
- [Package Architecture](#package-architecture)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [`createMachine`](#createmachineconfig)
  - [`createService`](#createservicemachine-options)
  - [`serializeSnapshot`](#serializesnapshotsnapshot)
  - [`deserializeSnapshot`](#deserializesnapshotserialized)
- [Framework Integration](#framework-integration)
- [Async helpers — `@fsmxjs/async`](#async-helpers--fsmxjsasync)
- [Roadmap](#roadmap)
- [Community](#community)
- [License](#license)

## Features

- Zero runtime dependencies
- Dual CJS / ESM output with full type declarations
- Pure actions as reducers — no `assign()` helper needed
- Snapshot referential stability — no-op returns the same reference
- Framework-agnostic — use with React, Remix, Vue, Svelte, or plain JS
- TypeScript-first with full generic inference
- Debug hooks (`onTransition`, `onError`) on `createService`
- Optional queue mode for safe reentrant sends
- Runtime config validation in `createMachine`
- Snapshot serialization for SSR hydration and persistence

## Design Philosophy

fsmxjs is built on a deliberate separation of concerns.

**Core is intentionally synchronous and async-free.** `machine.transition()` is a pure function. `createService` is a synchronous event loop. There are no Promises, no timers, and no side-effect orchestration inside the core runtime.

**Async is not a layer on top of core — it is a separate concern.** The core does not coordinate async work by design. Async workflows live in companion packages (`@fsmxjs/async`) that wrap the core's `subscribe` / `send` API from the outside.

There are no plans to add async primitives to core.

**Intentionally excluded from the core design:**

- Promise-based transitions
- Actor model / spawned machines
- `invoke` / service invocation

> Adding these would fundamentally change the nature of the library.

**Provided separately when needed:**

- Async helpers → `@fsmxjs/async`
- Framework adapters (React, Vue, etc.)
- Devtools

---

## Installation

```sh
npm install fsmxjs
# or
pnpm add fsmxjs
```

## Package Architecture

Two packages are published separately:

| Package | Purpose |
|---|---|
| `fsmxjs` | Core synchronous FSM runtime |
| `@fsmxjs/async` | Async task management companion |

`@fsmxjs/async` declares `fsmxjs >=1.3.0` as a peer dependency. It wraps the core's public API from the outside — core has no knowledge of the async package.

**Why not a monorepo/workspace yet?** Two packages do not justify the tooling overhead. Separate versioning is intentional: the async package can evolve independently of core. This structure will be revisited if a third package warrants shared infrastructure.

---

## Quick Start

```ts
import { createMachine, createService } from 'fsmxjs';

const toggleMachine = createMachine({
  initial: 'idle',
  context: { count: 0 },
  states: {
    idle: {
      entry: (ctx) => ({ count: ctx.count + 1 }),
      on: { TOGGLE: { target: 'active' } },
    },
    active: {
      on: { TOGGLE: { target: 'idle' } },
    },
  },
});

const service = createService(toggleMachine).start();

service.subscribe((snapshot) => {
  console.log(snapshot.value, snapshot.context);
});

service.send({ type: 'TOGGLE' }); // active { count: 1 }
service.send({ type: 'TOGGLE' }); // idle   { count: 2 }
```

## API Reference

### `createMachine(config)`

Creates an immutable machine definition. Returns a `Machine` object.

```ts
const machine = createMachine({
  initial: 'idle',         // initial state key (required)
  context: { count: 0 },  // initial context (required)
  types: {} as {           // optional: explicit event union
    events: { type: 'INCREMENT'; by: number } | { type: 'RESET' }
  },
  states: {
    idle: {
      entry: (ctx, event) => ({ ... }),  // runs on entering this state
      exit:  (ctx, event) => ({ ... }),  // runs on leaving this state
      on: {
        EVENT_TYPE: {
          target: 'other',               // optional: omit for internal transition
          guard:   (ctx, event) => true, // optional: transition guard
          actions: (ctx, event) => ({ }),// optional: context updater
          reenter: false,                // optional: re-run exit/entry on self-transition
        },
      },
    },
  },
});
```

**`machine.initialState`** — `Snapshot` at machine creation time (event: `{ type: '@@fsmx/init' }`). Entry actions have NOT been run.

**`machine.transition(state, event)`** — Pure transition function. Returns a new `Snapshot` if the transition fires, or the same reference if it is a no-op.

`createMachine` validates the config at construction time and throws a descriptive error if `initial` or any transition `target` references a state that does not exist.

---

### `createService(machine, options?)`

Creates a stateful service that manages a machine's lifecycle.

```ts
const service = createService(machine, {
  onTransition({ prev, next, event }) {
    console.log(event.type, prev.value, '→', next.value);
  },
  onError(err) {
    console.error('FSM error:', err);
  },
});
```

#### `options.onTransition(args)`

Called after every snapshot change, **before** subscribers are notified. Only fires when `next !== prev` (no-op transitions are silent).

| Field | Type | Description |
|---|---|---|
| `prev` | `Snapshot` | Snapshot before the change |
| `next` | `Snapshot` | Snapshot after the change |
| `event` | `TEvent \| InitEvent` | Event that triggered the change |
| `changed` | `true` | Always `true` — hook only fires on changes |

Fires on `start()`, `send()`, and `stop()`. If the hook throws, the exception is routed to `onError` and swallowed — a buggy debug hook will not crash the service.

#### `options.onError(error)`

Called when an internal FSM exception occurs (entry, exit, or transition action throws). The original error is always re-thrown after `onError` returns. Also called when `onTransition` throws.

If `onError` itself throws, the exception is silently swallowed to prevent masking the original error.

#### `options.queue`

Set `queue: true` to enable queue mode. In queue mode, calls to `send()` from within a subscriber or flush loop are enqueued and processed sequentially after the current event completes, rather than throwing.

```ts
const service = createService(machine, { queue: true }).start();

service.subscribe(() => {
  service.send({ type: 'NEXT' }); // enqueued, not thrown
});
```

- `send()` called during a flush returns the snapshot **at enqueue time**, not the post-flush snapshot. Use `getSnapshot()` after the outer `send()` returns to read the final state.
- Calling `stop()` during a flush immediately clears the queue — remaining events are discarded.

#### `service.start()`

Activates the service. Runs the current state's entry actions, then notifies all subscribers. Returns `this` (chainable).

- Calling `start()` while already running is a no-op.
- If the entry action throws, status rolls back and no notification is sent.

#### `service.stop()`

Deactivates the service. Runs the current state's exit actions, then notifies all subscribers. Returns `this` (chainable).

- Subscribers are **not** cleared on stop.
- Snapshot is **not** reset — current state and context are preserved.
- If the exit action throws, status rolls back to running and no notification is sent.

#### `service.send(event)`

Sends an event to the machine. If the transition fires, updates the snapshot and notifies subscribers.

- Throws if called before `start()` or after `stop()`.
- Throws if `event` is not an object with a `type` string property.
- Throws if called re-entrantly from within a subscriber (use `queue: true` to allow reentrant sends).

#### `service.subscribe(listener)`

Registers a listener `(snapshot: Snapshot) => void`. Returns an unsubscribe function.

- Listeners registered before `start()` are notified when `start()` is called.

#### `service.select(selector, listener)`

Registers a derived-value listener. Calls `listener(value)` only when `selector(snapshot)` returns a value that is not `Object.is`-equal to the previous value.

Returns an unsubscribe function.

```ts
service.select((s) => s.context.count, (count) => {
  console.log('count changed:', count);
});
```

#### `service.getSnapshot()`

Returns the current `Snapshot` synchronously. Safe to call before `start()`.

---

### `serializeSnapshot(snapshot)`

Serializes a `Snapshot` to a JSON string. Preserves `value`, `context`, and `event`.

```ts
import { serializeSnapshot, deserializeSnapshot } from 'fsmxjs';

const json = serializeSnapshot(service.getSnapshot());
// '{"value":"active","context":{"count":3},"event":{"type":"INC"}}'
```

**Limitations:** `Date` instances in `context` are restored as ISO strings, not `Date` objects. `Map`, `Set`, and custom class instances lose their prototype identity. These are intentional JSON round-trip trade-offs.

---

### `deserializeSnapshot(serialized)`

Parses a JSON string produced by `serializeSnapshot` back into a typed `Snapshot`. Generic parameters mirror those of `Snapshot`.

```ts
const snapshot = deserializeSnapshot<Ctx, StateValue, Event>(json);
```

- Throws `SyntaxError` if `serialized` is not valid JSON.
- Throws `Error` (`"deserializeSnapshot: invalid snapshot shape"`) if the parsed value is missing required fields (`value`, `context`, `event.type`).

**SSR hydration example (Remix):**

```ts
// server: loader
export const loader = () => {
  const service = createService(machine).start();
  return json({ state: serializeSnapshot(service.getSnapshot()) });
};

// client: hydration
const { state } = useLoaderData<typeof loader>();
const snapshot = deserializeSnapshot<Ctx, StateValue, Event>(state);
const service = createService(machine).start();
// restore state if needed via comparison with snapshot.value / snapshot.context
```

---

### Types

```ts
type Snapshot<TContext, TStateValue extends string, TEvent> = {
  value:   TStateValue;
  context: Readonly<TContext>;
  event:   TEvent | { type: '@@fsmx/init' };
};

type ActionFn<TContext, TEvent> =
  (context: TContext, event: TEvent) => Partial<TContext> | void;

type GuardFn<TContext, TEvent> =
  (context: TContext, event: TEvent) => boolean;

type ServiceOptions<TContext, TEvent, TStateValue extends string> = {
  onTransition?: (args: {
    prev:    Snapshot<TContext, TStateValue, TEvent>;
    next:    Snapshot<TContext, TStateValue, TEvent>;
    event:   TEvent | { type: '@@fsmx/init' };
    changed: boolean;
  }) => void;
  onError?: (error: unknown) => void;
  queue?:   boolean;
};
```

---

### Transition Semantics

| Scenario | exit runs? | actions run? | entry runs? |
|---|---|---|---|
| External (`target` differs) | yes | yes | yes |
| Self (`target === current`, default) | no | yes | no |
| Self (`target === current`, `reenter: true`) | yes | yes | yes |
| Internal (no `target`) | no | yes | no |
| Unknown event / all guards fail | — | — | — (same snapshot ref) |

### Context Updates

Actions are **pure reducers**. Return a `Partial<TContext>` (or `void` to skip update). Context is merged shallowly via `Object.assign`:

```ts
// context: { a: 1, b: 2 }
actions: (ctx) => ({ a: ctx.a + 1 })
// result: { a: 2, b: 2 }
```

Multiple actions in an array run sequentially, each receiving the output of the previous.

### Explicit Event Types

Use the `types` phantom field to declare a richer event union with payloads:

```ts
const machine = createMachine({
  initial: 'idle',
  context: { value: '' },
  types: {} as {
    events: { type: 'SET'; value: string } | { type: 'RESET' }
  },
  states: {
    idle: {
      on: {
        SET:   { actions: (_ctx, e) => ({ value: e.value }) },
        RESET: { actions: () => ({ value: '' }) },
      },
    },
  },
});
```

TypeScript will enforce the full event union on `service.send()`.

---

## Framework Integration

fsmxjs is framework-agnostic. Adapters for React and other frameworks are out of scope for this package but straightforward to build on top of the `subscribe` / `select` API.

**React example (without an adapter):**

```ts
function useMachine<C, E extends { type: string }, V extends string>(
  machine: Machine<C, E, V>,
) {
  const service = useMemo(() => createService(machine).start(), []);
  const [snap, setSnap] = useState(() => service.getSnapshot());

  useEffect(() => {
    return service.subscribe(setSnap);
  }, [service]);

  return [snap, service.send] as const;
}
```

---

## Async helpers — `@fsmxjs/async`

For async workflows, install the companion package:

```sh
npm install @fsmxjs/async
# or
pnpm add @fsmxjs/async
```

### Task lifecycle

Each task slot (`key`) follows this lifecycle:

```
run(key, fn) called
  └─ previous task for key? → abort signal fired
  └─ new task starts running
       ├─ completes normally → run() resolves
       ├─ throws (not aborted) → run() rejects
       └─ throws after abort → run() resolves (stale error swallowed)
```

Starting a new task with the same key aborts the previous one automatically.

### Cancellation model

Cancellation is **AbortSignal-based**. When a task is superseded or `abortAll()` is called, the `AbortSignal` fires. In-flight Promises are **not** forcibly stopped.

**Tasks must cooperate with cancellation:**

- Pass `signal` to cancellable APIs (`fetch`, etc.) to trigger network cancellation
- Check `signal.aborted` before sending events back to the machine

The `send` argument inside a `TaskFn` is a no-op once the signal fires — safe to call without an `aborted` guard if you only need to protect `send`:

```ts
manager.run('fetch', async ({ signal, send }) => {
  const data = await fetch('/api/data', { signal }).then((r) => r.json());
  send({ type: 'LOADED', data }); // no-op if aborted — safe without guard
});
```

If you also need to skip post-abort computation, check `signal.aborted` explicitly:

```ts
manager.run('heavy', async ({ signal, send }) => {
  const result = await expensiveWork();
  if (signal.aborted) return;
  send({ type: 'DONE', result });
});
```

### `createTaskManager(service)`

Manages keyed async tasks.

```ts
import { createTaskManager } from '@fsmxjs/async';

const manager = createTaskManager(service);

await manager.run('fetch', async ({ signal, snapshot, send }) => {
  const data = await fetch('/api/data', { signal }).then((r) => r.json());
  send({ type: 'LOADED', data });
});
```

| Argument | Type | Description |
|---|---|---|
| `key` | `string` | Task slot identifier |
| `task` | `TaskFn` | Async function receiving `{ signal, snapshot, send }` |

**`TaskFn` arguments:**

| Field | Description |
|---|---|
| `signal` | `AbortSignal` — fires when a newer task with the same key is started, or `abortAll()` is called |
| `snapshot` | Snapshot captured at the time `run()` was called |
| `send` | Wraps `service.send()` — no-op if `signal.aborted` |

**Error semantics:**

| Case | Result |
|---|---|
| Task completes normally | `run()` resolves |
| Task throws (not aborted) | `run()` rejects with the error |
| Task throws after abort | `run()` resolves (stale error swallowed) |

#### Teardown

`@fsmxjs/async` does not auto-detect service stop. Always abort tasks before stopping the service:

```ts
manager.abortAll();
service.stop();
```

`abortAll()` fires the abort signal for all running tasks. It does not forcibly stop in-flight Promises. Tasks must pass `signal` to cancellable APIs or check `signal.aborted` to respond to cancellation.

---

### `takeLatest(service, key)`

Convenience wrapper over `createTaskManager`. Each call supersedes the previous task for that key.

```ts
import { takeLatest } from '@fsmxjs/async';

const runSearch = takeLatest(service, 'search');

// Only the last call is active — earlier calls are aborted automatically.
inputEl.addEventListener('input', () => {
  runSearch(async ({ signal, send }) => {
    const results = await search(inputEl.value, { signal });
    send({ type: 'RESULTS', results });
  });
});
```

---

## Roadmap

### Delivered

| Release | Highlights |
|---|---|
| v1.0 | Core FSM runtime: `createMachine`, `createService`, guards, context reducers |
| v1.1 | Debug hooks (`onTransition`, `onError`), runtime config validation |
| v1.2 | Queue mode, explicit stop-during-flush semantics |
| v1.3 | Snapshot serialization (`serializeSnapshot`, `deserializeSnapshot`) |
| v2.0 milestone | `@fsmxjs/async` introduced; core remains async-free |
| v2.x (ongoing) | Interactive examples site — [toshtag.github.io/fsmxjs](https://toshtag.github.io/fsmxjs/) |

### v2.x — near-term maintenance track

- Async usability improvements without expanding core responsibilities
- Documentation refinement and example quality improvements
- Internal refactoring for maintainability, developer efficiency, and targeted performance improvements
  - file/module reorganization
  - test structure cleanup
  - build/test script simplification
  - hot-path profiling and micro-optimizations only where justified

### v3 (tentative)

- Re-evaluate repository/package structure if package count and maintenance cost justify it
- Candidates: workspace/monorepo migration, `@fsmxjs/devtools`, `@fsmxjs/react`
- No commitment yet

### Core constraints

See [Design Philosophy](#design-philosophy).

---

## Community

| Channel | Use for |
|---------|---------|
| [Discussions](https://github.com/toshtag/fsmxjs/discussions) | Questions, ideas, show-and-tell, anything that isn't a confirmed bug |
| [Issues](https://github.com/toshtag/fsmxjs/issues) | Confirmed bugs only |

**Rule of thumb:** if you're not sure whether it's a bug, open a Discussion first.

### Discussion categories

- **Q&A** — usage questions, "is this the right approach?", unexpected behavior you aren't sure is a bug
- **Ideas** — feature proposals (please read [CONTRIBUTING.md](CONTRIBUTING.md) before posting)
- **Show and tell** — projects or demos built with fsmxjs
- **General** — everything else

---

## License

MIT
