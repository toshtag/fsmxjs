import type { EventObject, Machine, Snapshot } from './types';

type Status = 'idle' | 'running' | 'stopped';

const SENTINEL = Symbol('fsmx/select-sentinel');

export interface Service<
  TContext,
  TEvent extends EventObject,
  TStateValue extends string,
> {
  start: () => Service<TContext, TEvent, TStateValue>;
  stop: () => Service<TContext, TEvent, TStateValue>;
  send: (event: TEvent) => void;
  getSnapshot: () => Snapshot<TContext, TStateValue, TEvent>;
  subscribe: (
    listener: (snapshot: Snapshot<TContext, TStateValue, TEvent>) => void,
  ) => () => void;
  select: <T>(
    selector: (snapshot: Snapshot<TContext, TStateValue, TEvent>) => T,
    listener: (selected: T) => void,
  ) => () => void;
}

export function createService<
  TContext,
  TEvent extends EventObject,
  TStateValue extends string,
>(
  machine: Machine<TContext, TEvent, TStateValue>,
): Service<TContext, TEvent, TStateValue> {
  type S = Snapshot<TContext, TStateValue, TEvent>;

  let snapshot: S = machine.initialState;
  let status: Status = 'idle';
  let dispatching = false;
  const listeners = new Set<(s: S) => void>();

  function notify(s: S): void {
    for (const listener of listeners) {
      listener(s);
    }
  }

  function applyEntry(snap: S): S {
    const stateNode = machine.config.states[snap.value];
    if (!stateNode?.entry) return snap;
    const entries = Array.isArray(stateNode.entry)
      ? stateNode.entry
      : [stateNode.entry];
    let ctx = snap.context as TContext;
    for (const fn of entries) {
      const patch = fn(ctx, snap.event as TEvent);
      if (patch !== undefined) ctx = Object.assign({}, ctx, patch);
    }
    return ctx === snap.context ? snap : { ...snap, context: ctx };
  }

  function applyExit(snap: S): S {
    const stateNode = machine.config.states[snap.value];
    if (!stateNode?.exit) return snap;
    const exits = Array.isArray(stateNode.exit)
      ? stateNode.exit
      : [stateNode.exit];
    let ctx = snap.context as TContext;
    for (const fn of exits) {
      const patch = fn(ctx, snap.event as TEvent);
      if (patch !== undefined) ctx = Object.assign({}, ctx, patch);
    }
    return ctx === snap.context ? snap : { ...snap, context: ctx };
  }

  const service: Service<TContext, TEvent, TStateValue> = {
    start() {
      if (status === 'running') return service;
      const prevStatus = status;
      status = 'running';
      try {
        const next = applyEntry(snapshot);
        snapshot = next;
      } catch (err) {
        status = prevStatus;
        throw err;
      }
      notify(snapshot);
      return service;
    },

    stop() {
      if (status !== 'running') return service;
      status = 'stopped';
      let next: S;
      try {
        next = applyExit(snapshot);
      } catch (err) {
        status = 'running';
        throw err;
      }
      snapshot = next;
      notify(snapshot);
      return service;
    },

    send(event: TEvent) {
      if (status !== 'running') {
        throw new Error(
          `Cannot send event "${event.type}" to a service that is not running (status: "${status}")`,
        );
      }
      if (dispatching) {
        throw new Error(
          `Reentrant send detected: cannot send "${event.type}" from within a subscriber`,
        );
      }
      const next = machine.transition(snapshot, event);
      if (next === snapshot) return;
      snapshot = next;
      dispatching = true;
      try {
        notify(snapshot);
      } finally {
        dispatching = false;
      }
    },

    getSnapshot() {
      return snapshot;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    select<T>(
      selector: (s: S) => T,
      listener: (selected: T) => void,
    ): () => void {
      let prev: T | typeof SENTINEL = SENTINEL;
      return service.subscribe((s) => {
        const next = selector(s);
        if (prev !== SENTINEL && Object.is(prev, next)) return;
        prev = next;
        listener(next);
      });
    },
  };

  return service;
}
