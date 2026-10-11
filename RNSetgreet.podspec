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

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  # The Objective-C++ module header imports the codegen spec (C++), so it must
  # stay out of the umbrella header the Swift sources compile against.
  s.private_header_files = "ios/**/*.h"

  s.swift_version = '5.0'
  s.ios.frameworks = 'UIKit'

  # SetgreetSDK dependency - this will be resolved by the main app's Podfile
  s.dependency 'SetgreetSDK', '1.6.0'

  # React Native's helper: React-Core, the codegen spec and, under the New
  # Architecture, RCT_NEW_ARCH_ENABLED. Older React Native versions lack it.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency 'React-Core'
  end
end
