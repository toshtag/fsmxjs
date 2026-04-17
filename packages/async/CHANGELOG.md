# Changelog — @fsmxjs/async

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-04-17

### Added

- `createTaskManager(service)` — manages keyed async tasks; starting a new task with the same key aborts the previous one
- `takeLatest(service, key)` — convenience wrapper over `createTaskManager` for latest-only task semantics
- `TaskFn` type — async function receiving `{ signal: AbortSignal, snapshot, send }`
- Stale-send protection: `send` inside a task is a no-op after its `AbortSignal` fires
- Abort error swallowing: errors thrown from aborted tasks are silently resolved

### Notes

- `abortAll()` sends abort signals to all running tasks; it does not forcibly terminate in-flight Promises — tasks must observe `signal.aborted` or pass `signal` to cancellable APIs
- Service stop is not auto-detected; call `manager.abortAll()` before `service.stop()`
- Peer dependency: `fsmxjs >=1.3.0`
