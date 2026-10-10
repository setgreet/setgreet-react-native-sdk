package com.setgreet.reactnative

import android.app.Activity
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.setgreet.purchases.SetgreetPaywallImpressionContext
import com.setgreet.purchases.SetgreetPurchaseAccessState
import com.setgreet.purchases.SetgreetPurchaseError
import com.setgreet.purchases.SetgreetPurchaseErrorCode
import com.setgreet.purchases.SetgreetPurchaseIntroOffer
import com.setgreet.purchases.SetgreetPurchasePeriod
import com.setgreet.purchases.SetgreetPurchasePeriodUnit
import com.setgreet.purchases.SetgreetPurchaseProduct
import com.setgreet.purchases.SetgreetPurchaseProvider
import com.setgreet.purchases.SetgreetPurchaseResult
import com.setgreet.purchases.SetgreetPurchaseSource
import com.setgreet.purchases.SetgreetPurchaseStatus
import com.setgreet.purchases.SetgreetRestoreResult
import com.setgreet.purchases.SetgreetRestoreStatus
import java.lang.ref.WeakReference
import java.math.BigDecimal
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

/*
 * The native half of the purchase-provider bridge.
 *
 * [RNSetgreetPurchaseProvider] is the `SetgreetPurchaseProvider` the wrapper
 * registers with the native SDK when JS calls `setPurchaseProvider`. Each call
 * the SDK makes on it becomes a `SetgreetPurchaseRequest` event
 * `{ requestId, method, args }`; JS runs the registered JS provider and answers
 * with `resolvePurchaseRequest(requestId, result, error)`, which resumes the
 * waiting call exactly once. `trackPaywallImpression` and `setAttributes` are
 * fire-and-forget (no `requestId`, no answer).
 *
 * No JS to answer (the JS context was torn down, or nothing listens for the
 * request event) fails a call at once: `loadProducts` throws, `purchase` and
 * `restorePurchases` report `FAILED` (`NOT_CONFIGURED`), `accessState` is null
 * and `identify` / `reset` return.
 *
 * The native SDK keeps the registered provider (and so this bridge) for the
 * life of the process, across JS reloads. The bridge therefore holds its
 * [Sender] (the module) weakly and drops it on [invalidate], so an old React
 * context is never kept alive by it.
 *
 * Only Kotlin's own coroutine primitives are used: kotlinx-coroutines is not on
 * this module's compile classpath (the native SDK ships it at runtime only).
 */
internal class RNSetgreetPurchaseBridge {

  /** The module side: whether JS can be reached, and how to emit a request. */
  interface Sender {
    /** Whether JS listens for the module's events and the React instance is alive. */
    fun canReachJs(): Boolean

    /** Emits a `SetgreetPurchaseRequest` event; false when it could not be sent. */
    fun emitRequest(body: WritableMap): Boolean
  }

  sealed class Answer {
    class Result(val values: Map<String, Any?>) : Answer()
    class Failure(val error: SetgreetPurchaseError) : Answer()
    object Unavailable : Answer()
    object TimedOut : Answer()
  }

  private val pending = ConcurrentHashMap<String, Continuation<Answer>>()
  private val timeouts = ConcurrentHashMap<String, Runnable>()
  private val handler = Handler(Looper.getMainLooper())

  @Volatile
  private var invalidated = false

  @Volatile
  private var sender: WeakReference<Sender>? = null

  /** The module that emits the requests. Held weakly; replaced by a later registration. */
  fun attach(sender: Sender) {
    this.sender = WeakReference(sender)
  }

  /** The attached sender, while it can reach JS. */
  private fun reachableSender(): Sender? =
    sender?.get()?.takeIf { !invalidated && it.canReachJs() }

  /**
   * Sends a request and suspends until JS answers, or until [timeoutMs] when
   * set. Never throws; the caller maps the [Answer].
   */
  suspend fun request(method: String, args: WritableMap, timeoutMs: Long?): Answer =
    suspendCoroutine { continuation ->
      val target = reachableSender()
      if (target == null) {
        continuation.resume(Answer.Unavailable)
        return@suspendCoroutine
      }
      val requestId = UUID.randomUUID().toString()
      pending[requestId] = continuation
      if (timeoutMs != null) {
        val timeout = Runnable { settle(requestId, Answer.TimedOut) }
        timeouts[requestId] = timeout
        handler.postDelayed(timeout, timeoutMs)
      }
      // Re-checked after the entry is in: an invalidate() that ran meanwhile
      // swept the map before this request was in it.
      if (invalidated || !target.emitRequest(requestBody(requestId, method, args))) {
        settle(requestId, Answer.Unavailable)
      }
    }

