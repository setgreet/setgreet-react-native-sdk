import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // Initialization
  initialize(appKey: string, config: { debugMode: boolean } | null): void;

  // User
  identifyUser(
    userId: string,
    attributes: { [key: string]: unknown } | null,
    operation: string | null,
    locale: string | null
  ): void;
  resetUser(): void;

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

  // Purchase providers. The native side registers a proxy provider that
  // forwards each call to JS as a `SetgreetPurchaseRequest` event; JS answers
  // request/response calls with `resolvePurchaseRequest`.
  setPurchaseProvider(
    providerId: string,
    defaultSource: { sourceType: string; sourceId: string | null }
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
