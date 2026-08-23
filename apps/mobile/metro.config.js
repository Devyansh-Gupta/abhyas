/** @type {import('@types/metro').MetroConfig} */
const { getDefaultConfig } = require('expo/metro-config');
// NOTE: 'nativewind/metro' subpath, NOT the package root — the root entry
// eagerly requires react-native (Flow syntax), which crashes bare Node/Metro setup.
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config, { input: './global.css' });
