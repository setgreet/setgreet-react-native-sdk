#if RCT_NEW_ARCH_ENABLED
import Foundation
import React
import SetgreetSDK

@objc(RNSetgreetSpec)
class RNSetgreetSpec: NSObject, RCTTurboModule {
  static func moduleName() -> String! {
    return "RNSetgreet"
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func initialize(appKey: String, config: NSDictionary?) {
    let debug = (config?["debugMode"] as? Bool) ?? false
    
    Setgreet.shared.initialize(
      appKey: appKey,
      config: .init(debugMode: debug)
    )
  }
  
  @objc
  func identifyUser(userId: String, attributes: NSDictionary?) {
    Setgreet.shared.identifyUser(userId: userId, attributes: attributes as? [String: Any])
  }
  
  @objc
  func resetUser() {
    Setgreet.shared.resetUser()
  }
  
  @objc
  func trackEvent(eventName: String, properties: NSDictionary?) {
    Setgreet.shared.trackEvent(eventName: eventName, properties: properties as? [String: Any])
  }
  
  @objc
  func trackScreen(screenName: String, properties: NSDictionary?) {
    Setgreet.shared.trackScreen(screenName: screenName, properties: properties as? [String: Any])
  }
  
  @objc
  func showFlow(flowId: String) {
    Setgreet.shared.showFlow(flowId: flowId)
  }
}
#endif