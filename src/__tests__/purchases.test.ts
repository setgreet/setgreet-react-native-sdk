import type {
  SetgreetPurchaseAccessState,
  SetgreetPurchaseProduct,
  SetgreetPurchaseProvider,
  SetgreetPurchaseResult,
  SetgreetPurchaseSource,
  SetgreetRestoreResult,
} from '../purchaseTypes';
import type { SetgreetFlowEvent } from '../types';

type Listener = (event: unknown) => void;

// Listeners added through NativeEventEmitter, by event name. Shared with the
// mock factory below (jest allows `mock`-prefixed names there).
const mockEmitterListeners = new Map<string, Listener[]>();

jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => ({
  __esModule: true,
  default: class MockNativeEventEmitter {
    addListener(eventType: string, listener: Listener) {
      const listeners = mockEmitterListeners.get(eventType) ?? [];
      listeners.push(listener);
      mockEmitterListeners.set(eventType, listeners);
      return {
        remove: () => {
          const current = mockEmitterListeners.get(eventType) ?? [];
          mockEmitterListeners.set(
            eventType,
            current.filter((entry) => entry !== listener)
          );
        },
      };
    }
  },
}));

jest.mock('../NativeRNSetgreet', () => ({
  __esModule: true,
  default: {
    setPurchaseProvider: jest.fn(),
    resolvePurchaseRequest: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
}));

type MockNative = {
  setPurchaseProvider: jest.Mock;
  resolvePurchaseRequest: jest.Mock;
  addListener: jest.Mock;
  removeListeners: jest.Mock;
};

type Bridge = typeof import('../purchases');
type PurchaseTypes = typeof import('../purchaseTypes');

/** Fresh copies of the bridge and the mocked native module (module state resets). */
async function loadBridge(): Promise<{
  bridge: Bridge;
  native: MockNative;
  types: PurchaseTypes;
}> {
  let bridge: Bridge | undefined;
  let native: MockNative | undefined;
  let types: PurchaseTypes | undefined;
  await jest.isolateModulesAsync(async () => {
    const nativeModule = await import('../NativeRNSetgreet');
    native = nativeModule.default as unknown as MockNative;
    types = await import('../purchaseTypes');
    bridge = await import('../purchases');
  });
  if (!bridge || !native || !types) {
    throw new Error('modules did not load');
  }
  return { bridge, native, types };
}

/** Lets the bridge's async handler (and the provider's promises) settle. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function sendRequest(request: unknown): Promise<void> {
  const listeners = mockEmitterListeners.get('SetgreetPurchaseRequest') ?? [];
  listeners.forEach((listener) => listener(request));
  await flush();
}

const annual: SetgreetPurchaseProduct = {
  ref: '$rc_annual',
  storeProductId: 'com.app.premium.annual',
  title: 'Premium Annual',
  description: 'Full access, billed yearly',
  localizedPrice: '$49.99',
  priceAmount: 49.99,
  currencyCode: 'USD',
  period: { unit: 'year', count: 1 },
  introOffer: {
    type: 'trial',
    localizedPrice: '$0.00',
    periodText: '7 days',
    eligible: true,
  },
};

type MockProvider = SetgreetPurchaseProvider & {
  loadProducts: jest.Mock<
    Promise<SetgreetPurchaseProduct[]>,
    [SetgreetPurchaseSource]
  >;
  purchase: jest.Mock<
    Promise<SetgreetPurchaseResult>,
    [string, SetgreetPurchaseSource]
  >;
  restorePurchases: jest.Mock<Promise<SetgreetRestoreResult>, []>;
  accessState: jest.Mock<Promise<SetgreetPurchaseAccessState | null>, []>;
  trackPaywallImpression: jest.Mock;
  setAttributes: jest.Mock;
  identify: jest.Mock<Promise<void>, [string]>;
  reset: jest.Mock<Promise<void>, []>;
};

function makeProvider(providerId = 'revenuecat'): MockProvider {
  return {
    providerId,
    loadProducts: jest.fn<
      Promise<SetgreetPurchaseProduct[]>,
      [SetgreetPurchaseSource]
    >(async () => [annual]),
    purchase: jest.fn<
      Promise<SetgreetPurchaseResult>,
      [string, SetgreetPurchaseSource]
    >(async (productRef) => ({
      status: 'purchased',
      productRef,
      accessRefs: ['premium'],
    })),
    restorePurchases: jest.fn<Promise<SetgreetRestoreResult>, []>(async () => ({
      status: 'restored',
      accessRefs: ['premium'],
    })),
    accessState: jest.fn<Promise<SetgreetPurchaseAccessState | null>, []>(
      async () => ({ active: true, accessRefs: ['premium'] })
    ),
    trackPaywallImpression: jest.fn(),
    setAttributes: jest.fn(),
    identify: jest.fn<Promise<void>, [string]>(async () => undefined),
    reset: jest.fn<Promise<void>, []>(async () => undefined),
  };
}

/** A copy of `provider` without the named methods (a JS caller may omit them). */
function withoutMethods(
  provider: MockProvider,
  ...names: Array<keyof MockProvider>
): SetgreetPurchaseProvider {
  const copy: Partial<MockProvider> = { ...provider };
  names.forEach((name) => {
    delete copy[name];
  });
  return copy as SetgreetPurchaseProvider;
}

const offeringSource = { sourceType: 'offering', sourceId: 'onboarding' };

beforeEach(() => {
  mockEmitterListeners.clear();
});

describe('setPurchaseProvider', () => {
  it('registers the provider id and the current offering by default', async () => {
    const { bridge, native } = await loadBridge();

    bridge.setPurchaseProvider(makeProvider());

    expect(native.setPurchaseProvider).toHaveBeenCalledTimes(1);
    expect(native.setPurchaseProvider).toHaveBeenCalledWith('revenuecat', {
      sourceType: 'current_offering',
      sourceId: null,
    });
  });

  it('passes options.defaultSource to native', async () => {
    const { bridge, native, types } = await loadBridge();

    bridge.setPurchaseProvider(makeProvider(), {
      defaultSource: types.SetgreetPurchaseSource.placement('paywall_main'),
    });

    expect(native.setPurchaseProvider).toHaveBeenCalledWith('revenuecat', {
      sourceType: 'placement',
      sourceId: 'paywall_main',
    });
  });

  it('listens for requests before registering natively, and only once', async () => {
    const { bridge, native } = await loadBridge();
    // How many request listeners exist at the moment native registers.
    const listenersAtRegistration: number[] = [];
    native.setPurchaseProvider.mockImplementation(() =>
      listenersAtRegistration.push(
        mockEmitterListeners.get('SetgreetPurchaseRequest')?.length ?? 0
      )
    );

    bridge.setPurchaseProvider(makeProvider());
    bridge.setPurchaseProvider(makeProvider('adapty'));

    expect(listenersAtRegistration).toEqual([1, 1]);
    expect(native.setPurchaseProvider).toHaveBeenLastCalledWith(
      'adapty',
      expect.anything()
    );
  });

  it('routes requests to the provider registered last', async () => {
    const { bridge, native } = await loadBridge();
    const first = makeProvider('first');
    const second = makeProvider('second');
    bridge.setPurchaseProvider(first);
    bridge.setPurchaseProvider(second);

    await sendRequest({ requestId: 'r1', method: 'accessState', args: {} });

    expect(first.accessState).not.toHaveBeenCalled();
    expect(second.accessState).toHaveBeenCalledTimes(1);
    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith(
      'r1',
      { accessState: { active: true, accessRefs: ['premium'] } },
      null
    );
  });

  it('rejects a provider without a providerId', async () => {
    const { bridge, native } = await loadBridge();
    const provider = { ...makeProvider(), providerId: '' };

    expect(() => bridge.setPurchaseProvider(provider)).toThrow(TypeError);
    expect(native.setPurchaseProvider).not.toHaveBeenCalled();
  });

  it('enforces the providerId pattern ^[a-z][a-z0-9_]{0,39}$', async () => {
    const { bridge, native } = await loadBridge();
    const invalid = [
      'RevenueCat',
      '1provider',
      '_revenuecat',
      'revenue-cat',
      'revenue cat',
      'a'.repeat(41),
    ];

    invalid.forEach((providerId) =>
      expect(() =>
        bridge.setPurchaseProvider({ ...makeProvider(), providerId })
      ).toThrow(TypeError)
    );
    expect(native.setPurchaseProvider).not.toHaveBeenCalled();

    bridge.setPurchaseProvider({
      ...makeProvider(),
      providerId: 'play_billing2',
    });
    bridge.setPurchaseProvider({
      ...makeProvider(),
      providerId: 'a'.repeat(40),
    });
    expect(native.setPurchaseProvider).toHaveBeenCalledTimes(2);
  });
});

describe('SetgreetPurchaseSource', () => {
  it('builds the three source shapes', async () => {
    const { types } = await loadBridge();

    expect(types.SetgreetPurchaseSource.currentOffering).toEqual({
      sourceType: 'current_offering',
      sourceId: null,
    });
    expect(types.SetgreetPurchaseSource.offering('onboarding')).toEqual({
      sourceType: 'offering',
      sourceId: 'onboarding',
    });
    expect(types.SetgreetPurchaseSource.placement('main')).toEqual({
      sourceType: 'placement',
      sourceId: 'main',
    });
  });
});

describe('request routing', () => {
  it('answers loadProducts with the products for the requested source', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    provider.loadProducts.mockResolvedValueOnce([
      annual,
      { ...annual, ref: '$rc_monthly', title: undefined, introOffer: null },
    ]);
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'r1',
      method: 'loadProducts',
      args: { source: offeringSource },
    });

    expect(provider.loadProducts).toHaveBeenCalledWith({
      sourceType: 'offering',
      sourceId: 'onboarding',
    });
    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith(
      'r1',
      {
        products: [
          annual,
          {
            ...annual,
            ref: '$rc_monthly',
            title: null,
            introOffer: null,
          },
        ],
      },
      null
    );
  });

  it('keeps priceAmount as the exact JS number', async () => {
    const { bridge, native } = await loadBridge();
    bridge.setPurchaseProvider(makeProvider());

    await sendRequest({
      requestId: 'r1',
      method: 'loadProducts',
      args: { source: offeringSource },
    });

    const result = native.resolvePurchaseRequest.mock.calls[0]?.[1] as {
      products: Array<{ priceAmount: unknown }>;
    };
    expect(result.products[0]?.priceAmount).toBe(49.99);
  });

  it('reads an unknown source type as the current offering', async () => {
    const { bridge } = await loadBridge();
    const provider = makeProvider();
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'r1',
      method: 'loadProducts',
      args: { source: { sourceType: 'mystery', sourceId: 'x' } },
    });

    expect(provider.loadProducts).toHaveBeenCalledWith({
      sourceType: 'current_offering',
      sourceId: null,
    });
  });

  it('answers purchase with the provider result', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'r2',
      method: 'purchase',
      args: { productRef: '$rc_annual', source: offeringSource },
    });

    expect(provider.purchase).toHaveBeenCalledWith('$rc_annual', {
      sourceType: 'offering',
      sourceId: 'onboarding',
    });
    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith(
      'r2',
      {
        status: 'purchased',
        productRef: '$rc_annual',
        accessRefs: ['premium'],
        error: null,
      },
      null
    );
  });

  it('passes a failed purchase result and its error through', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    provider.purchase.mockResolvedValueOnce({
      status: 'failed',
      productRef: '$rc_annual',
      error: { code: 'product_unavailable', providerCode: '5' },
    });
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'r2',
      method: 'purchase',
      args: { productRef: '$rc_annual', source: offeringSource },
    });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith(
      'r2',
      {
        status: 'failed',
        productRef: '$rc_annual',
        accessRefs: [],
        error: {
          code: 'product_unavailable',
          providerCode: '5',
          message: null,
        },
      },
      null
    );
  });

  it('answers restorePurchases with the provider result', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    provider.restorePurchases.mockResolvedValueOnce({
      status: 'nothingToRestore',
    });
    bridge.setPurchaseProvider(provider);

    await sendRequest({ requestId: 'r3', method: 'restorePurchases' });

    expect(provider.restorePurchases).toHaveBeenCalledTimes(1);
    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith(
      'r3',
      { status: 'nothingToRestore', accessRefs: [], error: null },
      null
    );
  });

  it('answers accessState, including null', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    provider.accessState.mockResolvedValueOnce(null);
    bridge.setPurchaseProvider(provider);

    await sendRequest({ requestId: 'r4', method: 'accessState', args: {} });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith(
      'r4',
      { accessState: null },
      null
    );
  });

  it('calls identify and reset and answers with an empty result', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'r5',
      method: 'identify',
      args: { userId: 'user-1' },
    });
    await sendRequest({ requestId: 'r6', method: 'reset', args: {} });

    expect(provider.identify).toHaveBeenCalledWith('user-1');
    expect(provider.reset).toHaveBeenCalledTimes(1);
    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith('r5', {}, null);
    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith('r6', {}, null);
  });

  it('answers only once the provider promise settles', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    let finish: (result: SetgreetPurchaseResult) => void = () => {};
    provider.purchase.mockReturnValueOnce(
      new Promise<SetgreetPurchaseResult>((resolve) => {
        finish = resolve;
      })
    );
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'r7',
      method: 'purchase',
      args: { productRef: '$rc_annual', source: offeringSource },
    });
    expect(native.resolvePurchaseRequest).not.toHaveBeenCalled();

    finish({ status: 'cancelled', productRef: '$rc_annual' });
    await flush();

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith(
      'r7',
      {
        status: 'cancelled',
        productRef: '$rc_annual',
        accessRefs: [],
        error: null,
      },
      null
    );
  });
});

