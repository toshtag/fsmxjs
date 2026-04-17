import type { EventObject, Snapshot } from 'fsmxjs';
import type { Service } from 'fsmxjs';

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
  _service: Service<TContext, TEvent, TStateValue>,
): TaskManager<TContext, TEvent, TStateValue> {
  throw new Error('not implemented');
}
