// React Native's Swift Package Manager mode reads the package name from
// `swiftpmConfig` in package.json (0.88 and later). React Native 0.87 reads it
// from here instead, so both forms name the same product that Package.swift
// vends. Without this, 0.87 derives "ReactNativeSdk" from the npm name and
// fails to resolve the package.
module.exports = {
  dependency: {
    platforms: {},
  },
  spm: {
    name: 'RNSetgreet',
  },
};
