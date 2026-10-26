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
    initialize: jest.fn(),
    setLocale: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
}));

import RNSetgreet from '../NativeRNSetgreet';
import { setLocale } from '../index';

const native = RNSetgreet as unknown as {
  initialize: jest.Mock;
  setLocale: jest.Mock;
};

describe('setLocale', () => {
  beforeEach(() => {
    native.initialize.mockReset();
    native.setLocale.mockReset();
  });

  it('passes the tag to the native module unchanged', () => {
    setLocale('tr-TR');

    expect(native.setLocale).toHaveBeenCalledTimes(1);
    expect(native.setLocale).toHaveBeenCalledWith('tr-TR');
  });

  it('passes null through to clear the override', () => {
    setLocale(null);

    expect(native.setLocale).toHaveBeenCalledWith(null);
  });

  it('passes an empty string through (native treats it as a clear)', () => {
    setLocale('');

    expect(native.setLocale).toHaveBeenCalledWith('');
  });

  it('maps undefined to null for callers outside TypeScript', () => {
    setLocale(undefined as unknown as null);

    expect(native.setLocale).toHaveBeenCalledWith(null);
  });

  it('can be called before initialize', () => {
    setLocale('de');

    expect(native.initialize).not.toHaveBeenCalled();
    expect(native.setLocale).toHaveBeenCalledWith('de');
  });

  it('does nothing when the native build predates setLocale (OTA update on an older binary)', () => {
    const mutable = RNSetgreet as unknown as Record<string, unknown>;
    const original = mutable.setLocale;
    delete mutable.setLocale;
    try {
      expect(() => setLocale('tr-TR')).not.toThrow();
    } finally {
      mutable.setLocale = original;
    }
  });
});
