import { describe, expect, it, vi } from 'vitest';
import { createMachine, createService } from '../src/index';

const toggleMachine = createMachine({
  initial: 'idle',
  context: { count: 0 },
  states: {
    idle: {
      entry: (ctx) => ({ count: ctx.count + 10 }),
      exit: (ctx) => ({ count: ctx.count + 1 }),
      on: { TOGGLE: { target: 'active' } },
    },
    active: {
      entry: (ctx) => ({ count: ctx.count + 100 }),
      exit: (ctx) => ({ count: ctx.count + 1 }),
      on: { TOGGLE: { target: 'idle' } },
    },
  },
});

describe('createService', () => {
  describe('API shape', () => {
    it('returns an object with expected methods', () => {
      const service = createService(toggleMachine);
      expect(typeof service.start).toBe('function');
      expect(typeof service.stop).toBe('function');
      expect(typeof service.send).toBe('function');
      expect(typeof service.getSnapshot).toBe('function');
      expect(typeof service.subscribe).toBe('function');
      expect(typeof service.select).toBe('function');
    });
  });

  describe('getSnapshot before start', () => {
    it('returns initial snapshot without running entry actions', () => {
      const service = createService(toggleMachine);
      const snap = service.getSnapshot();
      expect(snap.value).toBe('idle');
      expect(snap.context.count).toBe(0);
      expect(snap.event).toEqual({ type: '@@fsmx/init' });
    });
  });

  describe('start', () => {
    it('runs initial state entry actions and updates snapshot', () => {
      const service = createService(toggleMachine);
      service.start();
      expect(service.getSnapshot().context.count).toBe(10);
    });

    it('notifies subscribers on start (always, even if context unchanged)', () => {
      const machine = createMachine({
        initial: 'idle',
        context: {},
        states: { idle: {} },
      });
      const service = createService(machine);
      const listener = vi.fn();
      service.subscribe(listener);
      service.start();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('returns this (chainable)', () => {
      const service = createService(toggleMachine);
      expect(service.start()).toBe(service);
    });

    it('is idempotent — calling twice is a no-op on the second call', () => {
      const service = createService(toggleMachine);
      const listener = vi.fn();
      service.subscribe(listener);
      service.start();
      service.start();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(service.getSnapshot().context.count).toBe(10);
    });

    it('rolls back status if entry action throws', () => {
      const machine = createMachine({
        initial: 'idle',
        context: {},
        states: {
          idle: {
            entry: () => {
              throw new Error('entry failed');
            },
          },
        },
      });
      const service = createService(machine);
      expect(() => service.start()).toThrow('entry failed');
      expect(() => service.send({ type: 'X' as never })).toThrow();
    });
  });

  describe('send', () => {
    it('transitions and updates snapshot', () => {
      const service = createService(toggleMachine).start();
      service.send({ type: 'TOGGLE' });
      expect(service.getSnapshot().value).toBe('active');
    });

    it('throws before start', () => {
      const service = createService(toggleMachine);
      expect(() => service.send({ type: 'TOGGLE' })).toThrow();
    });

    it('throws after stop', () => {
      const service = createService(toggleMachine).start();
      service.stop();
      expect(() => service.send({ type: 'TOGGLE' })).toThrow();
    });

    it('throws on reentrant send from subscriber', () => {
      const service = createService(toggleMachine).start();
      service.subscribe(() => {
        expect(() => service.send({ type: 'TOGGLE' })).toThrow();
      });
      service.send({ type: 'TOGGLE' });
    });
  });

  describe('subscribe', () => {
    it('notifies listener on state change', () => {
      const service = createService(toggleMachine).start();
      const listener = vi.fn();
      service.subscribe(listener);
      service.send({ type: 'TOGGLE' });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0]?.[0].value).toBe('active');
    });

    it('does not notify when send is a no-op', () => {
      const service = createService(toggleMachine).start();
      const listener = vi.fn();
      service.subscribe(listener);
      service.send({ type: 'UNKNOWN' as never });
      expect(listener).not.toHaveBeenCalled();
    });

    it('returns an unsubscribe function that stops notifications', () => {
      const service = createService(toggleMachine).start();
      const listener = vi.fn();
      const unsub = service.subscribe(listener);
      unsub();
      service.send({ type: 'TOGGLE' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('subscriber registered before start is notified on start', () => {
      const service = createService(toggleMachine);
      const listener = vi.fn();
      service.subscribe(listener);
      service.start();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies all subscribers', () => {
      const service = createService(toggleMachine).start();
      const a = vi.fn();
      const b = vi.fn();
      service.subscribe(a);
      service.subscribe(b);
      service.send({ type: 'TOGGLE' });
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('runs exit actions of current state', () => {
      const service = createService(toggleMachine).start();
      // count is 10 after entry; exit adds 1
      service.stop();
      expect(service.getSnapshot().context.count).toBe(11);
    });

    it('notifies subscribers after exit actions', () => {
      const service = createService(toggleMachine).start();
      const listener = vi.fn();
      service.subscribe(listener);
      service.stop();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('preserves snapshot (does not reset to initial)', () => {
      const service = createService(toggleMachine).start();
      service.send({ type: 'TOGGLE' });
      service.stop();
      expect(service.getSnapshot().value).toBe('active');
    });

    it('does not clear subscribers', () => {
      const service = createService(toggleMachine).start();
      const listener = vi.fn();
      service.subscribe(listener);
      service.stop();
      listener.mockClear();
      service.start();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('returns this (chainable)', () => {
      const service = createService(toggleMachine).start();
      expect(service.stop()).toBe(service);
    });

    it('rolls back status if exit action throws', () => {
      const machine = createMachine({
        initial: 'idle',
        context: {},
        states: {
          idle: {
            exit: () => {
              throw new Error('exit failed');
            },
            on: { GO: { target: 'done' } },
          },
          done: {},
        },
      });
      const service = createService(machine).start();
      expect(() => service.stop()).toThrow('exit failed');
      // status rolled back to running — send should work
      expect(() => service.send({ type: 'GO' })).not.toThrow();
    });
  });

  describe('restart (stop then start)', () => {
    it('reactivates from current state, not initial', () => {
      const service = createService(toggleMachine).start();
      service.send({ type: 'TOGGLE' });
      service.stop();
      service.start();
      expect(service.getSnapshot().value).toBe('active');
    });

    it('re-runs entry of current state on restart', () => {
      const service = createService(toggleMachine).start();
      // after start: count = 10 (idle entry)
      service.send({ type: 'TOGGLE' });
      // after TOGGLE: idle exit (+1=11), active entry (+100=111)
      service.stop();
      // after stop: active exit (+1=112)
      const countAfterStop = service.getSnapshot().context.count;
      service.start();
      // after restart: active entry (+100)
      expect(service.getSnapshot().context.count).toBe(countAfterStop + 100);
    });
  });

  describe('select', () => {
    it('calls listener with selected value on change', () => {
      const service = createService(toggleMachine).start();
      const listener = vi.fn();
      service.select((s) => s.value, listener);
      service.send({ type: 'TOGGLE' });
      expect(listener).toHaveBeenCalledWith('active');
    });

    it('does not call listener when selected value is unchanged', () => {
      const service = createService(toggleMachine).start();
      const listener = vi.fn();
      service.select((s) => s.value, listener);
      service.send({ type: 'UNKNOWN' as never });
      expect(listener).not.toHaveBeenCalled();
    });

    it('uses Object.is for equality — NaN equals NaN', () => {
      const machine = createMachine({
        initial: 'idle',
        context: { val: NaN },
        states: {
          idle: {
            on: { PING: { actions: () => ({ val: NaN }) } },
          },
        },
      });
      const service = createService(machine).start();
      const listener = vi.fn();
      service.select((s) => s.context.val, listener);
      service.send({ type: 'PING' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('is called once on start (initial notification)', () => {
      const service = createService(toggleMachine);
      const listener = vi.fn();
      service.select((s) => s.value, listener);
      service.start();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('idle');
    });

    it('returns an unsubscribe function', () => {
      const service = createService(toggleMachine).start();
      const listener = vi.fn();
      const unsub = service.select((s) => s.value, listener);
      unsub();
      service.send({ type: 'TOGGLE' });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('action exception propagation', () => {
    it('propagates exception from transition action without updating snapshot', () => {
      const machine = createMachine({
        initial: 'idle',
        context: { count: 0 },
        states: {
          idle: {
            on: {
              BOOM: {
                actions: () => {
                  throw new Error('boom');
                },
              },
            },
          },
        },
      });
      const service = createService(machine).start();
      const before = service.getSnapshot();
      expect(() => service.send({ type: 'BOOM' })).toThrow('boom');
      expect(service.getSnapshot()).toBe(before);
    });
  });
});
