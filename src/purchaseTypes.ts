/**
 * The host-implemented purchase interface behind native paywalls.
 *
 * Setgreet wraps no vendor SDK and keeps no entitlement state: your app
 * implements {@link SetgreetPurchaseProvider} on top of whatever it already
 * uses (RevenueCat, Adapty, StoreKit, Play Billing, ...) and registers one
 * object with `setPurchaseProvider`. The native SDK then owns the loading
 * state, the plan picker, live price tokens, the purchase lock, branching on
 * the result, analytics and the catalog sync.
 *
 * The names mirror the iOS (`SetgreetPurchaseProvider.swift`) and Android
 * (`SetgreetPurchaseProvider.kt`) interfaces one to one, with a `Promise`
 * wherever they are `async` / `suspend`.
 */

// ============================================
// Source
// ============================================

/** Where a paywall's products come from, in the provider's own vocabulary. */
export type SetgreetPurchaseSourceType =
  | 'current_offering'
  | 'offering'
  | 'placement';

/**
 * A product source. `sourceId` names the offering or placement, and is
 * required for `'offering'` and `'placement'`; it is null for the current
 * offering. Build one with {@link SetgreetPurchaseSource}.
 */
export type SetgreetPurchaseSource = {
  sourceType: SetgreetPurchaseSourceType;
  sourceId?: string | null;
};

/**
 * Builders for {@link SetgreetPurchaseSource}, named like the native ones:
 *
 * ```ts
 * SetgreetPurchaseSource.currentOffering; // the default source
 * SetgreetPurchaseSource.offering('onboarding');
 * SetgreetPurchaseSource.placement('paywall_main');
 * ```
 */
export const SetgreetPurchaseSource: {
  /** The provider's current offering (the default source). */
  readonly currentOffering: SetgreetPurchaseSource;
  /** A specific offering by identifier. */
  offering(identifier: string): SetgreetPurchaseSource;
  /** The offering a placement resolves to. */
  placement(identifier: string): SetgreetPurchaseSource;
} = Object.freeze({
  currentOffering: Object.freeze({
    sourceType: 'current_offering' as const,
    sourceId: null,
  }),
  offering: (identifier: string): SetgreetPurchaseSource => ({
    sourceType: 'offering',
    sourceId: identifier,
  }),
  placement: (identifier: string): SetgreetPurchaseSource => ({
    sourceType: 'placement',
    sourceId: identifier,
  }),
});

// ============================================
// Product
// ============================================

/** Units a subscription period is expressed in. */
export type SetgreetPurchasePeriodUnit = 'day' | 'week' | 'month' | 'year';

/**
 * How often a subscription renews. A product without a period is a one-time
 * (lifetime) purchase.
 */
export type SetgreetPurchasePeriod = {
  unit: SetgreetPurchasePeriodUnit;
  count: number;
};

/** An introductory offer attached to a product. */
export type SetgreetPurchaseIntroOffer = {
  /**
   * `'trial'` for a free trial. The SDK derives `trialText` from trials
   * only; other values (`'payAsYouGo'`, `'payUpFront'`) pass through to the
   * catalog sync untouched.
   */
  type: string;
  /** The offer's localized price, when it has one. */
  localizedPrice?: string | null;
  /** The offer's length as the provider formats it, e.g. `'7 days'`. */
  periodText?: string | null;
  /**
   * Whether this user is eligible; null when the provider cannot say. The
   * SDK derives `trialText` only when this is `true`.
   */
  eligible?: boolean | null;
};

/** One purchasable product, normalized from the provider's own model. */
export type SetgreetPurchaseProduct = {
  /**
   * The provider-side stable reference a flow refers to: a RevenueCat
   * package identifier (`$rc_annual`), an Adapty `vendorProductId`, a store
   * product id. Unique within its source only: `$rc_annual` exists in every
   * RevenueCat offering, so a ref names a product together with its source.
   */
  ref: string;
  /** The App Store / Google Play product identifier. */
  storeProductId: string;
  title?: string | null;
  description?: string | null;
  /** The price as the store formats it for this user, e.g. `'$49.99'`. */
  localizedPrice: string;
  /** The price as a number, e.g. `49.99`. */
  priceAmount: number;
  /** ISO 4217 code, e.g. `'USD'`. */
  currencyCode: string;
  /** null for a one-time purchase. */
  period?: SetgreetPurchasePeriod | null;
  introOffer?: SetgreetPurchaseIntroOffer | null;
};