describe('errors', () => {
  it('answers a rejected loadProducts with its purchase error', async () => {
    const { bridge, native, types } = await loadBridge();
    const provider = makeProvider();
    provider.loadProducts.mockRejectedValueOnce(
      types.purchaseError('provider_not_initialized', {
        providerCode: 'configure',
        message: 'Purchases is not configured',
      })
    );
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'e1',
      method: 'loadProducts',
      args: { source: offeringSource },
    });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith('e1', null, {
      code: 'provider_not_initialized',
      providerCode: 'configure',
      message: 'Purchases is not configured',
    });
  });

  it('maps a thrown plain object with a valid code', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    provider.purchase.mockRejectedValueOnce({
      code: 'network_error',
      message: 'offline',
    });
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'e2',
      method: 'purchase',
      args: { productRef: '$rc_annual', source: offeringSource },
    });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith('e2', null, {
      code: 'network_error',
      providerCode: null,
      message: 'offline',
    });
  });

  it('maps any other thrown value to unknown', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    provider.purchase.mockRejectedValueOnce(new Error('boom'));
    provider.restorePurchases.mockRejectedValueOnce({ code: 'NOT_OURS' });
    provider.accessState.mockRejectedValueOnce('denied');
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'e3',
      method: 'purchase',
      args: { productRef: '$rc_annual', source: offeringSource },
    });
    await sendRequest({ requestId: 'e4', method: 'restorePurchases' });
    await sendRequest({ requestId: 'e5', method: 'accessState' });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith('e3', null, {
      code: 'unknown',
      providerCode: null,
      message: 'boom',
    });
    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith('e4', null, {
      code: 'unknown',
      providerCode: null,
      message: null,
    });
    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith('e5', null, {
      code: 'unknown',
      providerCode: null,
      message: 'denied',
    });
  });

  it('answers a provider that throws synchronously', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    provider.loadProducts.mockImplementationOnce(() => {
      throw new Error('sync');
    });
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'e6',
      method: 'loadProducts',
      args: { source: offeringSource },
    });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith('e6', null, {
      code: 'unknown',
      providerCode: null,
      message: 'sync',
    });
  });

  it('answers a purchase that resolves without a result as an error', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    provider.purchase.mockResolvedValueOnce(
      undefined as unknown as SetgreetPurchaseResult
    );
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'e7',
      method: 'purchase',
      args: { productRef: '$rc_annual', source: offeringSource },
    });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith(
      'e7',
      null,
      expect.objectContaining({ code: 'unknown' })
    );
  });

  it('answers an unknown method with an error', async () => {
    const { bridge, native } = await loadBridge();
    bridge.setPurchaseProvider(makeProvider());

    await sendRequest({ requestId: 'e8', method: 'refund', args: {} });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith('e8', null, {
      code: 'unknown',
      providerCode: null,
      message: 'Unknown purchase request method: refund',
    });
  });

  it('answers a missing required method with not_configured', async () => {
    const { bridge, native } = await loadBridge();
    bridge.setPurchaseProvider(withoutMethods(makeProvider(), 'accessState'));

    await sendRequest({ requestId: 'e9', method: 'accessState', args: {} });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith(
      'e9',
      null,
      expect.objectContaining({ code: 'not_configured' })
    );
  });
});

