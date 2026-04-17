# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `createMachine` — pure FSM definition with full TypeScript inference
- `createService` — stateful runtime with `start` / `stop` / `send` / `subscribe` / `select`
- Snapshot referential stability — no-op transitions return the same object reference
- Self-transition semantics — internal by default, opt-in re-entry via `reenter: true`
- `types.events` phantom field for explicit event union with payload types
- Dual CJS / ESM output via tsup
- TypeDoc API reference generation
