import type { EventObject, Service, Snapshot } from 'fsmxjs';

export type TaskFn<
  TContext,
  TEvent extends EventObject,
  TStateValue extends string,
> = (args: {
  signal: AbortSignal;
  snapshot: Snapshot<TContext, TStateValue, TEvent>;
  send: (event: TEvent) => void;
}) => Promise<void>;

export interface TaskManager<
  TContext,
  TEvent extends EventObject,
  TStateValue extends string,
> {
  run(key: string, task: TaskFn<TContext, TEvent, TStateValue>): Promise<void>;
  abortAll(): void;
}

export function createTaskManager<
  TContext,
  TEvent extends EventObject,
  TStateValue extends string,
>(
  service: Service<TContext, TEvent, TStateValue>,
): TaskManager<TContext, TEvent, TStateValue> {
  const controllers = new Map<string, AbortController>();

  return {
    async run(key, task) {
      const prev = controllers.get(key);
      if (prev) prev.abort();

      const controller = new AbortController();
      controllers.set(key, controller);
      const { signal } = controller;

      const snapshot = service.getSnapshot();

      try {
        await task({
          signal,
          snapshot,
          send: (event) => {
            if (signal.aborted) return;
            service.send(event);
          },
        });
      } catch (err) {
        if (signal.aborted) return;
        throw err;
      } finally {
        if (controllers.get(key) === controller) {
          controllers.delete(key);
        }
      }
    },

    abortAll() {
      for (const ctrl of controllers.values()) ctrl.abort();
      controllers.clear();
    },
  };
}
