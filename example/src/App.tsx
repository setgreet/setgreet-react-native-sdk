import { useEffect, useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {
  initialize,
  identifyUser,
  trackEvent,
  showFlow,
  useFlowEvents,
} from '@setgreet/react-native-sdk';

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
  });

  useEffect(() => {
    const run = async () => {
      try {
        validateConfig(APP_KEY, TEST_FLOW_ID);

        // Initialize the SDK with your app key
        initialize(APP_KEY, {
          debugMode: DEBUG_MODE,
        });

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
