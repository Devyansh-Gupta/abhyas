/** @type {import('@types/metro').MetroConfig} */
const { getDefaultConfig } = require('expo/metro-config');
// NOTE: 'nativewind/metro' subpath, NOT the package root — the root entry
// eagerly requires react-native (Flow syntax), which crashes bare Node/Metro setup.
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
// expo-sqlite's web worker imports wa-sqlite.wasm (#8 persistence); SDK 57's
// default assetExts omits 'wasm', which broke `expo export --platform web` (#4 F29).
config.resolver.assetExts.push('wasm');

module.exports = withNativewind(config, { input: './global.css' });
