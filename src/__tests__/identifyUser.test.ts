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
    identifyUser: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
}));

import RNSetgreet from '../NativeRNSetgreet';
import { identifyUser } from '../index';

const native = RNSetgreet as unknown as { identifyUser: jest.Mock };

describe('identifyUser', () => {
  beforeEach(() => {
    native.identifyUser.mockReset();
  });

  it('forwards the user hash as the fifth argument', () => {
    identifyUser('user_123', { plan: 'pro' }, 'create', undefined, 'a1b2c3');

    expect(native.identifyUser).toHaveBeenCalledTimes(1);
    expect(native.identifyUser).toHaveBeenCalledWith(
      'user_123',
      { plan: 'pro' },
      'create',
      null,
      'a1b2c3'
    );
  });

  it('sends null when the user hash is omitted', () => {
    identifyUser('user_123', { plan: 'pro' }, 'update', 'en-US');

    expect(native.identifyUser).toHaveBeenCalledWith(
      'user_123',
      { plan: 'pro' },
      'update',
      'en-US',
      null
    );
  });

  it('fills the defaults when only the user id is given', () => {
    identifyUser('user_123');

    expect(native.identifyUser).toHaveBeenCalledWith(
      'user_123',
      null,
      'create',
      null,
      null
    );
  });

  it('forwards the user hash unchanged (the native SDK ignores a blank one)', () => {
    identifyUser('user_123', undefined, undefined, undefined, '');

    expect(native.identifyUser).toHaveBeenCalledWith(
      'user_123',
      null,
      'create',
      null,
      ''
    );
  });
});
