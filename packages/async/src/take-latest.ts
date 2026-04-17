import type { EventObject } from 'fsmxjs';
import type { Service } from 'fsmxjs';
import type { TaskFn } from './task-manager';

export function takeLatest<
  TContext,
  TEvent extends EventObject,
  TStateValue extends string,
>(
  _service: Service<TContext, TEvent, TStateValue>,
  _key: string,
): (task: TaskFn<TContext, TEvent, TStateValue>) => Promise<void> {
  throw new Error('not implemented');
}
