import { createMachine, createService } from 'fsmxjs';

type Context = { name: string; email: string };
type Event =
  | { type: 'NEXT_STEP1'; name: string }
  | { type: 'NEXT_STEP2'; email: string }
  | { type: 'BACK' }
  | { type: 'SUBMIT' }
  | { type: 'RESET' };
type State = 'step1' | 'step2' | 'review' | 'submitted';

const machine = createMachine<Context, Event, State>({
  initial: 'step1',
  context: { name: '', email: '' },
  states: {
    step1: {
      on: {
        NEXT_STEP1: {
          target: 'step2',
          guard: (_ctx, e) => e.type === 'NEXT_STEP1' && e.name.trim().length > 0,
          actions: [(ctx, e) => e.type === 'NEXT_STEP1' ? { name: e.name.trim() } : {}],
        },
      },
    },
    step2: {
      on: {
        NEXT_STEP2: {
          target: 'review',
          guard: (_ctx, e) => e.type === 'NEXT_STEP2' && /\S+@\S+\.\S+/.test(e.email),
          actions: [(_ctx, e) => e.type === 'NEXT_STEP2' ? { email: e.email.trim() } : {}],
        },
        BACK: { target: 'step1' },
      },
    },
    review: {
      on: {
        SUBMIT: { target: 'submitted' },
        BACK: { target: 'step2' },
      },
    },
    submitted: {
      on: {
        RESET: { target: 'step1', actions: [() => ({ name: '', email: '' })] },
      },
    },
  },
});

const service = createService(machine);
service.start();

const steps: Record<State, HTMLElement> = {
  step1: document.getElementById('step1')!,
  step2: document.getElementById('step2')!,
  review: document.getElementById('review')!,
  submitted: document.getElementById('submitted')!,
};
const err1El = document.getElementById('err1')!;
const err2El = document.getElementById('err2')!;

function render() {
  const { value, context } = service.getSnapshot();
  Object.entries(steps).forEach(([k, el]) => el.classList.toggle('active', k === value));
  err1El.textContent = '';
  err2El.textContent = '';
  (document.getElementById('rName') as HTMLElement).textContent = context.name;
  (document.getElementById('rEmail') as HTMLElement).textContent = context.email;
}

service.subscribe(render);
render();

document.getElementById('next1')!.addEventListener('click', () => {
  const name = (document.getElementById('name') as HTMLInputElement).value;
  if (!name.trim()) { err1El.textContent = 'Name is required.'; return; }
  service.send({ type: 'NEXT_STEP1', name });
});

document.getElementById('next2')!.addEventListener('click', () => {
  const email = (document.getElementById('email') as HTMLInputElement).value;
  if (!/\S+@\S+\.\S+/.test(email)) { err2El.textContent = 'Valid email required.'; return; }
  service.send({ type: 'NEXT_STEP2', email });
});

document.getElementById('back2')!.addEventListener('click', () => service.send({ type: 'BACK' }));
document.getElementById('back3')!.addEventListener('click', () => service.send({ type: 'BACK' }));
document.getElementById('submit')!.addEventListener('click', () => service.send({ type: 'SUBMIT' }));
document.getElementById('reset')!.addEventListener('click', () => service.send({ type: 'RESET' }));
