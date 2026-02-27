import Foundation
import React
import SetgreetSDK

@objc(RNSetgreet)
class RNSetgreet: RCTEventEmitter {
  private static let eventName = "SetgreetFlowEvent"
  private var hasListeners = false

  override static func moduleName() -> String! {
    return "RNSetgreet"
  }

  @objc
  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return [RNSetgreet.eventName]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  @objc(initialize:config:)
  func initialize(appKey: String, config: NSDictionary?) {
    let debug = (config?["debugMode"] as? Bool) ?? false

    DispatchQueue.main.async { [weak self] in
      Setgreet.shared.initialize(
        appKey: appKey,
        config: .init(debugMode: debug)
      )

      self?.setupFlowCallbacks()
    }
  }

  private func setupFlowCallbacks() {
    Setgreet.shared.setFlowCallbacks { callbacks in
      callbacks
        .onFlowStarted { [weak self] event in
          self?.sendFlowEvent(self?.createFlowStartedEvent(event))
        }
        .onFlowCompleted { [weak self] event in
          self?.sendFlowEvent(self?.createFlowCompletedEvent(event))
        }
        .onFlowDismissed { [weak self] event in
          self?.sendFlowEvent(self?.createFlowDismissedEvent(event))
        }
        .onScreenChanged { [weak self] event in
          self?.sendFlowEvent(self?.createScreenChangedEvent(event))
        }
        .onActionTriggered { [weak self] event in
          self?.sendFlowEvent(self?.createActionTriggeredEvent(event))
        }
        .onPermissionRequested { [weak self] event in
          self?.sendFlowEvent(self?.createPermissionRequestedEvent(event))
        }
        .onError { [weak self] event in
          self?.sendFlowEvent(self?.createFlowErrorEvent(event))
        }
    }
  }

  private func sendFlowEvent(_ body: [String: Any]?) {
    guard hasListeners, let body = body else { return }
    sendEvent(withName: RNSetgreet.eventName, body: body)
  }

  private func createFlowStartedEvent(_ event: FlowStartedEvent) -> [String: Any] {
    return [
      "type": "flowStarted",
      "flowId": event.flowId,
      "screenCount": event.screenCount,
      "timestamp": event.timestamp * 1000
    ]
  }

  private func createFlowCompletedEvent(_ event: FlowCompletedEvent) -> [String: Any] {
    return [
      "type": "flowCompleted",
      "flowId": event.flowId,
      "screenCount": event.screenCount,
      "durationMs": event.durationMs,
      "timestamp": event.timestamp * 1000
    ]
  }

  private func createFlowDismissedEvent(_ event: FlowDismissedEvent) -> [String: Any] {
    return [
      "type": "flowDismissed",
      "flowId": event.flowId,
      "reason": dismissReasonToJsString(event.reason),
      "screenIndex": event.screenIndex,
      "screenCount": event.screenCount,
      "durationMs": event.durationMs,
      "timestamp": event.timestamp * 1000
    ]
  }

  private func createScreenChangedEvent(_ event: ScreenChangedEvent) -> [String: Any] {
    return [
      "type": "screenChanged",
      "flowId": event.flowId,
      "fromIndex": event.fromIndex,
      "toIndex": event.toIndex,
      "screenCount": event.screenCount,
      "timestamp": event.timestamp * 1000
    ]
  }

  private func createActionTriggeredEvent(_ event: ActionTriggeredEvent) -> [String: Any] {
    var dict: [String: Any] = [
      "type": "actionTriggered",
      "flowId": event.flowId,
      "actionType": event.actionType.lowercased(),
      "screenIndex": event.screenIndex,
      "timestamp": event.timestamp * 1000
    ]
    if let actionName = event.actionName {
      dict["actionName"] = actionName
    } else {
      dict["actionName"] = NSNull()
    }
    return dict
  }

  private func createFlowErrorEvent(_ event: FlowErrorEvent) -> [String: Any] {
    return [
      "type": "flowError",
      "flowId": event.flowId,
      "errorType": errorTypeToJsString(event.errorType),
      "message": event.message,
      "timestamp": event.timestamp * 1000
    ]
  }

  private func createPermissionRequestedEvent(_ event: PermissionRequestedEvent) -> [String: Any] {
    return [
      "type": "permissionRequested",
      "flowId": event.flowId,
      "permissionType": event.permissionType,
      "result": event.result,
      "screenIndex": event.screenIndex,
      "timestamp": event.timestamp * 1000
    ]
  }

  private func dismissReasonToJsString(_ reason: DismissReason) -> String {
    switch reason {
    case .userClose:
      return "userClose"
    case .userSkip:
      return "userSkip"
    case .backPress:
      return "backPress"
    case .replaced:
      return "replaced"
    case .programmatic:
      return "programmatic"
    case .swipeDown:
      return "swipeDown"
    case .completed:
      return "completed"
    case .remindLater:
      return "remindLater"
    }
  }

  private func errorTypeToJsString(_ errorType: FlowErrorType) -> String {
    switch errorType {
    case .network:
      return "network"
    case .parse:
      return "parse"
    case .display:
      return "display"
    case .unknown:
      return "unknown"
    }
  }

  @objc(getAnonymousId)
  func getAnonymousId() -> String? {
    return Setgreet.shared.anonymousId
  }

  @objc(identifyUser:attributes:operation:locale:)
  func identifyUser(userId: String, attributes: NSDictionary?, operation: String?, locale: String?) {
    let op: SetgreetSDK.Operation = (operation?.lowercased() == "update") ? .update : .create

    Setgreet.shared.identifyUser(
      userId: userId,
      attributes: attributes as? [String: Any],
      operation: op,
      locale: locale
    )
  }

  @objc(resetUser)
  func resetUser() {
    Setgreet.shared.resetUser()
  }

  @objc(trackEvent:properties:)
  func trackEvent(eventName: String, properties: NSDictionary?) {
    Setgreet.shared.trackEvent(eventName: eventName, properties: properties as? [String: Any])
  }

  @objc(trackScreen:properties:)
  func trackScreen(screenName: String, properties: NSDictionary?) {
    Setgreet.shared.trackScreen(screenName: screenName, properties: properties as? [String: Any])
  }

  @objc(showFlow:)
  func showFlow(flowId: String) {
    DispatchQueue.main.async {
      Setgreet.shared.showFlow(flowId: flowId)
    }
  }

  // MARK: - Event Emitter Required Methods
  @objc(addListener:)
  override func addListener(_ eventName: String) {
    super.addListener(eventName)
  }

  @objc(removeListeners:)
  override func removeListeners(_ count: Double) {
    super.removeListeners(count)
  }
}
