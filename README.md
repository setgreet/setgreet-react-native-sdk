# Setgreet React Native SDK

[![npm version](https://img.shields.io/npm/v/@setgreet/react-native-sdk.svg)](https://www.npmjs.com/package/@setgreet/react-native-sdk)

Setgreet React Native SDK allows you to show Setgreet flows in your React Native app.

## Requirements

- React Native 0.60.0 and above
- iOS 13.0+ (for iOS apps)
- Android 5.0 (API level 21) and above (for Android apps)

## Installation

### 1. Install the package

```bash
npm install @setgreet/react-native-sdk
# or
yarn add @setgreet/react-native-sdk
```

### 2. iOS Setup

For iOS, you need to install CocoaPods dependencies:

```bash
cd ios && pod install
```

### 3. Android Setup

No additional setup required for Android.

## Usage

### Initialization

- Setgreet App Key: You can get the app key while creating a new app in the Setgreet flow editor.

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

**Example:**

```typescript
import { identifyUser } from '@setgreet/react-native-sdk';

identifyUser('user123', {
  name: 'John Doe',
  email: 'john@example.com',
  plan: 'premium',
});
```

### Reset User

Clears user identification data and resets user session state for logout scenarios.

**Example:**

```typescript
import { resetUser } from '@setgreet/react-native-sdk';

resetUser();
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
