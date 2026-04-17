# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
