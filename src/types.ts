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
export type ActionType =
  | 'next'
  | 'back'
  | 'close'
  | 'skip'
  | 'notification_permission'
  | 'location_permission'
  | 'camera_permission'
  | 'internalUrl'
  | 'externalUrl'
  | 'none';

// Permission types
export type PermissionType = 'notification' | 'location' | 'camera';

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
