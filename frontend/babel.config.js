module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'babel-plugin-transform-import-meta',
      // reanimated v3 plugin MUST be last
      'react-native-reanimated/plugin',
    ],
  };
};
