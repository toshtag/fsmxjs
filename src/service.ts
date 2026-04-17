import type { EventObject, Machine, ServiceOptions, Snapshot } from './types';

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
  options?: ServiceOptions<TContext, TEvent, TStateValue>,
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

  function fireOnError(err: unknown): void {
    try { options?.onError?.(err); } catch { /* swallow */ }
  }

  function fireOnTransition(prev: S, next: S, event: S['event']): void {
    try {
      options?.onTransition?.({ prev, next, event, changed: true });
    } catch (hookErr) {
      fireOnError(hookErr);
    }
  }

  function processEvent(event: TEvent): void {
    const prev = snapshot;
    let next: S;
    try {
      next = machine.transition(snapshot, event);
    } catch (err) {
      fireOnError(err);
      throw err;
    }
    if (next === prev) return;
    snapshot = next;
    fireOnTransition(prev, next, event);
    dispatching = true;
    try {
      notify(snapshot);
    } finally {
      dispatching = false;
    }
  }

  const service: Service<TContext, TEvent, TStateValue> = {
    start() {
      if (status === 'running') return service;
      const prevStatus = status;
      status = 'running';
      const prev = snapshot;
      let next: S;
      try {
        next = applyEntry(snapshot);
      } catch (err) {
        status = prevStatus;
        fireOnError(err);
        throw err;
      }
      snapshot = next;
      if (next !== prev) fireOnTransition(prev, next, next.event);
      notify(snapshot);
      return service;
    },

    stop() {
      if (status !== 'running') return service;
      status = 'stopped';
      const prev = snapshot;
      let next: S;
      try {
        next = applyExit(snapshot);
      } catch (err) {
        status = 'running';
        fireOnError(err);
        throw err;
      }
      snapshot = next;
      if (next !== prev) fireOnTransition(prev, next, next.event);
      notify(snapshot);
      return service;
    },

    send(event: TEvent) {
      if (typeof (event as { type?: unknown })?.type !== 'string') {
        throw new Error(`Invalid event: expected { type: string }`);
      }
      if (status === 'idle') {
        throw new Error(`Cannot send "${event.type}": service has not been started`);
      }
      if (status === 'stopped') {
        throw new Error(`Cannot send "${event.type}": service has been stopped`);
      }
      if (dispatching) {
        throw new Error(
          `Reentrant send detected: cannot send "${event.type}" from within a subscriber`,
        );
      }
      processEvent(event);
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
