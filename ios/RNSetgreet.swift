import Foundation
import SetgreetSDK
// Present only when the app opted in with the `RNSetgreet/Lottie` pod.
#if canImport(SetgreetSDKLottie)
import SetgreetSDKLottie
#endif

/// The module's logic. `RNSetgreet.mm` is the React Native module, under both
/// architectures: it owns one instance, forwards every JS call to it and
/// emits the events it produces (an `RCTEventEmitter`, so `NativeEventEmitter`
/// subscriptions work unchanged).
@objc(RNSetgreetImpl)
public final class RNSetgreetImpl: NSObject, RNSetgreetPurchaseRequestSending {
  private static let eventName = "SetgreetFlowEvent"

  /// The events the module emits: flow events and purchase requests.
  @objc public static let supportedEvents = [eventName, RNSetgreetPurchaseBridge.requestEventName]

  private let emit: (String, [String: Any]) -> Void
  private var hasListeners = false
  private let purchaseBridge = RNSetgreetPurchaseBridge()

  /// - Parameter emitter: Sends an event (name, body) to JS.
  @objc public init(emitter: @escaping (String, [String: Any]) -> Void) {
    emit = emitter
    super.init()
  }

  /// Whether JS listens for the module's events (the module's
  /// `startObserving` / `stopObserving`).
  @objc(setListening:)
  public func setListening(_ listening: Bool) {
    hasListeners = listening
    purchaseBridge.setListening(listening)
  }

  /// The JS context is going away (reload, teardown): every purchase call
  /// waiting on JS fails now instead of hanging.
  @objc
  public func invalidate() {
    purchaseBridge.invalidate()
  }

  /// Hands `initialize` to the SDK on the main queue. Every call that needs an
  /// initialized SDK (`identifyUser`, `resetUser`, `trackEvent`, `trackScreen`,
  /// `showFlow`) is queued there too, FIFO behind it: on a fresh install, one
  /// that reached the SDK first would build a request with no app key, which
  /// the SDK treats as a fatal error. `setPurchaseProvider` stays inline (see
  /// there).
  @objc(initialize:config:)
  public func initialize(appKey: String, config: NSDictionary?) {
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
        .onCustomAction { [weak self] event in
          self?.sendFlowEvent(self?.createCustomActionEvent(event))
        }
        .onTrackEvent { [weak self] event in
          self?.sendFlowEvent(self?.createTrackEventEvent(event))
        }
        .onRemindLater { [weak self] event in
          self?.sendFlowEvent(self?.createRemindLaterEvent(event))
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
    emit(RNSetgreetImpl.eventName, body)
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
      // The SDK reports the canonical snake_case name (`remind_later`,
      // `request_notification_permission`), which lower-casing leaves as is.
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

  private func createCustomActionEvent(_ event: CustomActionEvent) -> [String: Any] {
    return [
      "type": "customAction",
      "flowId": event.flowId,
      "screenIndex": event.screenIndex,
      "data": jsonObject(event.data),
      "timestamp": event.timestamp * 1000
    ]
  }

  private func createTrackEventEvent(_ event: TrackEventEvent) -> [String: Any] {
    return [
      "type": "trackEvent",
      "flowId": event.flowId,
      "screenIndex": event.screenIndex,
      "eventName": event.eventName,
      "properties": jsonObject(event.properties),
      "timestamp": event.timestamp * 1000
    ]
  }

  private func createRemindLaterEvent(_ event: RemindLaterEvent) -> [String: Any] {
    return [
      "type": "remindLater",
      "flowId": event.flowId,
      "screenIndex": event.screenIndex,
      "timestamp": event.timestamp * 1000
    ]
  }

  /// A payload dictionary React Native can carry (`NSNull` when absent): it
  /// rejects any value that is not a JSON type, so anything else is sent as
  /// its description.
  private func jsonObject(_ values: [String: Any]?) -> Any {
    guard let values = values else { return NSNull() }
    return values.mapValues(jsonValue)
  }

  private func jsonValue(_ value: Any) -> Any {
    // An `Optional` boxed in `Any` (a nil value in the payload) would
    // otherwise fall through to `default` and reach JS as the string "nil".
    guard let value = unwrapped(value) else { return NSNull() }
    switch value {
    case is NSNull, is String, is Bool, is Int, is Double, is NSNumber:
      return value
    case let dictionary as [String: Any]:
      return dictionary.mapValues(jsonValue)
    case let array as [Any]:
      return array.map(jsonValue)
    default:
      return String(describing: value)
    }
  }

  /// The value inside any `Optional` layers, or `nil` for an empty one.
  private func unwrapped(_ value: Any) -> Any? {
    let mirror = Mirror(reflecting: value)
    guard mirror.displayStyle == .optional else { return value }
    guard let wrapped = mirror.children.first else { return nil }
    return unwrapped(wrapped.value)
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
  public func getAnonymousId() -> String? {
    return Setgreet.shared.anonymousId
  }

  /// Registers the optional Lottie component. Returns whether Lottie can
  /// render: false when the app did not install the `RNSetgreet/Lottie` pod,
  /// in which case a Lottie component in a flow renders nothing.
  ///
  /// The registry is read on the main queue while a flow renders, so the
  /// registration is queued there too, ahead of any later `showFlow`.
  @objc(registerLottie)
  public func registerLottie() -> Bool {
    #if canImport(SetgreetSDKLottie)
    DispatchQueue.main.async {
      SetgreetLottie.register()
    }
    return true
    #else
    return false
    #endif
  }

  // `identifyUser`, `resetUser`, `trackEvent`, `trackScreen` and `showFlow`
  // run on the main queue, behind `initialize` (see there).

  @objc(identifyUser:attributes:operation:locale:)
  public func identifyUser(userId: String, attributes: NSDictionary?, operation: String?, locale: String?) {
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
  public func resetUser() {
    DispatchQueue.main.async {
      Setgreet.shared.resetUser()
    }
  }

  @objc(trackEvent:properties:)
  public func trackEvent(eventName: String, properties: NSDictionary?) {
    let eventProperties = properties as? [String: Any]

    DispatchQueue.main.async {
      Setgreet.shared.trackEvent(eventName: eventName, properties: eventProperties)
    }
  }

  @objc(trackScreen:properties:)
  public func trackScreen(screenName: String, properties: NSDictionary?) {
    let screenProperties = properties as? [String: Any]

    DispatchQueue.main.async {
      Setgreet.shared.trackScreen(screenName: screenName, properties: screenProperties)
    }
  }

  @objc(showFlow:)
  public func showFlow(flowId: String) {
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
  public func setPurchaseProvider(_ providerId: String, defaultSource: NSDictionary?) {
    purchaseBridge.attach(sender: self)
    let provider = RNSetgreetPurchaseProvider(providerId: providerId, bridge: purchaseBridge)
    let source = RNSetgreetPurchaseCoding.source(from: defaultSource as? [String: Any])
    Setgreet.shared.setPurchaseProvider(provider, defaultSource: source)
  }

  /// JS answered a purchase request.
  @objc(resolvePurchaseRequest:result:error:)
  public func resolvePurchaseRequest(_ requestId: String, result: NSDictionary?, error: NSDictionary?) {
    purchaseBridge.resolve(
      requestId: requestId,
      result: result as? [String: Any],
      error: error as? [String: Any]
    )
  }

  func sendPurchaseRequest(_ body: [String: Any]) {
    emit(RNSetgreetPurchaseBridge.requestEventName, body)
  }
}
