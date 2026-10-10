/*
 * setgreetRevenueCatProvider.ts
 *
 * Reference `SetgreetPurchaseProvider` backed by RevenueCat.
 *
 * Targets: @setgreet/react-native-sdk with purchase providers, and
 * react-native-purchases 10.4.0 or later, the first release whose
 * `trackCustomPaywallImpression` accepts an `offering` (10.3.0 takes only
 * `offeringId`; changelog 10.4.0: "Add presentedOfferingContext support to
 * custom paywall impression events"). Every other API used here is present
 * in 10.4.0: this file type-checks against its published types, and not
 * against 10.3.0's.
 *
 * The example app pins react-native-purchases to exactly 10.10.2 out of
 * supply-chain caution: a release some weeks old, verified against, rather
 * than whatever was published last.
 *
 * This file is meant to be COPIED into your app, not imported from a package:
 * Setgreet ships no RevenueCat dependency and never configures it. Call
 * `Purchases.configure({ apiKey })` yourself, then register one instance with
 * `setPurchaseProvider(new SetgreetRevenueCatProvider())`.
 *
 * It ports the iOS (`SetgreetRevenueCatProvider.swift`) and Android
 * (`SetgreetRevenueCatProvider.kt`) reference providers.
 *
 * Mapping:
 *   product ref            RevenueCat package identifier ($rc_annual, $rc_monthly, custom);
 *                          unique within its offering only, so packages are
 *                          kept per (source, ref) and a purchase names its source
 *   current_offering       getOfferings().current
 *   offering + sourceId    getOfferings().all[sourceId]
 *   placement + sourceId   getCurrentOfferingForPlacement(sourceId)
 *   access refs            CustomerInfo.entitlements.active keys
 *   trial (iOS)            the product's introductory price; eligibility from
 *                          checkTrialOrIntroductoryPriceEligibility
 *   trial (Android)        the free (else intro) phase of the default option;
 *                          Google Play lists only offers the user can take
 */
import { Platform } from 'react-native';
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  OFFER_PAYMENT_MODE,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import type {
  CustomerInfo,
  IntroEligibility,
  PricingPhase,
  PurchasesOffering,
  PurchasesPackage,
  PurchasesStoreProduct,
} from 'react-native-purchases';
import {
  isSetgreetPurchaseErrorCode,
  purchaseError,
} from '@setgreet/react-native-sdk';
import type {
  SetgreetPaywallImpressionContext,
  SetgreetPurchaseAccessState,
  SetgreetPurchaseError,
  SetgreetPurchaseErrorCode,
  SetgreetPurchaseIntroOffer,
  SetgreetPurchasePeriod,
  SetgreetPurchasePeriodUnit,
  SetgreetPurchaseProduct,
  SetgreetPurchaseProvider,
  SetgreetPurchaseResult,
  SetgreetPurchaseSource,
  SetgreetRestoreResult,
} from '@setgreet/react-native-sdk';

export class SetgreetRevenueCatProvider implements SetgreetPurchaseProvider {
  readonly providerId = 'revenuecat';

  /**
   * Packages by source, then by ref, kept between `loadProducts` and
   * `purchase`: a package identifier such as `$rc_annual` exists in every
   * offering, so a ref alone does not name a package. And the offering each
   * source resolved to, for impression tracking.
   */
  private readonly packagesBySource = new Map<
    string,
    Map<string, PurchasesPackage>
  >();
  private readonly offeringsBySource = new Map<string, PurchasesOffering>();

  // Catalog

  async loadProducts(
    source: SetgreetPurchaseSource
  ): Promise<SetgreetPurchaseProduct[]> {
    const packages = (await this.loadOffering(source)).availablePackages;
    const eligibility = await introEligibility(packages);
    return packages.map((aPackage) =>
      toProduct(aPackage, eligibility[aPackage.product.identifier])
    );
  }

  /**
   * Fetches the offering `source` resolves to and keeps its packages under
   * that source, for `purchase`.
   */
  private async loadOffering(
    source: SetgreetPurchaseSource
  ): Promise<PurchasesOffering> {
    if (!(await isConfigured())) {
      throw purchaseError('provider_not_initialized', {
        message: 'Purchases.configure() has not been called',
      });
    }

    let offering: PurchasesOffering | null;
    try {
      offering = await resolveOffering(source);
    } catch (error) {
      throw normalizedError(error, 'network_error');
    }
    if (offering == null) {
      throw purchaseError('product_not_found', {
        message: `No offering for ${source.sourceType} ${source.sourceId ?? ''}`,
      });
    }

    // The first package of an identifier wins, as RevenueCat lists them.
    const packages = new Map<string, PurchasesPackage>();
    offering.availablePackages.forEach((aPackage) => {
      if (!packages.has(aPackage.identifier)) {
        packages.set(aPackage.identifier, aPackage);
      }
    });
    this.packagesBySource.set(sourceKey(source), packages);
    this.offeringsBySource.set(sourceKey(source), offering);
    return offering;
  }

