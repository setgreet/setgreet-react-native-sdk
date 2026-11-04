require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNSetgreet"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "15.0" }
  s.source       = { :git => "https://github.com/setgreet/setgreet-react-native-sdk.git", :tag => "#{s.version}" }

  # ios/Frameworks (the vendored xcframeworks) is deliberately not globbed.
  # ios/Interop/RNSetgreetInterop.m only exists for Swift Package Manager (a
  # target needs one source file), so CocoaPods takes the header alone.
  s.source_files = "ios/*.{h,m,mm,swift,cpp}", "ios/include/**/*.h", "ios/Interop/include/**/*.h"
  # The Objective-C++ module header imports the codegen spec (C++), so it must
  # stay out of the umbrella header the Swift sources compile against. The
  # interop protocol is in it on purpose: that is how the Swift sources see it.
  s.private_header_files = "ios/include/**/*.h"
  s.public_header_files = "ios/Interop/include/**/*.h"

  s.swift_version = '5.0'
  s.ios.frameworks = 'UIKit'

  # The native SDK ships inside this package (ios/Frameworks, copied from
  # https://github.com/setgreet/setgreet-ios-sdk at the version Package.swift
  # pins), so no pod repository is involved. Autolinking installs this spec as
  # a `:path` pod, which is why the binaries are vendored rather than fetched.
  s.vendored_frameworks = 'ios/Frameworks/SetgreetSDK.xcframework'

  # `pod 'RNSetgreet'` (what autolinking adds) installs the root spec only, so
  # apps that don't opt in to Lottie keep a Lottie-free build.
  s.default_subspecs = :none

  # Opt-in Lottie support: `pod 'RNSetgreet/Lottie', :path => ...` in the app's
  # Podfile adds the SetgreetSDKLottie module (and lottie-ios), which
  # `registerLottie()` then registers. Both xcframeworks come from the same
  # native SDK release (SetgreetSDKLottie requires that exact SetgreetSDK
  # build). The lottie-ios constraint mirrors SetgreetSDKLottie.podspec.
  s.subspec 'Lottie' do |ss|
    ss.vendored_frameworks = 'ios/Frameworks/SetgreetSDKLottie.xcframework'
    ss.dependency 'lottie-ios', '~> 4.6'
  end

  # React Native's helper: React-Core, the codegen spec and, under the New
  # Architecture, RCT_NEW_ARCH_ENABLED. Older React Native versions lack it.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency 'React-Core'
  end
end
