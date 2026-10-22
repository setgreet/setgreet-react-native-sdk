package com.setgreet.reactnative

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableMapKeySetIterator
import com.facebook.react.bridge.ReadableType
import com.setgreet.Setgreet
import com.setgreet.listener.DismissReason
import com.setgreet.listener.SetgreetFlowEvent
import com.setgreet.model.Operation
import com.setgreet.model.SetgreetConfig
import com.setgreet.purchases.SetgreetPurchaseProvider
import com.setgreet.purchases.SetgreetPurchaseSource

@ReactModule(name = RNSetgreetModule.NAME)
class RNSetgreetModule(reactContext: ReactApplicationContext) :
  NativeRNSetgreetSpec(reactContext) {

  @Volatile
  private var listenerCount = 0

  private val purchaseBridge = RNSetgreetPurchaseBridge()

  /** Held strongly here and only weakly by the bridge (see RNSetgreetPurchaseBridge). */
  private val purchaseRequestSender = object : RNSetgreetPurchaseBridge.Sender {
    override fun canReachJs(): Boolean =
      listenerCount > 0 && reactApplicationContext.hasActiveReactInstance()

    override fun emitRequest(body: Map<String, Any?>): Boolean = emitPurchaseRequest(body)
  }

  /** The SDK calls, in order: see RNSetgreetSdkCalls. */
  private val sdkCalls = RNSetgreetSdkCalls(object : RNSetgreetNativeSdk {
    override fun initialize(appKey: String, debugMode: Boolean) {
      Setgreet.initialize(reactApplicationContext, appKey, SetgreetConfig(debugMode = debugMode))
      setupFlowCallbacks()
    }

    override fun identifyUser(userId: String, attributes: Map<String, Any>?, operation: Operation, locale: String?) {
      Setgreet.identifyUser(userId, attributes, operation, locale)
    }

    override fun resetUser() {
      Setgreet.resetUser()
    }

    override fun trackEvent(eventName: String, properties: Map<String, Any>?) {
      Setgreet.trackEvent(eventName, properties)
    }

    override fun trackScreen(screenName: String, properties: Map<String, Any>?) {
      Setgreet.trackScreen(screenName, properties)
    }

    override fun showFlow(flowId: String) {
      Setgreet.showFlow(flowId)
    }

    override fun setPurchaseProvider(provider: SetgreetPurchaseProvider, defaultSource: SetgreetPurchaseSource) {
      Setgreet.setPurchaseProvider(provider, defaultSource)
    }
  })

  override fun getName(): String {
    return NAME
  }

  override fun initialize(appKey: String, config: ReadableMap?) {
    try {
      if (appKey.isBlank()) {
        throw IllegalArgumentException("App key cannot be empty")
      }

      val debugMode = config?.getBoolean("debugMode") ?: false

      // On the main thread; the calls that need it initialized follow it there.
      sdkCalls.initialize(appKey, debugMode)
    } catch (e: Exception) {
      throw e
    }
  }

  private fun setupFlowCallbacks() {
    Setgreet.setFlowCallbacks {
      onFlowStarted { event ->
        sendEvent(createFlowStartedEvent(event))
      }
      onFlowCompleted { event ->
        sendEvent(createFlowCompletedEvent(event))
      }
      onFlowDismissed { event ->
        sendEvent(createFlowDismissedEvent(event))
      }
      onScreenChanged { event ->
        sendEvent(createScreenChangedEvent(event))
      }
      onActionTriggered { event ->
        sendEvent(Arguments.makeNativeMap(RNSetgreetFlowEventCoding.encode(event)))
      }
      onPermissionRequested { event ->
        sendEvent(createPermissionRequestedEvent(event))
      }
      onError { event ->
        sendEvent(Arguments.makeNativeMap(RNSetgreetFlowEventCoding.encode(event)))
      }
      onPurchaseCompleted { event ->
        sendEvent(createPurchaseCompletedEvent(event))
      }
      onPurchaseCancelled { event ->
        sendEvent(createPurchaseCancelledEvent(event))
      }
      onPurchaseFailed { event ->
        sendEvent(createPurchaseFailedEvent(event))
      }
      onPurchasePending { event ->
        sendEvent(createPurchasePendingEvent(event))
      }
      onRestoreCompleted { event ->
        sendEvent(createRestoreCompletedEvent(event))
      }
      onRestoreFailed { event ->
        sendEvent(createRestoreFailedEvent(event))
      }
    }
    // Custom action, track event and remind later reach a flow listener only
    // (the callbacks have no slot for them). The listener is a separate slot
    // that also receives every event above, so only those three are
    // forwarded from it (see RNSetgreetFlowEventCoding.encodeListenerEvent).
    //
    // The SDK has ONE listener slot: this replaces a listener the host app set
    // before, and a host `Setgreet.setFlowListener` call after initialize
    // silently stops these three events in JS (documented in the README).
    //
    // TODO: once the Android pin moves to 1.8.0, which adds the builder
    // callbacks onCustomAction, onTrackEvent and onRemindLater, register
    // those in the block above and drop this setFlowListener call. Never
    // register both: each of the three events would then reach JS twice.
    Setgreet.setFlowListener { event ->
      RNSetgreetFlowEventCoding.encodeListenerEvent(event)?.let {
        sendEvent(Arguments.makeNativeMap(it))
      }
    }
  }

  private fun sendEvent(params: WritableMap) {
    // Flow and purchase outcome events can fire after the flow was dismissed
    // or the JS context was torn down (a purchase outlives both).
    // hasActiveReactInstance() and emitDeviceEvent() serve both architectures
    // (the bridge, or the bridgeless React host).
    if (!reactApplicationContext.hasActiveReactInstance()) return
    try {
      reactApplicationContext.emitDeviceEvent(EVENT_NAME, params)
    } catch (e: RuntimeException) {
      // The React instance went away between the check and the emit.
    }
  }

  private fun createFlowStartedEvent(event: SetgreetFlowEvent.FlowStarted): WritableMap {
    return Arguments.createMap().apply {
      putString("type", "flowStarted")
      putString("flowId", event.flowId)
      putInt("screenCount", event.screenCount)
      putDouble("timestamp", event.timestamp.toDouble())
    }
  }

  private fun createFlowCompletedEvent(event: SetgreetFlowEvent.FlowCompleted): WritableMap {
    return Arguments.createMap().apply {
      putString("type", "flowCompleted")
      putString("flowId", event.flowId)
      putInt("screenCount", event.screenCount)
      putDouble("durationMs", event.durationMs.toDouble())
      putDouble("timestamp", event.timestamp.toDouble())
    }
  }

  private fun createFlowDismissedEvent(event: SetgreetFlowEvent.FlowDismissed): WritableMap {
    return Arguments.createMap().apply {
      putString("type", "flowDismissed")
      putString("flowId", event.flowId)
      putString("reason", event.reason.toJsString())
      putInt("screenIndex", event.screenIndex)
      putInt("screenCount", event.screenCount)
      putDouble("durationMs", event.durationMs.toDouble())
      putDouble("timestamp", event.timestamp.toDouble())
    }
  }

  private fun createScreenChangedEvent(event: SetgreetFlowEvent.ScreenChanged): WritableMap {
    return Arguments.createMap().apply {
      putString("type", "screenChanged")
      putString("flowId", event.flowId)
      putInt("fromIndex", event.fromIndex)
      putInt("toIndex", event.toIndex)
      putInt("screenCount", event.screenCount)
      putDouble("timestamp", event.timestamp.toDouble())
    }
  }

  private fun createPermissionRequestedEvent(event: SetgreetFlowEvent.PermissionRequested): WritableMap {
    return Arguments.createMap().apply {
      putString("type", "permissionRequested")
      putString("flowId", event.flowId)
      putString("permissionType", event.permissionType)
      putString("result", event.result)
      putInt("screenIndex", event.screenIndex)
      putDouble("timestamp", event.timestamp.toDouble())
    }
  }

  private fun createPurchaseCompletedEvent(event: SetgreetFlowEvent.PurchaseCompleted): WritableMap {
    return Arguments.createMap().apply {
      putString("type", "purchaseCompleted")
      putString("flowId", event.flowId)
      putString("screenId", event.screenId)
      putString("componentId", event.componentId)
      putString("productRef", event.productRef)
      putString("provider", event.provider)
      putArray("accessRefs", stringArray(event.accessRefs))
      putDouble("timestamp", event.timestamp.toDouble())
    }
  }

  private fun createPurchaseCancelledEvent(event: SetgreetFlowEvent.PurchaseCancelled): WritableMap {
    return Arguments.createMap().apply {
      putString("type", "purchaseCancelled")
      putString("flowId", event.flowId)
      putString("screenId", event.screenId)
      putString("componentId", event.componentId)
      putString("productRef", event.productRef)
      putString("provider", event.provider)
      putDouble("timestamp", event.timestamp.toDouble())
    }
  }

  private fun createPurchaseFailedEvent(event: SetgreetFlowEvent.PurchaseFailed): WritableMap {
    return Arguments.createMap().apply {
      putString("type", "purchaseFailed")
      putString("flowId", event.flowId)
      putString("screenId", event.screenId)
      putString("componentId", event.componentId)
      putString("productRef", event.productRef)
      putString("provider", event.provider)
      putMap("error", Arguments.makeNativeMap(RNSetgreetPurchaseCoding.encode(event.error)))
      putDouble("timestamp", event.timestamp.toDouble())
    }
  }

  private fun createPurchasePendingEvent(event: SetgreetFlowEvent.PurchasePending): WritableMap {
    return Arguments.createMap().apply {
      putString("type", "purchasePending")
      putString("flowId", event.flowId)
      putString("screenId", event.screenId)
      putString("componentId", event.componentId)
      putString("productRef", event.productRef)
      putString("provider", event.provider)
      putDouble("timestamp", event.timestamp.toDouble())
    }
  }

  private fun createRestoreCompletedEvent(event: SetgreetFlowEvent.RestoreCompleted): WritableMap {
    return Arguments.createMap().apply {
      putString("type", "restoreCompleted")
      putString("flowId", event.flowId)
      putString("screenId", event.screenId)
      putString("componentId", event.componentId)
      putString("provider", event.provider)
      putString("status", event.status.rawValue)
      putArray("accessRefs", stringArray(event.accessRefs))
      putDouble("timestamp", event.timestamp.toDouble())
    }
  }

  private fun createRestoreFailedEvent(event: SetgreetFlowEvent.RestoreFailed): WritableMap {
    return Arguments.createMap().apply {
      putString("type", "restoreFailed")
      putString("flowId", event.flowId)
      putString("screenId", event.screenId)
      putString("componentId", event.componentId)
      putString("provider", event.provider)
      putMap("error", Arguments.makeNativeMap(RNSetgreetPurchaseCoding.encode(event.error)))
      putDouble("timestamp", event.timestamp.toDouble())
    }
  }

  private fun stringArray(values: List<String>) =
    Arguments.createArray().apply { values.forEach { pushString(it) } }

  private fun DismissReason.toJsString(): String = when (this) {
    DismissReason.USER_CLOSE -> "userClose"
    DismissReason.USER_SKIP -> "userSkip"
    DismissReason.BACK_PRESS -> "backPress"
    DismissReason.REPLACED -> "replaced"
    DismissReason.PROGRAMMATIC -> "programmatic"
    DismissReason.SWIPE_DOWN -> "swipeDown"
    DismissReason.COMPLETED -> "completed"
    DismissReason.REMIND_LATER -> "remindLater"
  }

  override fun addListener(eventType: String?) {
    listenerCount++
  }

  override fun removeListeners(count: Double) {
    listenerCount = (listenerCount - count.toInt()).coerceAtLeast(0)
  }

  override fun getAnonymousId(): String? {
    return Setgreet.anonymousId
  }

  /**
   * The Android SDK renders Lottie out of the box (it depends on lottie-compose),
   * so there is nothing to register: Lottie is always available here. The
   * method exists so apps call one `registerLottie()` on both platforms.
   */
  override fun registerLottie(): Boolean = true

  /**
   * Registers a proxy provider that forwards every call to the JS provider.
   *
   * Inline, not posted to the main thread like the other calls (see
   * RNSetgreetSdkCalls): an [identifyUser] / [resetUser] that follows it is
   * posted, so it runs after the registration and finds the provider. The
   * SDK's registration is synchronized and safe from any thread. Its preload
   * runs on the main dispatcher, which posts asynchronous messages, so it is
   * not guaranteed to start after the [initialize] runnable posted before it.
   * That is harmless: the catalog sync and the access-attribute write come
   * after the JS round trip and are skipped while the SDK is not initialized,
   * so at worst this launch's registration-time sync is skipped.
   */
  override fun setPurchaseProvider(providerId: String, defaultSource: ReadableMap) {
    purchaseBridge.attach(purchaseRequestSender)
    val provider = RNSetgreetPurchaseProvider(providerId, purchaseBridge)
    val source = RNSetgreetPurchaseCoding.source(defaultSource.toHashMap())
    sdkCalls.setPurchaseProvider(provider, source)
  }

  /** JS answered a purchase request. Arrives on the native modules thread. */
  override fun resolvePurchaseRequest(requestId: String, result: ReadableMap?, error: ReadableMap?) {
    purchaseBridge.resolve(requestId, result?.toHashMap(), error?.toHashMap())
  }

  /**
   * The JS context is going away (reload, teardown): every purchase call
   * waiting on JS fails now instead of hanging.
   */
  override fun invalidate() {
    purchaseBridge.invalidate()
    super.invalidate()
  }

  /** Emits a bridge request, converting its plain Kotlin map for React Native. */
  private fun emitPurchaseRequest(body: Map<String, Any?>): Boolean {
    if (!reactApplicationContext.hasActiveReactInstance()) return false
    return try {
      reactApplicationContext.emitDeviceEvent(
        RNSetgreetPurchaseBridge.REQUEST_EVENT_NAME,
        Arguments.makeNativeMap(body)
      )
      true
    } catch (e: RuntimeException) {
      false
    }
  }

  override fun identifyUser(userId: String, attributes: ReadableMap?, operation: String?, locale: String?) {
    try {
      if (userId.isBlank()) {
        throw IllegalArgumentException("User ID cannot be empty")
      }

      val attrs = attributes?.toNonNullAnyMap()
      val op = when (operation?.lowercase()) {
        "update" -> Operation.UPDATE
        else -> Operation.CREATE
      }

      sdkCalls.identifyUser(userId, attrs, op, locale)
    } catch (e: Exception) {
      throw e
    }
  }

  override fun resetUser() {
    sdkCalls.resetUser()
  }

  override fun trackEvent(eventName: String, properties: ReadableMap?) {
    sdkCalls.trackEvent(eventName, properties?.toNonNullAnyMap())
  }

  override fun trackScreen(screenName: String, properties: ReadableMap?) {
    sdkCalls.trackScreen(screenName, properties?.toNonNullAnyMap())
  }

  override fun showFlow(flowId: String) {
    try {
      // Validate flow ID
      if (flowId.isBlank()) {
        throw IllegalArgumentException("Flow ID cannot be empty")
      }
      
      sdkCalls.showFlow(flowId)
    } catch (e: Exception) {
      throw e
    }
  }

  private fun ReadableMap.toNonNullAnyMap(): Map<String, Any> {
    val result = mutableMapOf<String, Any>()
    val iterator: ReadableMapKeySetIterator = this.keySetIterator()
    while (iterator.hasNextKey()) {
      val key = iterator.nextKey()
      when (this.getType(key)) {
        ReadableType.Boolean -> result[key] = this.getBoolean(key)
        ReadableType.Number -> result[key] = this.getDouble(key)
        ReadableType.String -> this.getString(key)?.let { result[key] = it }
        else -> Unit
      }
    }
    return result
  }

  companion object {
    const val NAME = "RNSetgreet"
    const val EVENT_NAME = "SetgreetFlowEvent"
  }
}
