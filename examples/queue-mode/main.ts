import { createMachine, createService } from 'fsmxjs';

type Context = Record<string, never>;
type Event = { type: 'TRIGGER' } | { type: 'CHAINED' } | { type: 'DONE' };
type State = 'idle' | 'processing' | 'chained' | 'finished';

const machine = createMachine<Context, Event, State>({
  initial: 'idle',
  context: {},
  states: {
    idle:       { on: { TRIGGER:  { target: 'processing' } } },
    processing: { on: { CHAINED:  { target: 'chained' } } },
    chained:    { on: { DONE:     { target: 'finished' } } },
    finished:   { on: { TRIGGER:  { target: 'processing' } } },
  },
});

const service = createService(machine, {
  queue: true,
  onTransition: ({ next }) => {
    appendLog(`→ state: ${next.value}   (event: ${next.event.type})`, 'is-state');
  },
});

service.subscribe((snap) => {
  if (snap.value === 'processing') {
    appendLog('  subscriber fires — enqueuing CHAINED');
    service.send({ type: 'CHAINED' });
  }
  if (snap.value === 'chained') {
    appendLog('  subscriber fires — enqueuing DONE');
    service.send({ type: 'DONE' });
  }
});

service.start();

const logEl = document.getElementById('log')!;

function appendLog(msg: string, cls = '') {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const row = document.createElement('div');
  row.className = 'log-row';

  const t = document.createElement('span');
  t.className = 'log-time';
  t.textContent = time;

  const m = document.createElement('span');
  m.className = 'log-text ' + cls;
  m.textContent = msg;

  row.appendChild(t);
  row.appendChild(m);
  logEl.prepend(row);
}

document.getElementById('trigger')!.addEventListener('click', () => {
  appendLog('--- TRIGGER sent ---', 'is-sep');
  service.send({ type: 'TRIGGER' });
});

document.getElementById('clear')!.addEventListener('click', () => {
  while (logEl.firstChild) logEl.removeChild(logEl.firstChild);
});
