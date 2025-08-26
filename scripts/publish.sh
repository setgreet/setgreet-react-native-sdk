#!/bin/bash

# Setgreet React Native SDK Publishing Script
# This script automates the publishing process for the @setgreet/react-native-sdk package

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

# Function to check if we're in the right directory
check_directory() {
    if [ ! -f "package.json" ] || [ ! -f "RNSetgreet.podspec" ]; then
        print_error "This script must be run from the root of the setgreet-react-native-sdk project"
        exit 1
    fi
}

# Function to check if npm is logged in
check_npm_auth() {
    if ! npm whoami > /dev/null 2>&1; then
        print_error "You are not logged in to npm"
        print_status "Please run 'npm login' or set your npm auth token"
        print_status "To set auth token: npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN"
        exit 1
    fi
    
    local npm_user=$(npm whoami)
    print_success "Logged in to npm as: $npm_user"
}

# Function to check git status
check_git_status() {
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "You have uncommitted changes:"
        git status --short
        echo
        read -p "Do you want to continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Aborting publish"
            exit 1
        fi
    fi
}

# Function to get current version
get_current_version() {
    node -p "require('./package.json').version"
}

# Function to validate version format
validate_version() {
    local version=$1
    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9\-\.]+)?$ ]]; then
        print_error "Invalid version format: $version"
        print_status "Version should follow semantic versioning (e.g., 1.0.0, 1.0.0-beta.1)"
        return 1
    fi
    return 0
}

# Function to update version
update_version() {
    local new_version=$1
    
    if ! validate_version "$new_version"; then
        exit 1
    fi
    
    print_status "Updating version to $new_version..."
    npm version "$new_version" --no-git-tag-version
    
    # Update podspec version
    if [ -f "RNSetgreet.podspec" ]; then
        print_status "Updating podspec version..."
        sed -i '' "s/spec.version[[:space:]]*=[[:space:]]*['\"][^'\"]*['\"]/spec.version = '$new_version'/" RNSetgreet.podspec
    fi
}

# Function to run tests and checks
run_checks() {
    print_status "Running TypeScript checks..."
    if ! npm run typecheck; then
        print_error "TypeScript check failed"
        exit 1
    fi
    
    print_status "Running linter..."
    if ! npm run lint; then
        print_error "Linting failed"
        exit 1
    fi
    
    print_success "All checks passed!"
}

# Function to build the package
build_package() {
    print_status "Building package..."
    if ! npm run prepare; then
        print_error "Build failed"
        exit 1
    fi
    print_success "Package built successfully!"
}

# Function to preview what will be published
preview_package() {
    print_status "Package contents preview:"
    npm pack --dry-run
}

# Function to publish package
publish_package() {
    print_status "Publishing package..."
    if npm publish; then
        print_success "Package published successfully!"
        local version=$(get_current_version)
        print_success "🎉 @setgreet/react-native-sdk@$version is now available!"
        print_status "Install with: npm install @setgreet/react-native-sdk@$version"
    else
        print_error "Publishing failed"
        exit 1
    fi
}

# Function to commit and tag version
commit_and_tag() {
    local version=$1
    
    print_status "Committing version changes..."
    git add package.json RNSetgreet.podspec
    git commit -m "Release $version"
    
    print_status "Creating git tag..."
    git tag "$version"
    
    print_status "Pushing changes and tags..."
    git push origin main
    git push origin "$version"
    
    print_success "Version committed and tagged successfully!"
}

# Function to cleanup on error
cleanup_auth() {
    if [ "$CLEANUP_AUTH" = "true" ]; then
        print_status "Cleaning up auth token..."
        npm config delete //registry.npmjs.org/:_authToken 2>/dev/null || true
    fi
}

