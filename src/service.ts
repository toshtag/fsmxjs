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
  let busy = false;
  let queue: TEvent[] = [];
  const listeners = new Set<(s: S) => void>();

  function notify(s: S): void {
    for (const listener of listeners) {
      listener(s);
    }
  }

  function applyLifecycle(snap: S, hook: 'entry' | 'exit'): S {
    const stateNode = machine.config.states[snap.value];
    const fns = stateNode?.[hook];
    if (!fns) return snap;
    const list = Array.isArray(fns) ? fns : [fns];
    let ctx = snap.context as TContext;
    for (const fn of list) {
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
    busy = true;
    try {
      notify(snapshot);
    } finally {
      busy = false;
    }
  }

  function flushQueue(): void {
    if (busy) return;
    busy = true;
    try {
      while (queue.length > 0 && status === 'running') {
        const event = queue.shift()!;
        processEvent(event);
      }
    } finally {
      busy = false;
      queue = [];
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
        next = applyLifecycle(snapshot, 'entry');
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
      queue = [];
      const prev = snapshot;
      let next: S;
      try {
        next = applyLifecycle(snapshot, 'exit');
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
      if (options?.queue) {
        if (busy) {
          queue.push(event);
          return snapshot;
        }
        processEvent(event);
        flushQueue();
        return snapshot;
      }
      if (busy) {
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
