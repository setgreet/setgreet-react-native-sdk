import Foundation
import React
import SetgreetSDK

@objc(RNSetgreet)
class RNSetgreet: NSObject, RCTBridgeModule {
  static func moduleName() -> String! {
    return "RNSetgreet"
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc(initialize:config:)
  func initialize(appKey: String, config: NSDictionary?) {
    let debug = (config?["debugMode"] as? Bool) ?? false
    
    Setgreet.shared.initialize(
      appKey: appKey,
      config: .init(debugMode: debug)
    )
  }
  
  @objc(identifyUser:attributes:)
  func identifyUser(userId: String, attributes: NSDictionary?) {
    Setgreet.shared.identifyUser(userId: userId, attributes: attributes as? [String: Any])
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
    Setgreet.shared.showFlow(flowId: flowId)
  }
}


