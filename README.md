# fsmxjs

Minimal, framework-agnostic finite state machine library for TypeScript.

**[Live examples →](https://toshtag.github.io/fsmxjs/)**
Toggle · Form wizard · Queue mode · Snapshot serialization · Async task manager

## What is fsmxjs?

A small state machine library for keeping transition logic outside the UI layer and outside async coordination.

The core is synchronous and pure. Async, side effects, and rendering live in adapters and companion packages — never inside the core. That boundary is the design, not an implementation detail.

For framework wiring recipes (React and others), see [docs/adapters.md](docs/adapters.md).

## You probably need this if:

- Your `useState` flags and `useEffect` branches keep multiplying around a single workflow.
- The same loading / editing / error flags are read and updated by several components and hooks.
- A `useEffect` decides when to navigate, toast, or call analytics — and that logic is hard to find.
- You want to unit-test transitions as pure functions, without rendering anything.
- You looked at XState and bounced — you want explicit transitions, not an actor framework.

See [docs/use-cases.md](docs/use-cases.md) for each shape with smelly-code examples and minimal fixes.

Not sure yet? See [docs/decision-guide.md](docs/decision-guide.md) for a decision tree.

## When not to use fsmxjs

- You need actors, `invoke`, hierarchical or parallel states — use [XState](https://stately.ai/docs/xstate).
- A single boolean drives the workflow — `useState` is fine.
- You need a global shared store across components — use [Jotai](https://jotai.org/) or similar.
- You want the framework to own side effects — fsmxjs deliberately keeps them out.

See [docs/decision-guide.md](docs/decision-guide.md) for a consolidated decision tree.

## Packages

| Package | Purpose |
|---|---|
| [`fsmxjs`](https://www.npmjs.com/package/fsmxjs) | Core synchronous FSM runtime |
| [`@fsmxjs/async`](packages/async/README.md) | Async task management companion |

`@fsmxjs/async` declares `fsmxjs >=1.3.0` as a peer dependency. It wraps the core's public API from the outside — core has no knowledge of the async package.

See [docs/async-scope.md](docs/async-scope.md) for what this package does and does not own.

```sh
npm install fsmxjs
# or
pnpm add fsmxjs
```

## Quick example

This is all fsmxjs does:

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

## Examples

- [Toggle](examples/toggle/main.ts) — the smallest possible explicit transition flow.
- [Form wizard](examples/form-wizard/main.ts) — multi-step flow with guarded transitions and context updates.
- [Async search](examples/async-search/main.ts) — handling async work without leaking it into the UI layer.

The full set is in [`examples/`](examples/) and runs live at [toshtag.github.io/fsmxjs](https://toshtag.github.io/fsmxjs/).

## Design philosophy

fsmxjs is built on a deliberate separation of concerns:

- **Core is intentionally synchronous and async-free.** `transition()` is pure; `createService` is a synchronous event loop. No Promises, no timers, no orchestration in core.
- **Async is a separate package, not a layer on top.** [`@fsmxjs/async`](packages/async/README.md) wraps the core's public API from the outside.
- **Intentionally excluded:** actors, `invoke`, hierarchical states, parallel states, Promise-based transitions. These are design boundaries, not gaps to fill later.
- **Small API is strategic.** Adding surface area without a clear FSM-essence justification is treated as a regression in design.

Full rationale and the new-feature proposal checklist live in [docs/philosophy.md](docs/philosophy.md).

## Comparison by responsibility

| Library | What it owns |
|---------|--------------|
| fsmxjs | Synchronous state transitions, pure |
| XState | Actor model, invoked services, hierarchical/parallel charts |
| `@xstate/fsm` | Flat FSM interpreter (XState-shaped API) |
| `useReducer` | In-component reducer |
| Jotai | Shared atomic state |

Decision rules:

- Single component state → `useReducer`
- Global / shared state → Jotai
- Orchestration / actors / invoke → XState
- Small, pure transition logic outside UI → fsmxjs

Full breakdown in [docs/comparisons.md](docs/comparisons.md).

## API at a glance

A complete machine + service in ~15 lines:

```ts
import { createMachine, createService } from 'fsmxjs';

const machine = createMachine({
  initial: 'idle',
  context: { count: 0 },
  states: {
    idle:   { on: { START: { target: 'active' } } },
    active: { on: { STOP:  { target: 'idle', actions: (ctx) => ({ count: ctx.count + 1 }) } } },
  },
});

const service = createService(machine, { onError: console.error }).start();
service.subscribe((snap) => console.log(snap.value, snap.context));
service.send({ type: 'START' });
service.send({ type: 'STOP' });
```

Surface area:

- `createMachine(config)` — pure machine definition with `transition(state, event)` and `initialState`.
- `createService(machine, options?)` — runtime with `start`, `stop`, `send`, `subscribe`, `select`, `getSnapshot`, plus `onTransition` / `onError` / `queue` options.
- `serializeSnapshot` / `deserializeSnapshot` — JSON round-trip for SSR hydration and persistence.

Full reference (all options, transition semantics, context updates, explicit event types): [docs/api.md](docs/api.md).

For async coordination (cancellation, supersession, `takeLatest`): [packages/async/README.md](packages/async/README.md).

## Roadmap

See [CHANGELOG.md](CHANGELOG.md) for delivered releases and the current near-term track.

## Community

| Channel | Use for |
|---------|---------|
| [Discussions](https://github.com/toshtag/fsmxjs/discussions) | Questions, ideas, show-and-tell, anything that isn't a confirmed bug |
| [Issues](https://github.com/toshtag/fsmxjs/issues) | Confirmed bugs only |

If you're not sure whether it's a bug, open a Discussion first. See [CONTRIBUTING.md](CONTRIBUTING.md) for the proposal flow.

## License

MIT
