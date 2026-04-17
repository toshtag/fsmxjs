import { createMachine, createService } from 'fsmxjs';

type Context = Record<string, never>;
type Event = { type: 'TRIGGER' } | { type: 'CHAINED' } | { type: 'DONE' };
type State = 'idle' | 'processing' | 'chained' | 'finished';

const machine = createMachine<Context, Event, State>({
  initial: 'idle',
  context: {},
  states: {
    idle: { on: { TRIGGER: { target: 'processing' } } },
    processing: { on: { CHAINED: { target: 'chained' } } },
    chained: { on: { DONE: { target: 'finished' } } },
    finished: { on: { TRIGGER: { target: 'processing' } } },
  },
});

const service = createService(machine, {
  queue: true,
  onTransition: ({ next }) => {
    log(`→ state: ${next.value}  (event: ${next.event.type})`, 'transition');
  },
});

// Subscriber sends a chained event from within a transition callback.
// Without queue mode this would be silently dropped; with queue:true it is enqueued.
service.subscribe((snap) => {
  if (snap.value === 'processing') {
    log('  subscriber fires — sending CHAINED');
    service.send({ type: 'CHAINED' });
  }
  if (snap.value === 'chained') {
    log('  subscriber fires — sending DONE');
    service.send({ type: 'DONE' });
  }
});

service.start();

const logEl = document.getElementById('log')!;

function log(msg: string, cls = '') {
  const div = document.createElement('div');
  div.className = 'entry ' + cls;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.prepend(div);
}

document.getElementById('trigger')!.addEventListener('click', () => {
  log('--- TRIGGER sent ---');
  service.send({ type: 'TRIGGER' });
});

document.getElementById('clear')!.addEventListener('click', () => {
  while (logEl.firstChild) logEl.removeChild(logEl.firstChild);
});
