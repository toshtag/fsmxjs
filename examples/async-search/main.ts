import { createMachine, createService } from 'fsmxjs';
import { takeLatest } from '@fsmxjs/async';

const FRUITS = [
  'apple', 'apricot', 'avocado', 'banana', 'blueberry', 'cherry', 'coconut',
  'date', 'fig', 'grape', 'guava', 'kiwi', 'lemon', 'lime', 'mango',
  'melon', 'orange', 'papaya', 'peach', 'pear', 'pineapple', 'plum',
  'pomegranate', 'raspberry', 'strawberry', 'watermelon',
];

function fakeSearch(query: string, signal: AbortSignal): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const delay = 300 + Math.random() * 400;
    const timer = setTimeout(() => {
      resolve(FRUITS.filter((f) => f.includes(query.toLowerCase())));
    }, delay);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); });
  });
}

type Context = { results: string[]; query: string };
type Event =
  | { type: 'SEARCH'; query: string }
  | { type: 'RESULTS'; results: string[] }
  | { type: 'ERROR' };
type State = 'idle' | 'loading' | 'ready';

const machine = createMachine<Context, Event, State>({
  initial: 'idle',
  context: { results: [], query: '' },
  states: {
    idle: {
      on: { SEARCH: { target: 'loading', actions: [(ctx, e) => e.type === 'SEARCH' ? { query: e.query, results: [] } : {}] } },
    },
    loading: {
      on: {
        SEARCH: { target: 'loading', actions: [(ctx, e) => e.type === 'SEARCH' ? { query: e.query, results: [] } : {}] },
        RESULTS: { target: 'ready', actions: [(_ctx, e) => e.type === 'RESULTS' ? { results: e.results } : {}] },
        ERROR: { target: 'idle' },
      },
    },
    ready: {
      on: {
        SEARCH: { target: 'loading', actions: [(ctx, e) => e.type === 'SEARCH' ? { query: e.query, results: [] } : {}] },
      },
    },
  },
});

const service = createService(machine);
service.start();

const search = takeLatest(service, 'search');

const statusEl = document.getElementById('status')!;
const resultsEl = document.getElementById('results')!;

service.subscribe((snap) => {
  statusEl.textContent = snap.value === 'loading' ? 'Searching…' : '';
  while (resultsEl.firstChild) resultsEl.removeChild(resultsEl.firstChild);
  snap.context.results.forEach((r) => {
    const li = document.createElement('li');
    li.textContent = r;
    resultsEl.appendChild(li);
  });
});

document.getElementById('query')!.addEventListener('input', (e) => {
  const query = (e.target as HTMLInputElement).value.trim();
  if (!query) {
    service.send({ type: 'RESULTS', results: [] });
    return;
  }
  service.send({ type: 'SEARCH', query });
  search(async ({ signal, send }) => {
    try {
      const results = await fakeSearch(query, signal);
      send({ type: 'RESULTS', results });
    } catch {
      send({ type: 'ERROR' });
    }
  });
});
