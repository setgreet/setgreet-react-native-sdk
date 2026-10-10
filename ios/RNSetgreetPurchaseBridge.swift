import Foundation
import SetgreetSDK

// The native half of the purchase-provider bridge.
//
// `RNSetgreetPurchaseProvider` is the `SetgreetPurchaseProvider` the wrapper
// registers with the native SDK when JS calls `setPurchaseProvider`. Each
// call the SDK makes on it becomes a `SetgreetPurchaseRequest` event
// `{ requestId, method, args }`; JS runs the registered JS provider and
// answers with `resolvePurchaseRequest(requestId, result, error)`, which
// resumes the waiting call exactly once. `trackPaywallImpression` and
// `setAttributes` are fire-and-forget (no `requestId`, no answer).
//
// Requests leave from the main queue. The wrapper hands `initialize` to the
// SDK on the main queue too, and JS calls `initialize` before
// `setPurchaseProvider`, so the module enqueues that block on the (serial)
// main queue before it registers the provider. The registration-time preload
// (`loadProducts` of the default source) therefore leaves only after
// `Setgreet.shared.initialize` has stored the app key, and the catalog sync
// that runs once JS answers sees it.
//
// No JS to answer (the JS context was torn down, or nothing listens for the
// request event) fails a call at once: `loadProducts` throws, `purchase` and
// `restorePurchases` report `failed` (`notConfigured`), `accessState` is nil
// and `identify` / `reset` return.

// MARK: - Bridge

protocol RNSetgreetPurchaseRequestSending: AnyObject {
  func sendPurchaseRequest(_ body: [String: Any])
}

/// Thread-safe: every mutable property is read and written under `lock`.
final class RNSetgreetPurchaseBridge: @unchecked Sendable {
  static let requestEventName = "SetgreetPurchaseRequest"

  /// The safety net for `loadProducts` and `accessState`: longer than the
  /// native SDK's own 10 s timeout, so that one governs wherever the SDK sets
  /// it, and a JS promise that never settles is not waited on forever. The
  /// other calls get none: a store sheet can stay open for minutes, and the
  /// SDK runs `identify` / `reset` one after another, so ending one early
  /// would let the next one run alongside it. Teardown still ends them.
  static let safetyTimeout: TimeInterval = 30

  enum Answer {
    case result([String: Any])
    case failure(SetgreetPurchaseError)
    case unavailable
    case timedOut
  }

  /// No JS provider can answer (none listening, JS torn down or reloading).
  /// Reported as `notConfigured` rather than `unknown`, so the error code says
  /// the provider was unavailable; the SDK still records a failed purchase.
  static let unavailableError = SetgreetPurchaseError(
    code: .notConfigured,
    message: "The JavaScript purchase provider is unavailable"
  )

  private let lock = NSLock()
  private weak var sender: RNSetgreetPurchaseRequestSending?
  private var isListening = false
  private var isInvalidated = false
  private var pending: [String: CheckedContinuation<Answer, Never>] = [:]

  deinit {
    // Never reached with a call in flight (a waiting call keeps the bridge
    // alive), kept so no continuation can leak.
    drain()
  }

  /// The module that emits the request events. Held weakly.
  func attach(sender: RNSetgreetPurchaseRequestSending) {
    lock.lock()
    self.sender = sender
    lock.unlock()
  }

  /// Whether JS listens for the module's events (`startObserving` /
  /// `stopObserving`). The JS request listener, once added, is never removed
  /// while its JS context lives.
  func setListening(_ listening: Bool) {
    lock.lock()
    isListening = listening
    lock.unlock()
  }

  /// The JS context is going away: every waiting call fails now, and every
  /// later one at once.
  func invalidate() {
    lock.lock()
    isInvalidated = true
    lock.unlock()
    drain()
  }

  /// Sends a request and waits for its answer, or for `timeout` when set.
  func request(method: String, args: [String: Any], timeout: TimeInterval?) async -> Answer {
    await withCheckedContinuation { (continuation: CheckedContinuation<Answer, Never>) in
      let requestId = UUID().uuidString
      lock.lock()
      guard isListening, !isInvalidated, sender != nil else {
        lock.unlock()
        continuation.resume(returning: .unavailable)
        return
      }
      pending[requestId] = continuation
      lock.unlock()

      if let timeout = timeout {
        DispatchQueue.global().asyncAfter(deadline: .now() + timeout) { [weak self] in
          self?.settle(requestId, with: .timedOut)
        }
      }
      send(
        RequestBody(value: ["requestId": requestId, "method": method, "args": args]),
        awaiting: requestId
      )
    }
  }

