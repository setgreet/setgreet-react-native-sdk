#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(RNSetgreet, RCTEventEmitter)

RCT_EXTERN_METHOD(initialize:(NSString *)appKey
                  config:(NSDictionary *)config)

RCT_EXTERN_METHOD(identifyUser:(NSString *)userId
                  attributes:(NSDictionary *)attributes
                  operation:(NSString *)operation
                  locale:(NSString *)locale)

RCT_EXTERN_METHOD(resetUser)

RCT_EXTERN_METHOD(trackEvent:(NSString *)eventName
                  properties:(NSDictionary *)properties)

RCT_EXTERN_METHOD(trackScreen:(NSString *)screenName
                  properties:(NSDictionary *)properties)

RCT_EXTERN_METHOD(showFlow:(NSString *)flowId)

RCT_EXTERN_METHOD(addListener:(NSString *)eventName)

RCT_EXTERN_METHOD(removeListeners:(double)count)

@end
