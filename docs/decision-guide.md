# Should I use fsmxjs?

## Quick decision tree

**Q1: Are your state transitions implicit, scattered, or being decided by effects or flags?**
(e.g. boolean flags multiplying around a workflow, `useEffect` branches deciding next state)

- No → `useState` or `useReducer` is likely sufficient
- Yes → continue

**Q2: Do you need to move this logic outside the component and test it independently?**

- No → `useReducer` is likely sufficient
- Yes → continue

**Q3: Do you need actors, `invoke`, hierarchical or parallel states?**

- Yes → use [XState](https://stately.ai/docs/xstate)
- No → fsmxjs is likely the right fit

---

## Green flags — fsmxjs is a good fit when

- A `useEffect` is deciding when to navigate, toast, or call analytics
- Multiple boolean flags represent a single workflow
- A single workflow's loading / editing / error states are shared across multiple components
- You want to unit-test transitions as pure functions without rendering
- You looked at XState and bounced — you want explicit transitions, not an actor framework

---

## Red flags / When to move on

- Child actors or supervised services become necessary → [XState](https://stately.ai/docs/xstate)
- The problem is sharing state across components, not transitions → [Jotai](https://jotai.org/) or similar
- The workflow lives in a single component with no outside testing need → `useReducer`
- You want the framework to own side effects → fsmxjs deliberately keeps them out

---

## See also

- [`../README.md`](../README.md) — entry point and "You probably need this if" section
- [`comparisons.md`](comparisons.md) — responsibility-based comparison with decision rules
- [`use-cases.md`](use-cases.md) — five recurring shapes with smelly-code examples
