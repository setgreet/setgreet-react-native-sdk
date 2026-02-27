const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const sdkRoot = path.resolve(__dirname, '..');
const exampleNodeModules = path.resolve(__dirname, 'node_modules');

const config = {
  watchFolders: [sdkRoot],
  resolver: {
    alias: {
      '@setgreet/react-native-sdk': sdkRoot,
    },
    // Prevent duplicate React instances when SDK is symlinked
    nodeModulesPaths: [exampleNodeModules],
    blockList: [new RegExp(path.resolve(sdkRoot, 'node_modules', 'react') + '(/.*|$)'), new RegExp(path.resolve(sdkRoot, 'node_modules', 'react-native') + '(/.*|$)')],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
