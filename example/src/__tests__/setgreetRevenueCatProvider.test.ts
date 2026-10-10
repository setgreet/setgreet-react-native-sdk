import type {
  CustomerInfo,
  IntroEligibility,
  MakePurchaseResult,
  PurchasesOffering,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
import type { SetgreetPurchaseSource } from '@setgreet/react-native-sdk';
import { SetgreetRevenueCatProvider } from '../setgreetRevenueCatProvider';

// react-native-purchases is the app's own dependency, installed in example/
// only, and the root Jest config hides example/node_modules: it is mocked
// virtually, with the enum values this file reads as the package publishes
// them (@revenuecat/purchases-typescript-internal).
jest.mock(
  'react-native-purchases',
  () => ({
    __esModule: true,
    default: {
      isConfigured: jest.fn(),
      getOfferings: jest.fn(),
      getCurrentOfferingForPlacement: jest.fn(),
      purchasePackage: jest.fn(),
      restorePurchases: jest.fn(),
      getCustomerInfo: jest.fn(),
      checkTrialOrIntroductoryPriceEligibility: jest.fn(),
      trackCustomPaywallImpression: jest.fn(),
      setAttributes: jest.fn(),
    },
    PURCHASES_ERROR_CODE: {
      PURCHASE_CANCELLED_ERROR: '1',
      PURCHASE_INVALID_ERROR: '4',
      PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: '5',
      PRODUCT_ALREADY_PURCHASED_ERROR: '6',
      NETWORK_ERROR: '10',
      INVALID_APP_USER_ID_ERROR: '14',
      PAYMENT_PENDING_ERROR: '20',
      CONFIGURATION_ERROR: '23',
      OFFLINE_CONNECTION_ERROR: '35',
    },
    INTRO_ELIGIBILITY_STATUS: {
      INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0,
      INTRO_ELIGIBILITY_STATUS_INELIGIBLE: 1,
      INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2,
      INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS: 3,
    },
    OFFER_PAYMENT_MODE: {
      FREE_TRIAL: 'FREE_TRIAL',
      SINGLE_PAYMENT: 'SINGLE_PAYMENT',
      DISCOUNTED_RECURRING_PAYMENT: 'DISCOUNTED_RECURRING_PAYMENT',
    },
  }),
  { virtual: true }
);

// The provider reads only `Platform.OS`. Here `react-native` resolves to the
// example app's own copy, which the root Jest preset does not set up.
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

// The package entry is its build output, which the root Jest config hides;
// the provider only needs the purchase helpers, served from the source.
jest.mock(
  '@setgreet/react-native-sdk',
  () => jest.requireActual('../../../src/purchaseTypes'),
  { virtual: true }
);

type PurchasesMock = {
  isConfigured: jest.Mock<Promise<boolean>, []>;
  getOfferings: jest.Mock<Promise<PurchasesOfferings>, []>;
  getCurrentOfferingForPlacement: jest.Mock<
    Promise<PurchasesOffering | null>,
    [string]
  >;
  purchasePackage: jest.Mock<Promise<MakePurchaseResult>, [PurchasesPackage]>;
  restorePurchases: jest.Mock<Promise<CustomerInfo>, []>;
  getCustomerInfo: jest.Mock<Promise<CustomerInfo>, []>;
  checkTrialOrIntroductoryPriceEligibility: jest.Mock<
    Promise<Record<string, IntroEligibility>>,
    [string[]]
  >;
  trackCustomPaywallImpression: jest.Mock<Promise<void>, [unknown]>;
  setAttributes: jest.Mock<Promise<void>, [unknown]>;
};

const Purchases = jest.requireMock<{ default: PurchasesMock }>(
  'react-native-purchases'
).default;

const platform = jest.requireMock<{ Platform: { OS: string } }>(
  'react-native'
).Platform;

// Fixtures: only the fields the provider reads.

function makePackage(
  identifier: string,
  productId: string,
  price: number,
  product: Record<string, unknown> = {}
): PurchasesPackage {
  return {
    identifier,
    product: {
      identifier: productId,
      title: `${productId} title`,
      description: `${productId} description`,
      price,
      priceString: `$${price.toFixed(2)}`,
      currencyCode: 'USD',
      subscriptionPeriod: 'P1Y',
      introPrice: null,
      defaultOption: null,
      ...product,
    },
  } as unknown as PurchasesPackage;
}

function makeOffering(
  identifier: string,
  packages: PurchasesPackage[]
): PurchasesOffering {
  return {
    identifier,
    availablePackages: packages,
  } as unknown as PurchasesOffering;
}

function customerInfo(activeEntitlements: string[]): CustomerInfo {
  return {
    entitlements: {
      active: Object.fromEntries(
        activeEntitlements.map((id) => [id, { identifier: id }])
      ),
    },
  } as unknown as CustomerInfo;
}

function purchaseResult(activeEntitlements: string[]): MakePurchaseResult {
  return {
    productIdentifier: 'com.app.annual',
    customerInfo: customerInfo(activeEntitlements),
  } as unknown as MakePurchaseResult;
}

// Both offerings carry a `$rc_annual` package, each with its own product.
const currentAnnual = makePackage('$rc_annual', 'com.app.annual', 49.99);
const currentMonthly = makePackage('$rc_monthly', 'com.app.monthly', 4.99, {
  subscriptionPeriod: 'P1M',
});
const discountAnnual = makePackage(
  '$rc_annual',
  'com.app.annual.discount',
  29.99
);
const currentOffering = makeOffering('default', [
  currentAnnual,
  currentMonthly,
]);
const discountOffering = makeOffering('discount', [discountAnnual]);

const current: SetgreetPurchaseSource = {
  sourceType: 'current_offering',
  sourceId: null,
};
const discount: SetgreetPurchaseSource = {
  sourceType: 'offering',
  sourceId: 'discount',
};

beforeEach(() => {
  jest.resetAllMocks();
  Purchases.isConfigured.mockResolvedValue(true);
  Purchases.getOfferings.mockResolvedValue({
    current: currentOffering,
    all: { default: currentOffering, discount: discountOffering },
  } as unknown as PurchasesOfferings);
  Purchases.getCurrentOfferingForPlacement.mockResolvedValue(discountOffering);
  Purchases.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({});
  Purchases.getCustomerInfo.mockResolvedValue(customerInfo([]));
  Purchases.purchasePackage.mockResolvedValue(purchaseResult(['premium']));
  Purchases.trackCustomPaywallImpression.mockResolvedValue(undefined);
  Purchases.setAttributes.mockResolvedValue(undefined);
});

describe('SetgreetRevenueCatProvider purchase', () => {
  it('buys the package of the requested source, never a same-ref package of another source', async () => {
    const provider = new SetgreetRevenueCatProvider();
    await provider.loadProducts(current);
    await provider.loadProducts(discount);

    const fromDiscount = await provider.purchase('$rc_annual', discount);
    expect(Purchases.purchasePackage.mock.calls[0]?.[0]).toBe(discountAnnual);
    expect(fromDiscount).toEqual({
      status: 'purchased',
      productRef: '$rc_annual',
      accessRefs: ['premium'],
    });

    await provider.purchase('$rc_annual', current);
    expect(Purchases.purchasePackage.mock.calls[1]?.[0]).toBe(currentAnnual);
  });

  it('loads the source first when its packages are not cached yet', async () => {
    const provider = new SetgreetRevenueCatProvider();

    await provider.purchase('$rc_annual', discount);

    expect(Purchases.getOfferings).toHaveBeenCalledTimes(1);
    expect(Purchases.purchasePackage.mock.calls[0]?.[0]).toBe(discountAnnual);
  });

  it('reads a placement through getCurrentOfferingForPlacement', async () => {
    const provider = new SetgreetRevenueCatProvider();

    const products = await provider.loadProducts({
      sourceType: 'placement',
      sourceId: 'paywall_main',
    });

    expect(Purchases.getCurrentOfferingForPlacement).toHaveBeenCalledWith(
      'paywall_main'
    );
    expect(products.map((product) => product.storeProductId)).toEqual([
      'com.app.annual.discount',
    ]);
  });

  it('reports a cancelled purchase as cancelled', async () => {
    Purchases.purchasePackage.mockRejectedValueOnce({
      code: '1',
      userCancelled: true,
      message: 'Purchase was cancelled.',
    });
    const provider = new SetgreetRevenueCatProvider();

    await expect(provider.purchase('$rc_annual', current)).resolves.toEqual({
      status: 'cancelled',
      productRef: '$rc_annual',
    });
  });

  it('reports a pending purchase as pending', async () => {
    Purchases.purchasePackage.mockRejectedValueOnce({
      code: '20',
      message: 'The payment is pending.',
      userInfo: { readableErrorCode: 'PaymentPendingError' },
    });
    const provider = new SetgreetRevenueCatProvider();

    const result = await provider.purchase('$rc_annual', current);

    expect(result.status).toBe('pending');
    expect(result.error).toMatchObject({
      code: 'purchase_pending',
      providerCode: 'PaymentPendingError',
      message: 'The payment is pending.',
    });
  });

  it('reports an already-owned product as purchased when RevenueCat confirms access', async () => {
    Purchases.purchasePackage.mockRejectedValueOnce({ code: '6' });
    Purchases.getCustomerInfo.mockResolvedValueOnce(customerInfo(['premium']));
    const provider = new SetgreetRevenueCatProvider();

    await expect(provider.purchase('$rc_annual', current)).resolves.toEqual({
      status: 'purchased',
      productRef: '$rc_annual',
      accessRefs: ['premium'],
    });
  });

  it('keeps an already-owned product failed without an active entitlement', async () => {
    Purchases.purchasePackage.mockRejectedValueOnce({ code: '6' });
    Purchases.getCustomerInfo.mockResolvedValueOnce(customerInfo([]));
    const provider = new SetgreetRevenueCatProvider();

    const result = await provider.purchase('$rc_annual', current);

    expect(result.status).toBe('failed');
    expect(result.error).toMatchObject({
      code: 'purchase_failed',
      providerCode: '6',
    });
  });

  it('fails a ref the source does not have', async () => {
    const provider = new SetgreetRevenueCatProvider();

    const result = await provider.purchase('$rc_weekly', current);

    expect(result.status).toBe('failed');
    expect(result.error).toMatchObject({ code: 'product_not_found' });
    expect(Purchases.purchasePackage).not.toHaveBeenCalled();
  });

  it('reports provider_not_initialized while RevenueCat is not configured', async () => {
    Purchases.isConfigured.mockResolvedValue(false);
    const provider = new SetgreetRevenueCatProvider();

    await expect(provider.loadProducts(current)).rejects.toMatchObject({
      code: 'provider_not_initialized',
    });
    const result = await provider.purchase('$rc_annual', current);
    expect(result.status).toBe('failed');
    expect(result.error).toMatchObject({ code: 'provider_not_initialized' });
    await expect(provider.accessState()).resolves.toBeNull();
  });
});

describe('SetgreetRevenueCatProvider restore and access', () => {
  it('reports restored, nothing to restore and failed', async () => {
    const provider = new SetgreetRevenueCatProvider();

    Purchases.restorePurchases.mockResolvedValueOnce(customerInfo(['pro']));
    await expect(provider.restorePurchases()).resolves.toEqual({
      status: 'restored',
      accessRefs: ['pro'],
    });

    Purchases.restorePurchases.mockResolvedValueOnce(customerInfo([]));
    await expect(provider.restorePurchases()).resolves.toEqual({
      status: 'nothingToRestore',
      accessRefs: [],
    });

    Purchases.restorePurchases.mockRejectedValueOnce({ code: '10' });
    const failed = await provider.restorePurchases();
    expect(failed.status).toBe('failed');
    expect(failed.error).toMatchObject({ code: 'network_error' });
  });

  it('reports active entitlement ids as access refs', async () => {
    Purchases.getCustomerInfo.mockResolvedValueOnce(
      customerInfo(['pro', 'premium'])
    );
    const provider = new SetgreetRevenueCatProvider();

    await expect(provider.accessState()).resolves.toEqual({
      active: true,
      accessRefs: ['premium', 'pro'],
    });
  });
});

describe('SetgreetRevenueCatProvider products', () => {
  it('maps an App Store product, with a trial only for an eligible user', async () => {
    Purchases.getOfferings.mockResolvedValueOnce({
      current: makeOffering('default', [
        makePackage('$rc_annual', 'com.app.annual', 49.99, {
          introPrice: {
            price: 0,
            priceString: '$0.00',
            cycles: 1,
            period: 'P1W',
            periodUnit: 'WEEK',
            periodNumberOfUnits: 1,
          },
        }),
        makePackage('$rc_monthly', 'com.app.monthly', 4.99, {
          subscriptionPeriod: 'P1M',
          introPrice: {
            price: 0,
            priceString: '$0.00',
            cycles: 1,
            period: 'P3D',
            periodUnit: 'DAY',
            periodNumberOfUnits: 3,
          },
        }),
      ]),
      all: {},
    } as unknown as PurchasesOfferings);
    Purchases.checkTrialOrIntroductoryPriceEligibility.mockResolvedValueOnce({
      'com.app.annual': { status: 2, description: 'eligible' },
      'com.app.monthly': { status: 1, description: 'ineligible' },
    } as unknown as Record<string, IntroEligibility>);
    const provider = new SetgreetRevenueCatProvider();

    const [annual, monthly] = await provider.loadProducts(current);

    expect(annual).toEqual({
      ref: '$rc_annual',
      storeProductId: 'com.app.annual',
      title: 'com.app.annual title',
      description: 'com.app.annual description',
      localizedPrice: '$49.99',
      priceAmount: 49.99,
      currencyCode: 'USD',
      period: { unit: 'year', count: 1 },
      introOffer: {
        type: 'trial',
        localizedPrice: '$0.00',
        periodText: '1 week',
        eligible: true,
      },
    });
    expect(monthly?.period).toEqual({ unit: 'month', count: 1 });
    expect(monthly?.introOffer).toMatchObject({
      type: 'trial',
      periodText: '3 days',
      eligible: false,
    });
  });

  it('strips only the trailing app-name group from Google Play titles', async () => {
    const replaced = jest.replaceProperty(platform, 'OS', 'android');
    try {
      const titles = [
        'Premium (My App)',
        'Pro (Annual) (My App)',
        'Pro (My App (Beta))',
        'Pro (Annual) (My App (Beta))',
        'Plain title',
        '(My App)',
        'Unbalanced (My App',
      ];
      Purchases.getOfferings.mockResolvedValueOnce({
        current: makeOffering(
          'default',
          titles.map((title, index) =>
            makePackage(`$rc_${index}`, `com.app.${index}`, 1, { title })
          )
        ),
        all: {},
      } as unknown as PurchasesOfferings);
      const provider = new SetgreetRevenueCatProvider();

      const products = await provider.loadProducts(current);

      expect(products.map((product) => product.title)).toEqual([
        'Premium',
        'Pro (Annual)',
        'Pro',
        'Pro (Annual)',
        'Plain title',
        '(My App)',
        'Unbalanced (My App',
      ]);
      expect(
        Purchases.checkTrialOrIntroductoryPriceEligibility
      ).not.toHaveBeenCalled();
    } finally {
      replaced.restore();
    }
  });

  it('maps a Google Play free phase as an eligible trial', async () => {
    const replaced = jest.replaceProperty(platform, 'OS', 'android');
    try {
      Purchases.getOfferings.mockResolvedValueOnce({
        current: makeOffering('default', [
          makePackage('$rc_annual', 'com.app.annual:yearly', 49.99, {
            defaultOption: {
              freePhase: {
                billingPeriod: { unit: 'DAY', value: 7, iso8601: 'P7D' },
                price: { formatted: '$0.00', amountMicros: 0 },
                offerPaymentMode: 'FREE_TRIAL',
              },
              introPhase: null,
            },
          }),
        ]),
        all: {},
      } as unknown as PurchasesOfferings);
      const provider = new SetgreetRevenueCatProvider();

      const [annual] = await provider.loadProducts(current);

      expect(annual?.introOffer).toEqual({
        type: 'trial',
        localizedPrice: '$0.00',
        periodText: '7 days',
        eligible: true,
      });
    } finally {
      replaced.restore();
    }
  });
});