  /** Sends a fire-and-forget request; dropped when no JS listens. */
  fun notify(method: String, args: WritableMap) {
    reachableSender()?.emitRequest(requestBody(null, method, args))
  }

  /**
   * JS answered [requestId]. An unknown or already settled id is ignored (a
   * late answer after a timeout).
   */
  fun resolve(requestId: String, result: Map<String, Any?>?, error: Map<String, Any?>?) {
    val answer = if (error != null) {
      Answer.Failure(RNSetgreetPurchaseCoding.decodeError(error))
    } else {
      Answer.Result(result ?: emptyMap())
    }
    settle(requestId, answer)
  }

  /** The JS context is going away: every waiting call fails now, and every later one at once. */
  fun invalidate() {
    invalidated = true
    sender = null
    pending.keys.toList().forEach { settle(it, Answer.Unavailable) }
  }

  private fun settle(requestId: String, answer: Answer) {
    val continuation = pending.remove(requestId) ?: return
    timeouts.remove(requestId)?.let { handler.removeCallbacks(it) }
    continuation.resume(answer)
  }

  private fun requestBody(requestId: String?, method: String, args: WritableMap): WritableMap =
    Arguments.createMap().apply {
      if (requestId != null) putString("requestId", requestId) else putNull("requestId")
      putString("method", method)
      putMap("args", args)
    }

  companion object {
    const val REQUEST_EVENT_NAME = "SetgreetPurchaseRequest"

    /**
     * The safety net for `loadProducts` and `accessState`: longer than the
     * native SDK's own 10 s timeout, so that one governs wherever the SDK sets
     * it, and a JS promise that never settles is not waited on forever. The
     * other calls get none: a store sheet can stay open for minutes, and the
     * SDK runs `identify` / `reset` one after another, so ending one early
     * would let the next one run alongside it. Teardown still ends them.
     */
    const val SAFETY_TIMEOUT_MS = 30_000L

    /**
     * No JS provider can answer (none listening, JS torn down or reloading).
     * Reported as `NOT_CONFIGURED` rather than `UNKNOWN`, so the error code says
     * the provider was unavailable; the SDK still records a failed purchase.
     */
    fun unavailableError() = SetgreetPurchaseError(
      code = SetgreetPurchaseErrorCode.NOT_CONFIGURED,
      message = "The JavaScript purchase provider is unavailable"
    )

    fun timeoutError(method: String) = SetgreetPurchaseError(
      code = SetgreetPurchaseErrorCode.NETWORK_ERROR,
      providerCode = "timeout",
      message = "The JavaScript provider's $method did not answer within ${SAFETY_TIMEOUT_MS / 1000}s"
    )
  }
}

/**
 * The provider registered with the native SDK: every call is forwarded to the
 * JS provider through [bridge]. The SDK calls it on the main thread; nothing
 * here blocks it (the calls suspend).
 */
