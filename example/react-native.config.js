module.exports = {
  dependencies: {
    '@setgreet/react-native-sdk': {
      platforms: {
        android: {
          sourceDir: '../../android',
          packageImportPath:
            'import com.setgreet.reactnative.RNSetgreetPackage;',
        },
      },
    },
  },
};