  // Purchase

  async purchase(
    productRef: string,
    source: SetgreetPurchaseSource
  ): Promise<SetgreetPurchaseResult> {
    if (!(await isConfigured())) {
      return {
        status: 'failed',
        productRef,
        error: purchaseError('provider_not_initialized'),
      };
    }
    let aPackage: PurchasesPackage;
    try {
      aPackage = await this.resolvePackage(productRef, source);
    } catch (error) {
      return {
        status: 'failed',
        productRef,
        error: asSetgreetError(error),
      };
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(aPackage);
      return {
        status: 'purchased',
        productRef,
        accessRefs: accessRefs(customerInfo),
      };
    } catch (error) {
      const ownedAccessRefs =
        purchasesErrorCode(error) ===
        PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR
          ? await activeAccessRefs()
          : null;
      return purchaseFailure(error, productRef, ownedAccessRefs);
    }
  }

  /**
   * The package `ref` names in `source`, never one of the same ref from
   * another offering. A cold cache (no `loadProducts(source)` yet in this
   * session) loads that source's offering first.
   */
  private async resolvePackage(
    ref: string,
    source: SetgreetPurchaseSource
  ): Promise<PurchasesPackage> {
    const cached = this.packagesBySource.get(sourceKey(source))?.get(ref);
    if (cached) {
      return cached;
    }
    await this.loadOffering(source);
    const loaded = this.packagesBySource.get(sourceKey(source))?.get(ref);
    if (!loaded) {
      throw purchaseError('product_not_found', {
        message: `No package ${ref} in ${source.sourceType} ${source.sourceId ?? ''}`,
      });
    }
    return loaded;
  }

  // Restore

  async restorePurchases(): Promise<SetgreetRestoreResult> {
    if (!(await isConfigured())) {
      return {
        status: 'failed',
        error: purchaseError('provider_not_initialized'),
      };
    }
    try {
      const refs = accessRefs(await Purchases.restorePurchases());
      return {
        status: refs.length === 0 ? 'nothingToRestore' : 'restored',
        accessRefs: refs,
      };
    } catch (error) {
      return {
        status: 'failed',
        error: normalizedError(error, 'restore_failed'),
      };
    }
  }

  // Access

  async accessState(): Promise<SetgreetPurchaseAccessState | null> {
    if (!(await isConfigured())) {
      return null;
    }
    try {
      const refs = accessRefs(await Purchases.getCustomerInfo());
      return { active: refs.length > 0, accessRefs: refs };
    } catch {
      return null;
    }
  }

  // Attribution

  trackPaywallImpression(context: SetgreetPaywallImpressionContext): void {
    const offering = this.offeringsBySource.get(sourceKey(context.source));
    whenConfigured(() =>
      Purchases.trackCustomPaywallImpression({
        paywallId: context.screenId,
        offering: offering ?? null,
      })
    );
  }

  setAttributes(attributes: Record<string, string>): void {
    whenConfigured(() => Purchases.setAttributes(attributes));
  }

  // `identify` and `reset` are left out on purpose: your app already drives
  // `Purchases.logIn` / `Purchases.logOut`, and a second caller can merge or
  // switch RevenueCat identities by accident.
}

// Offerings

function sourceKey(source: SetgreetPurchaseSource): string {
  return `${source.sourceType}|${source.sourceId ?? ''}`;
}

async function resolveOffering(
  source: SetgreetPurchaseSource
): Promise<PurchasesOffering | null> {
  switch (source.sourceType) {
    case 'offering': {
      if (!source.sourceId) {
        return null;
      }
      const offerings = await Purchases.getOfferings();
      return offerings.all[source.sourceId] ?? null;
    }
    case 'placement':
      return source.sourceId
        ? Purchases.getCurrentOfferingForPlacement(source.sourceId)
        : null;
    default:
      return (await Purchases.getOfferings()).current;
  }
}

async function isConfigured(): Promise<boolean> {
  try {
    return await Purchases.isConfigured();
  } catch {
    return false;
  }
}

/** Runs a fire-and-forget RevenueCat call once Purchases is configured; failures are dropped. */
function whenConfigured(call: () => Promise<unknown>): void {
  isConfigured()
    .then((configured) => (configured ? call() : undefined))
    .catch(() => undefined);
}

/**
 * iOS only: RevenueCat computes trial and intro eligibility against the App
 * Store. Google Play hands an app only the offers the user can take, so on
 * Android there is nothing to ask.
 */
