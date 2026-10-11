package com.setgreet.reactnative

import android.app.Activity
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
 * Requests are plain Kotlin maps (strings, numbers, booleans, nulls, lists and
 * nested maps); the module turns them into React Native maps when it emits
 * them. With the [RNSetgreetScheduler] injected, nothing here needs Android or
 * React Native at run time, so the bridge is unit-tested on the plain JVM.
 *
 * Only Kotlin's own coroutine primitives are used: kotlinx-coroutines is not on
 * this module's compile classpath (the native SDK ships it at runtime only).
 */
internal class RNSetgreetPurchaseBridge(
  /** Runs the timeouts; the main thread in production. */
  private val scheduler: RNSetgreetScheduler = RNSetgreetMainThreadScheduler
) {

  /** The module side: whether JS can be reached, and how to emit a request. */
  interface Sender {
    /** Whether JS listens for the module's events and the React instance is alive. */
    fun canReachJs(): Boolean

    /** Emits a `SetgreetPurchaseRequest` event; false when it could not be sent. */
    fun emitRequest(body: Map<String, Any?>): Boolean
  }

  sealed class Answer {
    class Result(val values: Map<String, Any?>) : Answer()
    class Failure(val error: SetgreetPurchaseError) : Answer()
    object Unavailable : Answer()
    object TimedOut : Answer()
  }

  private val pending = ConcurrentHashMap<String, Continuation<Answer>>()
  private val timeouts = ConcurrentHashMap<String, Runnable>()

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
  suspend fun request(method: String, args: Map<String, Any?>, timeoutMs: Long?): Answer =
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
        scheduler.postDelayed(timeout, timeoutMs)
      }
      // Re-checked after the entry is in: an invalidate() that ran meanwhile
      // swept the map before this request was in it.
      if (invalidated || !target.emitRequest(requestBody(requestId, method, args))) {
        settle(requestId, Answer.Unavailable)
      }
    }

  /** Sends a fire-and-forget request; dropped when no JS listens. */
  fun notify(method: String, args: Map<String, Any?>) {
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
    timeouts.remove(requestId)?.let { scheduler.cancel(it) }
    continuation.resume(answer)
  }

  private fun requestBody(requestId: String?, method: String, args: Map<String, Any?>): Map<String, Any?> =
    mapOf("requestId" to requestId, "method" to method, "args" to args)

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

    fun timeoutError(method: String, timeoutMs: Long = SAFETY_TIMEOUT_MS): SetgreetPurchaseError {
      val limit = if (timeoutMs % 1000 == 0L) "${timeoutMs / 1000}s" else "${timeoutMs}ms"
      return SetgreetPurchaseError(
        code = SetgreetPurchaseErrorCode.NETWORK_ERROR,
        providerCode = "timeout",
        message = "The JavaScript provider's $method did not answer within $limit"
      )
    }
  }
}

/**
 * The provider registered with the native SDK: every call is forwarded to the
 * JS provider through [bridge]. The SDK calls it on the main thread; nothing
 * here blocks it (the calls suspend).
 */
