#!/bin/bash
set -e

echo "🏗️ Downloading SetgreetSDK XCFramework for React Native integration..."

# Configuration
SETGREET_SDK_URL="https://github.com/setgreet/setgreet-ios-sdk.git"
SETGREET_SDK_VERSION="0.3.0"  # Update this to match your SDK version
OUTPUT_DIR="$(pwd)/ios/Frameworks"
TEMP_DIR=$(mktemp -d)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Setting up temporary workspace...${NC}"
cd "$TEMP_DIR"

echo -e "${BLUE}📥 Cloning SetgreetSDK repository...${NC}"
git clone --depth 1 --branch $SETGREET_SDK_VERSION "$SETGREET_SDK_URL" setgreet-sdk

echo -e "${BLUE}🔍 Verifying XCFramework...${NC}"
if [ ! -d "setgreet-sdk/SetgreetSDK.xcframework" ]; then
    echo -e "${RED}❌ SetgreetSDK.xcframework not found in repository${NC}"
    echo -e "${BLUE}📋 Available files:${NC}"
    ls -la setgreet-sdk/
    exit 1
fi

echo -e "${GREEN}✅ Found SetgreetSDK.xcframework${NC}"

# Verify the XCFramework structure
echo -e "${BLUE}📋 XCFramework contents:${NC}"
ls -la setgreet-sdk/SetgreetSDK.xcframework/

echo -e "${BLUE}📋 Copying XCFramework to React Native SDK...${NC}"
mkdir -p "$OUTPUT_DIR"
cp -R setgreet-sdk/SetgreetSDK.xcframework "$OUTPUT_DIR/"

# Cleanup
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo -e "${GREEN}✅ Successfully downloaded SetgreetSDK.xcframework!${NC}"
echo -e "${GREEN}📍 Location: $OUTPUT_DIR/SetgreetSDK.xcframework${NC}"
echo ""
echo -e "${BLUE}🚀 Next steps:${NC}"
echo "1. Commit the XCFramework to the repository:"
echo "   ${GREEN}git add ios/Frameworks/SetgreetSDK.xcframework${NC}"
echo "   ${GREEN}git commit -m \"Add SetgreetSDK XCFramework for seamless integration\"${NC}"
echo ""
echo "2. Setgreet React Native SDK users can now simply run:"
echo "   ${GREEN}npm install react-native-setgreet${NC}"
echo "   ${GREEN}cd ios && pod install${NC}"
echo "   ${GREEN}npx react-native run-ios${NC}"
echo ""