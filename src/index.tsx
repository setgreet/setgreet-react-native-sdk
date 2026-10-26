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

/**
 * Sets the language Setgreet content is shown in on this device, for every
 * user, identified or not. It is an explicit language choice, saved on the
 * device: it survives app relaunches and `resetUser()`, and it is never
 * stored on the user. Pass `null` (or an empty string) to go back to the
 * device language.
 *
 * Content is shown in, first match wins:
 * 1. the `setLocale` override;
 * 2. the last `locale` passed to `identifyUser` for the current user;
 * 3. the user's locale saved on the server;
 * 4. the device language.
 *
 * Can be called before `initialize`. A value that is not a valid BCP-47
 * language tag (for example "tr-TR", "pt-BR", "de") is ignored with a
 * warning, and the previous locale stays.
 *
 * Does nothing when the installed native build predates this method (for
 * example, an over-the-air JavaScript update running on an older app binary).
 */
export const setLocale = (locale: string | null): void => {
  if (typeof RNSetgreet.setLocale !== 'function') return;
  RNSetgreet.setLocale(locale ?? null);
};

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
