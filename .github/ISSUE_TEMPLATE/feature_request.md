---
name: Feature request
about: Suggest an idea or enhancement
labels: enhancement
---

## Philosophy checklist

Before submitting, verify your proposal fits the design constraints.
Proposals that fail this checklist will be declined without further discussion.

- [ ] The change is synchronous (no `Promise`, `async`, `await` in core)
- [ ] It concerns state transitions only, not side effects or lifecycle
- [ ] It is essential to FSM semantics, not just convenient
- [ ] It does not expand the public API surface without strong justification
- [ ] It does not depend on any framework (React, Vue, DOM, Node-only APIs)

If any item is unchecked, consider whether this belongs in `@fsmxjs/async`, a UI adapter, or a separate package.

---

## Problem

<!-- What problem does this feature solve? -->

## Proposed solution

<!-- Describe the API or behavior you'd like. -->

## Alternatives considered

<!-- Any alternative solutions or workarounds you've considered. -->