  /// Sends a fire-and-forget request; dropped when no JS listens.
  func notify(method: String, args: [String: Any]) {
    send(RequestBody(value: ["requestId": NSNull(), "method": method, "args": args]), awaiting: nil)
  }

  /// A request body handed to the main queue. Built once, never mutated.
  private struct RequestBody: @unchecked Sendable {
    let value: [String: Any]
  }

  /// Emits `body` from the main queue (see the file header). A request that
  /// can no longer be delivered by then fails at once.
  private func send(_ body: RequestBody, awaiting requestId: String?) {
    DispatchQueue.main.async {
      self.lock.lock()
      let sender = (self.isListening && !self.isInvalidated) ? self.sender : nil
      self.lock.unlock()
      guard let sender = sender else {
        if let requestId = requestId {
          self.settle(requestId, with: .unavailable)
        }
        return
      }
      sender.sendPurchaseRequest(body.value)
    }
  }

  /// JS answered `requestId`. An unknown or already settled id is ignored
  /// (a late answer after a timeout).
  func resolve(requestId: String, result: [String: Any]?, error: [String: Any]?) {
    if let error = error {
      settle(requestId, with: .failure(RNSetgreetPurchaseCoding.decodeError(error)))
    } else {
      settle(requestId, with: .result(result ?? [:]))
    }
  }

  private func settle(_ requestId: String, with answer: Answer) {
    lock.lock()
    let continuation = pending.removeValue(forKey: requestId)
    lock.unlock()
    continuation?.resume(returning: answer)
  }

  private func drain() {
    lock.lock()
    let waiting = Array(pending.values)
    pending.removeAll()
    lock.unlock()
    waiting.forEach { $0.resume(returning: .unavailable) }
  }
}

// MARK: - Proxy provider

final class RNSetgreetPurchaseProvider: SetgreetPurchaseProvider {
  let providerId: String
  private let bridge: RNSetgreetPurchaseBridge

  init(providerId: String, bridge: RNSetgreetPurchaseBridge) {
    self.providerId = providerId
    self.bridge = bridge
  }

  func loadProducts(_ source: SetgreetPurchaseSource) async throws -> [SetgreetPurchaseProduct] {
    let answer = await bridge.request(
      method: "loadProducts",
      args: ["source": RNSetgreetPurchaseCoding.encode(source)],
      timeout: RNSetgreetPurchaseBridge.safetyTimeout
    )
    switch answer {
    case .result(let result):
      return RNSetgreetPurchaseCoding.products(result["products"])
    case .failure(let error):
      throw error
    case .unavailable:
      throw RNSetgreetPurchaseBridge.unavailableError
    case .timedOut:
      throw RNSetgreetPurchaseProvider.timeoutError("loadProducts")
    }
  }

  func purchase(productRef: String, source: SetgreetPurchaseSource) async -> SetgreetPurchaseResult {
    let answer = await bridge.request(
      method: "purchase",
      args: ["productRef": productRef, "source": RNSetgreetPurchaseCoding.encode(source)],
      timeout: nil
    )
    switch answer {
    case .result(let result):
      return RNSetgreetPurchaseCoding.purchaseResult(result, requestedRef: productRef)
    case .failure(let error):
      return SetgreetPurchaseResult(status: .failed, productRef: productRef, error: error)
    case .unavailable, .timedOut:
      return SetgreetPurchaseResult(
        status: .failed, productRef: productRef, error: RNSetgreetPurchaseBridge.unavailableError
      )
    }
  }

  func restorePurchases() async -> SetgreetRestoreResult {
    let answer = await bridge.request(method: "restorePurchases", args: [:], timeout: nil)
    switch answer {
    case .result(let result):
      return RNSetgreetPurchaseCoding.restoreResult(result)
    case .failure(let error):
      return SetgreetRestoreResult(status: .failed, error: error)
    case .unavailable, .timedOut:
      return SetgreetRestoreResult(status: .failed, error: RNSetgreetPurchaseBridge.unavailableError)
    }
  }

