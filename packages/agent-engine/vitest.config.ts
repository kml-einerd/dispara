import { defineConfig } from '/home/agdev/dispara/node_modules/vitest/dist/config.js';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@dispara/shared': '/home/agdev/dispara/packages/shared/src/index.ts',
    },
  },
});
