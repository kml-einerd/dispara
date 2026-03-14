import '@testing-library/jest-dom/vitest';

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
