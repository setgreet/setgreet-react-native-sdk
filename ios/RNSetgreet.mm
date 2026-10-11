#import "RNSetgreet.h"

#if __has_include(<RNSetgreet/RNSetgreet-Swift.h>)
#import <RNSetgreet/RNSetgreet-Swift.h>
#else
#import "RNSetgreet-Swift.h"
#endif

// Every method forwards to RNSetgreetImpl. The RCT_EXPORT_* macros register
// the methods with the bridge (old architecture); under the New Architecture
// the codegen spec (getTurboModule:) calls the same Objective-C methods.
// addListener: and removeListeners: come from RCTEventEmitter.
@implementation RNSetgreet {
  RNSetgreetImpl *_impl;
}

RCT_EXPORT_MODULE(RNSetgreet)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if (self = [super init]) {
    __weak RNSetgreet *weakSelf = self;
    _impl = [[RNSetgreetImpl alloc] initWithEmitter:^(NSString *name, NSDictionary<NSString *, id> *body) {
      [weakSelf sendEventWithName:name body:body];
    }];
  }
  return self;
}

#pragma mark - Events

- (NSArray<NSString *> *)supportedEvents
{
  return RNSetgreetImpl.supportedEvents;
}

- (void)startObserving
{
  [_impl setListening:YES];
}

- (void)stopObserving
{
  [_impl setListening:NO];
}

- (void)invalidate
{
  [_impl invalidate];
  [super invalidate];
}

#pragma mark - Methods

RCT_EXPORT_METHOD(initialize:(NSString *)appKey config:(NSDictionary *)config)
{
  [_impl initialize:appKey config:config];
}

RCT_EXPORT_METHOD(identifyUser:(NSString *)userId
                  attributes:(NSDictionary *)attributes
                  operation:(NSString *)operation
                  locale:(NSString *)locale)
{
  [_impl identifyUser:userId attributes:attributes operation:operation locale:locale];
}

RCT_EXPORT_METHOD(resetUser)
{
  [_impl resetUser];
}

RCT_EXPORT_METHOD(trackEvent:(NSString *)eventName properties:(NSDictionary *)properties)
{
  [_impl trackEvent:eventName properties:properties];
}

RCT_EXPORT_METHOD(trackScreen:(NSString *)screenName properties:(NSDictionary *)properties)
{
  [_impl trackScreen:screenName properties:properties];
}

RCT_EXPORT_METHOD(showFlow:(NSString *)flowId)
{
  [_impl showFlow:flowId];
}

// Synchronous under both architectures: runs on the JS thread and returns the
// value (nil = null).
RCT_EXPORT_SYNCHRONOUS_TYPED_METHOD(NSString *, getAnonymousId)
{
  return [_impl getAnonymousId];
}

RCT_EXPORT_METHOD(setPurchaseProvider:(NSString *)providerId defaultSource:(NSDictionary *)defaultSource)
{
  [_impl setPurchaseProvider:providerId defaultSource:defaultSource];
}

RCT_EXPORT_METHOD(resolvePurchaseRequest:(NSString *)requestId
                  result:(NSDictionary *)result
                  error:(NSDictionary *)error)
{
  [_impl resolvePurchaseRequest:requestId result:result error:error];
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRNSetgreetSpecJSI>(params);
}
#endif

@end
