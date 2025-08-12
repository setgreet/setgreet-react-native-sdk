module.exports = {
  dependencies: {
    'react-native-setgreet': {
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
