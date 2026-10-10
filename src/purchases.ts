/**
 * The JavaScript half of the purchase-provider bridge.
 *
 * `setPurchaseProvider` registers a native proxy provider with the native
 * SDK. Each call the native SDK makes on that proxy arrives here as a
 * `SetgreetPurchaseRequest` event `{ requestId, method, args }`; this module
 * runs the registered JS provider and answers with
 * `resolvePurchaseRequest(requestId, result, error)`. `trackPaywallImpression`
 * and `setAttributes` are fire-and-forget: they carry no `requestId` and get
 * no answer.
 *
 * Answers (`result`), per method:
 * - `loadProducts`: `{ products: SetgreetPurchaseProduct[] }`
 * - `purchase`: a `SetgreetPurchaseResult`
 * - `restorePurchases`: a `SetgreetRestoreResult`
 * - `accessState`: `{ accessState: SetgreetPurchaseAccessState | null }`
 * - `identify`, `reset`: `{}`
 *
 * A provider that rejects (or a request the provider cannot serve) answers
 * with `error: { code, providerCode, message }` instead; the native side
 * maps it per method (a thrown `loadProducts`, a `failed` purchase or
 * restore, a `null` access state). A `purchase` rejected with code
 * `purchase_cancelled` or `purchase_pending` answers as a `cancelled` or
 * `pending` result instead, as the native reference providers report them.
 *
 * Every answer is rebuilt from plain strings, numbers, booleans and string
 * arrays before it crosses to native, so no provider value can make the
 * answer itself fail and leave a purchase (which has no time limit) waiting.
 */
import { NativeEventEmitter } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import RNSetgreet from './NativeRNSetgreet';
import {
  SetgreetPurchaseSource,
  isSetgreetPurchaseErrorCode,
  purchaseError,
} from './purchaseTypes';
import type {
  SetPurchaseProviderOptions,
  SetgreetPaywallImpressionContext,
  SetgreetPurchaseError,
  SetgreetPurchaseProvider,
  SetgreetPurchaseSourceType,
} from './purchaseTypes';

/** The event the native proxy emits for every provider call. */
export const PURCHASE_REQUEST_EVENT = 'SetgreetPurchaseRequest';

/** What a provider id must look like; the backend rejects a catalog sync from any other id. */
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

type BridgeObject = { [key: string]: unknown };

type BridgeError = {
  code: SetgreetPurchaseError['code'];
  providerCode: string | null;
  message: string | null;
};

type PurchaseRequest = {
  requestId: string | null;
  method: string;
  args: BridgeObject;
};

let registeredProvider: SetgreetPurchaseProvider | null = null;
let requestSubscription: EmitterSubscription | null = null;

/**
 * Registers your purchase provider so paywall screens can load products,
 * transact and branch on the outcome. Call it once at startup, after
 * `initialize` and before `identifyUser` (whose call reaches the provider's
 * `identify` only once a provider is registered); a later call replaces the
 * provider.
 *
 * `options.defaultSource` (the current offering by default) is loaded in the
 * background right away, so the product catalog syncs to the dashboard
 * before any paywall is shown.
 *
 * ```ts
 * setPurchaseProvider(new SetgreetRevenueCatProvider());
 * setPurchaseProvider(provider, {
 *   defaultSource: SetgreetPurchaseSource.offering('onboarding'),
 * });
 * ```
 */
export function setPurchaseProvider(
  provider: SetgreetPurchaseProvider,
  options?: SetPurchaseProviderOptions
): void {
  if (
    provider == null ||
    typeof provider.providerId !== 'string' ||
    !PROVIDER_ID_PATTERN.test(provider.providerId)
  ) {
    throw new TypeError(
      'setPurchaseProvider: `providerId` must match ^[a-z][a-z0-9_]{0,39}$ ' +
        '(e.g. "revenuecat")'
    );
  }
  registeredProvider = provider;
  // Subscribed before the native registration: the native proxy fails fast
  // while nothing listens for its requests.
  ensureRequestSubscription();
  const source = readSource(
    options?.defaultSource ?? SetgreetPurchaseSource.currentOffering
  );
  RNSetgreet.setPurchaseProvider(provider.providerId, {
    sourceType: source.sourceType,
    sourceId: source.sourceId ?? null,
  });
}

function ensureRequestSubscription(): void {
  if (requestSubscription != null) {
    return;
  }
  const emitter = new NativeEventEmitter(RNSetgreet);
  requestSubscription = emitter.addListener(
    PURCHASE_REQUEST_EVENT,
    (event: unknown) => {
      handlePurchaseRequest(event).catch(ignoreError);
    }
  );
}

