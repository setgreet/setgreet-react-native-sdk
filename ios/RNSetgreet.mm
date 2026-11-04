// ios/include/RNSetgreet/RNSetgreet.h: the module's public headers directory
// under Swift Package Manager, a private header under CocoaPods, and
// <RNSetgreet/RNSetgreet.h> in both.
#import <RNSetgreet/RNSetgreet.h>

// The Swift half, through the protocol in ios/Interop (its own module under
// Swift Package Manager, a public header of this pod under CocoaPods).
#if __has_include(<RNSetgreetInterop/RNSetgreetInterop.h>)
#import <RNSetgreetInterop/RNSetgreetInterop.h>
#else
#import "RNSetgreetInterop.h"
#endif

// Every method forwards to RNSetgreetImpl. The RCT_EXPORT_* macros register
// the methods with the bridge (old architecture); under the New Architecture
// the codegen spec (getTurboModule:) calls the same Objective-C methods.
// addListener: and removeListeners: come from RCTEventEmitter.
@implementation RNSetgreet {
  NSObject<RNSetgreetImplementing> *_impl;
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
    _impl = RNSetgreetMakeImpl(^(NSString *name, NSDictionary<NSString *, id> *body) {
      [weakSelf sendEventWithName:name body:body];
    });
  }
  return self;
}

#pragma mark - Events

- (NSArray<NSString *> *)supportedEvents
{
  return RNSetgreetSupportedEvents();
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
                  locale:(NSString *)locale
                  userHash:(NSString *)userHash)
{
  [_impl identifyUser:userId attributes:attributes operation:operation locale:locale userHash:userHash];
}

RCT_EXPORT_METHOD(resetUser)
{
  [_impl resetUser];
}

RCT_EXPORT_METHOD(setLocale:(NSString *)locale)
{
  [_impl setLocale:locale];
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

// Synchronous: returns whether Lottie can render (see RNSetgreetImpl).
RCT_EXPORT_SYNCHRONOUS_TYPED_METHOD(NSNumber *, registerLottie)
{
  return @([_impl registerLottie]);
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
