import { assertType, expectTypeOf } from 'vitest';
import { createMachine, createService } from 'fsmxjs';
import type { Snapshot } from 'fsmxjs';
import { createTaskManager, type TaskFn, type TaskManager } from '../src/task-manager';
import { takeLatest } from '../src/take-latest';

const machine = createMachine({
  initial: 'idle',
  context: { count: 0 },
  states: {
    idle: {
      on: { INC: { actions: (ctx) => ({ count: ctx.count + 1 }) } },
    },
  },
});

type TCtx = { count: number };
type TEvent = { type: 'INC' };
type TState = 'idle';

const service = createService(machine);

// ---------------------------------------------------------------------------
// 1. createTaskManager returns TaskManager with correct generics
// ---------------------------------------------------------------------------

{
  const manager = createTaskManager(service);
  expectTypeOf(manager).toMatchTypeOf<TaskManager<TCtx, TEvent, TState>>();
}

// ---------------------------------------------------------------------------
// 2. run() returns Promise<void>
// ---------------------------------------------------------------------------

{
  const manager = createTaskManager(service);
  expectTypeOf(manager.run).returns.resolves.toBeVoid();
}

// ---------------------------------------------------------------------------
// 3. TaskFn receives signal: AbortSignal
// ---------------------------------------------------------------------------

{
  createTaskManager(service).run('k', async ({ signal }) => {
    expectTypeOf(signal).toEqualTypeOf<AbortSignal>();
  });
}

// ---------------------------------------------------------------------------
// 4. TaskFn receives snapshot with correct type
// ---------------------------------------------------------------------------

{
  createTaskManager(service).run('k', async ({ snapshot }) => {
    expectTypeOf(snapshot).toEqualTypeOf<Snapshot<TCtx, TState, TEvent>>();
  });
}

// ---------------------------------------------------------------------------
// 5. TaskFn send accepts only valid events
// ---------------------------------------------------------------------------

{
  createTaskManager(service).run('k', async ({ send }) => {
    send({ type: 'INC' });
    // @ts-expect-error — 'INVALID' is not a valid event
    send({ type: 'INVALID' });
  });
}

// ---------------------------------------------------------------------------
// 6. abortAll() returns void
// ---------------------------------------------------------------------------

{
  const manager = createTaskManager(service);
  expectTypeOf(manager.abortAll).returns.toBeVoid();
}

// ---------------------------------------------------------------------------
// 7. TaskFn type alias is correct
// ---------------------------------------------------------------------------

{
  const fn: TaskFn<TCtx, TEvent, TState> = async ({ signal, snapshot, send }) => {
    assertType<AbortSignal>(signal);
    assertType<Snapshot<TCtx, TState, TEvent>>(snapshot);
    assertType<(e: TEvent) => void>(send);
  };
  expectTypeOf(fn).toMatchTypeOf<TaskFn<TCtx, TEvent, TState>>();
}

// ---------------------------------------------------------------------------
// 8. takeLatest returns a function accepting TaskFn
// ---------------------------------------------------------------------------

{
  const run = takeLatest(service, 'k');
  expectTypeOf(run).toBeFunction();
  expectTypeOf(run).returns.resolves.toBeVoid();
}

// ---------------------------------------------------------------------------
// 9. takeLatest task fn send rejects invalid events
// ---------------------------------------------------------------------------

{
  const run = takeLatest(service, 'k');
  run(async ({ send }) => {
    send({ type: 'INC' });
    // @ts-expect-error — 'UNKNOWN' is not in the event union
    send({ type: 'UNKNOWN' });
  });
}
