#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(RNSetgreet, NSObject)

RCT_EXTERN_METHOD(initialize:(NSString *)appKey
                  config:(NSDictionary *)config)

RCT_EXTERN_METHOD(identifyUser:(NSString *)userId
                  attributes:(NSDictionary *)attributes)

RCT_EXTERN_METHOD(resetUser)

RCT_EXTERN_METHOD(trackEvent:(NSString *)eventName
                  properties:(NSDictionary *)properties)

RCT_EXTERN_METHOD(trackScreen:(NSString *)screenName
                  properties:(NSDictionary *)properties)

RCT_EXTERN_METHOD(showFlow:(NSString *)flowId)

@end
