// Ensure CJS React picks up development bundles (needed for React.act)
process.env.NODE_ENV = 'test';

import '@testing-library/jest-dom/vitest';

// Enable React act() environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock import.meta.env
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-key',
    VITE_API_URL: 'http://localhost:3001/v1',
    VITE_USE_MOCK: 'true',
    MODE: 'test',
    DEV: true,
    PROD: false,
  },
  writable: true,
});
