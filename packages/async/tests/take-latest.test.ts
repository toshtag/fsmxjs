import { describe, expect, it } from 'vitest';
import { createMachine, createService } from 'fsmxjs';
import { takeLatest } from '../src/take-latest';

function makeService() {
  const machine = createMachine({
    initial: 'idle',
    context: { count: 0 },
    states: {
      idle: {
        on: { INC: { actions: (ctx) => ({ count: ctx.count + 1 }) } },
      },
    },
  });
  return createService(machine).start();
}

describe('takeLatest', () => {
  it('returns a function', () => {
    const run = takeLatest(makeService(), 'k');
    expect(typeof run).toBe('function');
  });

  it('runs a task to completion', async () => {
    const run = takeLatest(makeService(), 'k');
    let ran = false;
    await run(async () => { ran = true; });
    expect(ran).toBe(true);
  });

  it('aborts previous task when called again with same key', async () => {
    const run = takeLatest(makeService(), 'search');
    let firstSignal: AbortSignal | undefined;

    const p1 = run(async ({ signal }) => {
      firstSignal = signal;
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve());
      });
    });

    const p2 = run(async () => {});

    await Promise.all([p1, p2]);
    expect(firstSignal?.aborted).toBe(true);
  });

  it('only the last task is effective when called rapidly', async () => {
    const service = makeService();
    const run = takeLatest(service, 'fetch');
    const ran: number[] = [];

    const p1 = run(async ({ signal }) => {
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve());
      });
      if (!signal.aborted) ran.push(1);
    });

    const p2 = run(async ({ signal }) => {
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve());
      });
      if (!signal.aborted) ran.push(2);
    });

    const p3 = run(async () => { ran.push(3); });

    await Promise.all([p1, p2, p3]);
    expect(ran).toEqual([3]);
  });

  it('different keys from different takeLatest instances do not interfere', async () => {
    const service = makeService();
    const runA = takeLatest(service, 'a');
    const runB = takeLatest(service, 'b');
    const signals: AbortSignal[] = [];

    await Promise.all([
      runA(async ({ signal }) => { signals.push(signal); }),
      runB(async ({ signal }) => { signals.push(signal); }),
    ]);

    expect(signals.every((s) => !s.aborted)).toBe(true);
  });

  it('different service instances are independent', async () => {
    const run1 = takeLatest(makeService(), 'k');
    const run2 = takeLatest(makeService(), 'k');
    const signals: AbortSignal[] = [];

    await Promise.all([
      run1(async ({ signal }) => { signals.push(signal); }),
      run2(async ({ signal }) => { signals.push(signal); }),
    ]);

    expect(signals.every((s) => !s.aborted)).toBe(true);
  });

  it('stale send from superseded task is a no-op', async () => {
    const service = makeService();
    const run = takeLatest(service, 'k');
    let capturedSend: ((e: { type: 'INC' }) => void) | undefined;

    const p1 = run(async ({ send, signal }) => {
      capturedSend = send;
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve());
      });
    });

    await run(async () => {});
    await p1;

    const before = service.getSnapshot().context.count;
    capturedSend?.({ type: 'INC' });
    expect(service.getSnapshot().context.count).toBe(before);
  });
});
