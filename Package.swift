// swift-tools-version: 5.9
//
// Swift Package Manager manifest for React Native's Swift Package Manager
// mode (`npx react-native spm`, experimental in React Native 0.87/0.88).
// CocoaPods installs this library through RNSetgreet.podspec and does not read
// this file.
//
// React Native's autolinker references this manifest through a symlink at
// <app>/ios/build/generated/autolinking/libs/RNSetgreet and resolves the
// relative package paths below from there, the same way the manifests
// `npx react-native spm scaffold` generates do:
//   ../../../../xcframeworks  -> <app>/ios/build/xcframeworks (React Native)
//   ../../../ios              -> <app>/ios/build/generated/ios (the app's
//                                codegen package, which vends RNSetgreetSpec)
// Outside an app set up that way those two packages do not exist, so the
// manifest resolves only in place.
//
// One pod becomes three targets: SwiftPM compiles one language per target, so
// the Swift sources (RNSetgreetSwift) and the Objective-C++ module that React
// Native loads (RNSetgreet, the product the autolinker links) are split. They
// meet in RNSetgreetInterop, an Objective-C protocol the Swift side conforms
// to: Xcode hands a Swift target's generated interface to C-family targets as
// a clang module, which an Objective-C++ source cannot import.
//
// Lottie: add the `SetgreetSDKLottie` product of setgreet-ios-sdk and the
// `Lottie` product of https://github.com/airbnb/lottie-spm.git to the APP
// target, then call `registerLottie()` from JavaScript. This package does not
// depend on them, so apps without Lottie animations stay Lottie-free.

import PackageDescription

// Kept in step with the xcframeworks vendored in ios/Frameworks for CocoaPods
// (both are updated by .github/workflows/update-native-sdk.yml).
let setgreetSDKVersion: Version = "1.12.2"

let package = Package(
    name: "RNSetgreet",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "RNSetgreet", targets: ["RNSetgreet"]),
    ],
    dependencies: [
        .package(url: "https://github.com/setgreet/setgreet-ios-sdk.git", exact: setgreetSDKVersion),
        .package(name: "ReactNative", path: "../../../../xcframeworks"),
        .package(name: "React-GeneratedCode", path: "../../../ios"),
    ],
    targets: [
        // The contract between the Objective-C++ module and the Swift
        // implementation (header-only).
        .target(
            name: "RNSetgreetInterop",
            path: "ios/Interop",
            publicHeadersPath: "include"
        ),
        // The module's logic (RNSetgreetImpl and the purchase bridge).
        .target(
            name: "RNSetgreetSwift",
            dependencies: [
                "RNSetgreetInterop",
                .product(name: "SetgreetSDK", package: "setgreet-ios-sdk"),
            ],
            path: "ios",
            exclude: ["Frameworks", "Interop", "include", "RNSetgreet.mm"],
            sources: ["RNSetgreet.swift", "RNSetgreetPurchaseBridge.swift"],
            linkerSettings: [.linkedFramework("UIKit")]
        ),
        // The React Native module: a TurboModule conforming to the codegen
        // spec (RNSetgreetSpec, generated into the app's codegen package).
        .target(
            name: "RNSetgreet",
            dependencies: [
                "RNSetgreetInterop",
                "RNSetgreetSwift",
                .product(name: "ReactHeaders", package: "ReactNative"),
                .product(name: "ReactNativeHeaders", package: "ReactNative"),
                .product(name: "ReactNativeDependenciesHeaders", package: "ReactNative"),
                .product(name: "ReactAppHeaders", package: "React-GeneratedCode"),
            ],
            path: "ios",
            exclude: ["Frameworks", "Interop", "RNSetgreet.swift", "RNSetgreetPurchaseBridge.swift"],
            sources: ["RNSetgreet.mm"],
            publicHeadersPath: "include",
            cxxSettings: [
                // Swift Package Manager mode of React Native is New
                // Architecture only; CocoaPods sets this through
                // install_modules_dependencies.
                .define("RCT_NEW_ARCH_ENABLED", to: "1"),
                // Match the prebuilt React framework's configuration-gated
                // C++ ABI (as the scaffolded manifests do).
                .define("DEBUG", .when(configuration: .debug)),
                .define("NDEBUG", .when(configuration: .release)),
            ],
            linkerSettings: [.linkedFramework("UIKit")]
        ),
    ],
    cxxLanguageStandard: .cxx20
)
