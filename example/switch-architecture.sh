#!/bin/bash

# Setgreet React Native SDK Architecture Switcher
# Usage: ./switch-architecture.sh [legacy|new]

ARCH_TYPE=${1:-new}

if [ "$ARCH_TYPE" = "legacy" ]; then
    echo "🔄 Switching to LEGACY architecture..."
    export RCT_NEW_ARCH_ENABLED=0
    cd ios
    rm -rf Pods Podfile.lock build
    pod install
    cd ..
    echo "✅ Legacy architecture installed successfully!"
    echo "🚀 Run: npx react-native run-ios"
elif [ "$ARCH_TYPE" = "new" ]; then
    echo "🔄 Switching to NEW architecture..."
    export RCT_NEW_ARCH_ENABLED=1
    cd ios
    rm -rf Pods Podfile.lock build
    pod install
    cd ..
    echo "✅ New architecture installed successfully!"
    echo "🚀 Run: npx react-native run-ios"
else
    echo "❌ Invalid architecture type. Use 'legacy' or 'new'"
    echo "Usage: ./switch-architecture.sh [legacy|new]"
    exit 1
fi