// ============================================
// Errors
// ============================================

/** Normalized error codes. The value is what analytics carry as `errorCode`. */
export type SetgreetPurchaseErrorCode =
  | 'not_configured'
  | 'provider_not_initialized'
  | 'product_not_found'
  | 'product_unavailable'
  | 'purchase_cancelled'
  | 'purchase_failed'
  | 'purchase_pending'
  | 'restore_failed'
  | 'network_error'
  | 'identity_error'
  | 'unknown';

const PURCHASE_ERROR_CODES: ReadonlySet<string> = new Set<string>([
  'not_configured',
  'provider_not_initialized',
  'product_not_found',
  'product_unavailable',
  'purchase_cancelled',
  'purchase_failed',
  'purchase_pending',
  'restore_failed',
  'network_error',
  'identity_error',
  'unknown',
]);

/** Whether `value` is one of the {@link SetgreetPurchaseErrorCode} values. */
export function isSetgreetPurchaseErrorCode(
  value: unknown
): value is SetgreetPurchaseErrorCode {
  return typeof value === 'string' && PURCHASE_ERROR_CODES.has(value);
}

/** A normalized purchase error. */
export type SetgreetPurchaseError = {
  code: SetgreetPurchaseErrorCode;
  /** The vendor's own code, for your logs and analytics. */
  providerCode?: string | null;
  /** The vendor's message. Shown to end users only in `debugMode`. */
  message?: string | null;
};

/**
 * Builds a throwable {@link SetgreetPurchaseError}: an `Error` that carries
 * `code` and `providerCode`. Throw it from `loadProducts` (any other thrown
 * value is reported as `'unknown'`), or put it in a result's `error`.
 *
 * ```ts
 * throw purchaseError('provider_not_initialized', {
 *   message: 'Purchases.configure() has not been called',
 * });
 * ```
 */
export function purchaseError(
  code: SetgreetPurchaseErrorCode,
  options?: { providerCode?: string | null; message?: string | null }
): Error & SetgreetPurchaseError {
  const error = new Error(options?.message ?? code) as Error &
    SetgreetPurchaseError;
  error.name = 'SetgreetPurchaseError';
  error.code = code;
  error.providerCode = options?.providerCode ?? null;
  return error;
}

// ============================================
// Results
// ============================================

/**
 * The outcome of `purchase`. The value is the Response Split value the SDK
 * sets on the button.
 */
export type SetgreetPurchaseStatus =
  | 'purchased'
  | 'cancelled'
  | 'failed'
  | 'pending';

export type SetgreetPurchaseResult = {
  status: SetgreetPurchaseStatus;
  productRef: string;
  /** The access (entitlement) refs the user now holds. Defaults to `[]`. */
  accessRefs?: string[];
  error?: SetgreetPurchaseError | null;
};

/**
 * The outcome of `restorePurchases`. The value is the Response Split value
 * the SDK sets on the button.
 */
export type SetgreetRestoreStatus = 'restored' | 'nothingToRestore' | 'failed';

export type SetgreetRestoreResult = {
  status: SetgreetRestoreStatus;
  /** The access (entitlement) refs the user now holds. Defaults to `[]`. */
  accessRefs?: string[];
  error?: SetgreetPurchaseError | null;
};

/** What the user currently has access to, as the provider reports it. */
export type SetgreetPurchaseAccessState = {
  active: boolean;
  accessRefs: string[];
};

// ============================================
// Impression
// ============================================

/** What the SDK reports when a paywall screen has rendered its catalog. */
export type SetgreetPaywallImpressionContext = {
  flowId: string;
  screenId: string;
  /** The screen's first source: its first plan picker's, else the default source. */
  source: SetgreetPurchaseSource;
  /**
   * The refs rendered on the screen, unique: the plan pickers' options in
   * tree order, then fixed purchase-button refs, then refs quoted by
   * `{{purchase.<ref>.*}}` tokens. Only refs the catalog has.
   */
  productRefs: string[];
};

