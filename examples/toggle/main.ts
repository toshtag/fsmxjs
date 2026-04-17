import { createMachine, createService } from 'fsmxjs';

type Context = { toggleCount: number };
type Event = { type: 'TOGGLE' };
type State = 'off' | 'on';

const machine = createMachine<Context, Event, State>({
  initial: 'off',
  context: { toggleCount: 0 },
  states: {
    off: {
      on: { TOGGLE: { target: 'on', actions: [(ctx) => ({ toggleCount: ctx.toggleCount + 1 })] } },
    },
    on: {
      on: { TOGGLE: { target: 'off', actions: [(ctx) => ({ toggleCount: ctx.toggleCount + 1 })] } },
    },
  },
});

const service = createService(machine);
service.start();

const stateEl = document.getElementById('state')!;
const countEl = document.getElementById('count')!;
const btn = document.getElementById('btn')!;

function render() {
  const snap = service.getSnapshot();
  stateEl.textContent = snap.value;
  countEl.textContent = `toggled ${snap.context.toggleCount} time(s)`;
}

service.subscribe(render);
render();

btn.addEventListener('click', () => service.send({ type: 'TOGGLE' }));
