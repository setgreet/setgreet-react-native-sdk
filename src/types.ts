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

// Action types for button actions
/**
 * The action a tapped component performed, as the native SDKs report it on
 * `actionTriggered`: the Android `ActionType` enum name lower-cased. (The iOS
 * SDK does not currently emit this event.) The previous union listed names
 * no runtime ever sent (`back`, `close`, `notification_permission`, ...).
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

// Union type for all events
export type SetgreetFlowEvent =
  | FlowStartedEvent
  | FlowCompletedEvent
  | FlowDismissedEvent
  | ScreenChangedEvent
  | ActionTriggeredEvent
  | PermissionRequestedEvent
  | FlowErrorEvent;

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
}
