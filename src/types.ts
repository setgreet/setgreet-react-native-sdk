import type {
  SetgreetPurchaseError,
  SetgreetRestoreStatus,
} from './purchaseTypes';

// Dismiss reasons for flow dismissal
export type DismissReason =
  | 'userClose'
  | 'userSkip'
  | 'backPress'
  | 'swipeDown'
  | 'replaced'
  | 'programmatic'
  | 'completed'
  | 'remindLater';

// Error types for flow errors
export type ErrorType = 'network' | 'parse' | 'display' | 'unknown';

// Action types for component actions
/**
 * The action a component performed, as `actionTriggered` reports it: the
 * canonical snake_case name, the same on iOS and Android.
 */
export type ActionType =
  | 'next'
  | 'previous'
  | 'skip'
  | 'dismiss'
  | 'remind_later'
  | 'url'
  | 'deeplink'
  | 'request_notification_permission'
  | 'request_location_permission'
  | 'request_camera_permission'
  | 'request_tracking_permission'
  | 'request_microphone_permission'
  | 'request_photo_library_permission'
  | 'request_review'
  | 'share'
  | 'open_settings'
  | 'track_event'
  | 'custom'
  | 'purchase'
  | 'restore_purchases'
  | 'none';

// Permission types
/**
 * The permission a flow requested. `tracking` is iOS App Tracking
 * Transparency and is reported as `not_required` on Android.
 */
export type PermissionType =
  | 'notification'
  | 'location'
  | 'camera'
  | 'tracking'
  | 'microphone'
  | 'photoLibrary';

// Permission result types
export type PermissionResult =
  | 'granted'
  | 'denied'
  | 'permanently_denied'
  | 'already_granted'
  | 'not_required';

// Event interfaces
export interface FlowStartedEvent {
  type: 'flowStarted';
  flowId: string;
  screenCount: number;
  timestamp: number;
}

export interface FlowCompletedEvent {
  type: 'flowCompleted';
  flowId: string;
  screenCount: number;
  durationMs: number;
  timestamp: number;
}

export interface FlowDismissedEvent {
  type: 'flowDismissed';
  flowId: string;
  reason: DismissReason;
  screenIndex: number;
  screenCount: number;
  durationMs: number;
  timestamp: number;
}

export interface ScreenChangedEvent {
  type: 'screenChanged';
  flowId: string;
  fromIndex: number;
  toIndex: number;
  screenCount: number;
  timestamp: number;
}

export interface ActionTriggeredEvent {
  type: 'actionTriggered';
  flowId: string;
  actionType: ActionType;
  actionName: string | null;
  screenIndex: number;
  timestamp: number;
}

/**
 * A flow the SDK set out to show could not be shown.
 */
export interface FlowErrorEvent {
  type: 'flowError';
  flowId: string;
  errorType: ErrorType;
  message: string;
  timestamp: number;
}

export interface PermissionRequestedEvent {
  type: 'permissionRequested';
  flowId: string;
  permissionType: PermissionType;
  result: PermissionResult;
  screenIndex: number;
  timestamp: number;
}

/**
 * A component whose action is Custom was tapped. `data` is the custom data
 * configured on the action in the editor, or `null` when it has none.
 *
 * On Android every value arrives as a string (numbers and booleans included)
 * and a nested object or array as `null`; on iOS values keep their JSON type.
 */
export interface CustomActionEvent {
  type: 'customAction';
  flowId: string;
  screenIndex: number;
  data: Record<string, unknown> | null;
  timestamp: number;
}

/**
 * A component whose action is Track Event was tapped. `properties` are the
 * event properties configured on the action, or `null` when it has none
 * (value types as for `CustomActionEvent.data`).
 */
export interface TrackEventEvent {
  type: 'trackEvent';
  flowId: string;
  screenIndex: number;
  eventName: string;
  properties: Record<string, unknown> | null;
  timestamp: number;
}

/**
 * A component whose action is Remind Later was tapped. The flow then closes,
 * so a `flowDismissed` event with reason `remindLater` follows.
 */
