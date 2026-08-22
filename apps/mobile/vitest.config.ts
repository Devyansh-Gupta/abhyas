import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // store.ts imports React Native-adjacent modules only via zustand (node-safe)
  },
  resolve: {
    alias: { '@abhyas/engine': new URL('../../packages/engine/src/index.ts', import.meta.url).pathname },
  },
});