async function handlePurchaseRequest(event: unknown): Promise<void> {
  const request = readRequest(event);
  if (request == null) {
    return;
  }
  const provider = registeredProvider;

  // Fire-and-forget: the native side waits for nothing.
  if (request.method === 'trackPaywallImpression') {
    if (typeof provider?.trackPaywallImpression === 'function') {
      const context = readImpressionContext(request.args.context);
      runQuietly(() => provider.trackPaywallImpression?.(context));
    }
    return;
  }
  if (request.method === 'setAttributes') {
    if (typeof provider?.setAttributes === 'function') {
      const attributes = readAttributes(request.args.attributes);
      runQuietly(() => provider.setAttributes?.(attributes));
    }
    return;
  }

  const requestId = request.requestId;
  if (requestId == null) {
    return;
  }
  let result: BridgeObject;
  try {
    result = await answer(provider, request);
  } catch (thrown) {
    RNSetgreet.resolvePurchaseRequest(requestId, null, toBridgeError(thrown));
    return;
  }
  try {
    RNSetgreet.resolvePurchaseRequest(requestId, result, null);
  } catch (thrown) {
    // The answer could not cross to native: answer with the error instead,
    // so the waiting call (a purchase has no time limit) still settles.
    RNSetgreet.resolvePurchaseRequest(requestId, null, toBridgeError(thrown));
  }
}

/** Runs a request/response call and serializes its answer. Throws on failure. */
async function answer(
  provider: SetgreetPurchaseProvider | null,
  request: PurchaseRequest
): Promise<BridgeObject> {
  if (provider == null) {
    throw purchaseError('not_configured', {
      message: 'No JavaScript purchase provider is registered',
    });
  }
  const { method, args } = request;
  switch (method) {
    case 'loadProducts': {
      requireMethod(provider, 'loadProducts');
      const products: unknown = await provider.loadProducts(
        readSource(args.source)
      );
      if (!Array.isArray(products)) {
        throw purchaseError('unknown', {
          message: 'loadProducts() must resolve to an array of products',
        });
      }
      return { products: products.filter(isObject).map(toBridgeProduct) };
    }
    case 'purchase': {
      requireMethod(provider, 'purchase');
      const productRef =
        typeof args.productRef === 'string' ? args.productRef : '';
      let result: unknown;
      try {
        result = await provider.purchase(productRef, readSource(args.source));
      } catch (thrown) {
        const error = toBridgeError(thrown);
        if (error.code === 'purchase_cancelled') {
          return { status: 'cancelled', productRef, accessRefs: [], error };
        }
        if (error.code === 'purchase_pending') {
          return { status: 'pending', productRef, accessRefs: [], error };
        }
        throw thrown;
      }
      if (!isObject(result)) {
        throw purchaseError('unknown', {
          message: 'purchase() resolved without a result',
        });
      }
      return toBridgePurchaseResult(result, productRef);
    }
    case 'restorePurchases': {
      requireMethod(provider, 'restorePurchases');
      const result: unknown = await provider.restorePurchases();
      if (!isObject(result)) {
        throw purchaseError('unknown', {
          message: 'restorePurchases() resolved without a result',
        });
      }
      return toBridgeRestoreResult(result);
    }
    case 'accessState': {
      requireMethod(provider, 'accessState');
      const state: unknown = await provider.accessState();
      return {
        accessState: isObject(state) ? toBridgeAccessState(state) : null,
      };
    }
    case 'identify': {
      if (typeof provider.identify === 'function') {
        const userId = typeof args.userId === 'string' ? args.userId : '';
        await provider.identify(userId);
      }
      return {};
    }
    case 'reset': {
      if (typeof provider.reset === 'function') {
        await provider.reset();
      }
      return {};
    }
    default:
      throw purchaseError('unknown', {
        message: `Unknown purchase request method: ${method}`,
      });
  }
}

function requireMethod(
  provider: SetgreetPurchaseProvider,
  name: 'loadProducts' | 'purchase' | 'restorePurchases' | 'accessState'
): void {
  if (typeof provider[name] !== 'function') {
    throw purchaseError('not_configured', {
      message: `The purchase provider does not implement ${name}()`,
    });
  }
}

// ============================================
// Reading native requests
// ============================================

function readRequest(event: unknown): PurchaseRequest | null {
  if (!isObject(event) || typeof event.method !== 'string') {
    return null;
  }
  return {
    requestId:
      typeof event.requestId === 'string' && event.requestId.length > 0
        ? event.requestId
        : null,
    method: event.method,
    args: isObject(event.args) ? event.args : {},
  };
}

const SOURCE_TYPES: ReadonlySet<string> = new Set<SetgreetPurchaseSourceType>([
  'current_offering',
  'offering',
  'placement',
]);

