import Foundation
import React
import SetgreetSDK

@objc(RNSetgreet)
class RNSetgreet: RCTEventEmitter, RNSetgreetPurchaseRequestSending {
  private static let eventName = "SetgreetFlowEvent"
  private var hasListeners = false
  private let purchaseBridge = RNSetgreetPurchaseBridge()

  override static func moduleName() -> String! {
    return "RNSetgreet"
  }

  @objc
  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return [RNSetgreet.eventName, RNSetgreetPurchaseBridge.requestEventName]
  }

  override func startObserving() {
    hasListeners = true
    purchaseBridge.setListening(true)
  }

  override func stopObserving() {
    hasListeners = false
    purchaseBridge.setListening(false)
  }

  /// The JS context is going away (reload, teardown): every purchase call
  /// waiting on JS fails now instead of hanging.
  override func invalidate() {
    purchaseBridge.invalidate()
    super.invalidate()
  }

  /// Hands `initialize` to the SDK on the main queue. Every call that needs an
  /// initialized SDK (`identifyUser`, `resetUser`, `trackEvent`, `trackScreen`,
  /// `showFlow`) is queued there too, FIFO behind it: on a fresh install, one
  /// that reached the SDK first would build a request with no app key, which
  /// the SDK treats as a fatal error. `setPurchaseProvider` stays inline (see
  /// there).
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
        .onPurchaseCompleted { [weak self] event in
          self?.sendFlowEvent(self?.createPurchaseCompletedEvent(event))
        }
        .onPurchaseCancelled { [weak self] event in
          self?.sendFlowEvent(self?.createPurchaseCancelledEvent(event))
        }
        .onPurchaseFailed { [weak self] event in
          self?.sendFlowEvent(self?.createPurchaseFailedEvent(event))
        }
        .onPurchasePending { [weak self] event in
          self?.sendFlowEvent(self?.createPurchasePendingEvent(event))
        }
        .onRestoreCompleted { [weak self] event in
          self?.sendFlowEvent(self?.createRestoreCompletedEvent(event))
        }
        .onRestoreFailed { [weak self] event in
          self?.sendFlowEvent(self?.createRestoreFailedEvent(event))
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

  private func createPurchaseCompletedEvent(_ event: PurchaseCompletedEvent) -> [String: Any] {
    return [
      "type": "purchaseCompleted",
      "flowId": event.flowId,
      "screenId": event.screenId,
      "componentId": event.componentId,
      "productRef": event.productRef,
      "provider": event.provider,
      "accessRefs": event.accessRefs,
      "timestamp": event.timestamp * 1000
    ]
  }

  private func createPurchaseCancelledEvent(_ event: PurchaseCancelledEvent) -> [String: Any] {
    return [
      "type": "purchaseCancelled",
      "flowId": event.flowId,
      "screenId": event.screenId,
      "componentId": event.componentId,
      "productRef": event.productRef,
      "provider": event.provider,
      "timestamp": event.timestamp * 1000
    ]
  }

  private func createPurchaseFailedEvent(_ event: PurchaseFailedEvent) -> [String: Any] {
    return [
      "type": "purchaseFailed",
      "flowId": event.flowId,
      "screenId": event.screenId,
      "componentId": event.componentId,
      "productRef": event.productRef,
      "provider": event.provider,
      "error": RNSetgreetPurchaseCoding.encode(event.error),
      "timestamp": event.timestamp * 1000
    ]
  }

  private func createPurchasePendingEvent(_ event: PurchasePendingEvent) -> [String: Any] {
    return [
      "type": "purchasePending",
      "flowId": event.flowId,
      "screenId": event.screenId,
      "componentId": event.componentId,
      "productRef": event.productRef,
      "provider": event.provider,
      "timestamp": event.timestamp * 1000
    ]
  }

  private func createRestoreCompletedEvent(_ event: RestoreCompletedEvent) -> [String: Any] {
    return [
      "type": "restoreCompleted",
      "flowId": event.flowId,
      "screenId": event.screenId,
      "componentId": event.componentId,
      "provider": event.provider,
      "status": event.status.rawValue,
      "accessRefs": event.accessRefs,
      "timestamp": event.timestamp * 1000
    ]
  }

  private func createRestoreFailedEvent(_ event: RestoreFailedEvent) -> [String: Any] {
    return [
      "type": "restoreFailed",
      "flowId": event.flowId,
      "screenId": event.screenId,
      "componentId": event.componentId,
      "provider": event.provider,
      "error": RNSetgreetPurchaseCoding.encode(event.error),
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

  // `identifyUser`, `resetUser`, `trackEvent`, `trackScreen` and `showFlow`
  // run on the main queue, behind `initialize` (see there).

  @objc(identifyUser:attributes:operation:locale:)
  func identifyUser(userId: String, attributes: NSDictionary?, operation: String?, locale: String?) {
    let op: SetgreetSDK.Operation = (operation?.lowercased() == "update") ? .update : .create
    let userAttributes = attributes as? [String: Any]

    DispatchQueue.main.async {
      Setgreet.shared.identifyUser(
        userId: userId,
        attributes: userAttributes,
        operation: op,
        locale: locale
      )
    }
  }

  @objc(resetUser)
  func resetUser() {
    DispatchQueue.main.async {
      Setgreet.shared.resetUser()
    }
  }

  @objc(trackEvent:properties:)
  func trackEvent(eventName: String, properties: NSDictionary?) {
    let eventProperties = properties as? [String: Any]

    DispatchQueue.main.async {
      Setgreet.shared.trackEvent(eventName: eventName, properties: eventProperties)
    }
  }

  @objc(trackScreen:properties:)
  func trackScreen(screenName: String, properties: NSDictionary?) {
    let screenProperties = properties as? [String: Any]

    DispatchQueue.main.async {
      Setgreet.shared.trackScreen(screenName: screenName, properties: screenProperties)
    }
  }

  @objc(showFlow:)
  func showFlow(flowId: String) {
    DispatchQueue.main.async {
      Setgreet.shared.showFlow(flowId: flowId)
    }
  }

  // MARK: - Purchase Providers

  /// Registers a proxy provider that forwards every call to the JS provider.
  ///
  /// Inline, not on the main queue: an `identifyUser` / `resetUser` that
  /// follows it is queued on the main queue, so it runs after the
  /// registration and finds the provider. The SDK's registration is
  /// lock-guarded and safe from any thread. Its preload still runs after
  /// `initialize` (see RNSetgreetPurchaseBridge.swift).
  @objc(setPurchaseProvider:defaultSource:)
  func setPurchaseProvider(_ providerId: String, defaultSource: NSDictionary?) {
    purchaseBridge.attach(sender: self)
    let provider = RNSetgreetPurchaseProvider(providerId: providerId, bridge: purchaseBridge)
    let source = RNSetgreetPurchaseCoding.source(from: defaultSource as? [String: Any])
    Setgreet.shared.setPurchaseProvider(provider, defaultSource: source)
  }

  /// JS answered a purchase request.
  @objc(resolvePurchaseRequest:result:error:)
  func resolvePurchaseRequest(_ requestId: String, result: NSDictionary?, error: NSDictionary?) {
    purchaseBridge.resolve(
      requestId: requestId,
      result: result as? [String: Any],
      error: error as? [String: Any]
    )
  }

  func sendPurchaseRequest(_ body: [String: Any]) {
    sendEvent(withName: RNSetgreetPurchaseBridge.requestEventName, body: body)
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
