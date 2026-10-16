import { useEffect, useRef, useCallback } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type {
  SetgreetFlowEvent,
  FlowStartedEvent,
  FlowCompletedEvent,
  FlowDismissedEvent,
  ScreenChangedEvent,
  ActionTriggeredEvent,
  PermissionRequestedEvent,
  FlowErrorEvent,
  CustomActionEvent,
  TrackEventEvent,
  RemindLaterEvent,
  PurchaseCompletedEvent,
  PurchaseCancelledEvent,
  PurchaseFailedEvent,
  PurchasePendingEvent,
  RestoreCompletedEvent,
  RestoreFailedEvent,
  FlowEventCallbacks,
  FlowEventSubscription,
} from './types';

const LINKING_ERROR =
  `The package 'react-native-setgreet' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const RNSetgreet = NativeModules.RNSetgreet
  ? NativeModules.RNSetgreet
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

const eventEmitter = new NativeEventEmitter(RNSetgreet);

/**
 * Subscribe to all Setgreet flow events
 * @param callback - Function called with each flow event
 * @returns Subscription object with remove() method for cleanup
 */
export function addFlowEventListener(
  callback: (event: SetgreetFlowEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener('SetgreetFlowEvent', callback);
  return {
    remove: () => subscription.remove(),
  };
}

/**
 * Subscribe to flow started events
 */
export function addFlowStartedListener(
  callback: (event: FlowStartedEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'flowStarted') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * Subscribe to flow completed events
 */
export function addFlowCompletedListener(
  callback: (event: FlowCompletedEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'flowCompleted') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * Subscribe to flow dismissed events
 */
export function addFlowDismissedListener(
  callback: (event: FlowDismissedEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'flowDismissed') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * Subscribe to screen changed events
 */
export function addScreenChangedListener(
  callback: (event: ScreenChangedEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'screenChanged') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * Subscribe to action triggered events
 */
export function addActionTriggeredListener(
  callback: (event: ActionTriggeredEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'actionTriggered') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * Subscribe to permission requested events
 */
export function addPermissionRequestedListener(
  callback: (event: PermissionRequestedEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'permissionRequested') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * Subscribe to flow error events
 */
export function addFlowErrorListener(
  callback: (event: FlowErrorEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'flowError') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * Subscribe to custom action events
 */
export function addCustomActionListener(
  callback: (event: CustomActionEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'customAction') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * Subscribe to track event events
 */
export function addTrackEventListener(
  callback: (event: TrackEventEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'trackEvent') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * Subscribe to remind later events
 */
export function addRemindLaterListener(
  callback: (event: RemindLaterEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'remindLater') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * Subscribe to purchase completed events
 */
export function addPurchaseCompletedListener(
  callback: (event: PurchaseCompletedEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'purchaseCompleted') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * Subscribe to purchase cancelled events
 */
export function addPurchaseCancelledListener(
  callback: (event: PurchaseCancelledEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'purchaseCancelled') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * Subscribe to purchase failed events
 */
export function addPurchaseFailedListener(
  callback: (event: PurchaseFailedEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'purchaseFailed') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * Subscribe to purchase pending events
 */
export function addPurchasePendingListener(
  callback: (event: PurchasePendingEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'purchasePending') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * Subscribe to restore completed events
 */
export function addRestoreCompletedListener(
  callback: (event: RestoreCompletedEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'restoreCompleted') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * Subscribe to restore failed events
 */
export function addRestoreFailedListener(
  callback: (event: RestoreFailedEvent) => void
): FlowEventSubscription {
  const subscription = eventEmitter.addListener(
    'SetgreetFlowEvent',
    (event: SetgreetFlowEvent) => {
      if (event.type === 'restoreFailed') {
        callback(event);
      }
    }
  );
  return { remove: () => subscription.remove() };
}

/**
 * React hook for subscribing to Setgreet flow events
 *
 * @example
 * ```tsx
 * useFlowEvents({
 *   onFlowStarted: (event) => console.log('Flow started:', event.flowId),
 *   onFlowCompleted: (event) => console.log('Flow completed in', event.durationMs, 'ms'),
 *   onFlowDismissed: (event) => console.log('Flow dismissed:', event.reason),
 * });
 * ```
 */
export function useFlowEvents(callbacks: FlowEventCallbacks): void {
  const callbacksRef = useRef(callbacks);

  // Update ref on each render to avoid stale closures
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  const handleEvent = useCallback((event: SetgreetFlowEvent) => {
    const currentCallbacks = callbacksRef.current;

    switch (event.type) {
      case 'flowStarted':
        currentCallbacks.onFlowStarted?.(event);
        break;
      case 'flowCompleted':
        currentCallbacks.onFlowCompleted?.(event);
        break;
      case 'flowDismissed':
        currentCallbacks.onFlowDismissed?.(event);
        break;
      case 'screenChanged':
        currentCallbacks.onScreenChanged?.(event);
        break;
      case 'actionTriggered':
        currentCallbacks.onActionTriggered?.(event);
        break;
      case 'permissionRequested':
        currentCallbacks.onPermissionRequested?.(event);
        break;
      case 'flowError':
        currentCallbacks.onFlowError?.(event);
        break;
      case 'customAction':
        currentCallbacks.onCustomAction?.(event);
        break;
      case 'trackEvent':
        currentCallbacks.onTrackEvent?.(event);
        break;
      case 'remindLater':
        currentCallbacks.onRemindLater?.(event);
        break;
      case 'purchaseCompleted':
        currentCallbacks.onPurchaseCompleted?.(event);
        break;
      case 'purchaseCancelled':
        currentCallbacks.onPurchaseCancelled?.(event);
        break;
      case 'purchaseFailed':
        currentCallbacks.onPurchaseFailed?.(event);
        break;
      case 'purchasePending':
        currentCallbacks.onPurchasePending?.(event);
        break;
      case 'restoreCompleted':
        currentCallbacks.onRestoreCompleted?.(event);
        break;
      case 'restoreFailed':
        currentCallbacks.onRestoreFailed?.(event);
        break;
    }
  }, []);

  useEffect(() => {
    const subscription = addFlowEventListener(handleEvent);
    return () => subscription.remove();
  }, [handleEvent]);
}
