# Design philosophy

This document explains why fsmxjs looks the way it does, and what it deliberately refuses to become.

## One-line identity

> A synchronous FSM core that keeps async, UI, and side effects entirely outside.

That is not an implementation detail. It is the design.

## Core is intentionally synchronous and async-free

`machine.transition()` is a pure function. `createService` is a synchronous event loop. There are no Promises, no timers, and no side-effect orchestration inside the core runtime.

This is enforced at the source level: `src/` contains no `Promise`, `async`, or `await`. The constraint is not aspirational — it is a property of the code.

## Async is a separate concern, not a layer on top

The core does not coordinate async work by design. Async workflows live in companion packages (`@fsmxjs/async`) that wrap the core's `subscribe` / `send` API from the outside. The core has no knowledge of them.

There are no plans to add async primitives to core. Future async ergonomics ship as new packages, never as core features.

## Responsibility separation

One layer, one responsibility:

| Layer | Owns |
|-------|------|
| `fsmxjs` core | State transitions |
| `@fsmxjs/async` | Async orchestration |
| UI adapters (separate packages) | Framework integration |

Crossing these boundaries — for example, embedding async into core for "convenience" — is rejected on principle. The boundary is the value.

## Intentionally excluded

`fsmxjs` will not support: actors, invoke, hierarchical states, parallel states, Promise-based transitions.

- **Actors / spawned machines** — would require a runtime supervisor and shift the library into orchestration territory.
- **`invoke` / service invocation** — pulls async lifecycle into the core, breaking the synchronous contract.
- **Hierarchical states** — adds substantial spec surface that overlaps XState's domain.
- **Parallel states** — same reason as hierarchical: outside the flat-FSM scope this library targets.
- **Promise-based transitions** — `transition()` must remain a pure synchronous function.

These are design boundaries, not gaps to fill later.

## Small API is a strategic choice

Fewer methods is the point. API scarcity here means "the right things are built in, the wrong things are kept out." Adding surface area without a clear FSM-essence justification is treated as a regression in design, not an improvement in features.

## How new-feature proposals are evaluated

Every proposal is judged by this checklist. If any answer is "No", the proposal is declined.

1. Is the change synchronous? (Async belongs in `@fsmxjs/async` or a new package.)
2. Does it operate only on state transitions, not side effects or lifecycle?
3. Is it essential to FSM semantics, not just convenient?
4. Does it avoid expanding the public API surface unnecessarily?
5. Does it avoid importing or depending on any framework (React, Vue, DOM, Node-only APIs)?

The full proposal flow is documented in [`../CONTRIBUTING.md`](../CONTRIBUTING.md).

## What would change this philosophy

Nothing currently on the roadmap does. The roadmap (see [`../CHANGELOG.md`](../CHANGELOG.md) and the root README) covers usability refinements, examples, and internal cleanup — none of which touch the synchronous-core boundary.

If the library ever grows actors, invoke, or async transitions, it will be a different library under a different name.

---

See also:
- [`../README.md`](../README.md) — entry point and quick example
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — proposal checklist and contribution flow
