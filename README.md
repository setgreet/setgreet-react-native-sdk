# Setgreet React Native SDK

[![npm version](https://img.shields.io/npm/v/@setgreet/react-native-sdk.svg)](https://www.npmjs.com/package/@setgreet/react-native-sdk)

Setgreet React Native SDK allows you to show Setgreet flows in your React Native app.

## Requirements

- React Native 0.60.0 and above
- iOS 15.0+ (for iOS apps)
- Android 6.0 (API level 23) and above (for Android apps)

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

identifyUser('user123', {
  name: 'John Doe',
  email: 'john@example.com',
  plan: 'premium',
}, 'create', 'en-US');
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

### Flow Callbacks

Listen to flow lifecycle events to track user interactions and flow completion.

**Available Callbacks:**

- `onFlowStarted`: Called when a flow begins displaying
- `onFlowCompleted`: Called when user completes all screens in the flow
- `onFlowDismissed`: Called when user dismisses the flow before completion
- `onScreenChanged`: Called when user navigates between screens
- `onActionTriggered`: Called when user interacts with buttons
- `onPermissionRequested`: Called when a permission request completes
- `onFlowError`: Called when an error occurs during flow operations

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
      console.log(`Screen changed: ${event.fromIndex + 1} -> ${event.toIndex + 1}`);
    },
    onActionTriggered: (event) => {
      console.log(`Action: ${event.actionType}`);
      if (event.actionName) {
        console.log(`Custom event name: ${event.actionName}`);
      }
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
} from '@setgreet/react-native-sdk';

// Subscribe to specific events
const subscription = addFlowCompletedListener((event) => {
  console.log(`Flow ${event.flowId} completed in ${event.durationMs}ms`);
});

// Subscribe to permission events
const permissionSubscription = addPermissionRequestedListener((event) => {
  console.log(`Permission ${event.permissionType}: ${event.result}`);
});

// Clean up when done
subscription.remove();
permissionSubscription.remove();
```

**Dismiss Reasons:**

| Reason | Description |
|--------|-------------|
| `userClose` | User tapped the close button |
| `userSkip` | User tapped the skip button |
| `backPress` | User pressed the back button (hardware) |
| `replaced` | Flow was replaced by a higher priority flow |
| `programmatic` | Flow was dismissed programmatically |
| `swipeDown` | User swiped down to dismiss a bottom sheet |
| `completed` | Flow reached its end node |

**Permission Types:**

| Type | Description |
|------|-------------|
| `notification` | Push notification permission |
| `location` | Location access permission |
| `camera` | Camera access permission |

**Permission Results:**

| Result | Description |
|--------|-------------|
| `granted` | Permission was granted by the user |
| `denied` | Permission was denied by the user |
| `permanently_denied` | Permission was permanently denied (user must enable in settings) |
| `already_granted` | Permission was already granted before the request |
| `not_required` | Permission request was not required or not applicable |

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

If your flows use permission buttons (notification, location, camera), you need to add the required keys to your `Info.plist`:

```xml
<!-- For location permission -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Your description for location usage</string>

<!-- For camera permission -->
<key>NSCameraUsageDescription</key>
<string>Your description for camera usage</string>
```

Note: Notification permission doesn't require an Info.plist key.

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
