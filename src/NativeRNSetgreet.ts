import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // Object parameters are untyped (`{ [key: string]: unknown }`) on purpose:
  // codegen turns a typed object into a C++ struct on iOS, while an untyped
  // one arrives as a plain dictionary on both platforms (NSDictionary,
  // ReadableMap), so one Objective-C++ method serves both architectures.
  // Their shapes are noted per method.

  // Initialization. `config`: `{ debugMode: boolean }`.
  initialize(appKey: string, config: { [key: string]: unknown } | null): void;

  // User
  identifyUser(
    userId: string,
    attributes: { [key: string]: unknown } | null,
    operation: string | null,
    locale: string | null
  ): void;
  resetUser(): void;

  // Locale override, saved on the device. `null` or empty clears it.
  setLocale(locale: string | null): void;

  // Tracking
  trackEvent(
    eventName: string,
    properties: { [key: string]: unknown } | null
  ): void;
  trackScreen(
    screenName: string,
    properties: { [key: string]: unknown } | null
  ): void;

  // UI Flow
  showFlow(flowId: string): void;

  // Anonymous ID
  getAnonymousId(): string | null;

  // Optional Lottie support. Registers the native Lottie component; returns
  // whether Lottie can render (iOS: the `RNSetgreet/Lottie` pod is installed;
  // Android: always, the core SDK includes it).
  registerLottie(): boolean;

  // Purchase providers. The native side registers a proxy provider that
  // forwards each call to JS as a `SetgreetPurchaseRequest` event; JS answers
  // request/response calls with `resolvePurchaseRequest`.
  // `defaultSource`: `{ sourceType: string; sourceId: string | null }`.
  setPurchaseProvider(
    providerId: string,
    defaultSource: { [key: string]: unknown }
  ): void;
  resolvePurchaseRequest(
    requestId: string,
    result: { [key: string]: unknown } | null,
    error: { [key: string]: unknown } | null
  ): void;

  // Event Emitter (required for NativeEventEmitter support)
  addListener(eventType: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNSetgreet');
