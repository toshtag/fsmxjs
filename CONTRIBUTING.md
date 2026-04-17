# Contributing

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