describe('answer coercion', () => {
  it('rebuilds a product from plain values only', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    const odd: Record<string, unknown> = {
      ref: '$rc_annual',
      storeProductId: 7,
      title: Symbol('title'),
      description: () => 'a function',
      localizedPrice: '$49.99',
      priceAmount: BigInt(50),
      currencyCode: 'USD',
      period: { unit: 'year', count: '1' },
      introOffer: { type: 'trial', eligible: 'yes', periodText: 7 },
    };
    provider.loadProducts.mockResolvedValueOnce([
      odd as unknown as SetgreetPurchaseProduct,
    ]);
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'c1',
      method: 'loadProducts',
      args: { source: offeringSource },
    });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith(
      'c1',
      {
        products: [
          {
            ref: '$rc_annual',
            storeProductId: null,
            title: null,
            description: null,
            localizedPrice: '$49.99',
            priceAmount: '50',
            currencyCode: 'USD',
            period: { unit: 'year', count: null },
            introOffer: {
              type: 'trial',
              localizedPrice: null,
              periodText: null,
              eligible: null,
            },
          },
        ],
      },
      null
    );
  });

  it('rebuilds a purchase result from plain values only', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    const odd: Record<string, unknown> = {
      status: Symbol('purchased'),
      productRef: '$rc_annual',
      accessRefs: [Symbol('premium'), 'premium', 3],
      error: { code: 'network_error', providerCode: 42, message: () => 'x' },
    };
    provider.purchase.mockResolvedValueOnce(
      odd as unknown as SetgreetPurchaseResult
    );
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'c2',
      method: 'purchase',
      args: { productRef: '$rc_annual', source: offeringSource },
    });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith(
      'c2',
      {
        status: null,
        productRef: '$rc_annual',
        accessRefs: ['premium'],
        error: { code: 'network_error', providerCode: '42', message: null },
      },
      null
    );
  });

  it('answers with an error when the answer itself cannot cross to native', async () => {
    const { bridge, native } = await loadBridge();
    native.resolvePurchaseRequest.mockImplementationOnce(() => {
      throw new Error('Unable to convert the value');
    });
    bridge.setPurchaseProvider(makeProvider());

    await sendRequest({
      requestId: 'c3',
      method: 'purchase',
      args: { productRef: '$rc_annual', source: offeringSource },
    });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledTimes(2);
    expect(native.resolvePurchaseRequest).toHaveBeenLastCalledWith('c3', null, {
      code: 'unknown',
      providerCode: null,
      message: 'Unable to convert the value',
    });
  });

  it('rejects a loadProducts that does not resolve an array', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    provider.loadProducts.mockResolvedValueOnce(
      {} as unknown as SetgreetPurchaseProduct[]
    );
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'c4',
      method: 'loadProducts',
      args: { source: offeringSource },
    });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith(
      'c4',
      null,
      expect.objectContaining({ code: 'unknown' })
    );
  });

  it('turns a numeric providerCode in a rejection into a string', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    provider.purchase.mockRejectedValueOnce({
      code: 'network_error',
      providerCode: 10,
      message: 'offline',
    });
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'c5',
      method: 'purchase',
      args: { productRef: '$rc_annual', source: offeringSource },
    });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith('c5', null, {
      code: 'network_error',
      providerCode: '10',
      message: 'offline',
    });
  });
});

