import { createMachine, createService } from 'fsmxjs';
import { createTaskManager } from '@fsmxjs/async';

type User = { id: number; name: string; email: string };

type Context = {
  user: User | null;
  error: string | null;
  retryCount: number;
};

type Event =
  | { type: 'FETCH' }
  | { type: 'SUCCESS'; user: User }
  | { type: 'FAILURE'; error: string }
  | { type: 'RETRY' }
  | { type: 'RESET' };

type State = 'idle' | 'loading' | 'success' | 'error';

const MAX_RETRIES = 3;

const machine = createMachine<Context, Event, State>({
  initial: 'idle',
  context: { user: null, error: null, retryCount: 0 },
  states: {
    idle: {
      on: {
        FETCH: { target: 'loading' },
      },
    },
    loading: {
      on: {
        SUCCESS: {
          target: 'success',
          actions: [(_ctx, e) => e.type === 'SUCCESS' ? { user: e.user, error: null } : {}],
        },
        FAILURE: {
          target: 'error',
          actions: [(ctx, e) =>
            e.type === 'FAILURE' ? { error: e.error, retryCount: ctx.retryCount + 1 } : {}
          ],
        },
      },
    },
    success: {
      on: {
        RESET: { target: 'idle', actions: [() => ({ user: null, error: null, retryCount: 0 })] },
      },
    },
    error: {
      on: {
        RETRY: [
          {
            target: 'loading',
            guard: (ctx) => ctx.retryCount < MAX_RETRIES,
          },
          {
            target: 'error',
          },
        ],
        RESET: { target: 'idle', actions: [() => ({ user: null, error: null, retryCount: 0 })] },
      },
    },
  },
});

const service = createService(machine).start();
const manager = createTaskManager(service);

async function fetchUser(signal: AbortSignal): Promise<User> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 800 + Math.random() * 600);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); });
  });

  if (Math.random() < 0.4) {
    throw new Error('Network error — server unreachable');
  }

  return { id: 1, name: 'Jane Smith', email: 'jane@example.com' };
}

function runFetch() {
  service.send({ type: 'FETCH' });
  manager.run('user', async ({ signal, send }) => {
    try {
      const user = await fetchUser(signal);
      send({ type: 'SUCCESS', user });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        send({ type: 'FAILURE', error: (err as Error).message });
      }
    }
  });
}

function setText(el: Element, text: string) {
  el.textContent = text;
}

function makeRow(label: string, value: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'user-row';
  const labelEl = document.createElement('span');
  labelEl.className = 'user-label';
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.textContent = value;
  row.appendChild(labelEl);
  row.appendChild(valueEl);
  return row;
}

const stateEl   = document.getElementById('state-value')!;
const spinnerEl = document.getElementById('spinner')!;
const userEl    = document.getElementById('user-info')!;
const errorEl   = document.getElementById('error-info')!;
const retryEl   = document.getElementById('retry-count')!;
const fetchBtn  = document.getElementById('btn-fetch')!;
const retryBtn  = document.getElementById('btn-retry')! as HTMLButtonElement;
const resetBtn  = document.getElementById('btn-reset')!;

service.subscribe((snap) => {
  const { value, context } = snap;

  setText(stateEl, value);
  stateEl.className = `state-badge state-${value}`;
  spinnerEl.style.display = value === 'loading' ? 'block' : 'none';

  userEl.style.display  = value === 'success' ? 'block' : 'none';
  errorEl.style.display = value === 'error'   ? 'block' : 'none';

  if (value === 'success' && context.user) {
    while (userEl.firstChild) userEl.removeChild(userEl.firstChild);
    userEl.appendChild(makeRow('Name', context.user.name));
    userEl.appendChild(makeRow('Email', context.user.email));
  }

  if (value === 'error') {
    while (errorEl.firstChild) errorEl.removeChild(errorEl.firstChild);
    const msgEl = document.createElement('div');
    msgEl.className = 'error-msg';
    setText(msgEl, context.error ?? 'Unknown error');
    const remaining = MAX_RETRIES - context.retryCount;
    const noteEl = document.createElement('div');
    noteEl.className = 'retry-note';
    setText(noteEl, remaining > 0
      ? `${remaining} retr${remaining === 1 ? 'y' : 'ies'} remaining`
      : 'No retries left');
    errorEl.appendChild(msgEl);
    errorEl.appendChild(noteEl);
  }

  setText(retryEl, `${context.retryCount} / ${MAX_RETRIES}`);

  fetchBtn.style.display = value === 'idle'    ? 'inline-flex' : 'none';
  retryBtn.style.display = value === 'error'   ? 'inline-flex' : 'none';
  resetBtn.style.display = ['success', 'error'].includes(value) ? 'inline-flex' : 'none';

  retryBtn.disabled = context.retryCount >= MAX_RETRIES;
});

fetchBtn.addEventListener('click', runFetch);

retryBtn.addEventListener('click', () => {
  service.send({ type: 'RETRY' });
  manager.run('user', async ({ signal, send }) => {
    try {
      const user = await fetchUser(signal);
      send({ type: 'SUCCESS', user });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        send({ type: 'FAILURE', error: (err as Error).message });
      }
    }
  });
});

resetBtn.addEventListener('click', () => service.send({ type: 'RESET' }));
