import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['packages/*/src/__tests__/*.test.ts', 'tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@dispara/shared': '/home/agdev/dispara/packages/shared/src/index.ts',
    },
  },
});
