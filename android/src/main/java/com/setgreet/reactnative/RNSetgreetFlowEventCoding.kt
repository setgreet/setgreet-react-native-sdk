package com.setgreet.reactnative

import com.setgreet.domain.model.flow.ActionType
import com.setgreet.listener.ErrorType
import com.setgreet.listener.SetgreetFlowEvent

/**
 * Flow events as the plain maps JS receives (the module converts them with
 * `Arguments.makeNativeMap`). Plain Kotlin, so the JVM tests cover it.
 */
internal object RNSetgreetFlowEventCoding {

  /**
   * The events the module forwards from the native flow listener: the native
   * SDK delivers custom action, track event and remind later to a listener
   * only, with no builder callback for them. The listener receives every
   * event, the ones the callbacks already forward included, so anything else
   * is `null` here: forwarding it would reach JS twice.
   */
  fun encodeListenerEvent(event: SetgreetFlowEvent): Map<String, Any?>? = when (event) {
    is SetgreetFlowEvent.CustomAction -> encode(event)
    is SetgreetFlowEvent.TrackEvent -> encode(event)
    is SetgreetFlowEvent.RemindLater -> encode(event)
    else -> null
  }

  fun encode(event: SetgreetFlowEvent.CustomAction): Map<String, Any?> = mapOf(
    "type" to "customAction",
    "flowId" to event.flowId,
    "screenIndex" to event.screenIndex,
    "data" to event.data?.let(::jsMap),
    "timestamp" to event.timestamp.toDouble()
  )

  fun encode(event: SetgreetFlowEvent.TrackEvent): Map<String, Any?> = mapOf(
    "type" to "trackEvent",
    "flowId" to event.flowId,
    "screenIndex" to event.screenIndex,
    "eventName" to event.eventName,
    "properties" to event.properties?.let(::jsMap),
    "timestamp" to event.timestamp.toDouble()
  )

  fun encode(event: SetgreetFlowEvent.RemindLater): Map<String, Any?> = mapOf(
    "type" to "remindLater",
    "flowId" to event.flowId,
    "screenIndex" to event.screenIndex,
    "timestamp" to event.timestamp.toDouble()
  )

  fun encode(event: SetgreetFlowEvent.ActionTriggered): Map<String, Any?> = mapOf(
    "type" to "actionTriggered",
    "flowId" to event.flowId,
    "actionType" to actionType(event.actionType),
    "actionName" to event.actionName,
    "screenIndex" to event.screenIndex,
    "timestamp" to event.timestamp.toDouble()
  )

  fun encode(event: SetgreetFlowEvent.FlowError): Map<String, Any?> = mapOf(
    "type" to "flowError",
    "flowId" to event.flowId,
    "errorType" to errorType(event.errorType),
    "message" to event.message,
    "timestamp" to event.timestamp.toDouble()
  )

  /**
   * The canonical snake_case action name (`remind_later`,
   * `request_notification_permission`): the enum name lower-cased. Kotlin's
   * `lowercase()` is locale-invariant, so a Turkish device does not turn the
   * `I` of `REQUEST_...` into a dotless `ı`.
   */
  fun actionType(type: ActionType): String = type.name.lowercase()

  fun errorType(type: ErrorType): String = when (type) {
    ErrorType.NETWORK -> "network"
    ErrorType.PARSE -> "parse"
    ErrorType.DISPLAY -> "display"
    ErrorType.UNKNOWN -> "unknown"
  }

  /**
   * A payload map with every value made one `Arguments.makeNativeMap`
   * accepts. It throws on any other type, and this runs on the main thread.
   */
  private fun jsMap(values: Map<*, *>): Map<String, Any?> =
    values.entries.associate { (key, value) -> key.toString() to jsValue(value) }

  private fun jsValue(value: Any?): Any? = when (value) {
    null, is Boolean, is String, is Int, is Double -> value
    is Number -> value.toDouble()
    is Map<*, *> -> jsMap(value)
    is Iterable<*> -> value.map(::jsValue)
    is Array<*> -> value.map(::jsValue)
    else -> value.toString()
  }
}
