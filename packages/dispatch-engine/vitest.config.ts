export default {
  test: {
    globals: true,
    include: ['src/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@dispara/shared': '/home/agdev/dispara/packages/shared/src/index.ts',
    },
  },
};
