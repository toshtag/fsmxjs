# API reference

This is the full API reference for the `fsmxjs` core package. For `@fsmxjs/async`, see [`packages/async/README.md`](../packages/async/README.md).

The page is organized in three layers, in reading order:

1. **Mental model** — concepts you need before reading the API.
2. **Core APIs** — `createMachine`, `createService`. The everyday surface.
3. **Reference details** — serialization, types, transition semantics, context updates, explicit event typing.

---

## Mental model

A few distinctions are load-bearing across the rest of this document.

### Machine vs service

A **machine** is a config object plus a pure `transition(state, event)` function. It holds no state of its own. `createMachine` returns a machine.

A **service** is a runtime that owns the current snapshot, runs entry/exit actions, calls subscribers, and accepts events via `send`. `createService(machine)` returns a service.

The same machine can drive many services. The machine is the rules; the service is one running game.

### Transitions vs side effects

Inside the machine, **transitions** and **actions** are pure: actions return `Partial<TContext>` (or `void`), they do not call APIs, and they do not navigate.

**Side effects** live outside the machine — typically in a `service.subscribe` callback, in a `service.select` listener, or in the framework integration layer. The machine emits state changes; subscribers turn them into effects.

This separation is what makes transitions unit-testable as pure functions.

### Synchronous core, async outside

`machine.transition` and `service.send` are synchronous. They never return Promises. The core has no notion of pending operations.

When you need to coordinate async work (fetch with cancellation, debounced search, retry), use [`@fsmxjs/async`](../packages/async/README.md). It wraps the service from outside; it does not modify the core.

The full rationale lives in [docs/philosophy.md](philosophy.md).

---

## `createMachine(config)`

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

## `createService(machine, options?)`

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

### `options.onTransition(args)`

Called after every snapshot change, **before** subscribers are notified. Only fires when `next !== prev` (no-op transitions are silent).

| Field | Type | Description |
|---|---|---|
| `prev` | `Snapshot` | Snapshot before the change |
| `next` | `Snapshot` | Snapshot after the change |
| `event` | `TEvent \| InitEvent` | Event that triggered the change |
| `changed` | `true` | Always `true` — hook only fires on changes |

Fires on `start()`, `send()`, and `stop()`. If the hook throws, the exception is routed to `onError` and swallowed — a buggy debug hook will not crash the service.

### `options.onError(error)`

Called when an internal FSM exception occurs (entry, exit, or transition action throws). The original error is always re-thrown after `onError` returns. Also called when `onTransition` throws.

If `onError` itself throws, the exception is silently swallowed to prevent masking the original error.

### `options.queue`

Set `queue: true` to enable queue mode. In queue mode, calls to `send()` from within a subscriber or flush loop are enqueued and processed sequentially after the current event completes, rather than throwing.

```ts
const service = createService(machine, { queue: true }).start();

service.subscribe(() => {
  service.send({ type: 'NEXT' }); // enqueued, not thrown
});
```

- `send()` called during a flush returns the snapshot **at enqueue time**, not the post-flush snapshot. Use `getSnapshot()` after the outer `send()` returns to read the final state.
- Calling `stop()` during a flush immediately clears the queue — remaining events are discarded.

### `service.start()`

Activates the service. Runs the current state's entry actions, then notifies all subscribers. Returns `this` (chainable).

- Calling `start()` while already running is a no-op.
- If the entry action throws, status rolls back and no notification is sent.

### `service.stop()`

Deactivates the service. Runs the current state's exit actions, then notifies all subscribers. Returns `this` (chainable).

- Subscribers are **not** cleared on stop.
- Snapshot is **not** reset — current state and context are preserved.
- If the exit action throws, status rolls back to running and no notification is sent.

### `service.send(event)`

Sends an event to the machine. If the transition fires, updates the snapshot and notifies subscribers.

- Throws if called before `start()` or after `stop()`.
- Throws if `event` is not an object with a `type` string property.
- Throws if called re-entrantly from within a subscriber (use `queue: true` to allow reentrant sends).

### `service.subscribe(listener)`

Registers a listener `(snapshot: Snapshot) => void`. Returns an unsubscribe function.

- Listeners registered before `start()` are notified when `start()` is called.

### `service.select(selector, listener)`

Registers a derived-value listener. Calls `listener(value)` only when `selector(snapshot)` returns a value that is not `Object.is`-equal to the previous value.

Returns an unsubscribe function.

```ts
service.select((s) => s.context.count, (count) => {
  console.log('count changed:', count);
});
```

### `service.getSnapshot()`

Returns the current `Snapshot` synchronously. Safe to call before `start()`.

---

## `serializeSnapshot(snapshot)`

Serializes a `Snapshot` to a JSON string. Preserves `value`, `context`, and `event`.

```ts
import { serializeSnapshot, deserializeSnapshot } from 'fsmxjs';

const json = serializeSnapshot(service.getSnapshot());
// '{"value":"active","context":{"count":3},"event":{"type":"INC"}}'
```

**Limitations:** `Date` instances in `context` are restored as ISO strings, not `Date` objects. `Map`, `Set`, and custom class instances lose their prototype identity. These are intentional JSON round-trip trade-offs.

---

## `deserializeSnapshot(serialized)`

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

## Types

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

The full machine-generated type reference is available via `pnpm run docs:api` (TypeDoc output).

---

## Transition semantics

| Scenario | exit runs? | actions run? | entry runs? |
|---|---|---|---|
| External (`target` differs) | yes | yes | yes |
| Self (`target === current`, default) | no | yes | no |
| Self (`target === current`, `reenter: true`) | yes | yes | yes |
| Internal (no `target`) | no | yes | no |
| Unknown event / all guards fail | — | — | — (same snapshot ref) |

---

## Context updates

Actions are **pure reducers**. Return a `Partial<TContext>` (or `void` to skip update). Context is merged shallowly via `Object.assign`:

```ts
// context: { a: 1, b: 2 }
actions: (ctx) => ({ a: ctx.a + 1 })
// result: { a: 2, b: 2 }
```

Multiple actions in an array run sequentially, each receiving the output of the previous.

---

## Explicit event types

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

See also:
- [`../README.md`](../README.md) — entry point and quick example
- [`philosophy.md`](philosophy.md) — why the API is shaped this way
- [`../packages/async/README.md`](../packages/async/README.md) — async coordination
