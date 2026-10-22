import { useEffect, useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Purchases from 'react-native-purchases';
import {
  initialize,
  identifyUser,
  trackEvent,
  showFlow,
  setPurchaseProvider,
  registerLottie,
  useFlowEvents,
} from '@setgreet/react-native-sdk';
import { SetgreetRevenueCatProvider } from './setgreetRevenueCatProvider';

// Your Setgreet app key
const APP_KEY = 'YOUR_APP_KEY_HERE';

// Test flow ID - replace with a valid flow ID
const TEST_FLOW_ID = 'YOUR_FLOW_ID_HERE';

// Debug mode for development
const DEBUG_MODE = true;

// Test user ID
const TEST_USER_ID = 'user123';

// Test user attributes
const TEST_USER_ATTRIBUTES = {
  plan: 'pro',
  environment: 'development',
};

const TEST_USER_LOCALE = 'en-US';

// ---------------------------------------------------------------------------
// Paywalls: paste your RevenueCat PUBLIC SDK keys here, one per platform.
// While a key is left as the placeholder, RevenueCat is not configured on
// that platform: the provider then reports `provider_not_initialized` and
// every paywall screen follows its `unavailablePolicy` (skipped by default).
// ---------------------------------------------------------------------------
const REVENUECAT_API_KEY_PLACEHOLDER = 'REVENUECAT_PUBLIC_API_KEY';
const REVENUECAT_API_KEY = Platform.select({
  ios: REVENUECAT_API_KEY_PLACEHOLDER,
  android: REVENUECAT_API_KEY_PLACEHOLDER,
  default: REVENUECAT_API_KEY_PLACEHOLDER,
});

let revenueCatConfigured = false;

// Call after `initialize`. `SetgreetRevenueCatProvider` is a copy-paste
// reference file (src/setgreetRevenueCatProvider.ts): the Setgreet SDK links
// no RevenueCat itself, and configuring RevenueCat stays the app's call.
const setUpPurchases = () => {
  if (
    !revenueCatConfigured &&
    REVENUECAT_API_KEY !== REVENUECAT_API_KEY_PLACEHOLDER
  ) {
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    revenueCatConfigured = true;
  }
  setPurchaseProvider(new SetgreetRevenueCatProvider());
};

// Validation function
const validateConfig = (appKey: string, flowId: string) => {
  if (appKey === 'YOUR_APP_KEY_HERE') {
    throw new Error(
      'Please replace YOUR_APP_KEY_HERE with your actual Setgreet app key'
    );
  }

  if (flowId === 'YOUR_FLOW_ID_HERE') {
    throw new Error(
      'Please replace YOUR_FLOW_ID_HERE with your actual Setgreet flow id'
    );
  }

  return true;
};

export default function App() {
  const [appKey, setAppKey] = useState(APP_KEY);
  const [flowId, setFlowId] = useState(TEST_FLOW_ID);
  const [eventLogs, setEventLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setEventLogs((prev) => [`[${timestamp}] ${message}`, ...prev]);
  };

  // Subscribe to flow events using the hook
  useFlowEvents({
    onFlowStarted: (event) => {
      addLog(`Flow Started: ${event.flowId} (${event.screenCount} screens)`);
    },
    onFlowCompleted: (event) => {
      addLog(`Flow Completed: ${event.flowId} in ${event.durationMs}ms`);
    },
    onFlowDismissed: (event) => {
      addLog(
        `Flow Dismissed: ${event.reason} at screen ${event.screenIndex + 1}/${event.screenCount}`
      );
    },
    onScreenChanged: (event) => {
      addLog(`Screen Changed: ${event.fromIndex + 1} -> ${event.toIndex + 1}`);
    },
    onActionTriggered: (event) => {
      let log = `Action: ${event.actionType}`;
      if (event.actionName) {
        log += ` (event: ${event.actionName})`;
      }
      addLog(log);
    },
    onFlowError: (event) => {
      addLog(`Error: ${event.errorType} - ${event.message}`);
    },
    onPurchaseCompleted: (event) => {
      addLog(
        `Purchase Completed: ${event.productRef} (${event.accessRefs.join(', ')})`
      );
    },
    onPurchaseCancelled: (event) => {
      addLog(`Purchase Cancelled: ${event.productRef}`);
    },
    onPurchaseFailed: (event) => {
      addLog(`Purchase Failed: ${event.productRef} - ${event.error.code}`);
    },
    onPurchasePending: (event) => {
      addLog(`Purchase Pending: ${event.productRef}`);
    },
    onRestoreCompleted: (event) => {
      addLog(`Restore Completed: ${event.status}`);
    },
    onRestoreFailed: (event) => {
      addLog(`Restore Failed: ${event.error.code}`);
    },
  });

  useEffect(() => {
    const run = async () => {
      try {
        // Lottie animations (opt-in). On iOS this needs the `RNSetgreet/Lottie`
        // pod (see ios/Podfile); without it Lottie components render nothing.
        // It needs no app key, so it runs before the config check.
        const lottieAvailable = registerLottie();
        addLog(`Lottie support: ${lottieAvailable ? 'on' : 'off'}`);

        validateConfig(APP_KEY, TEST_FLOW_ID);

        // Initialize the SDK with your app key
        initialize(APP_KEY, {
          debugMode: DEBUG_MODE,
        });

        // Paywalls: configure RevenueCat and register the purchase provider
        setUpPurchases();

        // Identify user with locale
        identifyUser(
          TEST_USER_ID,
          TEST_USER_ATTRIBUTES,
          'create',
          TEST_USER_LOCALE
        );

        // Track initial event
        trackEvent('app_opened', { source: 'example' });
      } catch (e) {
        console.error('Initialization error:', e);
      }
    };
    run();
  }, []);

  const handleInitialize = () => {
    try {
      initialize(appKey, {
        debugMode: DEBUG_MODE,
      });

      setUpPurchases();

      identifyUser(
        TEST_USER_ID,
        TEST_USER_ATTRIBUTES,
        'create',
        TEST_USER_LOCALE
      );

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Setgreet SDK initialized successfully!',
      });
    } catch (e) {
      const errorMsg = 'Failed to initialize SDK: ' + (e as Error).message;
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMsg,
      });
      console.error('Initialize error:', e);
    }
  };

  const handleShowFlow = () => {
    try {
      showFlow(flowId);
    } catch (e) {
      const errorMessage = 'Failed to show flow: ' + (e as Error).message;
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
      console.error('ShowFlow error:', e);
    }
  };

  const handleClearLogs = () => {
    setEventLogs([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Setgreet</Text>

      <View style={styles.inputSection}>
        <View style={styles.labelContainer}>
          <View style={styles.labelLine} />
          <Text style={styles.label}>AppKey</Text>
          <View style={styles.labelLine} />
        </View>
        <TextInput
          style={styles.input}
          value={appKey}
          onChangeText={setAppKey}
          placeholder="Enter App Key"
        />
        <TouchableOpacity style={styles.button} onPress={handleInitialize}>
          <Text style={styles.buttonText}>Initialize Setgreet SDK</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputSection}>
        <View style={styles.labelContainer}>
          <View style={styles.labelLine} />
          <Text style={styles.label}>FlowId</Text>
          <View style={styles.labelLine} />
        </View>
        <TextInput
          style={styles.input}
          value={flowId}
          onChangeText={setFlowId}
          placeholder="Enter Flow ID"
        />
        <TouchableOpacity style={styles.button} onPress={handleShowFlow}>
          <Text style={styles.buttonText}>Show Flow</Text>
        </TouchableOpacity>
      </View>

      {eventLogs.length > 0 && (
        <View style={styles.logsSection}>
          <View style={styles.logsHeader}>
            <Text style={styles.logsTitle}>Event Logs</Text>
            <TouchableOpacity onPress={handleClearLogs}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.logsContainer}>
            {eventLogs.map((log, index) => (
              <Text key={index} style={styles.logText}>
                {log}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}

      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fafafa',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
    color: '#000',
  },
  inputSection: {
    marginBottom: 30,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    color: '#666',
    marginHorizontal: 10,
    fontWeight: '500',
  },
  labelLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logsSection: {
    marginTop: 10,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  clearButton: {
    fontSize: 14,
    color: '#007AFF',
  },
  logsContainer: {
    maxHeight: 150,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 10,
  },
  logText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
});