describe('a rejected purchase', () => {
  it('with purchase_cancelled answers as cancelled', async () => {
    const { bridge, native, types } = await loadBridge();
    const provider = makeProvider();
    provider.purchase.mockRejectedValueOnce(
      types.purchaseError('purchase_cancelled', {
        providerCode: '1',
        message: 'The user cancelled',
      })
    );
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'l1',
      method: 'purchase',
      args: { productRef: '$rc_annual', source: offeringSource },
    });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith(
      'l1',
      {
        status: 'cancelled',
        productRef: '$rc_annual',
        accessRefs: [],
        error: {
          code: 'purchase_cancelled',
          providerCode: '1',
          message: 'The user cancelled',
        },
      },
      null
    );
  });

  it('with purchase_pending answers as pending', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    provider.purchase.mockRejectedValueOnce({ code: 'purchase_pending' });
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'l2',
      method: 'purchase',
      args: { productRef: '$rc_monthly', source: offeringSource },
    });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith(
      'l2',
      {
        status: 'pending',
        productRef: '$rc_monthly',
        accessRefs: [],
        error: { code: 'purchase_pending', providerCode: null, message: null },
      },
      null
    );
  });

  it('with any other code still answers as an error (failed natively)', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    provider.purchase.mockRejectedValueOnce({ code: 'purchase_failed' });
    provider.restorePurchases.mockRejectedValueOnce({
      code: 'purchase_cancelled',
    });
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: 'l3',
      method: 'purchase',
      args: { productRef: '$rc_annual', source: offeringSource },
    });
    await sendRequest({ requestId: 'l4', method: 'restorePurchases' });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith('l3', null, {
      code: 'purchase_failed',
      providerCode: null,
      message: null,
    });
    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith('l4', null, {
      code: 'purchase_cancelled',
      providerCode: null,
      message: null,
    });
  });
});

