import RNSetgreet from './NativeRNSetgreet';
import { _setThemeConfig } from './theme';

// Re-export types
export type {
  DismissReason,
  ErrorType,
  ActionType,
  PermissionType,
  PermissionResult,
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
  SetgreetFlowEvent,
  FlowEventSubscription,
  FlowEventCallbacks,
} from './types';

// Re-export event functions and hook
export {
  addFlowEventListener,
  addFlowStartedListener,
  addFlowCompletedListener,
  addFlowDismissedListener,
  addScreenChangedListener,
  addActionTriggeredListener,
  addPermissionRequestedListener,
  addFlowErrorListener,
  addCustomActionListener,
  addTrackEventListener,
  addRemindLaterListener,
  addPurchaseCompletedListener,
  addPurchaseCancelledListener,
  addPurchaseFailedListener,
  addPurchasePendingListener,
  addRestoreCompletedListener,
  addRestoreFailedListener,
  useFlowEvents,
} from './useFlowEvents';

// Purchase providers (paywalls)
export type {
  SetgreetPurchaseSourceType,
  SetgreetPurchasePeriodUnit,
  SetgreetPurchasePeriod,
  SetgreetPurchaseIntroOffer,
  SetgreetPurchaseProduct,
  SetgreetPurchaseStatus,
  SetgreetPurchaseResult,
  SetgreetRestoreStatus,
  SetgreetRestoreResult,
  SetgreetPurchaseAccessState,
  SetgreetPurchaseErrorCode,
  SetgreetPurchaseError,
  SetgreetPaywallImpressionContext,
  SetgreetPurchaseProvider,
  SetPurchaseProviderOptions,
} from './purchaseTypes';
export {
  SetgreetPurchaseSource,
  isSetgreetPurchaseErrorCode,
  purchaseError,
} from './purchaseTypes';
export { setPurchaseProvider } from './purchases';

// Re-export theme types and sync function
export type {
  SetgreetColorScheme,
  SetgreetTypeStyle,
  SetgreetTypography,
  SetgreetTheme,
} from './theme';
export { syncTheme } from './theme';

export type InitConfig = { debugMode: boolean; apiUrl?: string };

export const initialize = (appKey: string, config?: InitConfig) => {
  _setThemeConfig(appKey, config?.apiUrl);
  RNSetgreet.initialize(appKey, config ?? { debugMode: false });
};

export const identifyUser = (
  userId: string,
  attributes?: Record<string, unknown>,
  operation?: 'create' | 'update',
  locale?: string
) =>
  RNSetgreet.identifyUser(
    userId,
    attributes ?? null,
    operation ?? 'create',
    locale ?? null
  );

export const resetUser = () => RNSetgreet.resetUser();

export const trackEvent = (
  eventName: string,
  properties?: Record<string, unknown>
) => RNSetgreet.trackEvent(eventName, properties ?? null);

export const trackScreen = (
  screenName: string,
  properties?: Record<string, unknown>
) => RNSetgreet.trackScreen(screenName, properties ?? null);

export const showFlow = (flowId: string) => RNSetgreet.showFlow(flowId);

export const getAnonymousId = (): string | null => RNSetgreet.getAnonymousId();

/**
 * Turns on Lottie animations in Setgreet flows. Call it once at startup,
 * before the first flow shows. Without it, a Lottie component in a flow
 * renders nothing on iOS; the rest of the flow is unaffected.
 *
 * iOS: needs the opt-in `RNSetgreet/Lottie` pod (see the README), which adds
 * the `SetgreetSDKLottie` module and `lottie-ios`. Returns `false` when that
 * pod is not installed.
 * Android: the core SDK already includes Lottie, so this always returns
 * `true` and changes nothing.
 *
 * Returns `false` when the installed native build predates this method (for
 * example, an over-the-air JS update running on an older app binary).
 */
export const registerLottie = (): boolean =>
  typeof RNSetgreet.registerLottie === 'function'
    ? RNSetgreet.registerLottie()
    : false;