// ============================================
// Provider
// ============================================

/**
 * Implemented by your app on top of its own purchase tool and registered
 * with `setPurchaseProvider`.
 *
 * Every method is called by the SDK, never by the dashboard:
 * - `loadProducts` when a paywall screen becomes current, and once at
 *   registration for the default source. Reject with a
 *   {@link SetgreetPurchaseError} (see {@link purchaseError}) when the
 *   products cannot be loaded.
 * - `purchase` and `restorePurchases` on a button tap. Report the outcome as
 *   a status. A rejection is reported as `'failed'`, except a `purchase`
 *   rejected with code `'purchase_cancelled'` or `'purchase_pending'`, which
 *   is reported as `'cancelled'` or `'pending'`.
 * - `accessState` when a paywall that skips users with access becomes
 *   current, after a catalog load and after purchase and restore outcomes.
 *   `null` means the provider cannot say (a rejection counts as `null`).
 * - `trackPaywallImpression` once per paywall screen per flow session.
 * - `setAttributes` right before a purchase (`setgreet_flow`, `setgreet_screen`).
 * - `identify` and `reset` are optional; implement them only when Setgreet's
 *   `identifyUser` / `resetUser` should drive the vendor identity. The SDK
 *   calls them one at a time, in call order, and waits for each without a
 *   time limit.
 *
 * Time limits: when a paywall loads, the native SDK waits up to 10 seconds
 * for `loadProducts` (then the screen follows its unavailable policy) and
 * for `accessState` (then it counts as "cannot say" and the paywall is
 * shown). The bridge itself gives `loadProducts` and `accessState` at most
 * 30 seconds wherever the SDK sets no limit of its own. `purchase` and
 * `restorePurchases` have no time limit (a store sheet can stay open for
 * minutes).
 */
export interface SetgreetPurchaseProvider {
  /**
   * `'revenuecat'`, `'adapty'`, `'storekit'`, ... Must match
   * `^[a-z][a-z0-9_]{0,39}$`: the backend rejects a catalog sync from any
   * other id.
   */
  readonly providerId: string;

  /** The products of `source`, in the provider's order. */
  loadProducts(
    source: SetgreetPurchaseSource
  ): Promise<SetgreetPurchaseProduct[]>;

  /**
   * Buys the product `productRef` names in `source`. A ref is only unique
   * within its source (`$rc_annual` exists in every RevenueCat offering):
   * buy the product this provider returned for that ref from
   * `loadProducts(source)`, never a product of the same ref from another
   * source.
   */
  purchase(
    productRef: string,
    source: SetgreetPurchaseSource
  ): Promise<SetgreetPurchaseResult>;

  /** Restores earlier purchases. */
  restorePurchases(): Promise<SetgreetRestoreResult>;

  /**
   * What the user has access to right now; `null` when the provider cannot
   * say. Answer for the current user only.
   */
  accessState(): Promise<SetgreetPurchaseAccessState | null>;

  /** A paywall screen rendered its catalog. Keep it quick. */
  trackPaywallImpression?(context: SetgreetPaywallImpressionContext): void;

  /** Attribution attributes for the provider. Keep it quick. */
  setAttributes?(attributes: Record<string, string>): void;

  /** Setgreet's `identifyUser` was called. Optional. */
  identify?(userId: string): Promise<void>;

  /** Setgreet's `resetUser` was called. Optional. */
  reset?(): Promise<void>;
}

/** Options for `setPurchaseProvider`. */
export type SetPurchaseProviderOptions = {
  /**
   * The source a paywall screen reads when it has no plan picker, and,
   * after its pickers' sources, where a fixed product ref or a
   * `{{purchase.<ref>.*}}` token is looked up. It is loaded in the
   * background at registration and is the only source whose catalog is
   * synced to the dashboard. Defaults to the current offering.
   */
  defaultSource?: SetgreetPurchaseSource;
};
