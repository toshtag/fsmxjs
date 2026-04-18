# @fsmxjs/async

Async task helpers for [fsmxjs](https://github.com/toshtag/fsmxjs).

> **This package does NOT turn fsmxjs into an async state machine.** It keeps async outside the core, and only coordinates it from the outside.

Use this only when async coordination is becoming the actual complexity. For simple `fetch` + `setState` flows, you do not need this package.

---

## What async problems this solves

These are the recurring shapes of async pain that this package addresses:

- **Stale results overwrite fresh ones.** A slow request returns after a faster newer one, clobbering the latest data. The "supersede previous in-flight call for this key" pattern is what `takeLatest` and `createTaskManager` provide.
- **`AbortController` plumbing leaks into call sites.** Manual `controller = new AbortController()` / `controller.abort()` bookkeeping ends up in components or effects. This package owns that lifecycle, indexed by key.
- **In-flight tasks survive teardown.** A task that resolves after `service.stop()` would normally try to `send` into a stopped service. Here, `send` becomes a no-op once the task is aborted.
- **Loading / success / error / retry flags scatter across components.** The machine still owns those states; this package only handles the async side that drives them.

If you do not have at least one of these problems, you do not need `@fsmxjs/async`.

---

## Responsibility boundary with core

| `fsmxjs` core | `@fsmxjs/async` |
|---|---|
| Synchronous state transitions | Async task lifecycle |
| Pure `transition()`, no Promises | `AbortSignal`, supersession, teardown |
| Knows nothing about async | Wraps `service.send` / `service.subscribe` from the outside |

State transitions stay synchronous; async lives outside them. Loading / success / error are perfectly valid machine states — what stays out of core is the *coordination* of the async work that drives those transitions.

---

## Installation

```sh
npm install @fsmxjs/async
# or
pnpm add @fsmxjs/async
```

Requires `fsmxjs >=1.3.0` as a peer dependency.

---

## Minimal example

```ts
import { createService } from 'fsmxjs';
import { createTaskManager } from '@fsmxjs/async';

const service = createService(machine).start();
const manager = createTaskManager(service);

manager.run('fetch', async ({ signal, send }) => {
  const data = await fetch('/api/data', { signal }).then((r) => r.json());
  send({ type: 'LOADED', data }); // no-op if a newer 'fetch' superseded this one
});
```

---

## Realistic example — debounced search with cancel

```ts
import { createMachine, createService } from 'fsmxjs';
import { takeLatest } from '@fsmxjs/async';

const machine = createMachine<Context, Event, 'idle' | 'loading' | 'ready'>({
  initial: 'idle',
  context: { results: [], query: '' },
  states: {
    idle:    { on: { SEARCH: { target: 'loading', actions: searchAction } } },
    loading: { on: {
      SEARCH:  { target: 'loading', actions: searchAction },
      RESULTS: { target: 'ready', actions: setResults },
      ERROR:   { target: 'idle' },
    } },
    ready:   { on: { SEARCH: { target: 'loading', actions: searchAction } } },
  },
});

const service = createService(machine).start();
const search  = takeLatest(service, 'search');

inputEl.addEventListener('input', (e) => {
  const query = (e.target as HTMLInputElement).value.trim();
  service.send({ type: 'SEARCH', query });

  search(async ({ signal, send }) => {
    try {
      const results = await fetchResults(query, signal);
      send({ type: 'RESULTS', results });
    } catch {
      send({ type: 'ERROR' });
    }
  });
});
```

The full runnable version lives in [`examples/async-search`](https://github.com/toshtag/fsmxjs/tree/main/examples/async-search).

---

## API reference

### `createTaskManager(service)`

Manages keyed async tasks. Starting a new task with the same key automatically aborts the previous one. A new task starts immediately — it does not wait for the previous task to finish cleanup.

```ts
const manager = createTaskManager(service);

manager.run('fetch', async ({ signal, snapshot, send }) => {
  const data = await fetch('/api/data', { signal }).then((r) => r.json());
  send({ type: 'LOADED', data });
});
```

Each key is tracked independently. Superseding `'fetch'` does not affect a concurrent `'poll'` task.

#### Task lifecycle

```
run(key, fn) called
  └─ previous task for key? → abort signal fired
  └─ new task starts running
       ├─ completes normally → run() resolves
       ├─ throws (not aborted) → run() rejects
       └─ throws after abort → run() resolves (stale error swallowed)
```

#### Cancellation model

Cancellation is **`AbortSignal`-based**. When a task is superseded or `abortAll()` is called, the `AbortSignal` fires. In-flight Promises are **not** forcibly stopped.

Tasks must cooperate with cancellation:

- Pass `signal` to cancellable APIs (`fetch`, etc.) to trigger network cancellation.
- Check `signal.aborted` before doing post-await work that should not run after abort.

The `send` argument is a no-op once the signal fires — safe to call without a guard if you only need to protect `send`:

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

### `takeLatest(service, key)`

Convenience wrapper over `createTaskManager`. Each call supersedes the previous task for that key only.

```ts
const runSearch = takeLatest(service, 'search');

inputEl.addEventListener('input', () => {
  runSearch(async ({ signal, send }) => {
    const results = await search(inputEl.value, { signal });
    send({ type: 'RESULTS', results });
  });
});
```

### `TaskFn` type

```ts
type TaskFn<TContext, TEvent, TStateValue> = (args: {
  signal:   AbortSignal;
  snapshot: Snapshot<TContext, TStateValue, TEvent>;
  send:     (event: TEvent) => void;
}) => Promise<void>;
```

- `signal` — fires when a newer task with the same key is started, or `abortAll()` is called.
- `snapshot` — captured at `run()` call time; does not update during task execution.
- `send` — forwards to `service.send()` while active; becomes a no-op once the task is aborted.

---

## Error semantics

| Case | Result |
|---|---|
| Task completes normally | `run()` resolves |
| Task throws (not aborted) | `run()` rejects with the error |
| Task throws after abort | `run()` resolves (stale error swallowed) |

---

## Teardown

Always abort tasks **before** stopping the service:

```ts
manager.abortAll();
service.stop();
```

`service.stop()` does not auto-detect running tasks. If you stop without calling `abortAll()`, in-flight tasks continue running but their `send` calls become no-ops.

`abortAll()` signals abort via `AbortSignal` — it does not forcibly terminate in-flight Promises. Your `TaskFn` must check `signal.aborted` (or pass `signal` to `fetch` and other cancellation-aware APIs) to actually stop work after abort.

---

## See also

- [`../../README.md`](../../README.md) — fsmxjs entry point
- [`../../docs/philosophy.md`](../../docs/philosophy.md) — why async is a separate package
- [`../../docs/api.md`](../../docs/api.md) — core API reference

## License

MIT