describe('optional and fire-and-forget methods', () => {
  it('answers identify and reset when the provider does not implement them', async () => {
    const { bridge, native } = await loadBridge();
    bridge.setPurchaseProvider(
      withoutMethods(makeProvider(), 'identify', 'reset')
    );

    await sendRequest({
      requestId: 'o1',
      method: 'identify',
      args: { userId: 'u' },
    });
    await sendRequest({ requestId: 'o2', method: 'reset', args: {} });

    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith('o1', {}, null);
    expect(native.resolvePurchaseRequest).toHaveBeenCalledWith('o2', {}, null);
  });

  it('forwards trackPaywallImpression without answering', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: null,
      method: 'trackPaywallImpression',
      args: {
        context: {
          flowId: 'flow-1',
          screenId: 'screen-1',
          source: offeringSource,
          productRefs: ['$rc_annual', 7],
        },
      },
    });

    expect(provider.trackPaywallImpression).toHaveBeenCalledWith({
      flowId: 'flow-1',
      screenId: 'screen-1',
      source: { sourceType: 'offering', sourceId: 'onboarding' },
      productRefs: ['$rc_annual'],
    });
    expect(native.resolvePurchaseRequest).not.toHaveBeenCalled();
  });

  it('forwards setAttributes with string values only, without answering', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    bridge.setPurchaseProvider(provider);

    await sendRequest({
      requestId: null,
      method: 'setAttributes',
      args: {
        attributes: { setgreet_flow: 'flow-1', setgreet_screen: 's', n: 1 },
      },
    });

    expect(provider.setAttributes).toHaveBeenCalledWith({
      setgreet_flow: 'flow-1',
      setgreet_screen: 's',
    });
    expect(native.resolvePurchaseRequest).not.toHaveBeenCalled();
  });

  it('ignores fire-and-forget methods the provider lacks or that throw', async () => {
    const { bridge, native } = await loadBridge();
    bridge.setPurchaseProvider(
      withoutMethods(makeProvider(), 'trackPaywallImpression', 'setAttributes')
    );
    await sendRequest({
      method: 'trackPaywallImpression',
      args: { context: {} },
    });

    const throwing = makeProvider();
    throwing.setAttributes.mockImplementation(() => {
      throw new Error('nope');
    });
    throwing.trackPaywallImpression.mockImplementation(() =>
      Promise.reject(new Error('async nope'))
    );
    bridge.setPurchaseProvider(throwing);
    await sendRequest({ method: 'setAttributes', args: { attributes: {} } });
    await sendRequest({
      method: 'trackPaywallImpression',
      args: { context: {} },
    });

    expect(throwing.setAttributes).toHaveBeenCalledTimes(1);
    expect(throwing.trackPaywallImpression).toHaveBeenCalledTimes(1);
    expect(native.resolvePurchaseRequest).not.toHaveBeenCalled();
  });

  it('ignores malformed requests and request/response calls without an id', async () => {
    const { bridge, native } = await loadBridge();
    const provider = makeProvider();
    bridge.setPurchaseProvider(provider);

    await sendRequest(null);
    await sendRequest('loadProducts');
    await sendRequest({ requestId: 'x' });
    await sendRequest({ method: 'accessState', args: {} });

    expect(native.resolvePurchaseRequest).not.toHaveBeenCalled();
  });
});

