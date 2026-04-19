# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.4] - 2026-04-19

### Added

- `examples/data-fetch/` — canonical real-world example: fetch with loading, error handling, and retry limit (guard prevents retrying past `MAX_RETRIES`). Uses `@fsmxjs/async` `createTaskManager`.
- Updated `README.md` Examples section to list all six demos.

## [1.3.3] - 2026-04-19

### Added

- `docs/decision-guide.md` — consolidated adoption decision guide with a 3-question decision tree, green flags, and red flags as a single entrypoint into existing README / comparisons / use-cases content
- `docs/async-scope.md` — explicit documentation of `@fsmxjs/async` scope: what problems it solves, its contract with core, and what it deliberately does not own
- `docs/adapters.md` — UI adapter strategy: no official adapter package yet, React wiring recipes (subscribe, selector pattern, scoped service), and criteria for when an official package will ship
- Links from `README.md`, `docs/philosophy.md`, and `docs/comparisons.md` to the new documents

## [1.3.2] - 2026-04-17

### Fixed

- No-op transitions (same state value, unchanged context) now return the original snapshot reference instead of allocating a new object. Subscribers using strict equality checks are no longer notified on no-op transitions.

## [1.3.1] - 2026-04-17

### Changed

- Internal refactoring of `service.ts`: merged duplicate `applyEntry`/`applyExit` into a single `applyLifecycle` helper; consolidated `dispatching`/`flushing` flags into a single `busy` flag. No behavior change.
- Internal refactoring of `machine.ts`: extracted config validation loop into a named `validateConfig` function; removed redundant explicit type parameters on `normalizeTransitions` calls. No behavior change.

### Added

- Interactive examples site published at [toshtag.github.io/fsmxjs](https://toshtag.github.io/fsmxjs/) — five live demos covering toggle, form wizard, queue mode, serialization, and async search

## [async-1.0.0] - 2026-04-17

Initial release of `@fsmxjs/async` — async task helpers for fsmxjs services.

### Added

- `createTaskManager(service)` — manages keyed async tasks; starting a new task with the same key aborts the previous one
- `takeLatest(service, key)` — convenience wrapper over `createTaskManager` for latest-only task semantics
- `TaskFn` type — async function receiving `{ signal: AbortSignal, snapshot, send }`
- Stale-send protection: `send` inside a task is a no-op after its `AbortSignal` fires
- Abort error swallowing: errors thrown from aborted tasks are silently resolved

### Notes

- `abortAll()` sends abort signals to all running tasks; it does not forcibly terminate in-flight Promises
- Service stop is not auto-detected; call `manager.abortAll()` before `service.stop()`
- `@fsmxjs/async` has `fsmxjs >=1.3.0` as a peer dependency

## [1.3.0] - 2026-04-17

### Added

- `serializeSnapshot(snapshot)` — serializes a `Snapshot` to a JSON string; preserves `value`, `context`, and `event` fields
- `deserializeSnapshot(serialized)` — deserializes a JSON string back to a `Snapshot` with generic type parameters for full TypeScript inference
- Runtime shape validation in `deserializeSnapshot`: throws `Error` on invalid snapshot shape, and propagates `SyntaxError` on malformed JSON

### Notes

- JSON round-trip limitations: `Date` instances in `context` are restored as ISO strings, not `Date` objects. `Map`, `Set`, and custom class instances lose their prototype identity. These are intentional trade-offs of the JSON-based format.

## [1.2.0] - 2026-04-17

### Added

- `ServiceOptions.queue` — optional boolean flag to enable queue mode for reentrant sends
- When `queue: true`, calls to `send()` from within a subscriber or flush loop are enqueued and processed sequentially after the current event completes, instead of throwing
- `send()` in queue mode returns the snapshot at enqueue time (not the post-flush snapshot)
- Calling `stop()` during a flush immediately clears the queue; remaining enqueued events are discarded and their transitions and hooks are never fired

## [1.1.0] - 2026-04-17

### Added

- `createService` now accepts an optional second argument `ServiceOptions`
- `onTransition` hook — called after every snapshot change, before subscribers; fires on `start()`, `send()`, and `stop()` when `next !== prev`
- `onError` hook — called when internal FSM exceptions occur (entry, exit, transition actions); original error is always re-thrown; hook exceptions are swallowed to prevent masking
- `createMachine` validates `initial` state and all transition `target` values at construction time, throwing a descriptive error on misconfiguration

### Changed

- `send()` now throws distinct messages for idle vs stopped state
- `send()` now throws `Invalid event: expected { type: string }` on invalid event shape

## [1.0.0] - 2026-04-17

### Added

- `createMachine` — pure FSM definition with full TypeScript inference
- `createService` — stateful runtime with `start` / `stop` / `send` / `subscribe` / `select`
- Snapshot referential stability — no-op transitions return the same object reference
- Self-transition semantics — internal by default, opt-in re-entry via `reenter: true`
- `types.events` phantom field for explicit event union with payload types
- Dual CJS / ESM output via tsup
- TypeDoc API reference generation
