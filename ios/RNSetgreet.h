#import <React/RCTEventEmitter.h>

// The React Native module: a TurboModule under the New Architecture (it
// conforms to the codegen spec), a bridge module under the old one. The
// logic lives in Swift (RNSetgreetImpl, RNSetgreet.swift).
#ifdef RCT_NEW_ARCH_ENABLED
#import <RNSetgreetSpec/RNSetgreetSpec.h>

@interface RNSetgreet : RCTEventEmitter <NativeRNSetgreetSpec>
#else
@interface RNSetgreet : RCTEventEmitter
#endif

@end
