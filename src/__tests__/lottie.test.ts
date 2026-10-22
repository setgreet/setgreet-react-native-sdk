jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => ({
  __esModule: true,
  default: class MockNativeEventEmitter {
    addListener() {
      return { remove: () => {} };
    }
  },
}));

jest.mock('../NativeRNSetgreet', () => ({
  __esModule: true,
  default: {
    registerLottie: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
}));

import RNSetgreet from '../NativeRNSetgreet';
import { registerLottie } from '../index';

const native = RNSetgreet as unknown as { registerLottie: jest.Mock };

describe('registerLottie', () => {
  beforeEach(() => {
    native.registerLottie.mockReset();
  });

  it('calls the native module once and returns true when Lottie is available', () => {
    native.registerLottie.mockReturnValue(true);

    expect(registerLottie()).toBe(true);
    expect(native.registerLottie).toHaveBeenCalledTimes(1);
    expect(native.registerLottie).toHaveBeenCalledWith();
  });

  it('returns false when the native Lottie module is not installed', () => {
    native.registerLottie.mockReturnValue(false);

    expect(registerLottie()).toBe(false);
  });

  it('returns false when the native build predates registerLottie (OTA update on an older binary)', () => {
    const mutable = RNSetgreet as unknown as Record<string, unknown>;
    const original = mutable.registerLottie;
    delete mutable.registerLottie;
    try {
      expect(registerLottie()).toBe(false);
    } finally {
      mutable.registerLottie = original;
    }
  });
});