async function introEligibility(
  packages: PurchasesPackage[]
): Promise<Record<string, IntroEligibility>> {
  if (Platform.OS !== 'ios' || packages.length === 0) {
    return {};
  }
  try {
    return await Purchases.checkTrialOrIntroductoryPriceEligibility(
      packages.map((aPackage) => aPackage.product.identifier)
    );
  } catch {
    return {};
  }
}

// Purchase outcomes

/**
 * The result of a purchase RevenueCat refused with `error`.
 *
 * `PRODUCT_ALREADY_PURCHASED_ERROR` is how RevenueCat reports Google Play's
 * `ITEM_ALREADY_OWNED`: the store account already owns the product, e.g. a
 * subscriber who reached the paywall anyway. When RevenueCat confirms an
 * active entitlement (`ownedAccessRefs` not empty) the user already has what
 * they tapped for, so it is reported as purchased and the flow moves on,
 * instead of a generic error under the button. Without one (the purchase
 * belongs to another app user, or is not synced yet) it stays a failure.
 */
function purchaseFailure(
  error: unknown,
  productRef: string,
  ownedAccessRefs: string[] | null
): SetgreetPurchaseResult {
  const code = purchasesErrorCode(error);
  if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
    return { status: 'cancelled', productRef };
  }
  if (
    code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR &&
    ownedAccessRefs != null &&
    ownedAccessRefs.length > 0
  ) {
    return { status: 'purchased', productRef, accessRefs: ownedAccessRefs };
  }
  const normalized = normalizedError(error, 'purchase_failed');
  switch (normalized.code) {
    case 'purchase_cancelled':
      return { status: 'cancelled', productRef, error: normalized };
    case 'purchase_pending':
      return { status: 'pending', productRef, error: normalized };
    default:
      return { status: 'failed', productRef, error: normalized };
  }
}

/** The user's active entitlements as RevenueCat reports them now; null when it cannot say. */
async function activeAccessRefs(): Promise<string[] | null> {
  try {
    return accessRefs(await Purchases.getCustomerInfo());
  } catch {
    return null;
  }
}

function accessRefs(info: CustomerInfo): string[] {
  return Object.keys(info.entitlements.active).sort();
}

// Errors

/**
 * The `PURCHASES_ERROR_CODE` of a rejection from react-native-purchases,
 * which rejects with a `PurchasesError`; undefined for anything else.
 */
function purchasesErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return typeof error.code === 'string' ? error.code : undefined;
  }
  return undefined;
}

function errorMessage(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : null;
  }
  return typeof error === 'string' ? error : null;
}

/** RevenueCat's readable error name, e.g. `PurchaseCancelledError`; else its numeric code. */
function readableErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'userInfo' in error) {
    const userInfo = error.userInfo;
    if (
      typeof userInfo === 'object' &&
      userInfo !== null &&
      'readableErrorCode' in userInfo &&
      typeof userInfo.readableErrorCode === 'string' &&
      userInfo.readableErrorCode.length > 0
    ) {
      return userInfo.readableErrorCode;
    }
  }
  return purchasesErrorCode(error) ?? null;
}

/**
 * RevenueCat's `PURCHASES_ERROR_CODE` → the normalized code; the vendor's code
 * travels as `providerCode` for logs and analytics.
 */
function normalizedError(
  error: unknown,
  fallback: SetgreetPurchaseErrorCode
): SetgreetPurchaseError {
  let code: SetgreetPurchaseErrorCode;
  switch (purchasesErrorCode(error)) {
    case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR:
      code = 'purchase_cancelled';
      break;
    case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
      code = 'purchase_pending';
      break;
    case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
      code = 'product_unavailable';
      break;
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
    case PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR:
      code = 'network_error';
      break;
    case PURCHASES_ERROR_CODE.INVALID_APP_USER_ID_ERROR:
      code = 'identity_error';
      break;
    case PURCHASES_ERROR_CODE.CONFIGURATION_ERROR:
      code = 'not_configured';
      break;
    default:
      code = fallback;
  }
  return purchaseError(code, {
    providerCode: readableErrorCode(error),
    message: errorMessage(error),
  });
}

/** An error this file threw itself keeps its code; anything else is `unknown`. */
function asSetgreetError(error: unknown): SetgreetPurchaseError {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    isSetgreetPurchaseErrorCode(error.code)
  ) {
    const providerCode =
      'providerCode' in error && typeof error.providerCode === 'string'
        ? error.providerCode
        : null;
    return { code: error.code, providerCode, message: errorMessage(error) };
  }
  return normalizedError(error, 'unknown');
}

// Mapping

function toProduct(
  aPackage: PurchasesPackage,
  eligibility: IntroEligibility | undefined
): SetgreetPurchaseProduct {
  const product = aPackage.product;
  return {
    ref: aPackage.identifier,
    storeProductId: product.identifier,
    title: Platform.OS === 'android' ? playTitle(product.title) : product.title,
    description: product.description,
    localizedPrice: product.priceString,
    priceAmount: product.price,
    currencyCode: product.currencyCode,
    period: period(product.subscriptionPeriod),
    introOffer:
      Platform.OS === 'android'
        ? playIntroOffer(product)
        : appStoreIntroOffer(product, eligibility),
  };
}

