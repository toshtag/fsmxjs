import type { EventObject, InitEvent, Snapshot } from './types';

export function serializeSnapshot<
  TContext,
  TStateValue extends string,
  TEvent extends EventObject,
>(snapshot: Snapshot<TContext, TStateValue, TEvent>): string {
  return JSON.stringify({
    value: snapshot.value,
    context: snapshot.context,
    event: snapshot.event,
  });
}

export function deserializeSnapshot<
  TContext = unknown,
  TStateValue extends string = string,
  TEvent extends EventObject = EventObject,
>(serialized: string): Snapshot<TContext, TStateValue, TEvent> {
  // JSON.parse throws SyntaxError on malformed input — let it propagate.
  const parsed: unknown = JSON.parse(serialized);

  const p = parsed as Record<string, unknown>;
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof p['value'] !== 'string' ||
    !('context' in p) ||
    typeof p['event'] !== 'object' ||
    p['event'] === null ||
    typeof (p['event'] as Record<string, unknown>)['type'] !== 'string'
  ) {
    throw new Error('deserializeSnapshot: invalid snapshot shape');
  }

  return {
    value: p['value'] as TStateValue,
    context: p['context'] as Readonly<TContext>,
    event: p['event'] as TEvent | InitEvent,
  };
}
