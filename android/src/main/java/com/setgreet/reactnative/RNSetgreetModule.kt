package com.setgreet.reactnative

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableMapKeySetIterator
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.UiThreadUtil
import com.setgreet.Setgreet
import com.setgreet.model.SetgreetConfig

@ReactModule(name = RNSetgreetModule.NAME)
class RNSetgreetModule(reactContext: ReactApplicationContext) :
  NativeRNSetgreetSpec(reactContext) {

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
      }
    } catch (e: Exception) {
      throw e
    }
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
  }
}