export interface RemindLaterEvent {
  type: 'remindLater';
  flowId: string;
  screenIndex: number;
  timestamp: number;
}

// Purchase events (purchase providers). `provider` is the registered
// provider's `providerId`; `componentId` is the purchase or restore button.

/** A purchase through the registered purchase provider succeeded. */
export interface PurchaseCompletedEvent {
  type: 'purchaseCompleted';
  flowId: string;
  screenId: string;
  componentId: string;
  productRef: string;
  provider: string;
  /** The access (entitlement) refs the user now holds. */
  accessRefs: string[];
  timestamp: number;
}

/** The user cancelled a purchase. */
export interface PurchaseCancelledEvent {
  type: 'purchaseCancelled';
  flowId: string;
  screenId: string;
  componentId: string;
  productRef: string;
  provider: string;
  timestamp: number;
}

/** A purchase failed. */
export interface PurchaseFailedEvent {
  type: 'purchaseFailed';
  flowId: string;
  screenId: string;
  componentId: string;
  productRef: string;
  provider: string;
  /** The normalized error, with the vendor's own code and message when known. */
  error: SetgreetPurchaseError;
  timestamp: number;
}

/** A purchase is pending approval (Ask to Buy, a deferred payment). */
export interface PurchasePendingEvent {
  type: 'purchasePending';
  flowId: string;
  screenId: string;
  componentId: string;
  productRef: string;
  provider: string;
  timestamp: number;
}

/** A restore finished; `status` says whether anything was restored. */
export interface RestoreCompletedEvent {
  type: 'restoreCompleted';
  flowId: string;
  screenId: string;
  componentId: string;
  provider: string;
  /** `'restored'` or `'nothingToRestore'`. */
  status: Exclude<SetgreetRestoreStatus, 'failed'>;
  accessRefs: string[];
  timestamp: number;
}

/** A restore failed. */
export interface RestoreFailedEvent {
  type: 'restoreFailed';
  flowId: string;
  screenId: string;
  componentId: string;
  provider: string;
  error: SetgreetPurchaseError;
  timestamp: number;
}

// Union type for all events
export type SetgreetFlowEvent =
  | FlowStartedEvent
  | FlowCompletedEvent
  | FlowDismissedEvent
  | ScreenChangedEvent
  | ActionTriggeredEvent
  | PermissionRequestedEvent
  | FlowErrorEvent
  | CustomActionEvent
  | TrackEventEvent
  | RemindLaterEvent
  | PurchaseCompletedEvent
  | PurchaseCancelledEvent
  | PurchaseFailedEvent
  | PurchasePendingEvent
  | RestoreCompletedEvent
  | RestoreFailedEvent;

// Subscription handle for cleanup
export interface FlowEventSubscription {
  remove: () => void;
}

// Callback types for individual events
export interface FlowEventCallbacks {
  onFlowStarted?: (event: FlowStartedEvent) => void;
  onFlowCompleted?: (event: FlowCompletedEvent) => void;
  onFlowDismissed?: (event: FlowDismissedEvent) => void;
  onScreenChanged?: (event: ScreenChangedEvent) => void;
  onActionTriggered?: (event: ActionTriggeredEvent) => void;
  onPermissionRequested?: (event: PermissionRequestedEvent) => void;
  onFlowError?: (event: FlowErrorEvent) => void;
  onCustomAction?: (event: CustomActionEvent) => void;
  onTrackEvent?: (event: TrackEventEvent) => void;
  onRemindLater?: (event: RemindLaterEvent) => void;
  onPurchaseCompleted?: (event: PurchaseCompletedEvent) => void;
  onPurchaseCancelled?: (event: PurchaseCancelledEvent) => void;
  onPurchaseFailed?: (event: PurchaseFailedEvent) => void;
  onPurchasePending?: (event: PurchasePendingEvent) => void;
  onRestoreCompleted?: (event: RestoreCompletedEvent) => void;
  onRestoreFailed?: (event: RestoreFailedEvent) => void;
}