internal class RNSetgreetPurchaseProvider(
  override val providerId: String,
  private val bridge: RNSetgreetPurchaseBridge,
  /** How long `loadProducts` and `accessState` wait for JS at most. */
  private val safetyTimeoutMs: Long = RNSetgreetPurchaseBridge.SAFETY_TIMEOUT_MS
) : SetgreetPurchaseProvider {

  override suspend fun loadProducts(source: SetgreetPurchaseSource): List<SetgreetPurchaseProduct> {
    val args = mapOf("source" to RNSetgreetPurchaseCoding.encode(source))
    return when (val answer = bridge.request("loadProducts", args, safetyTimeoutMs)) {
      is RNSetgreetPurchaseBridge.Answer.Result -> RNSetgreetPurchaseCoding.products(answer.values["products"])
      is RNSetgreetPurchaseBridge.Answer.Failure -> throw answer.error
      RNSetgreetPurchaseBridge.Answer.Unavailable -> throw RNSetgreetPurchaseBridge.unavailableError()
      RNSetgreetPurchaseBridge.Answer.TimedOut ->
        throw RNSetgreetPurchaseBridge.timeoutError("loadProducts", safetyTimeoutMs)
    }
  }

  // The Activity stays native: a JS provider reaches the store through its own
  // native module.
  override suspend fun purchase(
    activity: Activity,
    productRef: String,
    source: SetgreetPurchaseSource
  ): SetgreetPurchaseResult = requestPurchase(productRef, source)

  /** [purchase] without the Activity it never forwards (unit tests have none). */
  internal suspend fun requestPurchase(productRef: String, source: SetgreetPurchaseSource): SetgreetPurchaseResult {
    val args = mapOf("productRef" to productRef, "source" to RNSetgreetPurchaseCoding.encode(source))
    return when (val answer = bridge.request("purchase", args, timeoutMs = null)) {
      is RNSetgreetPurchaseBridge.Answer.Result -> RNSetgreetPurchaseCoding.purchaseResult(answer.values, productRef)
      is RNSetgreetPurchaseBridge.Answer.Failure ->
        SetgreetPurchaseResult(SetgreetPurchaseStatus.FAILED, productRef, error = answer.error)
      RNSetgreetPurchaseBridge.Answer.Unavailable, RNSetgreetPurchaseBridge.Answer.TimedOut ->
        SetgreetPurchaseResult(SetgreetPurchaseStatus.FAILED, productRef, error = RNSetgreetPurchaseBridge.unavailableError())
    }
  }

  override suspend fun restorePurchases(): SetgreetRestoreResult =
    when (val answer = bridge.request("restorePurchases", emptyMap(), timeoutMs = null)) {
      is RNSetgreetPurchaseBridge.Answer.Result -> RNSetgreetPurchaseCoding.restoreResult(answer.values)
      is RNSetgreetPurchaseBridge.Answer.Failure ->
        SetgreetRestoreResult(SetgreetRestoreStatus.FAILED, error = answer.error)
      RNSetgreetPurchaseBridge.Answer.Unavailable, RNSetgreetPurchaseBridge.Answer.TimedOut ->
        SetgreetRestoreResult(SetgreetRestoreStatus.FAILED, error = RNSetgreetPurchaseBridge.unavailableError())
    }

  override suspend fun accessState(): SetgreetPurchaseAccessState? {
    val answer = bridge.request("accessState", emptyMap(), safetyTimeoutMs)
    return if (answer is RNSetgreetPurchaseBridge.Answer.Result) {
      RNSetgreetPurchaseCoding.accessState(answer.values["accessState"])
    } else {
      null
    }
  }

  override fun trackPaywallImpression(context: SetgreetPaywallImpressionContext) {
    bridge.notify("trackPaywallImpression", mapOf("context" to RNSetgreetPurchaseCoding.encode(context)))
  }

  override fun setAttributes(attributes: Map<String, String>) {
    bridge.notify("setAttributes", mapOf("attributes" to attributes.toMap()))
  }

  // No time limit: the SDK runs `identify` / `reset` one after another.
  override suspend fun identify(userId: String) {
    bridge.request("identify", mapOf("userId" to userId), timeoutMs = null)
  }

  override suspend fun reset() {
    bridge.request("reset", emptyMap(), timeoutMs = null)
  }
}

/**
 * Converts between the native purchase models and the JS bridge values, as
 * plain Kotlin maps (the module converts them for React Native). What JS sends
 * (read through `ReadableMap.toHashMap()`: numbers are `Double`, objects `Map`,
 * arrays `List`) is validated defensively: a product without a `ref` or a
 * numeric `priceAmount` is dropped, an unknown status is `FAILED`, an unknown
 * error code is `UNKNOWN`, a missing array is empty.
 */
internal object RNSetgreetPurchaseCoding {

  // Native → JS

  fun encode(source: SetgreetPurchaseSource): Map<String, Any?> =
    mapOf("sourceType" to source.sourceType, "sourceId" to source.sourceId)

  fun encode(context: SetgreetPaywallImpressionContext): Map<String, Any?> = mapOf(
    "flowId" to context.flowId,
    "screenId" to context.screenId,
    "source" to encode(context.source),
    "productRefs" to context.productRefs.toList()
  )

  fun encode(error: SetgreetPurchaseError): Map<String, Any?> = mapOf(
    "code" to error.code.rawValue,
    "providerCode" to error.providerCode,
    "message" to error.message
  )

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
      providerCode = codeString(values["providerCode"]),
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

  /** A vendor code as a string; a number (JS sends every number as a double) loses a `.0`. */
  private fun codeString(value: Any?): String? = when (value) {
    is String -> value
    is Double -> when {
      !value.isFinite() -> null
      value == Math.rint(value) && Math.abs(value) < 1e15 -> value.toLong().toString()
      else -> value.toString()
    }
    is Float -> codeString(value.toDouble())
    is Int, is Long -> value.toString()
    else -> null
  }

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
