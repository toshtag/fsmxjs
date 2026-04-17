import { createMachine, createService } from 'fsmxjs';

type Context = { name: string; email: string; error: string };
type Event =
  | { type: 'NEXT_STEP1'; name: string }
  | { type: 'NEXT_STEP2'; email: string }
  | { type: 'BACK' }
  | { type: 'SUBMIT' }
  | { type: 'RESET' };
type State = 'step1' | 'step2' | 'review' | 'submitted';

const machine = createMachine<Context, Event, State>({
  initial: 'step1',
  context: { name: '', email: '', error: '' },
  states: {
    step1: {
      on: {
        NEXT_STEP1: {
          target: 'step2',
          guard: (_ctx, e) => e.type === 'NEXT_STEP1' && e.name.trim().length > 0,
          actions: [
            (ctx, e) => e.type === 'NEXT_STEP1' ? { name: e.name.trim(), error: '' } : {},
          ],
        },
      },
      exit: [(_ctx, e) => e.type === 'NEXT_STEP1' && e.name.trim() === '' ? { error: 'Name is required.' } : { error: '' }],
    },
    step2: {
      on: {
        NEXT_STEP2: {
          target: 'review',
          guard: (_ctx, e) => e.type === 'NEXT_STEP2' && /\S+@\S+\.\S+/.test(e.email),
          actions: [
            (ctx, e) => e.type === 'NEXT_STEP2' ? { email: e.email.trim(), error: '' } : {},
          ],
        },
        BACK: { target: 'step1' },
      },
      exit: [(_ctx, e) => e.type === 'NEXT_STEP2' && !/\S+@\S+\.\S+/.test(e.email) ? { error: 'Valid email required.' } : { error: '' }],
    },
    review: {
      on: {
        SUBMIT: { target: 'submitted' },
        BACK: { target: 'step2' },
      },
    },
    submitted: {
      on: {
        RESET: { target: 'step1', actions: [() => ({ name: '', email: '', error: '' })] },
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

function render() {
  const { value, context } = service.getSnapshot();
  Object.entries(steps).forEach(([k, el]) => el.classList.toggle('active', k === value));
  (document.getElementById('err1') as HTMLElement).textContent = value === 'step1' ? context.error : '';
  (document.getElementById('err2') as HTMLElement).textContent = value === 'step2' ? context.error : '';
  (document.getElementById('rName') as HTMLElement).textContent = context.name;
  (document.getElementById('rEmail') as HTMLElement).textContent = context.email;
}

service.subscribe(render);
render();

document.getElementById('next1')!.addEventListener('click', () => {
  service.send({ type: 'NEXT_STEP1', name: (document.getElementById('name') as HTMLInputElement).value });
});
document.getElementById('next2')!.addEventListener('click', () => {
  service.send({ type: 'NEXT_STEP2', email: (document.getElementById('email') as HTMLInputElement).value });
});
document.getElementById('back2')!.addEventListener('click', () => service.send({ type: 'BACK' }));
document.getElementById('back3')!.addEventListener('click', () => service.send({ type: 'BACK' }));
document.getElementById('submit')!.addEventListener('click', () => service.send({ type: 'SUBMIT' }));
document.getElementById('reset')!.addEventListener('click', () => service.send({ type: 'RESET' }));
