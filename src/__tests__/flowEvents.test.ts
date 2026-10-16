import type {
  CustomActionEvent,
  FlowEventCallbacks,
  RemindLaterEvent,
  SetgreetFlowEvent,
  TrackEventEvent,
} from '../types';

type Listener = (event: unknown) => void;

// Listeners added through NativeEventEmitter, by event name. Shared with the
// mock factory below (jest allows `mock`-prefixed names there).
const mockEmitterListeners = new Map<string, Listener[]>();

jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => ({
  __esModule: true,
  default: class MockNativeEventEmitter {
    addListener(eventType: string, listener: Listener) {
      const listeners = mockEmitterListeners.get(eventType) ?? [];
      listeners.push(listener);
      mockEmitterListeners.set(eventType, listeners);
      return {
        remove: () => {
          const current = mockEmitterListeners.get(eventType) ?? [];
          mockEmitterListeners.set(
            eventType,
            current.filter((entry) => entry !== listener)
          );
        },
      };
    }
  },
}));

// The hook's React primitives, run synchronously outside a renderer: effects
// run at once and their cleanups are kept, so a test can unmount.
const mockEffectCleanups: Array<() => void> = [];

jest.mock('react', () => ({
  useRef: <T>(initial: T) => ({ current: initial }),
  useCallback: <T>(callback: T) => callback,
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (typeof cleanup === 'function') {
      mockEffectCleanups.push(cleanup);
    }
  },
}));

import {
  addCustomActionListener,
  addRemindLaterListener,
  addTrackEventListener,
  useFlowEvents,
} from '../useFlowEvents';

/** Emits a flow event the way the native module does. */
function emit(event: SetgreetFlowEvent): void {
  (mockEmitterListeners.get('SetgreetFlowEvent') ?? []).forEach((listener) =>
    listener(event)
  );
}

function listenerCount(): number {
  return (mockEmitterListeners.get('SetgreetFlowEvent') ?? []).length;
}

function unmount(): void {
  mockEffectCleanups.splice(0).forEach((cleanup) => cleanup());
}

const customAction: CustomActionEvent = {
  type: 'customAction',
  flowId: 'flow-1',
  screenIndex: 2,
  data: { plan: 'annual' },
  timestamp: 1_700_000_000_000,
};

const trackEvent: TrackEventEvent = {
  type: 'trackEvent',
  flowId: 'flow-1',
  screenIndex: 1,
  eventName: 'plan_selected',
  properties: { plan: 'annual' },
  timestamp: 1_700_000_000_000,
};

const remindLater: RemindLaterEvent = {
  type: 'remindLater',
  flowId: 'flow-1',
  screenIndex: 3,
  timestamp: 1_700_000_000_000,
};

const otherEvents: SetgreetFlowEvent[] = [
  {
    type: 'flowStarted',
    flowId: 'flow-1',
    screenCount: 3,
    timestamp: 1,
  },
  {
    type: 'actionTriggered',
    flowId: 'flow-1',
    actionType: 'remind_later',
    actionName: null,
    screenIndex: 3,
    timestamp: 1,
  },
  {
    type: 'flowDismissed',
    flowId: 'flow-1',
    reason: 'remindLater',
    screenIndex: 3,
    screenCount: 4,
    durationMs: 10,
    timestamp: 1,
  },
];

afterEach(() => {
  unmount();
  mockEmitterListeners.clear();
});

