require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNSetgreet"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "13.0" }
  s.source       = { :git => "https://github.com/setgreet/setgreet-react-native-sdk.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{swift,m,h}"
  
  s.swift_version = '5.0'
  s.ios.frameworks = 'UIKit'

  # SetgreetSDK should be added via Swift Package Manager
  # Add this to your iOS project: https://github.com/setgreet/setgreet-ios-sdk
  # This podspec assumes SetgreetSDK is available in the project
  
  install_modules_dependencies(s)
end
