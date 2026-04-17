import { createMachine, createService, serializeSnapshot, deserializeSnapshot } from 'fsmxjs';

const STORAGE_KEY = 'fsmxjs-serialization-example';

type Context = { count: number };
type Event = { type: 'INCREMENT' } | { type: 'DECREMENT' } | { type: 'RESET' };
type State = 'active';

function buildService(initialCount = 0) {
  const m = createMachine<Context, Event, State>({
    initial: 'active',
    context: { count: initialCount },
    states: {
      active: {
        on: {
          INCREMENT: { actions: [(ctx) => ({ count: ctx.count + 1 })] },
          DECREMENT: { actions: [(ctx) => ({ count: ctx.count - 1 })] },
          RESET:     { actions: [() => ({ count: 0 })] },
        },
      },
    },
  });
  return createService(m);
}

let service = buildService();
service.start();

const countEl  = document.getElementById('count')!;
const statusEl = document.getElementById('status')!;

function render() {
  countEl.textContent = String(service.getSnapshot().context.count);
}

function rebind() {
  service.subscribe(render);
  render();
}

rebind();

let flashTimer: ReturnType<typeof setTimeout> | undefined;
function setStatus(msg: string, ok = false) {
  statusEl.textContent = msg;
  statusEl.className = 'status-msg' + (ok ? ' ok' : '');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'status-msg'; }, 2000);
}

function flashCount() {
  countEl.classList.add('flash');
  setTimeout(() => countEl.classList.remove('flash'), 300);
}

document.getElementById('inc')!.addEventListener('click',   () => { service.send({ type: 'INCREMENT' }); flashCount(); });
document.getElementById('dec')!.addEventListener('click',   () => { service.send({ type: 'DECREMENT' }); flashCount(); });
document.getElementById('reset')!.addEventListener('click', () => { service.send({ type: 'RESET' }); });

document.getElementById('save')!.addEventListener('click', () => {
  const serialized = serializeSnapshot(service.getSnapshot());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  setStatus(`Saved  count = ${service.getSnapshot().context.count}`, true);
});

document.getElementById('load')!.addEventListener('click', () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) { setStatus('Nothing saved yet.'); return; }
  try {
    const snapshot = deserializeSnapshot<Context, State, Event>(JSON.parse(raw));
    service.stop();
    service = buildService(snapshot.context.count);
    service.start();
    rebind();
    flashCount();
    setStatus(`Loaded  count = ${snapshot.context.count}`, true);
  } catch {
    setStatus('Failed to load snapshot.');
  }
});
