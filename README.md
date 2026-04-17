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
- Debug hooks (`onTransition`, `onError`) on `createService`
- Optional queue mode for safe reentrant sends
- Runtime config validation in `createMachine`

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

## Roadmap

| Version | Status | Notes |
|---|---|---|
| v1.1 | Released | `onTransition` / `onError` debug hooks, improved error messages, `createMachine` config validation |
| v1.2 | Released | `queue` option — safe reentrant sends via synchronous event queue |
| v1.3 | Planned | Snapshot serialization (for SSR hydration) |
| v2.0 | Planned | Optional async action helpers (separate entrypoint) |

## License

MIT
