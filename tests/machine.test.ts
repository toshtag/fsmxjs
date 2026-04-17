import { describe, expect, it } from 'vitest';
import { createMachine } from '../src/index';

// Toggle machine used across multiple tests
const toggleMachine = createMachine({
  initial: 'idle',
  context: { count: 0 },
  states: {
    idle: {
      on: { TOGGLE: { target: 'active' } },
    },
    active: {
      on: { TOGGLE: { target: 'idle' } },
    },
  },
});

describe('createMachine', () => {
  describe('initialState', () => {
    it('returns correct value', () => {
      expect(toggleMachine.initialState.value).toBe('idle');
    });

    it('returns correct context', () => {
      expect(toggleMachine.initialState.context).toEqual({ count: 0 });
    });

    it('returns @@fsmx/init event', () => {
      expect(toggleMachine.initialState.event).toEqual({
        type: '@@fsmx/init',
      });
    });
  });

  describe('transition', () => {
    it('moves to target state on matching event', () => {
      const next = toggleMachine.transition(toggleMachine.initialState, {
        type: 'TOGGLE',
      });
      expect(next.value).toBe('active');
      expect(next.event).toEqual({ type: 'TOGGLE' });
    });

    it('returns same snapshot reference on unknown event', () => {
      const snapshot = toggleMachine.initialState;
      const next = toggleMachine.transition(snapshot, {
        type: 'UNKNOWN' as never,
      });
      expect(next).toBe(snapshot);
    });

    it('actions update context', () => {
      const machine = createMachine({
        initial: 'idle',
        context: { count: 0 },
        states: {
          idle: {
            on: {
              INC: {
                target: 'idle',
                actions: (ctx) => ({ count: ctx.count + 1 }),
              },
            },
          },
        },
      });
      const next = machine.transition(machine.initialState, { type: 'INC' });
      expect(next.context.count).toBe(1);
    });

    it('takes transition when guard passes', () => {
      const machine = createMachine({
        initial: 'idle',
        context: { count: 1 },
        states: {
          idle: {
            on: {
              GO: {
                target: 'done',
                guard: (ctx) => ctx.count > 0,
              },
            },
          },
          done: {},
        },
      });
      const next = machine.transition(machine.initialState, { type: 'GO' });
      expect(next.value).toBe('done');
    });

    it('returns same snapshot when guard fails', () => {
      const machine = createMachine({
        initial: 'idle',
        context: { count: 0 },
        states: {
          idle: {
            on: {
              GO: {
                target: 'done',
                guard: (ctx) => ctx.count > 0,
              },
            },
          },
          done: {},
        },
      });
      const snapshot = machine.initialState;
      const next = machine.transition(snapshot, { type: 'GO' });
      expect(next).toBe(snapshot);
    });

    it('first passing guard wins among multiple transitions', () => {
      const machine = createMachine({
        initial: 'idle',
        context: { count: 5 },
        states: {
          idle: {
            on: {
              GO: [
                { target: 'a', guard: (ctx) => ctx.count > 10 },
                { target: 'b', guard: (ctx) => ctx.count > 3 },
                { target: 'c' },
              ],
            },
          },
          a: {},
          b: {},
          c: {},
        },
      });
      const next = machine.transition(machine.initialState, { type: 'GO' });
      expect(next.value).toBe('b');
    });

    it('returns same snapshot when all guards fail', () => {
      const machine = createMachine({
        initial: 'idle',
        context: { count: 0 },
        states: {
          idle: {
            on: {
              GO: [
                { target: 'done', guard: () => false },
                { target: 'done', guard: () => false },
              ],
            },
          },
          done: {},
        },
      });
      const snapshot = machine.initialState;
      const next = machine.transition(snapshot, { type: 'GO' });
      expect(next).toBe(snapshot);
    });

    it('runs entry actions when entering target state', () => {
      const machine = createMachine({
        initial: 'idle',
        context: { log: '' },
        states: {
          idle: {
            on: { GO: { target: 'done' } },
          },
          done: {
            entry: (ctx) => ({ log: ctx.log + 'entry' }),
          },
        },
      });
      const next = machine.transition(machine.initialState, { type: 'GO' });
      expect(next.context.log).toBe('entry');
    });

    it('runs exit actions when leaving current state', () => {
      const machine = createMachine({
        initial: 'idle',
        context: { log: '' },
        states: {
          idle: {
            exit: (ctx) => ({ log: ctx.log + 'exit' }),
            on: { GO: { target: 'done' } },
          },
          done: {},
        },
      });
      const next = machine.transition(machine.initialState, { type: 'GO' });
      expect(next.context.log).toBe('exit');
    });

    it('executes actions in order: exit → transition → entry', () => {
      const machine = createMachine({
        initial: 'idle',
        context: { log: '' },
        states: {
          idle: {
            exit: (ctx) => ({ log: ctx.log + 'exit,' }),
            on: {
              GO: {
                target: 'done',
                actions: (ctx) => ({ log: ctx.log + 'transition,' }),
              },
            },
          },
          done: {
            entry: (ctx) => ({ log: ctx.log + 'entry' }),
          },
        },
      });
      const next = machine.transition(machine.initialState, { type: 'GO' });
      expect(next.context.log).toBe('exit,transition,entry');
    });

    it('self-transition does NOT run exit/entry by default', () => {
      const machine = createMachine({
        initial: 'idle',
        context: { log: '' },
        states: {
          idle: {
            entry: (ctx) => ({ log: ctx.log + 'entry,' }),
            exit: (ctx) => ({ log: ctx.log + 'exit,' }),
            on: {
              SELF: {
                target: 'idle',
                actions: (ctx) => ({ log: ctx.log + 'action' }),
              },
            },
          },
        },
      });
      const next = machine.transition(machine.initialState, { type: 'SELF' });
      expect(next.context.log).toBe('action');
    });

    it('self-transition with reenter:true runs exit and entry', () => {
      const machine = createMachine({
        initial: 'idle',
        context: { log: '' },
        states: {
          idle: {
            entry: (ctx) => ({ log: ctx.log + 'entry,' }),
            exit: (ctx) => ({ log: ctx.log + 'exit,' }),
            on: {
              SELF: {
                target: 'idle',
                reenter: true,
                actions: (ctx) => ({ log: ctx.log + 'action,' }),
              },
            },
          },
        },
      });
      const next = machine.transition(machine.initialState, { type: 'SELF' });
      expect(next.context.log).toBe('exit,action,entry,');
    });

    it('internal transition (no target) skips exit/entry', () => {
      const machine = createMachine({
        initial: 'idle',
        context: { log: '' },
        states: {
          idle: {
            entry: (ctx) => ({ log: ctx.log + 'entry,' }),
            exit: (ctx) => ({ log: ctx.log + 'exit,' }),
            on: {
              INTERNAL: {
                actions: (ctx) => ({ log: ctx.log + 'action' }),
              },
            },
          },
        },
      });
      const next = machine.transition(machine.initialState, {
        type: 'INTERNAL',
      });
      expect(next.context.log).toBe('action');
    });

    it('returns a new snapshot object when transition fires', () => {
      const snapshot = toggleMachine.initialState;
      const next = toggleMachine.transition(snapshot, { type: 'TOGGLE' });
      expect(next).not.toBe(snapshot);
    });
  });

  describe('config validation', () => {
    it('throws when initial state does not exist in states', () => {
      expect(() =>
        createMachine({
          initial: 'nonexistent' as never,
          context: {},
          states: { idle: {} },
        }),
      ).toThrow('createMachine: initial state "nonexistent" does not exist in states');
    });

    it('throws when a transition target does not exist in states', () => {
      expect(() =>
        createMachine({
          initial: 'idle',
          context: {},
          states: {
            idle: { on: { GO: { target: 'ghost' as never } } },
          },
        }),
      ).toThrow('createMachine: transition target "ghost"');
    });

    it('does not throw when config is valid', () => {
      expect(() =>
        createMachine({
          initial: 'idle',
          context: {},
          states: {
            idle: { on: { GO: { target: 'active' } } },
            active: {},
          },
        }),
      ).not.toThrow();
    });
  });
});
