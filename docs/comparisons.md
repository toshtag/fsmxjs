# Responsibility-based comparison

How fsmxjs relates to other libraries you might be evaluating: useReducer, Jotai, XState, and `@xstate/fsm`.

## How to read this page

This page does **not** ship a feature checklist. Feature matrices are misleading — they reduce architectural decisions to "more boxes ticked is better", which is the wrong frame.

Instead, the question is: **what is each library responsible for?** Pick the one whose responsibility matches what your code is missing.

## fsmxjs

**Responsibility:** synchronous state transitions, decoupled from UI and async.

fsmxjs owns the part of your application that decides *what state are we in, and what is the next state given this event?*. It does not own rendering, side effects, async coordination, or shared state. Those belong to other layers.

Reach for fsmxjs when you want explicit transitions outside the component, with guards, entry/exit actions, and a serializable snapshot — and you do not want a runtime that supervises actors or manages invoked services.

## XState

**Responsibility:** an actor-based orchestration framework. Hierarchical and parallel statecharts, invoked services, spawned child machines, and a visual editor.

Reach for XState when the actual complexity is orchestration: long-lived services, supervised child workflows, or charts that benefit from hierarchy and visualization.

XState is not a heavier fsmxjs. It is a different category. Pick it when you need orchestration; pick fsmxjs when you need transitions.

## `@xstate/fsm`

**Responsibility:** a flat FSM interpreter that follows the XState API surface for the FSM subset.

How fsmxjs diverges from `@xstate/fsm`:

- **Async stays outside the core.** fsmxjs has no `invoke` and never will; `@fsmxjs/async` lives in a separate package.
- **Snapshot serialization** for SSR hydration and persistence is built in.
- **Queue mode** for safe reentrant `send()` from subscribers is built in.
- **No actor / spawn** semantics, by design.

If you already use the XState FSM subset and want to stay in that ecosystem, `@xstate/fsm` is the right fit. If you want the choices listed above, fsmxjs is.

## React `useReducer`

**Responsibility:** in-component reducer for state local to a single component subtree.

`useReducer` does not give you guards, entry/exit actions, or a snapshot you can serialize. It does not exist outside the component, so you cannot test transitions without rendering.

Reach for `useReducer` when the state is genuinely local and you do not need machine semantics. Reach for fsmxjs when the transitions outgrow the component or need to be tested in isolation.

## Jotai

**Responsibility:** atomic shared state.

Jotai is a state container — it stores values and lets components subscribe to atoms. It is not a transition engine. It does not model "what events move us between states".

Reach for Jotai when the problem is *sharing state across components*. Reach for fsmxjs when the problem is *defining valid transitions between states*. The two solve different problems and can be used together.

## Responsibility overlap table

| Library | What it owns |
|---------|--------------|
| fsmxjs | Synchronous state transitions, pure |
| XState | Actor model, invoked services, hierarchical/parallel charts |
| `@xstate/fsm` | Flat FSM interpreter (XState-shaped API) |
| `useReducer` | In-component reducer |
| Jotai | Shared atomic state |

## Decision rules

- Single component state → `useReducer`
- Global / shared state → Jotai
- Orchestration / actors / invoke → XState
- Small, pure transition logic outside UI → fsmxjs

For a consolidated decision tree, see [decision-guide.md](decision-guide.md).

---

See also:
- [`../README.md`](../README.md) — entry point and quick example
- [`use-cases.md`](use-cases.md) — five recurring shapes fsmxjs is designed for
- [`philosophy.md`](philosophy.md) — why fsmxjs refuses to grow into XState
