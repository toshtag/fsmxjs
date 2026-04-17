# @fsmxjs/async

Async task helpers for [fsmxjs](https://github.com/toshtag/fsmxjs).

## Installation

```sh
npm install @fsmxjs/async
# or
pnpm add @fsmxjs/async
```

Requires `fsmxjs >=1.3.0` as a peer dependency.

## API

### `createTaskManager(service)`

Manages keyed async tasks. Starting a new task with the same key automatically aborts the previous one.

```ts
import { createTaskManager } from '@fsmxjs/async';

const manager = createTaskManager(service);

manager.run('fetch', async ({ signal, send }) => {
  const data = await fetch('/api/data', { signal }).then((r) => r.json());
  send({ type: 'LOADED', data }); // no-op if task was superseded
});
```

Each key is tracked independently. Superseding `'fetch'` does not affect a concurrent `'poll'` task.

### `takeLatest(service, key)`

Convenience wrapper over `createTaskManager`. Each call supersedes the previous task for that key only.

```ts
import { takeLatest } from '@fsmxjs/async';

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

`send` is a no-op once the abort signal fires, so stale results are safely discarded without explicit guards.

## Teardown

Always abort tasks before stopping the service:

```ts
manager.abortAll();
service.stop();
```

`service.stop()` does not auto-detect running tasks. If you stop without calling `abortAll()`, in-flight tasks continue running but their `send` calls become no-ops.

**Important:** `abortAll()` signals abort via `AbortSignal` — it does not forcibly terminate in-flight Promises. Your `TaskFn` must check `signal.aborted` (or pass `signal` to `fetch` and other cancellation-aware APIs) to actually stop work after abort.

## License

MIT
