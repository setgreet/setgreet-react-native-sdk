#import <Foundation/Foundation.h>

// The contract between the two halves of the module: RNSetgreet.mm (the React
// Native module, Objective-C++) and RNSetgreetImpl (RNSetgreet.swift). The
// Objective-C++ side cannot read the Swift compiler's generated interface
// header in every build system this library supports, so the Swift side
// conforms to this protocol instead, and the compiler checks both sides
// against it.

NS_ASSUME_NONNULL_BEGIN

/// Sends an event (name, body) to JavaScript.
typedef void (^RNSetgreetEventEmitter)(NSString *name, NSDictionary<NSString *, id> *body);

/// What the module calls on the Swift implementation.
@protocol RNSetgreetImplementing <NSObject>
- (void)setListening:(BOOL)listening;
- (void)invalidate;
- (void)initialize:(NSString *)appKey config:(nullable NSDictionary *)config;
- (nullable NSString *)getAnonymousId;
- (BOOL)registerLottie;
- (void)identifyUser:(NSString *)userId
          attributes:(nullable NSDictionary *)attributes
           operation:(nullable NSString *)operation
              locale:(nullable NSString *)locale
            userHash:(nullable NSString *)userHash;
- (void)resetUser;
- (void)setLocale:(nullable NSString *)locale;
- (void)trackEvent:(NSString *)eventName properties:(nullable NSDictionary *)properties;
- (void)trackScreen:(NSString *)screenName properties:(nullable NSDictionary *)properties;
- (void)showFlow:(NSString *)flowId;
- (void)setPurchaseProvider:(NSString *)providerId defaultSource:(nullable NSDictionary *)defaultSource;
- (void)resolvePurchaseRequest:(NSString *)requestId
                        result:(nullable NSDictionary *)result
                         error:(nullable NSDictionary *)error;
@end

/// Creates the Swift implementation. Defined in RNSetgreet.swift.
FOUNDATION_EXPORT NSObject<RNSetgreetImplementing> *RNSetgreetMakeImpl(RNSetgreetEventEmitter emitter);

/// The events the module emits. Defined in RNSetgreet.swift.
FOUNDATION_EXPORT NSArray<NSString *> *RNSetgreetSupportedEvents(void);

NS_ASSUME_NONNULL_END