/**
 * Google Play's product title carries the app name in a trailing
 * parenthesised group ("Premium (My App)"). The Kotlin reference uses Play's
 * `name` instead, which react-native-purchases does not expose, so that group
 * is dropped here: scanning back from the final ")" to its matching "(", so
 * parentheses inside the product name or the app name survive
 * ("Pro (Annual) (My App (Beta))" becomes "Pro (Annual)"). A title without a
 * balanced trailing group, or with nothing before it, is kept as is.
 */
function playTitle(title: string): string {
  const trimmed = title.trimEnd();
  if (!trimmed.endsWith(')')) {
    return title;
  }
  let depth = 0;
  for (let index = trimmed.length - 1; index >= 0; index -= 1) {
    const character = trimmed[index];
    if (character === ')') {
      depth += 1;
    } else if (character === '(') {
      depth -= 1;
      if (depth === 0) {
        const name = trimmed.slice(0, index).trimEnd();
        return name.length > 0 ? name : title;
      }
    }
  }
  return title;
}

const PERIOD_UNITS: Record<string, SetgreetPurchasePeriodUnit> = {
  D: 'day',
  W: 'week',
  M: 'month',
  Y: 'year',
};

/** `P1Y`, `P3M`, `P1W`, `P7D` (ISO 8601); null for a one-time product. */
function period(iso8601: string | null): SetgreetPurchasePeriod | null {
  const match = /^P(\d+)([DWMY])$/.exec(iso8601 ?? '');
  const count = Number(match?.[1]);
  const unit = PERIOD_UNITS[match?.[2] ?? ''];
  return unit && count > 0 ? { unit, count } : null;
}

/**
 * Android: the trial (else the intro price) of the option a package purchase
 * uses, its default option. Google Play returns only offers the current user
 * is eligible for, so an offer present here is one the user can take.
 */
function playIntroOffer(
  product: PurchasesStoreProduct
): SetgreetPurchaseIntroOffer | null {
  const option = product.defaultOption;
  const phase: PricingPhase | null =
    option?.freePhase ?? option?.introPhase ?? null;
  if (phase == null) {
    return null;
  }
  const type = playIntroType(phase.offerPaymentMode);
  if (type == null) {
    return null;
  }
  return {
    type,
    localizedPrice: phase.price.formatted,
    periodText: periodText(phase.billingPeriod.unit, phase.billingPeriod.value),
    eligible: true,
  };
}

/** null for a phase that is not an offer (the dashboard knows these three types only). */
function playIntroType(mode: OFFER_PAYMENT_MODE | null): string | null {
  switch (mode) {
    case OFFER_PAYMENT_MODE.FREE_TRIAL:
      return 'trial';
    case OFFER_PAYMENT_MODE.SINGLE_PAYMENT:
      return 'payUpFront';
    case OFFER_PAYMENT_MODE.DISCOUNTED_RECURRING_PAYMENT:
      return 'payAsYouGo';
    default:
      return null;
  }
}

/**
 * iOS: the App Store introductory offer. react-native-purchases reports its
 * price and cycles but not its payment mode, so a free price is a trial, more
 * than one cycle is pay-as-you-go, and one paid cycle is pay-up-front.
 */
function appStoreIntroOffer(
  product: PurchasesStoreProduct,
  eligibility: IntroEligibility | undefined
): SetgreetPurchaseIntroOffer | null {
  const intro = product.introPrice;
  if (intro == null) {
    return null;
  }
  let type = 'payUpFront';
  if (intro.price === 0) {
    type = 'trial';
  } else if (intro.cycles > 1) {
    type = 'payAsYouGo';
  }
  return {
    type,
    localizedPrice: intro.priceString,
    periodText: periodText(intro.periodUnit, intro.periodNumberOfUnits),
    eligible: eligible(eligibility),
  };
}

/**
 * null when RevenueCat could not determine eligibility; the SDK then shows no
 * trial text, which it derives only for a user reported as eligible.
 */
function eligible(eligibility: IntroEligibility | undefined): boolean | null {
  switch (eligibility?.status) {
    case INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE:
      return true;
    case INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE:
    case INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS:
      return false;
    default:
      return null;
  }
}

/** `7 days`, `1 week`: what the SDK turns into `7-day free trial`. */
function periodText(unit: string, value: number): string {
  const names: Record<string, string> = {
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month',
    YEAR: 'year',
  };
  const name = names[unit] ?? 'period';
  return `${value} ${name}${value === 1 ? '' : 's'}`;
}