  func accessState() async -> SetgreetPurchaseAccessState? {
    let answer = await bridge.request(
      method: "accessState", args: [:], timeout: RNSetgreetPurchaseBridge.safetyTimeout
    )
    guard case .result(let result) = answer else { return nil }
    return RNSetgreetPurchaseCoding.accessState(result["accessState"])
  }

  func trackPaywallImpression(_ context: SetgreetPaywallImpressionContext) {
    bridge.notify(
      method: "trackPaywallImpression",
      args: ["context": RNSetgreetPurchaseCoding.encode(context)]
    )
  }

  func setAttributes(_ attributes: [String: String]) {
    bridge.notify(method: "setAttributes", args: ["attributes": attributes])
  }

  // No time limit: the SDK runs `identify` / `reset` one after another.
  func identify(userId: String) async {
    _ = await bridge.request(method: "identify", args: ["userId": userId], timeout: nil)
  }

  func reset() async {
    _ = await bridge.request(method: "reset", args: [:], timeout: nil)
  }

  private static func timeoutError(_ method: String) -> SetgreetPurchaseError {
    SetgreetPurchaseError(
      code: .networkError,
      providerCode: "timeout",
      message: "The JavaScript provider's \(method) did not answer within \(Int(RNSetgreetPurchaseBridge.safetyTimeout))s"
    )
  }
}

// MARK: - Coding

/// Converts between the native purchase models and the JS bridge values.
/// What JS sends is validated defensively: a product without a `ref` or a
/// numeric `priceAmount` is dropped, an unknown status is `failed`, an
/// unknown error code is `unknown`, a missing array is empty.
enum RNSetgreetPurchaseCoding {

  // Native → JS

  static func encode(_ source: SetgreetPurchaseSource) -> [String: Any] {
    [
      "sourceType": source.sourceType,
      "sourceId": source.sourceId ?? NSNull(),
    ]
  }

  static func encode(_ context: SetgreetPaywallImpressionContext) -> [String: Any] {
    [
      "flowId": context.flowId,
      "screenId": context.screenId,
      "source": encode(context.source),
      "productRefs": context.productRefs,
    ]
  }

  static func encode(_ error: SetgreetPurchaseError) -> [String: Any] {
    [
      "code": error.code.rawValue,
      "providerCode": error.providerCode ?? NSNull(),
      "message": error.message ?? NSNull(),
    ]
  }

  // JS → native

  static func source(from value: [String: Any]?) -> SetgreetPurchaseSource {
    let sourceType = nonEmptyString(value?["sourceType"]) ?? SetgreetPurchaseSource.currentOffering.sourceType
    return SetgreetPurchaseSource(sourceType: sourceType, sourceId: nonEmptyString(value?["sourceId"]))
  }

  static func products(_ value: Any?) -> [SetgreetPurchaseProduct] {
    guard let list = value as? [Any] else { return [] }
    return list.compactMap(product)
  }

  static func product(_ value: Any) -> SetgreetPurchaseProduct? {
    guard let product = value as? [String: Any],
          let ref = nonEmptyString(product["ref"]),
          let priceAmount = decimal(product["priceAmount"]) else {
      return nil
    }
    return SetgreetPurchaseProduct(
      ref: ref,
      storeProductId: string(product["storeProductId"]) ?? "",
      title: string(product["title"]),
      description: string(product["description"]),
      localizedPrice: string(product["localizedPrice"]) ?? "",
      priceAmount: priceAmount,
      currencyCode: string(product["currencyCode"]) ?? "",
      period: period(product["period"]),
      introOffer: introOffer(product["introOffer"])
    )
  }

  static func purchaseResult(_ result: [String: Any], requestedRef: String) -> SetgreetPurchaseResult {
    let productRef = nonEmptyString(result["productRef"]) ?? requestedRef
    let accessRefs = strings(result["accessRefs"])
    let error = (result["error"] as? [String: Any]).map(decodeError)
    guard let raw = result["status"] as? String, let status = SetgreetPurchaseStatus(rawValue: raw) else {
      return SetgreetPurchaseResult(
        status: .failed,
        productRef: productRef,
        accessRefs: accessRefs,
        error: error ?? SetgreetPurchaseError(code: .unknown, message: "Unknown purchase status")
      )
    }
    return SetgreetPurchaseResult(status: status, productRef: productRef, accessRefs: accessRefs, error: error)
  }

