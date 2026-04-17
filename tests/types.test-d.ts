import { assertType, expectTypeOf } from 'vitest';
import { createMachine, createService } from '../src/index';
import type { Snapshot } from '../src/index';

// ---------------------------------------------------------------------------
// Fixture machines
// ---------------------------------------------------------------------------

const toggleMachine = createMachine({
  initial: 'idle',
  context: { count: 0 },
  states: {
    idle: { on: { TOGGLE: { target: 'active' } } },
    active: { on: { TOGGLE: { target: 'idle' } } },
  },
});

const payloadMachine = createMachine({
  initial: 'idle',
  context: { value: '' },
  types: {} as { events: { type: 'SET'; value: string } | { type: 'RESET' } },
  states: {
    idle: {
      on: {
        SET: { actions: (ctx, e) => ({ value: e.value }) },
        RESET: { actions: () => ({ value: '' }) },
      },
    },
  },
});

// ---------------------------------------------------------------------------
// 1. send() rejects events not in the union
// ---------------------------------------------------------------------------

{
  const service = createService(toggleMachine).start();
  // @ts-expect-error — 'UNKNOWN' is not a valid event type
  service.send({ type: 'UNKNOWN' });
}

// ---------------------------------------------------------------------------
// 2. Transition targets must be valid state keys
// ---------------------------------------------------------------------------

{
  createMachine({
    initial: 'idle',
    context: {},
    states: {
      idle: {
        // @ts-expect-error — 'nonexistent' is not a valid state key
        on: { GO: { target: 'nonexistent' } },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// 3. snapshot.value is inferred as union of all state keys
// ---------------------------------------------------------------------------

{
  const snap = toggleMachine.initialState;
  expectTypeOf(snap.value).toEqualTypeOf<'idle' | 'active'>();
}

// ---------------------------------------------------------------------------
// 4. Context type is inferred from config.context
// ---------------------------------------------------------------------------

{
  expectTypeOf(toggleMachine.initialState.context).toEqualTypeOf<
    Readonly<{ count: number }>
  >();
}

// ---------------------------------------------------------------------------
// 5. Guard receives correctly narrowed event type per on key
// ---------------------------------------------------------------------------

{
  createMachine({
    initial: 'idle',
    context: {},
    states: {
      idle: {
        on: {
          TOGGLE: {
            target: 'active',
            guard: (_ctx, event) => {
              expectTypeOf(event).toEqualTypeOf<{ type: 'TOGGLE' }>();
              return true;
            },
          },
        },
      },
      active: {},
    },
  });
}

// ---------------------------------------------------------------------------
// 6. Action receives correctly narrowed event type per on key
// ---------------------------------------------------------------------------

{
  createMachine({
    initial: 'idle',
    context: { count: 0 },
    types: {} as { events: { type: 'INC' } },
    states: {
      idle: {
        on: {
          INC: {
            actions: (_ctx, event) => {
              expectTypeOf(event).toEqualTypeOf<{ type: 'INC' }>();
            },
          },
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// 7. types.events phantom field overrides inferred event union
// ---------------------------------------------------------------------------

{
  const service = createService(payloadMachine).start();

  // SET with correct payload must be accepted
  service.send({ type: 'SET', value: 'hello' });

  // SET without required payload must be rejected
  // @ts-expect-error — missing required 'value' field
  service.send({ type: 'SET' });

  // RESET must be accepted
  service.send({ type: 'RESET' });

  // TOGGLE is not in the explicit union — must be rejected
  // @ts-expect-error — 'TOGGLE' is not in the event union
  service.send({ type: 'TOGGLE' });
}

// ---------------------------------------------------------------------------
// 8. Snapshot event type includes InitEvent
// ---------------------------------------------------------------------------

{
  type SnapEvent = (typeof toggleMachine.initialState)['event'];
  assertType<SnapEvent>({ type: '@@fsmx/init' });
  assertType<SnapEvent>({ type: 'TOGGLE' });
}

// ---------------------------------------------------------------------------
// 9. Service<TContext, TEvent, TStateValue> is correctly typed
// ---------------------------------------------------------------------------

{
  const service = createService(toggleMachine);

  expectTypeOf(service.send).parameter(0).toEqualTypeOf<{ type: 'TOGGLE' }>();

  expectTypeOf(service.getSnapshot).returns.toEqualTypeOf<
    Snapshot<{ count: number }, 'idle' | 'active', { type: 'TOGGLE' }>
  >();
}