internal class RNSetgreetPurchaseProvider(
  override val providerId: String,
  private val bridge: RNSetgreetPurchaseBridge
) : SetgreetPurchaseProvider {

  override suspend fun loadProducts(source: SetgreetPurchaseSource): List<SetgreetPurchaseProduct> {
    val args = Arguments.createMap().apply { putMap("source", RNSetgreetPurchaseCoding.encode(source)) }
    return when (val answer = bridge.request("loadProducts", args, RNSetgreetPurchaseBridge.SAFETY_TIMEOUT_MS)) {
      is RNSetgreetPurchaseBridge.Answer.Result -> RNSetgreetPurchaseCoding.products(answer.values["products"])
      is RNSetgreetPurchaseBridge.Answer.Failure -> throw answer.error
      RNSetgreetPurchaseBridge.Answer.Unavailable -> throw RNSetgreetPurchaseBridge.unavailableError()
      RNSetgreetPurchaseBridge.Answer.TimedOut -> throw RNSetgreetPurchaseBridge.timeoutError("loadProducts")
    }
  }

  // The Activity stays native: a JS provider reaches the store through its own
  // native module.
  override suspend fun purchase(
    activity: Activity,
    productRef: String,
    source: SetgreetPurchaseSource
  ): SetgreetPurchaseResult {
    val args = Arguments.createMap().apply {
      putString("productRef", productRef)
      putMap("source", RNSetgreetPurchaseCoding.encode(source))
    }
    return when (val answer = bridge.request("purchase", args, timeoutMs = null)) {
      is RNSetgreetPurchaseBridge.Answer.Result -> RNSetgreetPurchaseCoding.purchaseResult(answer.values, productRef)
      is RNSetgreetPurchaseBridge.Answer.Failure ->
        SetgreetPurchaseResult(SetgreetPurchaseStatus.FAILED, productRef, error = answer.error)
      RNSetgreetPurchaseBridge.Answer.Unavailable, RNSetgreetPurchaseBridge.Answer.TimedOut ->
        SetgreetPurchaseResult(SetgreetPurchaseStatus.FAILED, productRef, error = RNSetgreetPurchaseBridge.unavailableError())
    }
  }

  override suspend fun restorePurchases(): SetgreetRestoreResult =
    when (val answer = bridge.request("restorePurchases", Arguments.createMap(), timeoutMs = null)) {
      is RNSetgreetPurchaseBridge.Answer.Result -> RNSetgreetPurchaseCoding.restoreResult(answer.values)
      is RNSetgreetPurchaseBridge.Answer.Failure ->
        SetgreetRestoreResult(SetgreetRestoreStatus.FAILED, error = answer.error)
      RNSetgreetPurchaseBridge.Answer.Unavailable, RNSetgreetPurchaseBridge.Answer.TimedOut ->
        SetgreetRestoreResult(SetgreetRestoreStatus.FAILED, error = RNSetgreetPurchaseBridge.unavailableError())
    }

  override suspend fun accessState(): SetgreetPurchaseAccessState? {
    val answer = bridge.request("accessState", Arguments.createMap(), RNSetgreetPurchaseBridge.SAFETY_TIMEOUT_MS)
    return if (answer is RNSetgreetPurchaseBridge.Answer.Result) {
      RNSetgreetPurchaseCoding.accessState(answer.values["accessState"])
    } else {
      null
    }
  }

  override fun trackPaywallImpression(context: SetgreetPaywallImpressionContext) {
    val args = Arguments.createMap().apply { putMap("context", RNSetgreetPurchaseCoding.encode(context)) }
    bridge.notify("trackPaywallImpression", args)
  }

  override fun setAttributes(attributes: Map<String, String>) {
    val args = Arguments.createMap().apply {
      putMap("attributes", Arguments.createMap().apply { attributes.forEach { (key, value) -> putString(key, value) } })
    }
    bridge.notify("setAttributes", args)
  }

  // No time limit: the SDK runs `identify` / `reset` one after another.
  override suspend fun identify(userId: String) {
    val args = Arguments.createMap().apply { putString("userId", userId) }
    bridge.request("identify", args, timeoutMs = null)
  }

  override suspend fun reset() {
    bridge.request("reset", Arguments.createMap(), timeoutMs = null)
  }
}

/**
 * Converts between the native purchase models and the JS bridge values. What
 * JS sends (read through `ReadableMap.toHashMap()`: numbers are `Double`,
 * objects `Map`, arrays `List`) is validated defensively: a product without a
 * `ref` or a numeric `priceAmount` is dropped, an unknown status is `FAILED`,
 * an unknown error code is `UNKNOWN`, a missing array is empty.
 */
internal object RNSetgreetPurchaseCoding {

  // Native → JS

  fun encode(source: SetgreetPurchaseSource): WritableMap = Arguments.createMap().apply {
    putString("sourceType", source.sourceType)
    val sourceId = source.sourceId
    if (sourceId != null) putString("sourceId", sourceId) else putNull("sourceId")
  }

  fun encode(context: SetgreetPaywallImpressionContext): WritableMap = Arguments.createMap().apply {
    putString("flowId", context.flowId)
    putString("screenId", context.screenId)
    putMap("source", encode(context.source))
    putArray("productRefs", Arguments.createArray().apply { context.productRefs.forEach { pushString(it) } })
  }

  fun encode(error: SetgreetPurchaseError): WritableMap = Arguments.createMap().apply {
    putString("code", error.code.rawValue)
    val providerCode = error.providerCode
    if (providerCode != null) putString("providerCode", providerCode) else putNull("providerCode")
    val message = error.message
    if (message != null) putString("message", message) else putNull("message")
  }

  // JS → native

  fun source(values: Map<String, Any?>?): SetgreetPurchaseSource {
    val sourceType = nonEmptyString(values?.get("sourceType"))
      ?: SetgreetPurchaseSource.currentOffering.sourceType
    return SetgreetPurchaseSource(sourceType, nonEmptyString(values?.get("sourceId")))
  }

  fun products(value: Any?): List<SetgreetPurchaseProduct> =
    (value as? List<*>)?.mapNotNull { product(it) } ?: emptyList()