  static func restoreResult(_ result: [String: Any]) -> SetgreetRestoreResult {
    let accessRefs = strings(result["accessRefs"])
    let error = (result["error"] as? [String: Any]).map(decodeError)
    guard let raw = result["status"] as? String, let status = SetgreetRestoreStatus(rawValue: raw) else {
      return SetgreetRestoreResult(
        status: .failed,
        accessRefs: accessRefs,
        error: error ?? SetgreetPurchaseError(code: .unknown, message: "Unknown restore status")
      )
    }
    return SetgreetRestoreResult(status: status, accessRefs: accessRefs, error: error)
  }

  static func accessState(_ value: Any?) -> SetgreetPurchaseAccessState? {
    guard let state = value as? [String: Any] else { return nil }
    let accessRefs = strings(state["accessRefs"])
    return SetgreetPurchaseAccessState(active: bool(state["active"]) ?? !accessRefs.isEmpty, accessRefs: accessRefs)
  }

  static func decodeError(_ value: [String: Any]) -> SetgreetPurchaseError {
    let code = (value["code"] as? String).flatMap(SetgreetPurchaseErrorCode.init(rawValue:)) ?? .unknown
    return SetgreetPurchaseError(code: code, providerCode: string(value["providerCode"]), message: string(value["message"]))
  }

  // Values

  private static func period(_ value: Any?) -> SetgreetPurchasePeriod? {
    guard let period = value as? [String: Any],
          let rawUnit = period["unit"] as? String,
          let unit = SetgreetPurchasePeriodUnit(rawValue: rawUnit),
          let count = integer(period["count"]), count > 0 else {
      return nil
    }
    return SetgreetPurchasePeriod(unit: unit, count: count)
  }

  private static func introOffer(_ value: Any?) -> SetgreetPurchaseIntroOffer? {
    guard let offer = value as? [String: Any], let type = nonEmptyString(offer["type"]) else { return nil }
    return SetgreetPurchaseIntroOffer(
      type: type,
      localizedPrice: string(offer["localizedPrice"]),
      periodText: string(offer["periodText"]),
      eligible: bool(offer["eligible"])
    )
  }

  private static func string(_ value: Any?) -> String? {
    value as? String
  }

  private static func nonEmptyString(_ value: Any?) -> String? {
    guard let text = value as? String, !text.isEmpty else { return nil }
    return text
  }

  private static func strings(_ value: Any?) -> [String] {
    (value as? [Any])?.compactMap { $0 as? String } ?? []
  }

  private static func isBoolean(_ number: NSNumber) -> Bool {
    CFGetTypeID(number) == CFBooleanGetTypeID()
  }

  private static func bool(_ value: Any?) -> Bool? {
    guard let number = value as? NSNumber, isBoolean(number) else { return nil }
    return number.boolValue
  }

  private static func number(_ value: Any?) -> Double? {
    guard let number = value as? NSNumber, !isBoolean(number) else { return nil }
    let double = number.doubleValue
    return double.isFinite ? double : nil
  }

  private static func integer(_ value: Any?) -> Int? {
    guard let double = number(value), double == double.rounded(), abs(double) <= Double(Int32.max) else {
      return nil
    }
    return Int(double)
  }

  private static let posixLocale = Locale(identifier: "en_US_POSIX")

  /// A JS number crosses as a binary double: convert it through its
  /// shortest decimal string ("49.99"), never straight from the double
  /// (which would give 49.990000000000002). A numeric string is accepted too.
  private static func decimal(_ value: Any?) -> Decimal? {
    if let double = number(value) {
      return Decimal(string: "\(double)", locale: posixLocale)
    }
    if let text = (value as? String)?.trimmingCharacters(in: .whitespaces),
       let double = Double(text), double.isFinite {
      return Decimal(string: text, locale: posixLocale)
    }
    return nil
  }
}
