# @fsmxjs/async scope

## What problems it solves

- Prevents stale responses from overwriting newer state (supersession)
- Handles `AbortController` lifecycle without leaking into call sites
- Ensures in-flight tasks become no-ops after service teardown
- Keeps loading / success / error / retry flags inside the machine, not scattered across components

Use this when async coordination is becoming the actual complexity. For simple `fetch` + `setState` flows, you do not need this package.

---

## Contract with core

| Concern | Owner |
|---|---|
| Synchronous state transitions | `fsmxjs` core |
| Async task lifecycle | `@fsmxjs/async` |

- Core transitions remain synchronous and pure — no Promises inside `transition()`
- This package wraps `service.send` / `service.subscribe` from the outside
- Core has no knowledge of this package

---

## What it deliberately does not own

- Promise-based state transitions — `transition()` stays pure and synchronous
- Child machine supervision or actor management
- Async coordination inside the core layer — introducing it would break the core's guarantee of pure, synchronous transitions

---

## When another tool is a better fit

- Request deduplication / caching → [SWR](https://swr.vercel.app/), [TanStack Query](https://tanstack.com/query)
- Complex service orchestration / child workflows → [XState](https://stately.ai/docs/xstate)
- Simple one-shot fetch without stale or cancel concerns → native `fetch` + component state

---

## See also

- [`../../packages/async/README.md`](../packages/async/README.md) — full API reference and realistic examples
- [`philosophy.md`](philosophy.md) — why async is a separate package
