import { describe, expect, it } from 'vitest';
import { deserializeSnapshot, serializeSnapshot } from '../src/index';
import type { Snapshot } from '../src/index';

type Ctx = { count: number };
type Ev = { type: 'INC' } | { type: 'DEC' };
type Val = 'active' | 'idle';

const snapshot: Snapshot<Ctx, Val, Ev> = {
  value: 'active',
  context: { count: 3 },
  event: { type: 'INC' },
};

const initSnapshot: Snapshot<Ctx, Val, Ev> = {
  value: 'idle',
  context: { count: 0 },
  event: { type: '@@fsmx/init' },
};

describe('serializeSnapshot / deserializeSnapshot', () => {
  it('roundtrip preserves value, context, and event.type', () => {
    const result = deserializeSnapshot<Ctx, Val, Ev>(serializeSnapshot(snapshot));
    expect(result.value).toBe('active');
    expect(result.context).toEqual({ count: 3 });
    expect(result.event.type).toBe('INC');
  });

  it('roundtrip preserves nested object context', () => {
    type NestedCtx = { user: { name: string; score: number } };
    const s: Snapshot<NestedCtx, 'on', { type: 'GO' }> = {
      value: 'on',
      context: { user: { name: 'alice', score: 42 } },
      event: { type: 'GO' },
    };
    const result = deserializeSnapshot<NestedCtx, 'on', { type: 'GO' }>(serializeSnapshot(s));
    expect(result.context).toEqual({ user: { name: 'alice', score: 42 } });
  });

  it('roundtrip preserves InitEvent', () => {
    const result = deserializeSnapshot<Ctx, Val, Ev>(serializeSnapshot(initSnapshot));
    expect(result.value).toBe('idle');
    expect(result.event.type).toBe('@@fsmx/init');
  });

  it('roundtrip preserves event payload fields', () => {
    type EvWithPayload = { type: 'ADD'; amount: number };
    const s: Snapshot<Ctx, Val, EvWithPayload> = {
      value: 'active',
      context: { count: 1 },
      event: { type: 'ADD', amount: 5 },
    };
    const result = deserializeSnapshot<Ctx, Val, EvWithPayload>(serializeSnapshot(s));
    expect(result.event).toEqual({ type: 'ADD', amount: 5 });
  });

  it('Date in context becomes ISO string after roundtrip', () => {
    type DateCtx = { ts: Date | string };
    const s: Snapshot<DateCtx, 'on', { type: 'GO' }> = {
      value: 'on',
      context: { ts: new Date('2024-01-01T00:00:00.000Z') },
      event: { type: 'GO' },
    };
    const result = deserializeSnapshot<DateCtx, 'on', { type: 'GO' }>(serializeSnapshot(s));
    expect(typeof result.context.ts).toBe('string');
    expect(result.context.ts).toBe('2024-01-01T00:00:00.000Z');
    expect(result.context.ts).not.toBeInstanceOf(Date);
  });

  it('malformed JSON throws SyntaxError', () => {
    expect(() => deserializeSnapshot('')).toThrow(SyntaxError);
    expect(() => deserializeSnapshot('not-json')).toThrow(SyntaxError);
  });

  it('empty object throws Error with invalid snapshot shape message', () => {
    expect(() => deserializeSnapshot('{}')).toThrow('invalid snapshot shape');
  });

  it('missing event.type throws Error with invalid snapshot shape message', () => {
    expect(() =>
      deserializeSnapshot('{"value":"x","context":{},"event":{}}'),
    ).toThrow('invalid snapshot shape');
  });
});
