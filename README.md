# fsmxjs

Minimal, framework-agnostic finite state machine library for TypeScript.

Inspired by [@xstate/fsm](https://github.com/statelyai/xstate/tree/main/packages/xstate-fsm), but with a simpler API, zero runtime dependencies, and pure TypeScript throughout.

## Features

- Zero runtime dependencies
- Dual CJS / ESM output with full type declarations
- Pure actions as reducers — no `assign()` helper needed
- Snapshot referential stability — no-op returns the same reference
- Framework-agnostic — use with React, Remix, Vue, Svelte, or plain JS
- TypeScript-first with full generic inference

## Installation

```sh
npm install fsmxjs
# or
pnpm add fsmxjs
```

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

---

### `createService(machine)`

Creates a stateful service that manages a machine's lifecycle.

```ts
const service = createService(machine);
```

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

- Throws if the service is not running.
- Throws if called re-entrantly from within a subscriber (queue mode planned for v1.2).

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

## Roadmap

| Version | Planned |
|---|---|
| v1.1 | `onTransition` debug hook, improved error messages |
| v1.2 | Event queue mode (reentrant send), `autoStart` / `queueBeforeStart` option |
| v1.3 | Snapshot serialization (for SSR hydration) |
| v2.0 | Optional async action helpers (separate entrypoint) |
| v3.0 | Hierarchical states (opt-in) |
| v4.0 | Optional actor model (separate package) |

## License

MIT
