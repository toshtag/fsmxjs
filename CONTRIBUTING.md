# Contributing

## Design Philosophy

fsmxjs has a deliberate, narrow scope. Before proposing or implementing anything, understand what this library is and is not.

### What fsmxjs is

> A synchronous FSM core that keeps async, UI, and side effects entirely outside.

This is not an implementation detail — it is the design philosophy itself.

### Hard constraints

These constraints are non-negotiable. Proposals that violate them will be declined regardless of how useful they seem.

| Constraint | Rule |
|-----------|------|
| Core is synchronous | No `Promise`, `async`, or `await` in `src/` |
| Async is isolated | All async orchestration lives in `@fsmxjs/async` only |
| One layer, one responsibility | core = transitions, async = orchestration, UI = adapter |
| No XState features | No `invoke`, actor model, `spawn`, or service orchestration |
| Small API is intentional | Fewer methods is a strategic choice, not a gap |

### Proposal checklist

Use this checklist to evaluate whether your idea fits this library.
If any answer is "No", the proposal will likely be declined.

- [ ] Is the proposed change synchronous? (async → belongs in `@fsmxjs/async` or a new package)
- [ ] Does it operate only on state transitions, not side effects or lifecycle?
- [ ] Is it essential to FSM semantics, not just convenient to have?
- [ ] Does it avoid expanding the public API surface unnecessarily?
- [ ] Does it avoid importing or depending on any framework (React, Vue, DOM, Node-only APIs)?

If you answered "No" to one or more items, consider whether the proposal belongs in a separate adapter or companion package instead.

---

## Setup

```sh
git clone https://github.com/toshtag/fsmxjs.git
cd fsmxjs
pnpm install
```

## Development workflow

All changes must go through a pull request. Direct pushes to `main` are not allowed.

```sh
# Run tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Type check
pnpm run typecheck

# Lint
pnpm run lint

# Format
pnpm run format

# Build
pnpm run build

# Generate API docs
pnpm run docs:api
```

## Commit convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `docs`, `test`, `chore`, `ci`, `refactor`, `perf`, `build`, `style`

## TDD

1. Write a failing test first and commit: `test(<scope>): add failing tests for ...`
2. Implement the minimum code to pass: `feat(<scope>): implement ...`
3. Refactor if needed: `refactor(<scope>): ...`

## Code style

- TypeScript source and test comments: English only
- No framework-specific imports in `src/` (React, Remix, DOM)
- Actions must be pure reducers: `(ctx, event) => Partial<ctx> | void`