function isSourceType(value: unknown): value is SetgreetPurchaseSourceType {
  return typeof value === 'string' && SOURCE_TYPES.has(value);
}

/** An unknown source type reads as the current offering, as the native SDKs default it. */
function readSource(value: unknown): SetgreetPurchaseSource {
  if (!isObject(value) || !isSourceType(value.sourceType)) {
    return { sourceType: 'current_offering', sourceId: null };
  }
  return {
    sourceType: value.sourceType,
    sourceId: typeof value.sourceId === 'string' ? value.sourceId : null,
  };
}

function readImpressionContext(
  value: unknown
): SetgreetPaywallImpressionContext {
  const context = isObject(value) ? value : {};
  return {
    flowId: typeof context.flowId === 'string' ? context.flowId : '',
    screenId: typeof context.screenId === 'string' ? context.screenId : '',
    source: readSource(context.source),
    productRefs: readStrings(context.productRefs),
  };
}

function readAttributes(value: unknown): Record<string, string> {
  const attributes: Record<string, string> = {};
  if (isObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === 'string') {
        attributes[key] = entry;
      }
    }
  }
  return attributes;
}

// ============================================
// Writing answers (validated again on the native side)
// ============================================

function toBridgeProduct(product: BridgeObject): BridgeObject {
  const period = isObject(product.period) ? product.period : null;
  const introOffer = isObject(product.introOffer) ? product.introOffer : null;
  return {
    ref: bridgeString(product.ref),
    storeProductId: bridgeString(product.storeProductId),
    title: bridgeString(product.title),
    description: bridgeString(product.description),
    localizedPrice: bridgeString(product.localizedPrice),
    priceAmount: bridgePrice(product.priceAmount),
    currencyCode: bridgeString(product.currencyCode),
    period:
      period == null
        ? null
        : {
            unit: bridgeString(period.unit),
            count: bridgeNumber(period.count),
          },
    introOffer:
      introOffer == null
        ? null
        : {
            type: bridgeString(introOffer.type),
            localizedPrice: bridgeString(introOffer.localizedPrice),
            periodText: bridgeString(introOffer.periodText),
            eligible: bridgeBoolean(introOffer.eligible),
          },
  };
}

function toBridgePurchaseResult(
  result: BridgeObject,
  requestedRef: string
): BridgeObject {
  return {
    status: bridgeString(result.status),
    productRef:
      typeof result.productRef === 'string' ? result.productRef : requestedRef,
    accessRefs: readStrings(result.accessRefs),
    error: isObject(result.error) ? toBridgeError(result.error) : null,
  };
}

function toBridgeRestoreResult(result: BridgeObject): BridgeObject {
  return {
    status: bridgeString(result.status),
    accessRefs: readStrings(result.accessRefs),
    error: isObject(result.error) ? toBridgeError(result.error) : null,
  };
}

function toBridgeAccessState(state: BridgeObject): BridgeObject {
  const accessRefs = readStrings(state.accessRefs);
  return {
    active:
      typeof state.active === 'boolean' ? state.active : accessRefs.length > 0,
    accessRefs,
  };
}

/**
 * Any thrown value or result error as a normalized error: `code` is kept
 * when it is a {@link SetgreetPurchaseError} code, else `'unknown'`.
 */
function toBridgeError(value: unknown): BridgeError {
  if (isObject(value)) {
    return {
      code: isSetgreetPurchaseErrorCode(value.code) ? value.code : 'unknown',
      providerCode: bridgeCode(value.providerCode),
      message: bridgeString(value.message),
    };
  }
  return {
    code: 'unknown',
    providerCode: null,
    message: typeof value === 'string' ? value : null,
  };
}

// ============================================
// Helpers
// ============================================

function isObject(value: unknown): value is BridgeObject {
  return typeof value === 'object' && value !== null;
}

function bridgeString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function bridgeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function bridgeBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/** A finite number, or a numeric string the native side parses; anything else is dropped. */
function bridgePrice(value: unknown): number | string | null {
  if (typeof value === 'bigint') {
    return String(value);
  }
  return typeof value === 'string' ? value : bridgeNumber(value);
}

/** A vendor code as a string: `5` and `'5'` both cross as `'5'`. */
function bridgeCode(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (
    (typeof value === 'number' && Number.isFinite(value)) ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return null;
}

function readStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

/** Calls a fire-and-forget provider method; nothing it throws or rejects escapes. */
function runQuietly(call: () => unknown): void {
  try {
    const returned = call();
    if (isObject(returned) && typeof returned.then === 'function') {
      Promise.resolve(returned).catch(ignoreError);
    }
  } catch {
    // A fire-and-forget call has nobody to report to.
  }
}

function ignoreError(): void {}
