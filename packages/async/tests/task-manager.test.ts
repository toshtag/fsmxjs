import { describe, expect, it, vi } from 'vitest';
import { createMachine, createService } from 'fsmxjs';
import { createTaskManager } from '../src/task-manager';

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

describe('createTaskManager', () => {
  it('returns an object with run and abortAll', () => {
    const manager = createTaskManager(makeService());
    expect(typeof manager.run).toBe('function');
    expect(typeof manager.abortAll).toBe('function');
  });

  it('runs a task to completion', async () => {
    const manager = createTaskManager(makeService());
    const ran = vi.fn();
    await manager.run('k', async () => { ran(); });
    expect(ran).toHaveBeenCalledOnce();
  });

  it('passes signal, snapshot, and send to task', async () => {
    const service = makeService();
    const manager = createTaskManager(service);
    let receivedSignal: AbortSignal | undefined;

    await manager.run('k', async ({ signal, snapshot, send }) => {
      receivedSignal = signal;
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(snapshot).toBe(service.getSnapshot());
      expect(typeof send).toBe('function');
    });

    expect(receivedSignal?.aborted).toBe(false);
  });

  it('provides snapshot captured at run() call time', async () => {
    const service = makeService();
    service.send({ type: 'INC' });
    const manager = createTaskManager(service);
    let received: unknown;

    await manager.run('k', async ({ snapshot }) => { received = snapshot; });

    expect(received).toBe(service.getSnapshot());
  });

  it('aborts previous task when new run() with same key is called', async () => {
    const manager = createTaskManager(makeService());
    let firstSignal: AbortSignal | undefined;

    const p1 = manager.run('k', async ({ signal }) => {
      firstSignal = signal;
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve());
      });
    });

    const p2 = manager.run('k', async () => {});

    await Promise.all([p1, p2]);
    expect(firstSignal?.aborted).toBe(true);
  });

  it('starts new task immediately without waiting for previous cleanup', async () => {
    const manager = createTaskManager(makeService());
    let task2Started = false;
    let task1CleanupDone = false;

    const p1 = manager.run('k', async ({ signal }) => {
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve());
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      task1CleanupDone = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const p2 = manager.run('k', async () => { task2Started = true; });
    await p2;

    expect(task2Started).toBe(true);
    expect(task1CleanupDone).toBe(false);

    await p1;
    expect(task1CleanupDone).toBe(true);
  });

  it('does not abort tasks with different keys', async () => {
    const manager = createTaskManager(makeService());
    const signals: AbortSignal[] = [];

    await Promise.all([
      manager.run('a', async ({ signal }) => { signals.push(signal); }),
      manager.run('b', async ({ signal }) => { signals.push(signal); }),
    ]);

    expect(signals.every((s) => !s.aborted)).toBe(true);
  });

  it('blocks send after abort (stale protection)', async () => {
    const service = makeService();
    const manager = createTaskManager(service);
    let capturedSend: ((e: { type: 'INC' }) => void) | undefined;

    const p1 = manager.run('k', async ({ send, signal }) => {
      capturedSend = send;
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve());
      });
    });

    await manager.run('k', async () => {});
    await p1;

    const before = service.getSnapshot().context.count;
    capturedSend?.({ type: 'INC' });
    expect(service.getSnapshot().context.count).toBe(before);
  });

  it('propagates real service errors from send when not aborted', async () => {
    const service = makeService();
    service.stop();
    const manager = createTaskManager(service);

    await expect(
      manager.run('k', async ({ send }) => { send({ type: 'INC' }); }),
    ).rejects.toThrow('service has been stopped');
  });

  it('propagates errors from non-aborted tasks', async () => {
    const manager = createTaskManager(makeService());
    const err = new Error('oops');

    await expect(
      manager.run('k', async () => { throw err; }),
    ).rejects.toBe(err);
  });

  it('swallows errors thrown from aborted tasks', async () => {
    const manager = createTaskManager(makeService());

    const p1 = manager.run('k', async ({ signal }) => {
      await new Promise<void>((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });

    await manager.run('k', async () => {});
    await expect(p1).resolves.toBeUndefined();
  });

  it('abortAll cancels all running tasks', async () => {
    const manager = createTaskManager(makeService());
    const aborted: string[] = [];

    const tasks = ['a', 'b', 'c'].map((key) =>
      manager.run(key, async ({ signal }) => {
        await new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => {
            aborted.push(key);
            resolve();
          });
        });
      }),
    );

    manager.abortAll();
    await Promise.all(tasks);
    expect(aborted.sort()).toEqual(['a', 'b', 'c']);
  });

  it('abortAll after settled task does not throw', async () => {
    const manager = createTaskManager(makeService());
    await manager.run('k', async () => {});
    expect(() => manager.abortAll()).not.toThrow();
  });

  it('send from aborted task after abortAll is a no-op', async () => {
    const service = makeService();
    const manager = createTaskManager(service);
    let capturedSend: ((e: { type: 'INC' }) => void) | undefined;

    const p = manager.run('k', async ({ send, signal }) => {
      capturedSend = send;
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve());
      });
    });

    manager.abortAll();
    await p;

    const before = service.getSnapshot().context.count;
    capturedSend?.({ type: 'INC' });
    expect(service.getSnapshot().context.count).toBe(before);
  });

  it('error thrown from aborted task after abortAll resolves, not rejects', async () => {
    const manager = createTaskManager(makeService());

    const p = manager.run('k', async ({ signal }) => {
      await new Promise<void>((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });

    manager.abortAll();
    await expect(p).resolves.toBeUndefined();
  });

  it('cleans up map entry after task settles', async () => {
    const service = makeService();
    const manager = createTaskManager(service);

    await manager.run('k', async () => {});

    // If map entry was cleaned up, running same key should create fresh controller
    let signalAfter: AbortSignal | undefined;
    await manager.run('k', async ({ signal }) => { signalAfter = signal; });
    expect(signalAfter?.aborted).toBe(false);
  });
});
