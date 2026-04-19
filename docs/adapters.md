# UI adapters

## Strategy

UI adapters for fsmxjs are separate packages — they are never part of the core, and never part of `@fsmxjs/async`. That boundary is the design, not a gap to fill later.

**No official UI adapter package exists yet.** Wiring fsmxjs into a UI framework requires only a few lines. The patterns below cover the common cases.

---

## Why adapters stay separate

The core owns state transitions only. Rendering, subscriptions, and component lifecycle are framework concerns — pulling them into the core would break the synchronous-pure contract that makes fsmxjs testable in isolation.

When an official `@fsmxjs/react` (or Vue, Svelte, etc.) package ships, it will:

- depend on fsmxjs core via `peerDependencies`
- expose thin bindings (`useService`, `useSelector`) only
- add no new state machine semantics
- never feed back into the core

---

## React — wiring without an adapter package

### Subscribe to state changes

```ts
import { useEffect, useState } from 'react';
import { createService } from 'fsmxjs';
import { machine } from './machine';

const service = createService(machine).start();

function useService() {
  const [snapshot, setSnapshot] = useState(() => service.getSnapshot());

  useEffect(() => {
    return service.subscribe(setSnapshot);
  }, []);

  return snapshot;
}
```

### Selector pattern — prevent unnecessary re-renders

```ts
function useSelector<T>(selector: (s: typeof snapshot) => T): T {
  const [value, setValue] = useState(() => selector(service.getSnapshot()));

  useEffect(() => {
    return service.subscribe((s) => {
      const next = selector(s);
      setValue((prev) => (prev === next ? prev : next));
    });
  }, [selector]);

  return value;
}
```

### Scoped service per component

For workflows scoped to a component subtree, create and stop the service inside the component:

```ts
function FormWizard() {
  const [service] = useState(() => createService(formMachine).start());

  useEffect(() => {
    return () => service.stop();
  }, [service]);

  const snapshot = useService(service);
  // ...
}
```

---

## When an official adapter package makes sense

An official `@fsmxjs/react` will be published when the wiring pattern stabilizes across real-world usage and the recipe above proves insufficient. Until then, the recipe is the adapter.

If you find a case the recipe does not cover, open a [Discussion](https://github.com/toshtag/fsmxjs/discussions) — that is the signal that drives the adapter roadmap.

---

## See also

- [`../README.md`](../README.md) — entry point
- [`philosophy.md`](philosophy.md) — why adapters are always separate packages
- [`../packages/async/README.md`](../packages/async/README.md) — async coordination companion