# Main publishing function
main() {
    echo "======================================"
    echo "  Setgreet React Native SDK Publisher"
    echo "======================================"
    echo
    
    # Parse command line arguments
    local version_type=""
    local custom_version=""
    local skip_checks=false
    local skip_git=false
    local preview_only=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --version)
                custom_version="$2"
                shift 2
                ;;
            --patch|--minor|--major)
                version_type="${1#--}"
                shift
                ;;
            --skip-checks)
                skip_checks=true
                shift
                ;;
            --skip-git)
                skip_git=true
                shift
                ;;
            --preview)
                preview_only=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --version VERSION    Set specific version (e.g., 1.2.3)"
                echo "  --patch              Increment patch version"
                echo "  --minor              Increment minor version"
                echo "  --major              Increment major version"
                echo "  --skip-checks        Skip linting and type checking"
                echo "  --skip-git           Skip git operations (commit/tag/push)"
                echo "  --preview            Only preview package contents, don't publish"
                echo "  --help, -h           Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0 --patch                 # Increment patch version"
                echo "  $0 --version 1.2.3         # Set specific version"
                echo "  $0 --minor --skip-git      # Increment minor, skip git operations"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                print_status "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Set cleanup trap
    trap cleanup_auth EXIT
    
    # Initial checks
    check_directory
    
    # Skip auth check for preview mode
    if [ "$preview_only" = false ]; then
        check_npm_auth
    fi
    
    if [ "$skip_git" = false ] && [ "$preview_only" = false ]; then
        check_git_status
    fi
    
    # Get current version
    local current_version=$(get_current_version)
    print_status "Current version: $current_version"
    
    # Determine new version
    local new_version=""
    if [ -n "$custom_version" ]; then
        new_version="$custom_version"
    elif [ -n "$version_type" ]; then
        new_version=$(npm version "$version_type" --dry-run --no-git-tag-version | sed 's/^v//')
    else
        echo
        print_status "Select version increment:"
        echo "1) Patch (bug fixes): $current_version -> $(npm version patch --dry-run --no-git-tag-version | sed 's/^v//')"
        echo "2) Minor (new features): $current_version -> $(npm version minor --dry-run --no-git-tag-version | sed 's/^v//')"
        echo "3) Major (breaking changes): $current_version -> $(npm version major --dry-run --no-git-tag-version | sed 's/^v//')"
        echo "4) Custom version"
        echo
        read -p "Choose option (1-4): " -n 1 -r
        echo
        echo
        
        case $REPLY in
            1) new_version=$(npm version patch --dry-run --no-git-tag-version | sed 's/^v//') ;;
            2) new_version=$(npm version minor --dry-run --no-git-tag-version | sed 's/^v//') ;;
            3) new_version=$(npm version major --dry-run --no-git-tag-version | sed 's/^v//') ;;
            4)
                read -p "Enter custom version: " new_version
                ;;
            *)
                print_error "Invalid option"
                exit 1
                ;;
        esac
    fi
    
    print_status "New version will be: $new_version"
    echo
    
    # Confirm before proceeding
    if [ "$preview_only" = false ]; then
        read -p "Continue with publishing? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Aborting publish"
            exit 0
        fi
        echo
    fi
    
    # Update version
    update_version "$new_version"
    
    # Run checks
    if [ "$skip_checks" = false ]; then
        run_checks
    else
        print_warning "Skipping checks as requested"
    fi
    
    # Build package
    build_package
    
    # Preview package
    preview_package
    
    if [ "$preview_only" = true ]; then
        print_status "Preview complete. Package not published."
        exit 0
    fi
    
    echo
    read -p "Proceed with publishing? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Aborting publish"
        exit 0
    fi
    
    # Publish package
    publish_package
    
    # Git operations
    if [ "$skip_git" = false ]; then
        commit_and_tag "$new_version"
    else
        print_warning "Skipping git operations as requested"
        print_status "Don't forget to commit and tag manually:"
        print_status "  git add package.json RNSetgreet.podspec"
        print_status "  git commit -m 'Release $new_version'"
        print_status "  git tag '$new_version'"
        print_status "  git push origin main && git push origin '$new_version'"
    fi
    
    echo
    print_success "🚀 Publishing complete!"
    print_status "Package URL: https://www.npmjs.com/package/@setgreet/react-native-sdk"
}

# Run main function with all arguments
main "$@"
