## Development & Publishing

### For Maintainers: Publishing New Versions

This project includes an automated publishing script that handles version management, building, testing, and publishing to npm.

#### Quick Publishing Commands

```bash
# Publish a patch version (bug fixes)
npm run publish:patch

# Publish a minor version (new features)
npm run publish:minor

# Publish a major version (breaking changes)
npm run publish:major

# Interactive publishing with custom version
npm run publish:custom

# Preview what would be published without actually publishing
npm run publish:preview
```

#### Manual Publishing Script Usage

You can also use the publishing script directly with more options:

```bash
# Basic usage (interactive)
./scripts/publish.sh

# Publish specific version
./scripts/publish.sh --version 1.2.3

# Publish with options
./scripts/publish.sh --minor --skip-checks  # Skip linting/type checking
./scripts/publish.sh --patch --skip-git     # Skip git operations
./scripts/publish.sh --preview              # Only preview, don't publish
```

#### Publishing Requirements

Before publishing, ensure:

1. **npm Authentication**: You must be logged in to npm with access to the @setgreet organization
   ```bash
   npm login
   # or set auth token
   npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN
   ```

2. **Clean Git State**: Commit or stash any pending changes

3. **Working Directory**: Run from the project root directory

#### What the Publishing Script Does

1. ✅ Verifies npm authentication and project directory
2. ✅ Checks git status for uncommitted changes
3. ✅ Runs TypeScript type checking
4. ✅ Runs ESLint for code quality
5. ✅ Builds the package using react-native-builder-bob
6. ✅ Updates version in package.json and RNSetgreet.podspec
7. ✅ Previews package contents
8. ✅ Publishes to npm registry
9. ✅ Creates git commit and tag
10. ✅ Pushes changes to repository

#### Troubleshooting Publishing

- **Authentication Error**: Run `npm whoami` to check if you're logged in
- **Version Conflict**: The version you're trying to publish already exists
- **Build Failures**: Check TypeScript errors or linting issues
- **Git Issues**: Ensure you have push access to the repository

For more help, run:
```bash
./scripts/publish.sh --help
```
