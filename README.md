# Setgreet React Native SDK

[![npm version](https://img.shields.io/npm/v/@setgreet/react-native-sdk.svg)](https://www.npmjs.com/package/@setgreet/react-native-sdk)

Setgreet React Native SDK allows you to show Setgreet flows in your React Native app.

## Requirements

- React Native 0.74.0 and above
- iOS 15.0+ (for iOS apps)
- Android 6.0 (API level 23) and above (for Android apps)
- Either React Native architecture: the New Architecture (the SDK is a TurboModule) or the old one (bridge). Nothing to configure; it follows your app.

## Installation

### 1. Install the package

```bash
npm install @setgreet/react-native-sdk
# or
yarn add @setgreet/react-native-sdk
```

### 2. iOS Setup

#### Install CocoaPods Dependencies

The iOS SetgreetSDK is automatically included via CocoaPods when you install the React Native SDK:

```bash
cd ios && pod install
```

### 3. Android Setup

No additional setup required for Android.

## Usage

### Initialization

- Setgreet App Key: You can find your App Key at [Apps page](https://app.setgreet.com/apps).

Initialize the SDK in your React Native app:

```typescript
import { initialize } from '@setgreet/react-native-sdk';

initialize('APP_KEY', {
  debugMode: false,
});
```

### Identify User

Identifies a user for Setgreet analytics and flow management.

**Parameters:**

- `userId` (String): The unique identifier for the user
- `attributes` (Optional): Additional user attributes
- `operation` (Optional): The operation type for user attributes ('create' or 'update', defaults to 'create')
- `locale` (Optional): User's locale (e.g., "en-US"). If not provided, uses device's default locale

**Example:**

```typescript
import { identifyUser } from '@setgreet/react-native-sdk';

identifyUser(
  'user123',
  {
    name: 'John Doe',
    email: 'john@example.com',
    plan: 'premium',
  },
  'create',
  'en-US'
);
```

### Reset User

Clears user identification data and resets user session state for logout scenarios.

**Example:**

```typescript
import { resetUser } from '@setgreet/react-native-sdk';

resetUser();
```

### Anonymous ID

The SDK automatically generates an anonymous ID on initialization, which persists across app launches. When `identifyUser` is called, the anonymous identity is merged with the identified user. A new anonymous ID is generated when `resetUser()` is called.

```typescript
import { getAnonymousId } from '@setgreet/react-native-sdk';

const anonId = getAnonymousId();
```

### Show Flow

- Setgreet Flow ID: The flow ID is a unique identifier for the flow you want to show. You can get the flow ID from the flow's URL at the web app. For example, if the flow URL is `https://app.setgreet.com/flows/1234`, the flow ID is `1234`.

To show the Setgreet flow, call the following method:

```typescript
import { showFlow } from '@setgreet/react-native-sdk';

showFlow('FLOW_ID');
```

### Track Screen

Tracks a screen view for analytics and potential flow triggers.

**Parameters:**

- `screenName` (String): The name of the screen being viewed
- `properties` (Optional): Additional properties associated with the screen view

**Example:**

```typescript
import { trackScreen } from '@setgreet/react-native-sdk';

trackScreen('product_detail', {
  product_id: 'prod_123',
  category: 'electronics',
  price: 299.99,
});
```

### Track Event

Tracks custom events for analytics and flow triggers.

**Parameters:**

- `eventName` (String): The name of the custom event
- `properties` (Optional): Additional properties associated with the event

**Example:**

```typescript
import { trackEvent } from '@setgreet/react-native-sdk';

trackEvent('purchase_completed', {
  order_id: 'ord_456',
  total_amount: 299.99,
  payment_method: 'credit_card',
  items_count: 3,
});
```

### Sync Theme

Sync your app's theme with Setgreet to enable theme-aware flow screens in the editor. Since React Native does not have a centralized theme system, you provide your color palette and typography manually.

```typescript
import { syncTheme } from '@setgreet/react-native-sdk';

syncTheme({
  colors: {
    primary: '#6200EE',
    onPrimary: '#FFFFFF',
    secondary: '#03DAC6',
    surface: '#FFFFFF',
    onSurface: '#000000',
    error: '#B00020',
  },
  typography: {
    bodyMedium: {
      fontFamily: 'Roboto',
      fontSize: 14,
      fontWeight: 400,
    },
    headlineMedium: {
      fontFamily: 'Roboto',
      fontSize: 28,
      fontWeight: 400,
    },
  },
});
```

Call `syncTheme()` after `initialize()` — typically once after app launch or when your theme changes.

### Flow Callbacks

Listen to flow lifecycle events to track user interactions and flow completion.

**Available Callbacks:**

- `onFlowStarted`: Called when a flow begins displaying
- `onFlowCompleted`: Called when user completes all screens in the flow
- `onFlowDismissed`: Called when user dismisses the flow before completion
- `onScreenChanged`: Called when user navigates between screens
- `onActionTriggered`: Called when a button's action is triggered, just before it runs, with the action's type (see Action Types below). It also fires when required inputs on the screen then stop the action
- `onCustomAction`: Called when the user taps a component whose action is Custom, with the custom data set on the action in the editor (`data`, `null` when there is none)
- `onTrackEvent`: Called when the user taps a component whose action is Track Event, with the event's `eventName` and `properties` (`null` when there are none)
- `onPermissionRequested`: Called when a permission request completes
- `onFlowError`: Called when an error occurs during flow operations, with its `errorType`: `network`, `parse`, `display` or `unknown`
- Purchase and restore callbacks: see [Purchases and paywalls](#purchases-and-paywalls)

Every event carries `flowId` and `timestamp`; `onCustomAction` and `onTrackEvent` also carry the `screenIndex` (0-based) where the user acted.

> **Android:** `onCustomAction` and `onTrackEvent` arrive through the native SDK's flow listener, which holds a single listener. The SDK registers its own when you call `initialize`, replacing any listener your native code set earlier. If your native code calls `Setgreet.setFlowListener` after `initialize`, these two callbacks stop firing in JavaScript. The other callbacks are not affected.

In `onCustomAction` data and `onTrackEvent` properties, every value arrives as a string on Android (numbers and booleans included) and a nested object or array as `null`; on iOS values keep their JSON type.

**Using the useFlowEvents Hook (Recommended):**

```tsx
import { useFlowEvents } from '@setgreet/react-native-sdk';

function MyComponent() {
  useFlowEvents({
    onFlowStarted: (event) => {
      console.log(`Flow started: ${event.flowId}`);
      console.log(`Total screens: ${event.screenCount}`);
    },
    onFlowCompleted: (event) => {
      console.log(`Flow completed: ${event.flowId}`);
      console.log(`Duration: ${event.durationMs}ms`);
    },
    onFlowDismissed: (event) => {
      console.log(`Flow dismissed: ${event.flowId}`);
      console.log(`Reason: ${event.reason}`);
      console.log(`Screen: ${event.screenIndex + 1}/${event.screenCount}`);
    },
    onScreenChanged: (event) => {
      console.log(
        `Screen changed: ${event.fromIndex + 1} -> ${event.toIndex + 1}`
      );
    },
    onActionTriggered: (event) => {
      console.log(`Action: ${event.actionType}`);
      if (event.actionName) {
        console.log(`Track Event name: ${event.actionName}`);
      }
    },
    onCustomAction: (event) => {
      console.log(`Custom action on screen ${event.screenIndex + 1}`);
      console.log(`Data: ${JSON.stringify(event.data)}`);
    },
    onTrackEvent: (event) => {
      console.log(`Track event: ${event.eventName}`);
      console.log(`Properties: ${JSON.stringify(event.properties)}`);
    },
    onPermissionRequested: (event) => {
      console.log(`Permission: ${event.permissionType}`);
      console.log(`Result: ${event.result}`);
    },
    onFlowError: (event) => {
      console.log(`Error: ${event.errorType} - ${event.message}`);
    },
  });

  return <View />;
}
```

**Using Individual Event Listeners:**

```typescript
import {
  addFlowStartedListener,
  addFlowCompletedListener,
  addFlowDismissedListener,
  addPermissionRequestedListener,
  addCustomActionListener,
} from '@setgreet/react-native-sdk';

// Subscribe to specific events
const subscription = addFlowCompletedListener((event) => {
  console.log(`Flow ${event.flowId} completed in ${event.durationMs}ms`);
});

// Subscribe to permission events
const permissionSubscription = addPermissionRequestedListener((event) => {
  console.log(`Permission ${event.permissionType}: ${event.result}`);
});

// Subscribe to custom actions
const customActionSubscription = addCustomActionListener((event) => {
  console.log(`Custom action data: ${JSON.stringify(event.data)}`);
});

// Clean up when done
subscription.remove();
permissionSubscription.remove();
customActionSubscription.remove();
```

Every callback has a listener: `addFlowStartedListener`, `addFlowCompletedListener`, `addFlowDismissedListener`, `addScreenChangedListener`, `addActionTriggeredListener`, `addCustomActionListener`, `addTrackEventListener`, `addPermissionRequestedListener` and `addFlowErrorListener` (purchase listeners: see [Purchase events](#purchase-events)). `addFlowEventListener` receives every event; switch on its `type`.

**Dismiss Reasons:**

| Reason         | Description                                 |
| -------------- | ------------------------------------------- |
| `userClose`    | User tapped the close button                |
| `userSkip`     | User tapped the skip button                 |
| `backPress`    | User pressed the back button (hardware)     |
| `replaced`     | Flow was replaced by a higher priority flow |
| `programmatic` | Flow was dismissed programmatically         |
| `swipeDown`    | User swiped down to dismiss a bottom sheet  |
| `completed`    | Flow reached its end node                   |

**Action Types:**

`onActionTriggered` reports `actionType` as one of these snake_case names, the same on iOS and Android. `actionName` is the event name for `track_event` and `null` otherwise.

- Navigation: `next`, `previous`, `skip`
- Closing the flow: `dismiss`
- Links: `url`
- Permission requests: `request_notification_permission`, `request_location_permission`, `request_camera_permission`, `request_tracking_permission`, `request_microphone_permission`, `request_photo_library_permission`
- System: `request_review`, `share`, `open_settings`
- Track Event and Custom: `track_event`, `custom`
- Paywalls: `purchase`, `restore_purchases`

**Permission Types:**

| Type           | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| `notification` | Push notification permission                                    |
| `location`     | Location access permission                                      |
| `camera`       | Camera access permission                                        |
| `tracking`     | App Tracking Transparency (iOS only; `not_required` on Android) |
| `microphone`   | Microphone access permission                                    |
| `photoLibrary` | Photo library read access                                       |

**Permission Results:**

| Result               | Description                                                      |
| -------------------- | ---------------------------------------------------------------- |
| `granted`            | Permission was granted by the user                               |
| `denied`             | Permission was denied by the user                                |
| `permanently_denied` | Permission was permanently denied (user must enable in settings) |
| `already_granted`    | Permission was already granted before the request                |
| `not_required`       | Permission request was not required or not applicable            |

## Purchases and paywalls

Setgreet renders paywall screens natively and branches the flow on the outcome of a purchase. It wraps no purchase SDK: your app implements one interface, `SetgreetPurchaseProvider`, by calling whatever it already uses (RevenueCat, Adapty, StoreKit, Play Billing, ...) and registers it once. The native SDK then loads the products, fills the plan picker, resolves price tokens in copy, locks the button while a purchase runs, branches on the result, sends analytics and syncs the product catalog to the dashboard.

### Register a provider

Call `setPurchaseProvider` once at startup, in this order: `initialize`, then `setPurchaseProvider`, then `identifyUser`. An `identifyUser` call reaches the provider (its `identify`, and the access attributes written afterwards) only once the provider is registered. Configuring your purchase SDK stays your call.

```typescript
import Purchases from 'react-native-purchases';
import {
  identifyUser,
  initialize,
  setPurchaseProvider,
} from '@setgreet/react-native-sdk';
import { SetgreetRevenueCatProvider } from './setgreetRevenueCatProvider';

Purchases.configure({ apiKey: '<your RevenueCat public SDK key>' });
initialize('APP_KEY', { debugMode: false });
setPurchaseProvider(new SetgreetRevenueCatProvider());
identifyUser('user123');
```

The default source (the current offering unless you pass another one) is loaded in the background at registration, so the catalog reaches the dashboard before any paywall is shown. A screen without a plan picker reads its products from it:

```typescript
import {
  SetgreetPurchaseSource,
  setPurchaseProvider,
} from '@setgreet/react-native-sdk';

setPurchaseProvider(provider, {
  defaultSource: SetgreetPurchaseSource.offering('onboarding'),
});
// Also SetgreetPurchaseSource.currentOffering and SetgreetPurchaseSource.placement('id')
```

### The interface

```typescript
interface SetgreetPurchaseProvider {
  readonly providerId: string; // 'revenuecat', 'adapty', ...; ^[a-z][a-z0-9_]{0,39}$
  loadProducts(
    source: SetgreetPurchaseSource
  ): Promise<SetgreetPurchaseProduct[]>;
  purchase(
    productRef: string,
    source: SetgreetPurchaseSource
  ): Promise<SetgreetPurchaseResult>;
  restorePurchases(): Promise<SetgreetRestoreResult>;
  accessState(): Promise<SetgreetPurchaseAccessState | null>; // null: cannot say
  trackPaywallImpression?(context: SetgreetPaywallImpressionContext): void;
  setAttributes?(attributes: Record<string, string>): void;
  identify?(userId: string): Promise<void>;
  reset?(): Promise<void>;
}
```

- A product `ref` (a RevenueCat package id such as `$rc_annual`) is unique only within its source. `purchase` receives the source the ref came from: buy the product you returned for that ref from that source.
- `purchase` resolves to `{ status: 'purchased' | 'cancelled' | 'failed' | 'pending', productRef, accessRefs, error }` and `restorePurchases` to `{ status: 'restored' | 'nothingToRestore' | 'failed', accessRefs, error }`. Report outcomes as statuses. A rejected promise is reported as `failed`, except a `purchase` rejected with code `purchase_cancelled` or `purchase_pending`, which is reported as `cancelled` or `pending`.
- When products cannot be loaded, `loadProducts` rejects with a purchase error, e.g. `throw purchaseError('network_error', { message })`. Any other rejection is reported as `unknown`. Error codes: `not_configured`, `provider_not_initialized`, `product_not_found`, `product_unavailable`, `purchase_cancelled`, `purchase_failed`, `purchase_pending`, `restore_failed`, `network_error`, `identity_error`, `unknown`.
- `priceAmount` is a number (`49.99`). The native SDK reads it as a decimal without binary rounding.
- `identify` and `reset` are optional. Implement them only if Setgreet's `identifyUser` / `resetUser` should drive your purchase SDK's identity. They run one at a time, in call order, with no time limit.
- `providerId` must match `^[a-z][a-z0-9_]{0,39}$`; `setPurchaseProvider` throws a `TypeError` otherwise.
- Time limits: when a paywall loads, the native SDK waits up to 10 seconds for `loadProducts` (then the screen follows its unavailable policy) and for `accessState` (then it counts as "cannot say" and the paywall is shown). `purchase` and `restorePurchases` have no time limit, since a store sheet can stay open for minutes.

### RevenueCat reference provider

[`example/src/setgreetRevenueCatProvider.ts`](example/src/setgreetRevenueCatProvider.ts) is a complete provider backed by `react-native-purchases` 10.4.0 or later, the first release whose `trackCustomPaywallImpression` accepts the offering (the example app pins 10.10.2, a release some weeks old, out of supply-chain caution). Copy it into your app: it uses your own `react-native-purchases` dependency, and Setgreet ships none. It keeps packages per source, reports active entitlement ids as access refs, shows trial text only to an eligible user, and reports an "already purchased" refusal as purchased when RevenueCat confirms an active entitlement.

### Platform notes

- **Android:** a flow opens in its own activity, which pauses your React Native activity, and React Native does not run JavaScript timers while it is paused. Provider methods must not depend on `setTimeout` or `setInterval`.
- **Android:** the store sheet opens from React Native's current activity (your app's), not from the flow's activity. If that activity was destroyed meanwhile, the purchase reports `failed`.
- **iOS:** nothing beyond `pod install`.
- Each provider call crosses from the native SDK to JavaScript and back. A call still waiting when the JavaScript context goes away (a reload) fails at once: `purchase` and `restorePurchases` report `failed` with `not_configured`, `loadProducts` errors and `accessState` returns `null`.

### Purchase events

`useFlowEvents` accepts `onPurchaseCompleted`, `onPurchaseCancelled`, `onPurchaseFailed`, `onPurchasePending`, `onRestoreCompleted` and `onRestoreFailed`. Outside React, use `addPurchaseCompletedListener`, `addPurchaseCancelledListener`, `addPurchaseFailedListener`, `addPurchasePendingListener`, `addRestoreCompletedListener` and `addRestoreFailedListener`.

Every purchase event carries `flowId`, `screenId`, `componentId` (the button), `provider` and `timestamp`. Purchase events add `productRef`; `purchaseCompleted` and `restoreCompleted` add `accessRefs`; `restoreCompleted` adds `status` (`restored` or `nothingToRestore`); `purchaseFailed` and `restoreFailed` add `error: { code, providerCode, message }`.

```tsx
useFlowEvents({
  onPurchaseCompleted: (event) => {
    console.log(`Bought ${event.productRef}: ${event.accessRefs.join(', ')}`);
  },
  onPurchaseFailed: (event) => {
    console.log(`Purchase failed: ${event.error.code}`);
  },
});
```

## External Data in Flows

Flows can render data fetched from **your own** API — a product list filtered by answers the user gave earlier in the same flow. You register the endpoint once in the Setgreet dashboard (Data Sources), bind it into a screen, and it renders.

**Nothing to do on the JavaScript side.** The feature needs no new API, no new permission and no new dependency in your app.

What is worth knowing:

- **Use package 1.2.0 or newer.** On an older version the screen renders without its data rather than failing.
- **Setgreet calls your API from its servers, not from the device**, so your endpoint must be reachable over HTTPS from the public internet. Setgreet signs each request and asserts the end user's id; verify the signature on your side.
- **A failure degrades, it does not blank.** If your API is slow or down, the screen renders without the data-bound parts. Only if the flow author explicitly chose "skip screen" is it passed over.
- **Answers reach your API by input name.** An input named `goal` in the editor arrives as `goal`. Attributes you set via `identifyUser` are available to it too.

See [External Data](https://setgreet.com/docs/personalization/external-data) for the endpoint contract and the signature-verification recipe.

## Troubleshooting

### iOS Issues

#### "SetgreetSDK module not found"

1. Ensure you've installed CocoaPods dependencies: `cd ios && pod install`
2. Clean your project: `cd ios && xcodebuild clean`
3. Reinstall pods: `cd ios && pod install`
4. Rebuild your project

#### "Duplicate symbol" errors

This usually means you have both the old embedded framework and the new CocoaPods dependency. Make sure you've:

1. Updated to the latest version of this package
2. Removed any manual SetgreetSDK framework references
3. Only use CocoaPods for SetgreetSDK dependency

#### CocoaPods Installation Issues

If you encounter CocoaPods issues:

1. Update CocoaPods: `sudo gem install cocoapods`
2. Clean CocoaPods cache: `pod cache clean --all`
3. Reinstall: `cd ios && pod install`

#### Permission Requests Not Working

If your flows use permission buttons, you need to add the required keys to your `Info.plist`:

```xml
<!-- For location permission -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Your description for location usage</string>

<!-- For camera permission -->
<key>NSCameraUsageDescription</key>
<string>Your description for camera usage</string>

<!-- For tracking permission (App Tracking Transparency) -->
<key>NSUserTrackingUsageDescription</key>
<string>Your description for tracking usage</string>

<!-- For microphone permission -->
<key>NSMicrophoneUsageDescription</key>
<string>Your description for microphone usage</string>

<!-- For photo library permission -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Your description for photo library usage</string>
```

Note: Notification permission doesn't require an Info.plist key. A missing key is logged, reported as `not_required`, and the flow advances.

On Android the SDK declares only `INTERNET`; declare the permissions your flows request in your app's `AndroidManifest.xml`: `POST_NOTIFICATIONS` (API 33+), `ACCESS_FINE_LOCATION`, `CAMERA`, `RECORD_AUDIO`, and `READ_MEDIA_IMAGES` (API 33+) or `READ_EXTERNAL_STORAGE` below. Tracking has no Android equivalent and advances immediately.

A screen can also carry a permission gate ("Skip when granted" in the editor): the SDK skips the primer when the permission is already granted, with nothing to do on the JavaScript side.

### Android Issues

Android integration should work automatically. If you encounter issues:

1. Clean your project: `cd android && ./gradlew clean`
2. Rebuild: `cd android && ./gradlew assembleDebug`

### General Issues

If you continue to have issues, please [open an issue](https://github.com/setgreet/setgreet-react-native-sdk/issues) with:

- Your React Native version
- iOS/Android version
- Error messages
- Steps to reproduce