describe('purchase event listeners', () => {
  type FlowEvents = typeof import('../useFlowEvents');

  async function loadFlowEvents(): Promise<FlowEvents> {
    let flowEvents: FlowEvents | undefined;
    await jest.isolateModulesAsync(async () => {
      flowEvents = await import('../useFlowEvents');
    });
    if (!flowEvents) {
      throw new Error('useFlowEvents did not load');
    }
    return flowEvents;
  }

  function emitFlowEvent(event: SetgreetFlowEvent): void {
    (mockEmitterListeners.get('SetgreetFlowEvent') ?? []).forEach((listener) =>
      listener(event)
    );
  }

  const base = {
    flowId: 'flow-1',
    screenId: 'screen-1',
    componentId: 'buy',
    provider: 'revenuecat',
    timestamp: 1_760_000_000_000,
  };

  it('delivers each purchase event to its own listener only', async () => {
    const flowEvents = await loadFlowEvents();
    const completed = jest.fn();
    const cancelled = jest.fn();
    const failed = jest.fn();
    const pending = jest.fn();
    const restored = jest.fn();
    const restoreFailed = jest.fn();
    const all = jest.fn();
    const subscriptions = [
      flowEvents.addPurchaseCompletedListener(completed),
      flowEvents.addPurchaseCancelledListener(cancelled),
      flowEvents.addPurchaseFailedListener(failed),
      flowEvents.addPurchasePendingListener(pending),
      flowEvents.addRestoreCompletedListener(restored),
      flowEvents.addRestoreFailedListener(restoreFailed),
      flowEvents.addFlowEventListener(all),
    ];

    const events: SetgreetFlowEvent[] = [
      {
        ...base,
        type: 'purchaseCompleted',
        productRef: '$rc_annual',
        accessRefs: ['premium'],
      },
      { ...base, type: 'purchaseCancelled', productRef: '$rc_annual' },
      {
        ...base,
        type: 'purchaseFailed',
        productRef: '$rc_annual',
        error: { code: 'network_error', providerCode: '10', message: 'x' },
      },
      { ...base, type: 'purchasePending', productRef: '$rc_annual' },
      {
        ...base,
        type: 'restoreCompleted',
        status: 'nothingToRestore',
        accessRefs: [],
      },
      {
        ...base,
        type: 'restoreFailed',
        error: { code: 'restore_failed', providerCode: null, message: null },
      },
    ];
    events.forEach(emitFlowEvent);

    expect(completed).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenCalledWith(events[0]);
    expect(cancelled).toHaveBeenCalledWith(events[1]);
    expect(failed).toHaveBeenCalledWith(events[2]);
    expect(pending).toHaveBeenCalledWith(events[3]);
    expect(restored).toHaveBeenCalledWith(events[4]);
    expect(restoreFailed).toHaveBeenCalledWith(events[5]);
    [cancelled, failed, pending, restored, restoreFailed].forEach((mock) =>
      expect(mock).toHaveBeenCalledTimes(1)
    );
    expect(all).toHaveBeenCalledTimes(events.length);

    subscriptions.forEach((subscription) => subscription.remove());
    emitFlowEvent(events[0] as SetgreetFlowEvent);
    expect(completed).toHaveBeenCalledTimes(1);
  });
});
