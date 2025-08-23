#!/bin/bash

# Setgreet React Native SDK - iOS Setup Script
# This script helps configure SetgreetSDK via Swift Package Manager

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if we're in a React Native project
check_react_native_project() {
    if [ ! -f "package.json" ]; then
        print_error "This script must be run from the root of a React Native project"
        exit 1
    fi
    
    if [ ! -d "ios" ]; then
        print_error "iOS directory not found. Make sure this is a React Native project with iOS support"
        exit 1
    fi
    
    print_success "React Native project detected"
}

# Function to find Xcode project file
find_xcode_project() {
    local xcodeproj_file=$(find ios -name "*.xcodeproj" -type d | head -n 1)
    local xcworkspace_file=$(find ios -name "*.xcworkspace" -type d | head -n 1)
    
    if [ -n "$xcworkspace_file" ]; then
        echo "$xcworkspace_file"
    elif [ -n "$xcodeproj_file" ]; then
        echo "$xcodeproj_file"
    else
        return 1
    fi
}

# Function to check if SetgreetSDK is already added
check_setgreet_dependency() {
    local project_file=$(find_xcode_project)
    if [ -z "$project_file" ]; then
        return 1
    fi
    
    # Check for SetgreetSDK in project.pbxproj
    if grep -q "SetgreetSDK" "$project_file/project.pbxproj" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to provide manual setup instructions
provide_manual_instructions() {
    echo
    echo "======================================"
    echo "  Manual iOS Setup Instructions"
    echo "======================================"
    echo
    print_status "Follow these steps to add SetgreetSDK to your iOS project:"
    echo
    echo "1. Open your iOS project in Xcode:"
    local project_file=$(find_xcode_project)
    if [ -n "$project_file" ]; then
        echo "   ${BLUE}open $project_file${NC}"
    else
        echo "   ${BLUE}open ios/YourProject.xcworkspace${NC} (or .xcodeproj)"
    fi
    echo
    echo "2. In Xcode, go to:"
    echo "   ${BLUE}File → Add Package Dependencies...${NC}"
    echo
    echo "3. Enter the SetgreetSDK repository URL:"
    echo "   ${GREEN}https://github.com/setgreet/setgreet-ios-sdk${NC}"
    echo
    echo "4. Click ${BLUE}Add Package${NC}"
    echo
    echo "5. Select your app target and click ${BLUE}Add Package${NC}"
    echo
    echo "6. Run ${BLUE}pod install${NC} in your iOS directory:"
    echo "   ${BLUE}cd ios && pod install${NC}"
    echo
    print_success "After completing these steps, your iOS app will have access to SetgreetSDK!"
    echo
}

# Function to check if Xcode command line tools are available
check_xcode_tools() {
    if command -v xcodebuild &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Main setup function
main() {
    echo "======================================"
    echo "  Setgreet React Native SDK iOS Setup"
    echo "======================================"
    echo
    
    # Check if we're in a React Native project
    check_react_native_project
    
    # Check if SetgreetSDK is already configured
    if check_setgreet_dependency; then
        print_success "SetgreetSDK appears to already be configured in your iOS project!"
        echo
        print_status "If you're having issues, try:"
        echo "1. Clean your project: ${BLUE}cd ios && xcodebuild clean${NC}"
        echo "2. Reinstall pods: ${BLUE}cd ios && pod install${NC}"
        echo "3. Rebuild your project"
        exit 0
    fi
    
    print_status "SetgreetSDK not found in your iOS project"
    echo
    
    # Check if Xcode tools are available
    if ! check_xcode_tools; then
        print_warning "Xcode command line tools not detected"
        print_status "Automatic setup is not available, providing manual instructions..."
        provide_manual_instructions
        exit 0
    fi
    
    print_status "We'll help you set up SetgreetSDK via Swift Package Manager"
    echo
    
    # For now, provide manual instructions as automatic SPM addition via CLI is complex
    print_warning "Automatic SPM package addition requires Xcode GUI"
    provide_manual_instructions
    
    # Future enhancement: Could potentially modify project.pbxproj directly
    # or provide a more sophisticated setup using xcodegen or similar tools
    
    echo
    print_status "💡 Pro tip: You can also add this script to your CI/CD pipeline"
    print_status "📖 For more information, visit: https://docs.setgreet.com/react-native"
}

# Run main function
main "$@"
