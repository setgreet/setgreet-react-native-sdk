package com.setgreet.reactnative

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableMapKeySetIterator
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.setgreet.Setgreet
import com.setgreet.listener.DismissReason
import com.setgreet.listener.ErrorType
import com.setgreet.listener.SetgreetFlowEvent
import com.setgreet.model.SetgreetConfig

@ReactModule(name = RNSetgreetModule.NAME)
class RNSetgreetModule(reactContext: ReactApplicationContext) :
  NativeRNSetgreetSpec(reactContext) {

  private var listenerCount = 0

  override fun getName(): String {
    return NAME
  }

  override fun initialize(appKey: String, config: ReadableMap?) {
    try {
      if (appKey.isBlank()) {
        throw IllegalArgumentException("App key cannot be empty")
      }

      val debugMode = config?.getBoolean("debugMode") ?: false
      val cfg = SetgreetConfig(debugMode = debugMode)

      UiThreadUtil.runOnUiThread {
        Setgreet.initialize(reactApplicationContext, appKey, cfg)
        setupFlowCallbacks()
      }
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
        sendEvent(createActionTriggeredEvent(event))
      }
      onPermissionRequested { event ->
        sendEvent(createPermissionRequestedEvent(event))
      }
      onError { event ->
        sendEvent(createFlowErrorEvent(event))
      }
    }
  }

  private fun sendEvent(params: WritableMap) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(EVENT_NAME, params)
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

  private fun createActionTriggeredEvent(event: SetgreetFlowEvent.ActionTriggered): WritableMap {
    return Arguments.createMap().apply {
      putString("type", "actionTriggered")
      putString("flowId", event.flowId)
      putString("actionType", event.actionType.name.lowercase())
      if (event.actionName != null) {
        putString("actionName", event.actionName)
      } else {
        putNull("actionName")
      }
      putInt("screenIndex", event.screenIndex)
      putDouble("timestamp", event.timestamp.toDouble())
    }
  }

  private fun createFlowErrorEvent(event: SetgreetFlowEvent.FlowError): WritableMap {
    return Arguments.createMap().apply {
      putString("type", "flowError")
      putString("flowId", event.flowId)
      putString("errorType", event.errorType.toJsString())
      putString("message", event.message)
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

  private fun ErrorType.toJsString(): String = when (this) {
    ErrorType.NETWORK -> "network"
    ErrorType.PARSE -> "parse"
    ErrorType.DISPLAY -> "display"
    ErrorType.UNKNOWN -> "unknown"
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

  override fun identifyUser(userId: String, attributes: ReadableMap?, operation: String?, locale: String?) {
    try {
      if (userId.isBlank()) {
        throw IllegalArgumentException("User ID cannot be empty")
      }

      val attrs = attributes?.toNonNullAnyMap()
      val op = when (operation?.lowercase()) {
        "update" -> com.setgreet.model.Operation.UPDATE
        else -> com.setgreet.model.Operation.CREATE
      }

      Setgreet.identifyUser(userId, attrs, op, locale)
    } catch (e: Exception) {
      throw e
    }
  }

  override fun resetUser() {
    Setgreet.resetUser()
  }

  override fun trackEvent(eventName: String, properties: ReadableMap?) {
    Setgreet.trackEvent(eventName, properties?.toNonNullAnyMap())
  }

  override fun trackScreen(screenName: String, properties: ReadableMap?) {
    Setgreet.trackScreen(screenName, properties?.toNonNullAnyMap())
  }

  override fun showFlow(flowId: String) {
    try {
      // Validate flow ID
      if (flowId.isBlank()) {
        throw IllegalArgumentException("Flow ID cannot be empty")
      }
      
      Setgreet.showFlow(flowId)
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
