import type {
  ActionFn,
  EventObject,
  Machine,
  MachineConfig,
  Snapshot,
  StateNodeConfig,
  TransitionConfig,
  TransitionValue,
} from './types';

// Extract all event type strings by walking every state's `on` keys.
type ExtractEventTypes<TStates> = {
  [S in keyof TStates]: TStates[S] extends { on?: infer TOn }
    ? keyof TOn extends string
      ? keyof TOn
      : never
    : never;
}[keyof TStates];

type InferEvents<TStates> = ExtractEventTypes<TStates> extends string
  ? { [K in ExtractEventTypes<TStates>]: { type: K } }[ExtractEventTypes<TStates>]
  : never;

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeTransitions<
  TContext,
  TEvent extends EventObject,
  TStateValue extends string,
>(
  value: TransitionValue<TContext, TEvent, TStateValue> | undefined,
): TransitionConfig<TContext, TEvent, TStateValue>[] {
  if (value === undefined) return [];
  if (typeof value === 'string') return [{ target: value }];
  if (Array.isArray(value)) return value;
  return [value];
}

function applyActions<TContext, TEvent extends EventObject>(
  context: TContext,
  event: TEvent,
  actions: ActionFn<TContext, TEvent>[],
): TContext {
  let ctx = context;
  for (const action of actions) {
    const patch = action(ctx, event);
    if (patch !== undefined) {
      ctx = Object.assign({}, ctx, patch);
    }
  }
  return ctx;
}

export function createMachine<
  TContext,
  TEvent extends EventObject = never,
  const TStates extends Record<
    string,
    StateNodeConfig<
      TContext,
      [TEvent] extends [never] ? InferEvents<TStates> : TEvent,
      Extract<keyof TStates, string>
    >
  > = Record<string, StateNodeConfig<TContext, EventObject, string>>,
>(config: {
  initial: Extract<keyof TStates, string>;
  context: TContext;
  types?: { events: TEvent };
  states: TStates;
}): Machine<
  TContext,
  [TEvent] extends [never] ? InferEvents<TStates> : TEvent,
  Extract<keyof TStates, string>
> {
  type ResolvedEvent = [TEvent] extends [never]
    ? InferEvents<TStates>
    : TEvent;
  type ResolvedState = Extract<keyof TStates, string>;
  type S = Snapshot<TContext, ResolvedState, ResolvedEvent>;

  const resolvedConfig = config as unknown as MachineConfig<
    TContext,
    ResolvedEvent,
    ResolvedState
  >;

  const initialState: S = {
    value: resolvedConfig.initial,
    context: resolvedConfig.context,
    event: { type: '@@fsmx/init' },
  };

  function transition(state: S, event: ResolvedEvent): S {
    const stateNode = resolvedConfig.states[state.value] as StateNodeConfig<
      TContext,
      ResolvedEvent,
      ResolvedState
    >;
    const on = stateNode.on as
      | Record<string, TransitionValue<TContext, ResolvedEvent, ResolvedState>>
      | undefined;

    if (!on || !(event.type in on)) return state;

    const candidates = normalizeTransitions<
      TContext,
      ResolvedEvent,
      ResolvedState
    >(on[event.type]);

    const matched = candidates.find(
      (t) => t.guard === undefined || t.guard(state.context, event),
    );

    if (matched === undefined) return state;

    const hasTarget = typeof matched.target === 'string';
    const isSelf = matched.target === state.value;
    const shouldReenter = matched.reenter === true;
    const isExternal = hasTarget && (!isSelf || shouldReenter);

    let ctx = state.context as TContext;

    if (isExternal) {
      ctx = applyActions(ctx, event, toArray(stateNode.exit));
    }

    ctx = applyActions(ctx, event, toArray(matched.actions));

    if (isExternal) {
      const targetNode = resolvedConfig.states[
        matched.target as ResolvedState
      ] as StateNodeConfig<TContext, ResolvedEvent, ResolvedState>;
      ctx = applyActions(ctx, event, toArray(targetNode.entry));
    }

    return {
      value: hasTarget ? (matched.target as ResolvedState) : state.value,
      context: ctx,
      event,
    };
  }

  return {
    config: resolvedConfig,
    initialState,
    transition,
  };
}