describe('useFlowEvents', () => {
  it('routes custom action, track event and remind later to their callbacks', () => {
    const callbacks = {
      onCustomAction: jest.fn(),
      onTrackEvent: jest.fn(),
      onRemindLater: jest.fn(),
    };
    useFlowEvents(callbacks);

    emit(customAction);
    emit(trackEvent);
    emit(remindLater);

    expect(callbacks.onCustomAction).toHaveBeenCalledTimes(1);
    expect(callbacks.onCustomAction).toHaveBeenCalledWith(customAction);
    expect(callbacks.onTrackEvent).toHaveBeenCalledTimes(1);
    expect(callbacks.onTrackEvent).toHaveBeenCalledWith(trackEvent);
    expect(callbacks.onRemindLater).toHaveBeenCalledTimes(1);
    expect(callbacks.onRemindLater).toHaveBeenCalledWith(remindLater);
  });

  it('does not call the new callbacks for other events', () => {
    const callbacks = {
      onCustomAction: jest.fn(),
      onTrackEvent: jest.fn(),
      onRemindLater: jest.fn(),
    };
    useFlowEvents(callbacks);

    otherEvents.forEach(emit);

    expect(callbacks.onCustomAction).not.toHaveBeenCalled();
    expect(callbacks.onTrackEvent).not.toHaveBeenCalled();
    expect(callbacks.onRemindLater).not.toHaveBeenCalled();
  });

  it('routes each event to its own callback alongside the existing ones', () => {
    const callbacks: Required<
      Pick<
        FlowEventCallbacks,
        | 'onActionTriggered'
        | 'onFlowDismissed'
        | 'onRemindLater'
        | 'onFlowError'
      >
    > = {
      onActionTriggered: jest.fn(),
      onFlowDismissed: jest.fn(),
      onRemindLater: jest.fn(),
      onFlowError: jest.fn(),
    };
    useFlowEvents(callbacks);

    emit(otherEvents[1]!);
    emit(remindLater);
    emit(otherEvents[2]!);
    emit({
      type: 'flowError',
      flowId: 'flow-1',
      errorType: 'network',
      message: 'offline',
      timestamp: 1,
    });

    expect(callbacks.onActionTriggered).toHaveBeenCalledTimes(1);
    expect(callbacks.onRemindLater).toHaveBeenCalledTimes(1);
    expect(callbacks.onFlowDismissed).toHaveBeenCalledTimes(1);
    expect(callbacks.onFlowError).toHaveBeenCalledWith(
      expect.objectContaining({ errorType: 'network' })
    );
  });

  it('tolerates a missing callback', () => {
    useFlowEvents({});

    expect(() => {
      emit(customAction);
      emit(trackEvent);
      emit(remindLater);
    }).not.toThrow();
  });

  it('stops delivering after unmount', () => {
    const onCustomAction = jest.fn();
    useFlowEvents({ onCustomAction });
    expect(listenerCount()).toBe(1);

    unmount();
    emit(customAction);

    expect(listenerCount()).toBe(0);
    expect(onCustomAction).not.toHaveBeenCalled();
  });
});

describe('event listeners', () => {
  it('addCustomActionListener receives custom actions only', () => {
    const callback = jest.fn();
    addCustomActionListener(callback);

    [trackEvent, remindLater, ...otherEvents].forEach(emit);
    emit(customAction);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(customAction);
  });

  it('addTrackEventListener receives track events only', () => {
    const callback = jest.fn();
    addTrackEventListener(callback);

    [customAction, remindLater, ...otherEvents].forEach(emit);
    emit(trackEvent);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(trackEvent);
  });

  it('addRemindLaterListener receives remind later only', () => {
    const callback = jest.fn();
    addRemindLaterListener(callback);

    [customAction, trackEvent, ...otherEvents].forEach(emit);
    emit(remindLater);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(remindLater);
  });

  it('a removed listener receives nothing', () => {
    const callbacks = [jest.fn(), jest.fn(), jest.fn()];
    const subscriptions = [
      addCustomActionListener(callbacks[0]!),
      addTrackEventListener(callbacks[1]!),
      addRemindLaterListener(callbacks[2]!),
    ];

    subscriptions.forEach((subscription) => subscription.remove());
    [customAction, trackEvent, remindLater].forEach(emit);

    expect(listenerCount()).toBe(0);
    callbacks.forEach((callback) => expect(callback).not.toHaveBeenCalled());
  });
});

describe('public exports', () => {
  it('exports the new listeners from the package entry point', () => {
    jest.isolateModules(() => {
      jest.doMock('../NativeRNSetgreet', () => ({
        __esModule: true,
        default: {},
      }));
      const entry = require('../index');
      expect(typeof entry.addCustomActionListener).toBe('function');
      expect(typeof entry.addTrackEventListener).toBe('function');
      expect(typeof entry.addRemindLaterListener).toBe('function');
    });
  });
});
