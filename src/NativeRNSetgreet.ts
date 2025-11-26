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

  // Event Emitter (required for NativeEventEmitter support)
  addListener(eventType: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNSetgreet');
