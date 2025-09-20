import RNSetgreet from './NativeRNSetgreet';

export type InitConfig = { debugMode: boolean };

export const initialize = (appKey: string, config?: InitConfig) =>
  RNSetgreet.initialize(appKey, config ?? { debugMode: false });

export const identifyUser = (
  userId: string,
  attributes?: Record<string, unknown>,
  operation?: 'create' | 'update',
  locale?: string
) => RNSetgreet.identifyUser(userId, attributes ?? null, operation ?? 'create', locale ?? null);

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