  fun product(value: Any?): SetgreetPurchaseProduct? {
    val product = value as? Map<*, *> ?: return null
    val ref = nonEmptyString(product["ref"]) ?: return null
    val priceAmount = decimal(product["priceAmount"]) ?: return null
    return SetgreetPurchaseProduct(
      ref = ref,
      storeProductId = product["storeProductId"] as? String ?: "",
      title = product["title"] as? String,
      description = product["description"] as? String,
      localizedPrice = product["localizedPrice"] as? String ?: "",
      priceAmount = priceAmount,
      currencyCode = product["currencyCode"] as? String ?: "",
      period = period(product["period"]),
      introOffer = introOffer(product["introOffer"])
    )
  }

  fun purchaseResult(values: Map<String, Any?>, requestedRef: String): SetgreetPurchaseResult {
    val productRef = nonEmptyString(values["productRef"]) ?: requestedRef
    val accessRefs = strings(values["accessRefs"])
    val error = (values["error"] as? Map<*, *>)?.let { decodeError(it) }
    val status = SetgreetPurchaseStatus.values().firstOrNull { it.rawValue == values["status"] }
      ?: return SetgreetPurchaseResult(
        SetgreetPurchaseStatus.FAILED,
        productRef,
        accessRefs,
        error ?: SetgreetPurchaseError(SetgreetPurchaseErrorCode.UNKNOWN, message = "Unknown purchase status")
      )
    return SetgreetPurchaseResult(status, productRef, accessRefs, error)
  }

  fun restoreResult(values: Map<String, Any?>): SetgreetRestoreResult {
    val accessRefs = strings(values["accessRefs"])
    val error = (values["error"] as? Map<*, *>)?.let { decodeError(it) }
    val status = SetgreetRestoreStatus.values().firstOrNull { it.rawValue == values["status"] }
      ?: return SetgreetRestoreResult(
        SetgreetRestoreStatus.FAILED,
        accessRefs,
        error ?: SetgreetPurchaseError(SetgreetPurchaseErrorCode.UNKNOWN, message = "Unknown restore status")
      )
    return SetgreetRestoreResult(status, accessRefs, error)
  }

  fun accessState(value: Any?): SetgreetPurchaseAccessState? {
    val state = value as? Map<*, *> ?: return null
    val accessRefs = strings(state["accessRefs"])
    return SetgreetPurchaseAccessState(
      active = state["active"] as? Boolean ?: accessRefs.isNotEmpty(),
      accessRefs = accessRefs
    )
  }

  fun decodeError(values: Map<*, *>): SetgreetPurchaseError {
    val code = SetgreetPurchaseErrorCode.values().firstOrNull { it.rawValue == values["code"] }
      ?: SetgreetPurchaseErrorCode.UNKNOWN
    return SetgreetPurchaseError(
      code = code,
      providerCode = values["providerCode"] as? String,
      message = values["message"] as? String
    )
  }

  // Values

  private fun period(value: Any?): SetgreetPurchasePeriod? {
    val period = value as? Map<*, *> ?: return null
    val unit = SetgreetPurchasePeriodUnit.values().firstOrNull { it.rawValue == period["unit"] } ?: return null
    val count = integer(period["count"])?.takeIf { it > 0 } ?: return null
    return SetgreetPurchasePeriod(unit, count)
  }

  private fun introOffer(value: Any?): SetgreetPurchaseIntroOffer? {
    val offer = value as? Map<*, *> ?: return null
    val type = nonEmptyString(offer["type"]) ?: return null
    return SetgreetPurchaseIntroOffer(
      type = type,
      localizedPrice = offer["localizedPrice"] as? String,
      periodText = offer["periodText"] as? String,
      eligible = offer["eligible"] as? Boolean
    )
  }

  private fun nonEmptyString(value: Any?): String? = (value as? String)?.takeIf { it.isNotEmpty() }

  private fun strings(value: Any?): List<String> = (value as? List<*>)?.filterIsInstance<String>() ?: emptyList()

  private fun integer(value: Any?): Int? {
    val number = (value as? Number)?.toDouble() ?: return null
    if (!number.isFinite() || number != Math.rint(number) || Math.abs(number) > Int.MAX_VALUE) return null
    return number.toInt()
  }

  /**
   * A JS number crosses as a binary double: convert it through its shortest
   * decimal string (`BigDecimal.valueOf` → "49.99"), never `BigDecimal(double)`
   * (49.99000000000000198951966012828052043914794921875). A numeric string is
   * accepted too.
   */
  private fun decimal(value: Any?): BigDecimal? = when (value) {
    is Double -> if (value.isFinite()) BigDecimal.valueOf(value) else null
    is Float -> if (value.isFinite()) BigDecimal(value.toString()) else null
    is Int -> BigDecimal.valueOf(value.toLong())
    is Long -> BigDecimal.valueOf(value)
    is String -> value.trim().toBigDecimalOrNull()
    else -> null
  }
}
