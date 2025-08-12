// Setgreet SDK Configuration
// Replace these values with your actual Setgreet credentials

export const SETGREET_CONFIG = {
  // Your Setgreet app key from the dashboard
  APP_KEY: 'YOUR_APP_KEY_HERE',

  // Test flow ID - replace with a valid flow ID from your dashboard
  TEST_FLOW_ID: 'YOUR_FLOW_ID_HERE',

  // Debug mode for development
  DEBUG_MODE: true,

  // Test user ID
  TEST_USER_ID: 'user123',

  // Test user attributes
  TEST_USER_ATTRIBUTES: {
    plan: 'pro',
    locale: 'en-US',
    environment: 'development',
  },
};

// Validation function
export const validateConfig = () => {
  if (SETGREET_CONFIG.APP_KEY === 'YOUR_APP_KEY_HERE') {
    throw new Error(
      'Please replace YOUR_APP_KEY_HERE with your actual Setgreet app key in src/config.ts'
    );
  }

  if (SETGREET_CONFIG.TEST_FLOW_ID === 'YOUR_FLOW_ID_HERE') {
    throw new Error(
      'Please replace YOUR_FLOW_ID_HERE with your actual Setgreet flow id in src/config.ts'
    );
  }

  return true;
};
