import type { EventObject, Service } from 'fsmxjs';
import { createTaskManager, type TaskFn } from './task-manager';

export function takeLatest<
  TContext,
  TEvent extends EventObject,
  TStateValue extends string,
>(
  service: Service<TContext, TEvent, TStateValue>,
  key: string,
): (task: TaskFn<TContext, TEvent, TStateValue>) => Promise<void> {
  const manager = createTaskManager(service);
  return (task) => manager.run(key, task);
}
