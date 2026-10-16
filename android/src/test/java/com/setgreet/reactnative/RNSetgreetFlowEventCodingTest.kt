package com.setgreet.reactnative

import com.setgreet.domain.model.flow.ActionType
import com.setgreet.listener.DismissReason
import com.setgreet.listener.ErrorType
import com.setgreet.listener.SetgreetFlowEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RNSetgreetFlowEventCodingTest {

  @Test
  fun `a custom action reaches JS with its data`() {
    val event = SetgreetFlowEvent.CustomAction(
      flowId = "flow-1",
      data = mapOf("plan" to "annual", "missing" to null),
      screenIndex = 2,
      timestamp = 1_700_000_000_000
    )

    assertEquals(
      mapOf(
        "type" to "customAction",
        "flowId" to "flow-1",
        "screenIndex" to 2,
        "data" to mapOf("plan" to "annual", "missing" to null),
        "timestamp" to 1_700_000_000_000.0
      ),
      RNSetgreetFlowEventCoding.encodeListenerEvent(event)
    )
  }

  @Test
  fun `a custom action without data sends null`() {
    val encoded = RNSetgreetFlowEventCoding.encodeListenerEvent(
      SetgreetFlowEvent.CustomAction(flowId = "flow-1", data = null, screenIndex = 0)
    )

    assertEquals(true, encoded!!.containsKey("data"))
    assertNull(encoded["data"])
  }

  @Test
  fun `a track event reaches JS with its name and properties`() {
    val event = SetgreetFlowEvent.TrackEvent(
      flowId = "flow-1",
      eventName = "plan_selected",
      properties = mapOf("plan" to "annual"),
      screenIndex = 1,
      timestamp = 1_700_000_000_000
    )

    assertEquals(
      mapOf(
        "type" to "trackEvent",
        "flowId" to "flow-1",
        "screenIndex" to 1,
        "eventName" to "plan_selected",
        "properties" to mapOf("plan" to "annual"),
        "timestamp" to 1_700_000_000_000.0
      ),
      RNSetgreetFlowEventCoding.encodeListenerEvent(event)
    )
  }

  @Test
  fun `a remind later reaches JS with its screen`() {
    val event = SetgreetFlowEvent.RemindLater(
      flowId = "flow-1",
      screenIndex = 3,
      timestamp = 1_700_000_000_000
    )

    assertEquals(
      mapOf(
        "type" to "remindLater",
        "flowId" to "flow-1",
        "screenIndex" to 3,
        "timestamp" to 1_700_000_000_000.0
      ),
      RNSetgreetFlowEventCoding.encodeListenerEvent(event)
    )
  }

  @Test
  fun `the listener forwards nothing the callbacks already forward`() {
    val forwardedByCallbacks = listOf(
      SetgreetFlowEvent.FlowStarted(flowId = "flow-1", screenCount = 3),
      SetgreetFlowEvent.FlowCompleted(flowId = "flow-1", screenCount = 3, durationMs = 10),
      SetgreetFlowEvent.FlowDismissed(
        flowId = "flow-1",
        reason = DismissReason.REMIND_LATER,
        screenIndex = 0,
        screenCount = 3,
        durationMs = 10
      ),
      SetgreetFlowEvent.ScreenChanged(flowId = "flow-1", fromIndex = 0, toIndex = 1, screenCount = 3),
      SetgreetFlowEvent.ActionTriggered(
        flowId = "flow-1",
        actionType = ActionType.NEXT,
        actionName = null,
        screenIndex = 0
      ),
      SetgreetFlowEvent.FlowError(flowId = "flow-1", errorType = ErrorType.NETWORK, message = "offline"),
      SetgreetFlowEvent.PermissionRequested(
        flowId = "flow-1",
        permissionType = "camera",
        result = "granted",
        screenIndex = 0
      )
    )

    forwardedByCallbacks.forEach { event ->
      assertNull("$event would reach JS twice", RNSetgreetFlowEventCoding.encodeListenerEvent(event))
    }
  }

  @Test
  fun `payload values become ones React Native can carry`() {
    val encoded = RNSetgreetFlowEventCoding.encode(
      SetgreetFlowEvent.CustomAction(
        flowId = "flow-1",
        data = mapOf(
          "count" to 3L,
          "ratio" to 0.5f,
          "nested" to mapOf(1 to listOf("a", 2L)),
          "array" to arrayOf(true, null),
          "other" to StringBuilder("text")
        ),
        screenIndex = 0
      )
    )

    assertEquals(
      mapOf(
        "count" to 3.0,
        "ratio" to 0.5,
        "nested" to mapOf("1" to listOf("a", 2.0)),
        "array" to listOf(true, null),
        "other" to "text"
      ),
      encoded["data"]
    )
  }

  @Test
  fun `an action triggered reaches JS with the canonical snake_case action type`() {
    val event = SetgreetFlowEvent.ActionTriggered(
      flowId = "flow-1",
      actionType = ActionType.TRACK_EVENT,
      actionName = "plan_selected",
      screenIndex = 1,
      timestamp = 1_700_000_000_000
    )

    assertEquals(
      mapOf(
        "type" to "actionTriggered",
        "flowId" to "flow-1",
        "actionType" to "track_event",
        "actionName" to "plan_selected",
        "screenIndex" to 1,
        "timestamp" to 1_700_000_000_000.0
      ),
      RNSetgreetFlowEventCoding.encode(event)
    )
  }

  @Test
  fun `an action without a name sends a null actionName`() {
    val encoded = RNSetgreetFlowEventCoding.encode(
      SetgreetFlowEvent.ActionTriggered(
        flowId = "flow-1",
        actionType = ActionType.NEXT,
        actionName = null,
        screenIndex = 0
      )
    )

    assertEquals(true, encoded.containsKey("actionName"))
    assertNull(encoded["actionName"])
  }

  @Test
  fun `every action type maps to the canonical name the JS ActionType lists`() {
    val expected = mapOf(
      ActionType.NEXT to "next",
      ActionType.PREVIOUS to "previous",
      ActionType.SKIP to "skip",
      ActionType.DISMISS to "dismiss",
      ActionType.REMIND_LATER to "remind_later",
      ActionType.URL to "url",
      ActionType.DEEPLINK to "deeplink",
      ActionType.REQUEST_NOTIFICATION_PERMISSION to "request_notification_permission",
      ActionType.REQUEST_LOCATION_PERMISSION to "request_location_permission",
      ActionType.REQUEST_CAMERA_PERMISSION to "request_camera_permission",
      ActionType.REQUEST_TRACKING_PERMISSION to "request_tracking_permission",
      ActionType.REQUEST_MICROPHONE_PERMISSION to "request_microphone_permission",
      ActionType.REQUEST_PHOTO_LIBRARY_PERMISSION to "request_photo_library_permission",
      ActionType.REQUEST_REVIEW to "request_review",
      ActionType.SHARE to "share",
      ActionType.OPEN_SETTINGS to "open_settings",
      ActionType.TRACK_EVENT to "track_event",
      ActionType.CUSTOM to "custom",
      ActionType.PURCHASE to "purchase",
      ActionType.RESTORE_PURCHASES to "restore_purchases",
      ActionType.NONE to "none"
    )

    // A new native action type fails here until the JS ActionType lists it.
    assertEquals(ActionType.values().toSet(), expected.keys)
    expected.forEach { (type, name) ->
      assertEquals(name, RNSetgreetFlowEventCoding.actionType(type))
    }
  }

  @Test
  fun `action types stay canonical under a Turkish default locale`() {
    val original = java.util.Locale.getDefault()
    try {
      java.util.Locale.setDefault(java.util.Locale.forLanguageTag("tr-TR"))
      assertEquals(
        "request_notification_permission",
        RNSetgreetFlowEventCoding.actionType(ActionType.REQUEST_NOTIFICATION_PERMISSION)
      )
    } finally {
      java.util.Locale.setDefault(original)
    }
  }

  @Test
  fun `a flow error reaches JS with its error type`() {
    val expected = mapOf(
      ErrorType.NETWORK to "network",
      ErrorType.PARSE to "parse",
      ErrorType.DISPLAY to "display",
      ErrorType.UNKNOWN to "unknown"
    )
    assertEquals(ErrorType.values().toSet(), expected.keys)

    expected.forEach { (type, name) ->
      assertEquals(
        mapOf(
          "type" to "flowError",
          "flowId" to "flow-1",
          "errorType" to name,
          "message" to "it broke",
          "timestamp" to 1_700_000_000_000.0
        ),
        RNSetgreetFlowEventCoding.encode(
          SetgreetFlowEvent.FlowError(
            flowId = "flow-1",
            errorType = type,
            message = "it broke",
            timestamp = 1_700_000_000_000
          )
        )
      )
    }
  }
}
