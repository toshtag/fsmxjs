export type EventObject = { type: string };

export type ActionFn<TContext, TEvent extends EventObject> = (
  context: TContext,
  event: TEvent,
) => Partial<TContext> | void;

export type GuardFn<TContext, TEvent extends EventObject> = (
  context: TContext,
  event: TEvent,
) => boolean;

export interface TransitionConfig<
  TContext,
  TEvent extends EventObject,
  TStateValue extends string,
> {
  target?: TStateValue;
  reenter?: boolean;
  guard?: GuardFn<TContext, TEvent>;
  actions?: ActionFn<TContext, TEvent> | ActionFn<TContext, TEvent>[];
}

export type TransitionValue<
  TContext,
  TEvent extends EventObject,
  TStateValue extends string,
> =
  | TStateValue
  | TransitionConfig<TContext, TEvent, TStateValue>
  | TransitionConfig<TContext, TEvent, TStateValue>[];

export interface StateNodeConfig<
  TContext,
  TEvent extends EventObject,
  TStateValue extends string,
> {
  on?: {
    [K in TEvent['type']]?: TransitionValue<
      TContext,
      Extract<TEvent, { type: K }>,
      TStateValue
    >;
  };
  entry?: ActionFn<TContext, TEvent> | ActionFn<TContext, TEvent>[];
  exit?: ActionFn<TContext, TEvent> | ActionFn<TContext, TEvent>[];
}

export interface MachineConfig<
  TContext,
  TEvent extends EventObject,
  TStateValue extends string,
> {
  initial: TStateValue;
  context: TContext;
  types?: { events: TEvent };
  states: Record<TStateValue, StateNodeConfig<TContext, TEvent, TStateValue>>;
}

export type InitEvent = { type: '@@fsmx/init' };

export interface Snapshot<
  TContext,
  TStateValue extends string,
  TEvent extends EventObject,
> {
  value: TStateValue;
  context: Readonly<TContext>;
  event: TEvent | InitEvent;
}

export type ServiceOptions<
  TContext,
  TEvent extends EventObject,
  TStateValue extends string,
> = {
  onTransition?: (args: {
    prev: Snapshot<TContext, TStateValue, TEvent>;
    next: Snapshot<TContext, TStateValue, TEvent>;
    event: TEvent | InitEvent;
    changed: boolean;
  }) => void;
  onError?: (error: unknown) => void;
};

export interface Machine<
  TContext,
  TEvent extends EventObject,
  TStateValue extends string,
> {
  config: MachineConfig<TContext, TEvent, TStateValue>;
  initialState: Snapshot<TContext, TStateValue, TEvent>;
  transition: (
    state: Snapshot<TContext, TStateValue, TEvent>,
    event: TEvent,
  ) => Snapshot<TContext, TStateValue, TEvent>;
}
