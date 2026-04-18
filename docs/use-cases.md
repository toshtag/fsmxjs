# When fsmxjs helps

Five recurring shapes of frontend complexity that fsmxjs is designed to address. If your project has one of these shapes, fsmxjs is likely a better fit than scattered hooks or a heavier orchestration framework.

If none of these match, [docs/comparisons.md](comparisons.md) helps you pick the right tool instead.

---

## 1. Your component is also your state machine

### Symptoms
- Several `useState` flags coordinate one workflow.
- One or more `useEffect` hooks branch on those flags to trigger the next step.
- Adding a new step means editing both state and effect logic in multiple places.

### Typical smelly code

```tsx
const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  if (status === 'success') navigate('/done');
}, [status]);

useEffect(() => {
  if (status === 'error' && error) reportError(error);
}, [status, error]);
```

### Why fsmxjs helps
The transitions live in the component instead of a place that names them. fsmxjs lifts the transitions into a `machine` definition that has explicit states, explicit events, and explicit guards. The component subscribes; it does not decide.

### Minimal code

```ts
const machine = createMachine({
  initial: 'idle',
  context: { error: null as string | null },
  states: {
    idle:       { on: { SUBMIT:  { target: 'submitting' } } },
    submitting: { on: { SUCCESS: { target: 'success' }, FAIL: { target: 'error', actions: (_c, e) => ({ error: e.message }) } } },
    success:    {},
    error:      { on: { RETRY: { target: 'submitting' } } },
  },
});
```

### When NOT to use
If the workflow is one boolean and one effect, this is overkill. Use `useState` directly.

---

## 2. State leaks across components and hooks

### Symptoms
- Two or three components read and update the same `isLoading`, `isEditing`, `hasError` flags.
- Custom hooks return overlapping flag combinations (`useFormState`, `useFormStatus`, `useFormError`).
- A flag change in one place silently invalidates assumptions in another.

### Typical smelly code

```tsx
function FormHeader({ isEditing, isSaving, hasError }: Props) { /* ... */ }
function FormBody  ({ isEditing, isSaving, hasError }: Props) { /* ... */ }
function FormFooter({ isEditing, isSaving, hasError }: Props) { /* ... */ }
```

The flags are not independent. `isSaving === true && isEditing === true` is unreachable, but the type system does not know that.

### Why fsmxjs helps
A machine collapses the flag combinations into a finite set of named states. Unreachable combinations cease to exist, because they are not in the state union.

### Minimal code

```ts
type State = 'viewing' | 'editing' | 'saving' | 'error';

const machine = createMachine<{}, Event, State>({
  initial: 'viewing',
  context: {},
  states: {
    viewing: { on: { EDIT:  { target: 'editing' } } },
    editing: { on: { SAVE:  { target: 'saving' }, CANCEL: { target: 'viewing' } } },
    saving:  { on: { OK:    { target: 'viewing' }, FAIL:   { target: 'error' } } },
    error:   { on: { RETRY: { target: 'saving' } } },
  },
});
```

### When NOT to use
If the flags really are independent (e.g. `isDarkMode` and `isLoggedIn`), they are not state of one machine. Keep them separate.

---

## 3. Your component decides what should happen next

### Symptoms
- A component imports `navigate`, `toast.show`, or analytics calls and triggers them inside a `useEffect`.
- Side effects fire as a consequence of state changes, not as the result of an explicit event.
- Removing the component breaks the workflow even though the workflow logically belongs to the domain.

### Typical smelly code

```tsx
useEffect(() => {
  if (status === 'submitted') {
    navigate('/thanks');
    toast.show('Saved');
    track('form_submit_success');
  }
}, [status]);
```

### Why fsmxjs helps
Side effects belong outside the machine. The machine emits state transitions; a thin layer at the framework edge — a subscriber — translates transitions into navigation, toasts, and analytics. The component becomes free of decision logic.

### Minimal code

```ts
const service = createService(machine).start();

service.subscribe((snap) => {
  if (snap.value === 'submitted') {
    navigate('/thanks');
    toast.show('Saved');
    track('form_submit_success');
  }
});
```

The subscriber lives in the same module as the framework integration, not inside every component that happens to render the form.

### When NOT to use
If the side effect is genuinely component-local (focusing an input on mount), a `useEffect` is fine. This pattern is for workflow-level effects that outlive any single component.

---

## 4. You can't unit-test transitions without rendering

### Symptoms
- Transition logic is reachable only by mounting a component, firing events, and asserting on rendered output.
- Tests are slow, brittle, or coupled to the testing-library API.
- A transition bug requires a UI test to reproduce.

### Typical smelly code

```tsx
test('submitting after error retries', async () => {
  render(<MyForm />);
  await userEvent.click(screen.getByText('Submit'));
  await waitFor(() => expect(screen.getByText('Error')).toBeVisible());
  await userEvent.click(screen.getByText('Retry'));
  await waitFor(() => expect(screen.getByText('Saved')).toBeVisible());
});
```

The test is doing UI work to assert a transition rule.

### Why fsmxjs helps
`machine.transition(state, event)` is a pure function. Transition tests become unit tests over data:

### Minimal code

```ts
const next = machine.transition(machine.initialState, { type: 'SUBMIT' });
expect(next.value).toBe('submitting');
```

No DOM, no testing library, no async. UI tests then only need to cover the rendering layer.

### When NOT to use
If you do not write transition tests at all, this benefit is theoretical and does not apply.

---

## 5. You need an FSM, not a framework

### Symptoms
- You looked at XState and bounced because the actor model, `invoke`, hierarchical states, and the visual editor are more than the project needs.
- You looked at `useReducer` and realized it does not give you guards, entry/exit actions, or a snapshot you can serialize.
- You want something between "a reducer" and "an orchestration framework".

### Typical smelly code
There is no smelly code here. The smell is the choice itself: reaching for XState to model a four-state form, or hand-rolling a switch statement to model a wizard.

### Why fsmxjs helps
fsmxjs is the FSM without the framework. Guards, entry/exit, a serializable snapshot, and a synchronous core — and nothing more. You get the parts of a state machine that matter for most frontend work, with no orchestration runtime to learn.

### Minimal code

```ts
const machine = createMachine({
  initial: 'off',
  context: { count: 0 },
  states: {
    off: { on: { TOGGLE: { target: 'on',  actions: (c) => ({ count: c.count + 1 }) } } },
    on:  { on: { TOGGLE: { target: 'off', actions: (c) => ({ count: c.count + 1 }) } } },
  },
});
```

This is the [examples/toggle](../examples/toggle/main.ts) demo, complete.

### When NOT to use
If you want actor supervision, invoked services, or hierarchical/parallel states, use XState. fsmxjs deliberately does not have these.

---

## Not in this list?

If your situation does not match one of these five, the responsibility-based comparison in [docs/comparisons.md](comparisons.md) helps you decide whether `useReducer`, Jotai, XState, or fsmxjs is the right choice.
